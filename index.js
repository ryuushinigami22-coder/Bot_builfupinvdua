const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs-extra');
const config = require('./config');
const path = require('path');
const archiver = require('archiver');
const { exec } = require('child_process');

const bot = new TelegramBot(config.botToken, { polling: true });
const dbFile = path.join(__dirname, 'database.json');
const backupDir = path.join(__dirname, 'backups');

// --- SISTEM DATABASE ASYNC (ANTI-DELAY & AUTO-FIX) ---
let db = { users: {}, scripts: [], redeemCodes: {}, maintenance: false };
let dbReady = loadDB();

async function loadDB() {
    try {
        if (await fs.pathExists(dbFile)) {
            const data = await fs.readFile(dbFile, 'utf8');
            if (data.trim().length > 0) {
                const parsed = JSON.parse(data);
                
                // Pastikan struktur dasar ada agar tidak error
                db.users = parsed.users || {};
                db.scripts = Array.isArray(parsed.scripts) ? parsed.scripts : [];
                db.redeemCodes = parsed.redeemCodes || {};
                db.maintenance = parsed.maintenance === true;

                // PERBAIKI DATA NULL & INISIALISASI FITUR BARU
                Object.keys(db.users).forEach(id => {
                    if (db.users[id].coin === null || db.users[id].coin === undefined) {
                        db.users[id].coin = 0;
                    }
                    // Tambahkan baris-baris ini agar fitur baru tidak error:
                    if (!db.users[id].lastClaim) db.users[id].lastClaim = 0;
                    if (db.users[id].isBanned === undefined) db.users[id].isBanned = false;
                    if (db.users[id].isVip === undefined) db.users[id].isVip = false;
                    if (db.users[id].misiSelesai === undefined) db.users[id].misiSelesai = false;
                });
            }
        } else {
            await saveDB();
        }
        console.log("✅ Database Berhasil Dimuat & Diperbaiki");
    } catch (err) {
        console.error("❌ Gagal load database:", err);
        db = { users: {}, scripts: [], redeemCodes: {} };
    }
}

async function saveDB() {
    try {
        // Tulis ke file sementara lalu rename supaya database tidak korup
        // jika proses/panel mati tepat saat penyimpanan.
        const tmpFile = `${dbFile}.tmp`;
        await fs.writeJson(tmpFile, db, { spaces: 2 });
        await fs.move(tmpFile, dbFile, { overwrite: true });
    } catch (err) {
        console.error("❌ Gagal simpan database:", err);
    }
}

async function createFullBackup() {
    await fs.ensureDir(backupDir);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const zipPath = path.join(backupDir, `botocoin-backup-${stamp}.zip`);

    // Pastikan data terbaru ikut masuk ke backup.
    await saveDB();

    await new Promise((resolve, reject) => {
        const output = fs.createWriteStream(zipPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        output.on('close', resolve);
        output.on('error', reject);
        archive.on('error', reject);

        archive.pipe(output);
        // Backup seluruh file project, tetapi jangan masukkan dependency besar,
        // git metadata, atau file backup lama ke dalam zip.
        archive.glob('**/*', {
            cwd: __dirname,
            dot: true,
            ignore: [
                'node_modules/**',
                '.git/**',
                'backups/**',
                '*.zip',
                '*.tmp'
            ]
        });
        archive.finalize();
    });

    return zipPath;
}

// --- NOTIFIKASI CHANNEL ---
function escapeHtml(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;');
}

const links = config.links || {};
const channelLink = (key, fallback = '') => {
    const value = links[key] || fallback;
    if (!value) return '';
    return value.startsWith('http') ? value : `https://t.me/${value.replace(/^@/, '')}`;
};

let botUsernameCache = null;
async function getBotStartUrl() {
    if (!botUsernameCache) {
        const me = await bot.getMe();
        botUsernameCache = me.username;
    }
    return `https://t.me/${botUsernameCache}/start?`;
}

async function getTryButton(text = 'Mau? , Gas Cobain') {
    return {
        inline_keyboard: [[{ text, url: await getBotStartUrl() }]]
    };
}

async function sendNotifMessage(text) {
    return bot.sendMessage(config.notifChannel, text, {
        parse_mode: 'HTML',
        reply_markup: await getTryButton('Mau? , Gas Cobain')
    });
}

async function sendNotifPhoto(photo, caption, buttonText = 'Mau? , Gas Cobain') {
    return bot.sendPhoto(config.notifChannel, photo, {
        caption,
        parse_mode: 'HTML',
        reply_markup: await getTryButton(buttonText)
    });
}

async function notifyNewUser(user) {
    try {
        const name = escapeHtml([user.first_name, user.last_name].filter(Boolean).join(' ') || 'Tanpa Nama');
        const username = user.username ? `@${escapeHtml(user.username)}` : 'Tidak ada username';
        const caption = `<b>🆕 NEW MEMBER!</b>\n\n` +
                        `<blockquote>🎉 Member baru terdeteksi dan berhasil masuk ke bot!</blockquote>\n` +
                        `👤 <b>Nama:</b> ${name}\n` +
                        `🔗 <b>Username:</b> ${username}\n` +
                        `🆔 <b>ID:</b> <code>${user.id}</code>`;

        // Gunakan foto yang sudah ditentukan di config, bukan foto profil member.
        if (config.startImage) {
            await sendNotifPhoto(config.startImage, caption, 'Sekarang waktu mu');
        } else {
            await bot.sendMessage(config.notifChannel, caption, { parse_mode: 'HTML' });
        }
    } catch (err) {
        // Jika foto tidak bisa diambil, tetap usahakan notif teks terkirim.
        console.error('❌ Gagal kirim notif new member:', err.message);
        try {
            const name = escapeHtml([user.first_name, user.last_name].filter(Boolean).join(' ') || 'Tanpa Nama');
            await sendNotifMessage(
                `<b>🆕 NEW MEMBER!</b>\n\n<blockquote>🎉 Member baru terdeteksi!</blockquote>\n👤 <b>Nama:</b> ${name}\n🆔 <b>ID:</b> <code>${user.id}</code>`
            );
        } catch (_) {}
    }
}

// Database dimuat sebelum handler menerima proses utama.
let ownerState = {};

// --- HELPER FUNCTIONS ---
async function checkJoin(userId) {
    // Telegram: status "restricted" does NOT always mean the user left.
    // A restricted user can still be a valid member when is_member === true.
    // Only "left"/"kicked" (or restricted + is_member === false) should fail.
    const chats = [...(config.channels || []), config.group]
        .filter(Boolean)
        .map(chat => String(chat).trim())
        .filter(Boolean);

    if (!chats.length) return true;

    for (const chat of chats) {
        try {
            const member = await bot.getChatMember(chat, userId);
            const status = String(member?.status || '').toLowerCase();

            const isActuallyMember =
                status === 'creator' ||
                status === 'administrator' ||
                status === 'member' ||
                (status === 'restricted' && member?.is_member === true);

            if (!isActuallyMember) {
                return false;
            }
        } catch (e) {
            // If Telegram cannot verify a required chat (private chat, wrong
            // username/ID, or bot lacks permission), fail closed instead of
            // accidentally granting access.
            console.error(`Join check failed for ${chat}:`, e?.message || e);
            return false;
        }
    }

    return true;
}

const mainMenu = (userId) => {
    if (!db.users[userId]) {
        db.users[userId] = { coin: 0, joined: false, refCount: 0 };
        saveDB();
    }

    const user = db.users[userId];
    const saldo = (user.coin || 0).toLocaleString();
    
    const caption = `<b>─〔 ${config.menu.title} 〕─</b>\n\n` +
                    `${config.menu.welcome}, <b>${userId}</b>!\n` +
                    `┣ <b>${config.menu.saldo} :</b> ${saldo} Coins\n` +
                    `┣ <b>${config.menu.referral} :</b> ${user.refCount || 0} Orang\n` +
                    `┗ <b>${config.menu.status} :</b> ${userId === config.ownerId ? 'Owner' : 'Member'}\n\n` +
                    `<blockquote>${config.menu.description}</blockquote>\n` +
                    `<b>${config.menu.divider}</b>`;

    // Ganti bagian let buttons = [ ... ] di dalam fungsi mainMenu kamu:
    let buttons = [
    [{ text: "🛒 Tukar Coin", style: 'primary', callback_data: "tukar_coin" }, { text: "📜 List Script", style: 'success', callback_data: "list_script" }],
    [{ text: "🎁 Klaim Harian", style: 'danger', callback_data: "daily_claim" }, { text: "🎰 Lucky Spin", style: 'primary', callback_data: "lucky_spin" }],
    [{ text: "📦 Mystery Box", style: 'success', callback_data: "gacha_script" }, { text: "🎮 Tebak Angka", style: 'danger', callback_data: "tebak_angka" }],
    [{ text: "📝 Misi Coin", style: 'primary', callback_data: "list_misi" }, { text: "💰 Beli Coin", style: 'success', callback_data: "beli_coin" }],
    [{ text: "💳 Ambil Coin", style: 'danger', callback_data: "referral" }, { text: "🏆 Top Sultan", style: 'primary', callback_data: "leaderboard" }],
    [{ text: "📊 Statistik", style: 'success', callback_data: "bot_stats" }, { text: "💸 Transfer Coin", style: 'danger', callback_data: "transfer_coin" }],
    [{ text: "🆓 Coin Gratis", style: 'primary', callback_data: "coin_gratis" }], // Tombol Baru
    [{ text: "💬 Code Redeem",style: 'success', url: channelLink('redeemChannel') }]
];

    if (userId === config.ownerId) {
        buttons.push([{ text: "⚙️ OWNER DASHBOARD", style: 'danger', callback_data: "owner_menu" }]);
    }

    return {
        caption: caption,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: buttons }
    };
};

// --- HANDLERS TEXT COMMANDS ---

// 1. BROADCAST (KHUSUS OWNER)
bot.onText(/\/bc (.+)/, async (msg, match) => {
    const userId = msg.from.id;
    if (userId !== config.ownerId) return;
    
    const textToBroadcast = match[1];
    const userIds = Object.keys(db.users);
    bot.sendMessage(userId, `🚀 <b>Memulai Broadcast...</b>\nTarget: ${userIds.length} User.`, { parse_mode: 'HTML' });

    let sukses = 0; let gagal = 0;
    for (const id of userIds) {
        try {
            await new Promise(resolve => setTimeout(resolve, 60)); // Delay agar tidak spam
            await bot.sendMessage(id, textToBroadcast, { parse_mode: 'HTML' });
            sukses++;
        } catch (err) { gagal++; }
    }
    bot.sendMessage(userId, `✅ <b>Broadcast Selesai!</b>\n\n🟢 Sukses: ${sukses}\n🔴 Gagal: ${gagal}`, { parse_mode: 'HTML' });
});

// --- FITUR BAN USER (OWNER ONLY) ---
bot.onText(/\/ban (.+)/, async (msg, match) => {
    if (msg.from.id !== config.ownerId) return;
    const targetId = match[1].trim();
    if (!db.users[targetId]) return bot.sendMessage(msg.from.id, "❌ ID tidak ditemukan.");
    
    db.users[targetId].isBanned = true;
    await saveDB();
    bot.sendMessage(msg.from.id, `✅ User <code>${targetId}</code> berhasil di-BANNED.`, { parse_mode: 'HTML' });
    bot.sendMessage(targetId, "🚫 <b>AKUN KAMU DI BANNED!</b>\nKamu tidak bisa lagi menggunakan layanan bot ini.", { parse_mode: 'HTML' }).catch(() => {});
});

// --- FITUR UNBAN USER (OWNER ONLY) ---
bot.onText(/\/unban (.+)/, async (msg, match) => {
    if (msg.from.id !== config.ownerId) return;
    const targetId = match[1].trim();
    if (!db.users[targetId]) return bot.sendMessage(msg.from.id, "❌ ID tidak ditemukan.");
    
    db.users[targetId].isBanned = false;
    await saveDB();
    bot.sendMessage(msg.from.id, `✅ User <code>${targetId}</code> telah di-UNBAN.`, { parse_mode: 'HTML' });
    bot.sendMessage(targetId, "✅ <b>AKUN KEMBALI AKTIF!</b>\nSekarang kamu bisa menggunakan bot lagi.", { parse_mode: 'HTML' }).catch(() => {});
});

// 2. REDEEM CODE USER
bot.onText(/\/redeem (.+)/, async (msg, match) => {
    await dbReady;
    const userId = msg.from.id;
    const inputCode = match[1].trim().toUpperCase();

    // 1. Cek apakah database redeem ada dan kodenya valid
    if (!db.redeemCodes || !db.redeemCodes[inputCode]) {
        return bot.sendMessage(userId, "❌ Kode redeem tidak valid atau sudah kedaluwarsa!");
    }

    const codeData = db.redeemCodes[inputCode];

    // 2. Cek apakah user sudah pernah klaim
    if (codeData.claimedBy.includes(userId)) {
        return bot.sendMessage(userId, "❌ Kamu sudah pernah klaim kode ini!");
    }

    // 3. Cek apakah kuota masih ada
    if (codeData.claimedBy.length >= codeData.limit) {
        // Jika sudah habis tapi masih ada di DB, hapus saja
        delete db.redeemCodes[inputCode];
        await saveDB();
        return bot.sendMessage(userId, "❌ Maaf, kode ini sudah habis diklaim oleh orang lain!");
    }

    // 4. Proses Berikan Hadiah
    if (!db.users[userId]) db.users[userId] = { coin: 0, joined: false, refCount: 0 };
    
    db.users[userId].coin = (db.users[userId].coin || 0) + codeData.reward;
    codeData.claimedBy.push(userId);

    // 5. FITUR AUTO-DELETE: Jika ini adalah orang ke-2 (terakhir), hapus kode dari database
    if (codeData.claimedBy.length >= codeData.limit) {
        delete db.redeemCodes[inputCode];
    }

    await saveDB();

    // Notif redeem berhasil ke channel laporan
    const redeemNotif = `<b>🎁 REDEEM BERHASIL</b>\n\n` +
                        `<blockquote>Seorang member berhasil menukarkan kode redeem.</blockquote>\n` +
                        `👤 <b>User ID:</b> <code>${userId}</code>\n` +
                        `🔑 <b>Kode:</b> <code>${inputCode}</code>\n` +
                        `💰 <b>Hadiah:</b> ${codeData.reward.toLocaleString()} Coins\n` +
                        `👥 <b>Claim:</b> ${codeData.claimedBy.length}/${codeData.limit}`;
    sendNotifMessage(redeemNotif).catch(() => {});

    // Perbaikan pada parse_mode (sebelumnya ada spasi 'par se_mode')
    bot.sendMessage(userId, `🎉 Selamat! Kamu berhasil mendapatkan <b>${codeData.reward.toLocaleString()}</b> koin!`, { parse_mode: 'HTML' });
});

// Menghidupkan Maintenance
bot.onText(/\/maint on/, async (msg) => {
    const userId = msg.from.id;
    if (userId !== config.ownerId) return;

    db.maintenance = true;
    await saveDB();
    bot.sendMessage(userId, "🔴 <b>Maintenance DIAKTIFKAN.</b>\nUser biasa tidak bisa mengakses bot sekarang.", { parse_mode: 'HTML' });
});

// Mematikan Maintenance
bot.onText(/\/maint off/, async (msg) => {
    const userId = msg.from.id;
    if (userId !== config.ownerId) return;

    db.maintenance = false;
    await saveDB();
    bot.sendMessage(userId, "🟢 <b>Maintenance DIMATIKAN.</b>\nBot kembali normal untuk semua user.", { parse_mode: 'HTML' });
});

// 3. START DENGAN REFERRAL
bot.onText(/\/start (.+)/, async (msg, match) => {
    try {
        await dbReady;
        const userId = msg.from.id;
        const referrerId = parseInt(match[1]);

        if (!db.users[userId]) {
            db.users[userId] = { coin: 0, joined: false, refBy: referrerId, refCount: 0 };
            if (referrerId && referrerId != userId && db.users[referrerId]) {
                db.users[referrerId].coin = (db.users[referrerId].coin || 0) + 30000;
                db.users[referrerId].refCount = (db.users[referrerId].refCount || 0) + 1;
                bot.sendMessage(referrerId, `<b>🔔 NOTIFIKASI REFERRAL</b>\n\n<blockquote>Teman bergabung!\n💰 <b>+30.000 Coins</b> ditambahkan.</blockquote>`, { parse_mode: 'HTML' }).catch(() => {});
            }
            await saveDB();
            await notifyNewUser(msg.from);
        }
    } catch (e) { console.error(e); }
});

// 4. START BIASA
bot.onText(/\/start/, async (msg) => {
    try {
        await dbReady;
        const userId = msg.from.id;

        // CEK APAKAH USER DIBAN
        if (db.users[userId] && db.users[userId].isBanned) {
            return bot.sendMessage(userId, "🚫 <b>AKUN KAMU DI BANNED!</b>\nKamu tidak bisa lagi menggunakan layanan bot ini.", { parse_mode: 'HTML' });
        }

        if (!db.users[userId]) {
            db.users[userId] = { coin: 0, joined: false, refCount: 0, lastClaim: 0, isBanned: false };
            await saveDB();
            await notifyNewUser(msg.from);
        }

        const isJoined = await checkJoin(userId);
        
        if (isJoined && !db.users[userId].joined) {
            db.users[userId].coin = (db.users[userId].coin || 0) + 2000;
            db.users[userId].joined = true;
            await saveDB();
            bot.sendMessage(userId, "<b>🎉 WELCOME BONUS!</b>\n<blockquote>Bonus 2.000 koin cair!</blockquote>", { parse_mode: 'HTML' });
        }

        if (!isJoined) {
            return bot.sendMessage(userId, `<b>〔 ⚠️ AKSES TERBATAS 〕</b>\n\n` +
                `Maaf, kamu harus bergabung ke komunitas kami terlebih dahulu untuk menggunakan bot ini.\n\n` +
                `<blockquote>Pastikan sudah join semua channel di bawah, lalu ketik /start Untuk verifikasi.</blockquote>`, {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "📢 Informasi Seputar Bot Coin",style: 'primary', url: channelLink('infoChannel') }],
                        [{ text: "📢 Community Channel",style: 'danger', url: channelLink('communityChannel') }],
                        [{ text: "👥 Public Group",style: 'success', url: channelLink('publicGroup') }],
                        [{ text: "✅ Bukti Penukaran",style: 'primary', url: channelLink('redeemChannel') }]
                    ]
                }
            });
        }

        // --- TAMBAHAN UNTUK WAJIB DAFTAR AKUN ---
        if (!db.users[userId] || !db.users[userId].registered) {
            ownerState[userId] = { step: 'reg_name' }; // Set status ke pendaftaran
            return bot.sendMessage(userId, "👋 <b>SELAMAT DATANG!</b>\n\nKamu belum memiliki akun. Silahkan buat akun terlebih dahulu.\n\n👤 <b>Masukkan Nama kamu:</b>", { parse_mode: 'HTML' });
        }
        // ----------------------------------------

        bot.sendPhoto(userId, config.startImage, mainMenu(userId)).catch(() => {
            bot.sendMessage(userId, mainMenu(userId).caption, { parse_mode: 'HTML', reply_markup: mainMenu(userId).reply_markup });
        });
    } catch (e) { console.error(e); }
});

// Helper: pastikan bot sudah menjadi ADMIN di channel/grup tujuan.
async function isBotAdminInMission(linkTujuan) {
    try {
        const clean = String(linkTujuan).trim().replace(/\/$/, '');
        const parts = clean.split('/');
        const last = parts[parts.length - 1];
        if (!last || last.startsWith('+') || last.toLowerCase() === 'joinchat') return false;

        const chatUsername = `@${last.replace(/^@/, '').split('?')[0]}`;
        const me = await bot.getMe();
        const member = await bot.getChatMember(chatUsername, me.id);
        return member.status === 'administrator' || member.status === 'creator';
    } catch (err) {
        console.error('Gagal cek admin misi:', err.message || err);
        return false;
    }
}

async function broadcastMission(ownerId) {
    const mission = ownerState[ownerId];
    if (!mission || !mission.linkMisi || !mission.reward) return false;

    const reward = Number(mission.reward);
    const linkTujuan = mission.linkMisi;
    const channelUsername = linkTujuan.replace(/\/$/, '').split('/').pop().replace(/^@/, '').split('?')[0];

    const adminReady = await isBotAdminInMission(linkTujuan);
    if (!adminReady) return false;

    await bot.sendMessage(ownerId, "🚀 <b>Bot sudah terdeteksi sebagai ADMIN!</b>\n\nMisi sedang disebarkan ke semua user...", { parse_mode: 'HTML' });

    Object.keys(db.users).forEach(id => {
        bot.sendMessage(id, `📢 <b>MISI BARU: JOIN & EARN</b>\n\nBergabunglah ke channel/grup di bawah ini untuk mendapatkan koin gratis!\n\n💰 <b>Hadiah:</b> ${reward.toLocaleString()} Coin`, {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: "🔗 Gabung Sekarang", url: linkTujuan }],
                    [{ text: "🔄 Refresh Status", style: 'primary', callback_data: `check_join|${channelUsername}|${reward}` }]
                ]
            }
        }).catch(e => console.log("Gagal kirim ke: " + id));
    });

    delete ownerState[ownerId];
    await bot.sendMessage(ownerId, "✅ <b>Misi berhasil disebar!</b>", { parse_mode: 'HTML' });
    return true;
}


// --- CALLBACK QUERY HANDLER ---
bot.on('callback_query', async (query) => {
    try {
        await dbReady;
        const userId = query.from.id;
        const data = query.data;
        const msgId = query.message.message_id;
        bot.answerCallbackQuery(query.id).catch(() => {});
       const state = ownerState[userId] || null;
       if (db.maintenance && userId !== config.ownerId) {
        return bot.answerCallbackQuery(query.id, { 
            text: "🚧 Bot sedang Maintenance!\nSemua fitur tombol dimatikan sementara.", 
            show_alert: true 
        });
    }
       
// Taruh di dalam bot.on('callback_query')
if (data.startsWith('acc_share_')) {
    const targetId = data.split('_')[2];
    if (!db.users[targetId]) return bot.answerCallbackQuery(query.id, { text: "User tidak ditemukan!", show_alert: true });

    db.users[targetId].coin = (db.users[targetId].coin || 0) + 5000;
    await saveDB();

    bot.sendMessage(targetId, "✅ MISI DISETUJUI!\nAdmin telah memverifikasi bukti share kamu.\n+5.000 Coin< telah ditambahkan ke saldo kamu.");
    return bot.editMessageCaption(`✅ <b>MISI BERHASIL (ACC)</b>\nTarget ID: <code>${targetId}</code>\nKoin sudah ditambahkan otomatis.`, {
        chat_id: query.message.chat.id,
        message_id: query.message.message_id,
        parse_mode: 'HTML'
    });
}

if (data.startsWith('tolak_share_')) {
    const targetId = data.split('_')[2];
    bot.sendMessage(targetId, "❌ <b>MISI DITOLAK</b>\nMohon maaf, bukti share kamu tidak valid.");
    return bot.editMessageCaption(`❌ <b>MISI DITOLAK</b>\nUser ID: <code>${targetId}</code> sudah diberitahu.`, {
        chat_id: query.message.chat.id,
        message_id: query.message.message_id,
        parse_mode: 'HTML'
    });
}
// --- SELESAI FITUR AKUN ---

        if (data === "check_join") {
            if (await checkJoin(userId)) {
                bot.deleteMessage(userId, msgId).catch(() => {});
                bot.sendPhoto(userId, config.startImage, mainMenu(userId));
            } else {
                bot.answerCallbackQuery(query.id, { text: "❌ Belum join semua!", show_alert: true });
            }
        }
        
        if (data === "coin_gratis") {
    const promoBot = await bot.getMe();
    const teksPromosi = `🚀 *PENGEN SCRIPT VIP GRATIS?*\n\nAYO CUY TUKAR KOIN MU MENJADI SCRIPT VIP!\n\n🔗 *Link Bot:* @${promoBot.username}\n🎁 *Bonus:* 5.000 Coin buat kamu yang share!`;
    
    const fotoPromosi = `https://files.catbox.moe/zv70sm.jpg`; // Link foto kamu

    // 1. Kirim Foto & Instruksi
    await bot.sendPhoto(userId, fotoPromosi, {
        caption: `<b>💰 MISI SHARE & DAPAT KOIN</b>\n\nShare foto di atas ke grup atau teman kamu dengan teks di bawah ini:\n\n<code>${teksPromosi}</code>\n\n(Klik teks di atas untuk menyalin)\n\n<b>Setelah share, silakan screenshot dan kirim fotonya ke sini!</b>`,
        parse_mode: 'HTML'
    });

    // 2. Aktifkan State nunggu kiriman foto
    ownerState[userId] = { step: 'waiting_bukti_share' };
    
    return bot.sendMessage(userId, "📸 <b>Silahkan kirim FOTO bukti screenshot kamu sekarang:</b>", { parse_mode: 'HTML' });
}

if (data === "refresh_misi_admin" && userId === config.ownerId) {
    const state = ownerState[userId];
    if (!state || state.step !== 'waiting_misi_admin') {
        return bot.answerCallbackQuery(query.id, { text: '❌ Tidak ada misi yang sedang menunggu verifikasi.', show_alert: true });
    }

    const adminReady = await isBotAdminInMission(state.linkMisi);
    if (!adminReady) {
        return bot.answerCallbackQuery(query.id, { text: '❌ Bot belum menjadi admin. Jadikan bot admin lalu refresh lagi.', show_alert: true });
    }

    await bot.answerCallbackQuery(query.id, { text: '✅ Status admin terdeteksi! Misi akan disebar.', show_alert: false });
    return broadcastMission(userId);
}

if (data === "cancel_misi_admin" && userId === config.ownerId) {
    delete ownerState[userId];
    await bot.answerCallbackQuery(query.id, { text: 'Misi dibatalkan.', show_alert: false });
    return bot.editMessageText('❌ <b>Pembuatan misi dibatalkan.</b>', { chat_id: userId, message_id: msgId, parse_mode: 'HTML' }).catch(() => {});
}

if (data === "create_misi_ads") {
    ownerState[userId] = { step: 'create_misi_link' };
    return bot.sendMessage(userId, "🔗 <b>MASUKKAN LINK MISI</b>\n\nSilahkan kirim link Channel atau Grup yang ingin dipromosikan.\nContoh: <code>https://t.me/NamaChannelmu</code>", { parse_mode: 'HTML' });
}

if (data.startsWith('check_join|')) {
    const [_, channel, reward] = data.split('|');
    const rewardAmount = parseInt(reward);

    try {
        // PENTING: Bot harus jadi ADMIN di channel/grup tersebut
        const chatMember = await bot.getChatMember(`@${channel}`, userId);
        const status = chatMember.status;

        // Cek apakah statusnya adalah member, admin, atau owner
        if (status === 'member' || status === 'administrator' || status === 'creator') {
            
            // 1. Tambah koin ke database
            db.users[userId].coin += rewardAmount;
            await saveDB();

            // 2. Notifikasi sukses (Popup)
            await bot.answerCallbackQuery(query.id, { text: `🎉 Berhasil! +${rewardAmount} Koin masuk.`, show_alert: true });

            // 3. Edit pesan agar tombol hilang (mencegah double claim)
            return bot.editMessageText(`✅ <b>MISI SELESAI</b>\n\nKamu sudah bergabung ke channel dan mendapatkan <b>${rewardAmount.toLocaleString()}</b> koin.`, {
                chat_id: userId,
                message_id: query.message.message_id,
                parse_mode: 'HTML'
            });
        } else {
            // Jika statusnya 'left' atau bukan member
            return bot.answerCallbackQuery(query.id, { text: "❌ Kamu belum join! Silahkan join dulu baru klik tombol ini.", show_alert: true });
        }
    } catch (err) {
        console.error(err);
        return bot.answerCallbackQuery(query.id, { text: "⚠️ Gagal cek status! Pastikan Bot sudah menjadi ADMIN di channel tujuan.", show_alert: true });
    }
}
        
        // --- FITUR MISI KOIN ---
if (data === "list_misi") {
    const txtMisi = `<b>📝 MISI KOIN GRATIS</b>\n\n` +
                    `Selesaikan misi di bawah ini untuk mendapatkan koin tambahan:\n\n` +
                    `1. Join Channel 1\n` +
                    `🎁 Hadiah: <b>5..000 Koin</b>\n\n` +
                    `2. Join Channel 2\n` +
                    `🎁 Hadiah: <b>5.000 Koin</b>\n\n` +
                    `3. Join Channel 2\n` +
                    `🎁 Hadiah: <b>5.000 Koin</b>\n\n` +
                    `4. Join Channel 2\n` +
                    `🎁 Hadiah: <b>5.000 Koin</b>\n\n` +
                    `<i>Klik tombol di bawah untuk mengambil hadiah misi!</i>`;
    
    bot.editMessageCaption(txtMisi, {
        chat_id: userId,
        message_id: msgId,
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [{ text: "📢 Join",style: 'primary', url: channelLink('infoChannel') }],
                [{ text: "📢 Join",style: 'danger', url: channelLink('communityChannel') }],
                [{ text: "📢 Join",style: 'success', url: channelLink('redeemChannel') }],
                [{ text: "📢 Join",style: 'primary', url: channelLink('publicGroup') }],
                [{ text: "✅ Ambil Hadiah", style: 'success', callback_data: "claim_misi" }],
                [{ text: "⬅️ Kembali", style: 'danger', callback_data: "back_home" }]
            ]
        }
    });
}

if (data === "claim_misi") {
    // Pengecekan apakah user benar-benar sudah join semua channel
    const isJoined = await checkJoin(userId);
    
    if (isJoined) {
        // Cek apakah user sudah pernah ambil misi ini sebelumnya
        if (db.users[userId].misiSelesai) {
            // PERBAIKAN: Ganti q.id jadi query.id
            return bot.answerCallbackQuery(query.id, { text: "❌ Kamu sudah mengambil hadiah misi ini!", show_alert: true });
        }

        db.users[userId].coin += 5000; 
        db.users[userId].misiSelesai = true; 
        await saveDB();

        bot.sendMessage(userId, "<b>🎉 MISI SELESAI!</b>\n+5.000 koin telah ditambahkan ke Akun kamu.", { parse_mode: 'HTML' });
        bot.editMessageCaption(mainMenu(userId).caption, { chat_id: userId, message_id: msgId, ...mainMenu(userId) });
    } else {
        // PERBAIKAN: Ganti q.id jadi query.id
        bot.answerCallbackQuery(query.id, { text: "❌ Kamu belum join semua channel di atas!", show_alert: true });
    }
}
        
        // --- FITUR GAME TEBAK ANGKA ---
if (data === "tebak_angka") {
    const txtGame = `<b>🎮 GAME TEBAK ANGKA</b>\n\n` +
                    `Pilih satu angka dari 1 - 5.\n` +
                    `┣ 💰 Biaya Main : 1.000 Koin\n` +
                    `┗ 🎁 Hadiah : 5.000 Koin\n\n` +
                    `<i>Jika tebakanmu sama dengan angka Bot, kamu menang!</i>`;
    
    bot.editMessageCaption(txtGame, {
        chat_id: userId,
        message_id: msgId,
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [{ text: "1", style: 'primary', callback_data: "bet_1" }, { text: "2", style: 'success', callback_data: "bet_2" }, { text: "3", style: 'danger', callback_data: "bet_3" }],
                [{ text: "4", style: 'primary', callback_data: "bet_4" }, { text: "5", style: 'success', callback_data: "bet_5" }],
                [{ text: "⬅️ Kembali", style: 'danger', callback_data: "back_home" }]
            ]
        }
    });
}

// Logika Hasil Tebakan
if (data.startsWith('bet_')) {
    const userGuess = parseInt(data.split('_')[1]);
    const biaya = 1000;

    if (db.users[userId].coin < biaya) {
        return bot.answerCallbackQuery(query.id, { text: "❌ Koin kamu kurang 1.000!", show_alert: true });
    }

    // Kurangi koin user
    db.users[userId].coin -= biaya;
    
    // Bot mengacak angka pemenang (1-5)
    const botNumber = Math.floor(Math.random() * 5) + 1;
    
    let resultTxt = "";
    if (userGuess === botNumber) {
        const hadiah = 5000;
        db.users[userId].coin += hadiah;
        resultTxt = `🎉 <b>MENANG JACKPOT!</b>\n\n` +
                    `🤖 Angka Bot: <b>${botNumber}</b>\n` +
                    `👤 Tebakanmu: <b>${userGuess}</b>\n\n` +
                    `Selamat! Tebakanmu tepat. Kamu mendapatkan <b>5.000 Koin</b>!`;
    } else {
        resultTxt = `💀 <b>ZONK / KALAH</b>\n\n` +
                    `🤖 Angka Bot: <b>${botNumber}</b>\n` +
                    `👤 Tebakanmu: <b>${userGuess}</b>\n\n` +
                    `Yah... tebakanmu salah. Angka yang benar adalah <b>${botNumber}</b>.\n` +
                    `Koin 1.000 kamu hangus. Coba lagi!`;
    }

    await saveDB();
    bot.editMessageCaption(resultTxt, {
        chat_id: userId,
        message_id: msgId,
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [{ text: "🎮 Main Lagi", style: 'success', callback_data: "tebak_angka" }],
                [{ text: "⬅️ Menu Utama", style: 'danger', callback_data: "back_home" }]
            ]
        }
    });
}
        
        // --- FITUR MYSTERY BOX (GACHA) ---
if (data === "gacha_script") {
    // Biaya gacha: 10.000 koin (bisa kamu ganti harganya di sini)
    const biayaGacha = 10000;

    if (db.users[userId].coin < biayaGacha) {
        return bot.answerCallbackQuery(query.id, { text: "❌ Koin kamu kurang 10.000!", show_alert: true });
    }

    if (db.scripts.length === 0) {
        return bot.answerCallbackQuery(query.id, { text: "❌ Belum ada script di dalam box.", show_alert: true });
    }

    // Proses Gacha
    db.users[userId].coin -= biayaGacha;
    
    // Pilih script secara acak
    const scriptAcak = db.scripts[Math.floor(Math.random() * db.scripts.length)];
    
    await saveDB();

    bot.answerCallbackQuery(query.id, { text: "🌀 Memutar Mystery Box...", show_alert: false });

    // Kirim animasi loading sederhana dulu
    bot.editMessageCaption("🌀 <b>SEDANG MENGACAK BOX...</b>", { chat_id: userId, message_id: msgId, parse_mode: 'HTML' });

    setTimeout(() => {
        bot.sendDocument(userId, scriptAcak.fileId, {
            caption: `<b>📦 MYSTERY BOX BERHASIL DIBUKA!</b>\n\n` +
                     `Selamat! Kamu mendapatkan:\n` +
                     `📂 Script: <b>${scriptAcak.name}</b>\n` +
                     `💰 Harga Asli: ${scriptAcak.price.toLocaleString()} Koin\n\n` +
                     `<i>Keberuntungan berpihak padamu!</i>`,
            parse_mode: 'HTML'
        });

        // Notif ke channel bukti
        sendNotifMessage(`📦 <b>GACHA BOX</b>\nUser: <code>${userId}</code>\nHadiah: ${scriptAcak.name}`).catch(() => {});
        
        // Kembalikan ke menu utama
        bot.sendMessage(userId, mainMenu(userId).caption, mainMenu(userId));
    }, 3000); // Delay 3 detik biar seru
}
        
        // --- FITUR BELI COIN ---
if (data === "beli_coin") {
    const textBeli = `<b>💎 TOP UP COIN SCRIPT</b>\n\n` +
                     `Silahkan pilih paket koin yang ingin kamu beli:\n\n` +
                     `┣ 🔴 10.000 Koin = Rp 2.000\n` +
                     `┣ 🟠 20.000 Koin = Rp 4.000\n` +
                     `┣ 🟡 30.000 Koin = Rp 6.000\n` +
                     `┣ 🔵 40.000 Koin = Rp 8.000\n` +
                     `┗ 🟢 50.000 Koin = Rp 10.000\n\n` +
                     `<i>Klik tombol di bawah untuk instruksi pembayaran.</i>`;
    
    bot.editMessageCaption(textBeli, {
        chat_id: userId,
        message_id: msgId,
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [{ text: "💳 Bayar Sekarang", style: 'success', callback_data: "bayar_koin" }],
                [{ text: "⬅️ Kembali", style: 'danger', callback_data: "back_home" }]
            ]
        }
    });
}

if (data === "bayar_koin") {
    const textBayar = `<b>📸 PROSES PEMBAYARAN</b>\n\n` +
                      `1. Scan QRIS di atas atau transfer ke DANA.\n` +
                      `2. <b>DANA:</b> <code>089517848185</code>\n` +
                      `3. Sertakan bukti transfer & <b>ID: ${userId}</b>.\n` +
                      `4. Kirim bukti ke Owner: ${config.ownerUsername || 'Owner'}\n\n` +
                      `<blockquote>Koin akan diproses manual oleh owner setelah bukti transfer dicek.</blockquote>`;

    bot.sendPhoto(userId, "https://files.catbox.moe/9syrwi.jpg", {
        caption: textBayar,
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [{ text: "👨‍💻 Hubungi Owner", url: config.ownerContact }],
                [{ text: "⬅️ Kembali", style: 'danger', callback_data: "beli_coin" }]
            ]
        }
    });
}

        if (data === "transfer_coin") {
            ownerState[userId] = { step: 'tf_id' };
            bot.sendMessage(userId, "👤 <b>TRANSFER KOIN</b>\n\nMasukkan ID user tujuan:");
        }

        if (data === "referral") {
            const botInfo = await bot.getMe();
            bot.editMessageCaption(`<b>───〔 👥 REFERRAL 〕───</b>\n\n🔗 <b>Link :</b> <code>https://t.me/${botInfo.username}?start=${userId}</code>\n👥 <b>Total :</b> ${db.users[userId].refCount || 0} Orang`, {
                chat_id: userId, message_id: msgId, parse_mode: 'HTML',
                reply_markup: { inline_keyboard: [[{ text: "⬅️ Kembali", callback_data: "back_home" }]] }
            });
        }

        if (data === "leaderboard") {
            const topUsers = Object.entries(db.users).sort(([, a], [, b]) => (b.coin || 0) - (a.coin || 0)).slice(0, 10);
            let text = "<b>🏆 TOP 10 SULTAN KOIN</b>\n\n";
            topUsers.forEach(([id, data], index) => {
                text += `${index + 1}. ID: <code>${id}</code> — 💰 <b>${(data.coin || 0).toLocaleString()}</b>\n`;
            });
            bot.editMessageCaption(text, { chat_id: userId, message_id: msgId, parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: "⬅️ Kembali", callback_data: "back_home" }]] } });
        }

        if (data === "bot_stats") {
            const totalUsers = Object.keys(db.users).length;
            bot.editMessageCaption(`<b>📊 STATISTIK BOT</b>\n\n┣ 👥 Total User: ${totalUsers}\n┗ 📂 Script: ${db.scripts.length}`, { chat_id: userId, message_id: msgId, parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: "⬅️ Kembali", callback_data: "back_home" }]] } });
        }

        if (data === "list_script" || data === "tukar_coin" || data.startsWith("page_")) {
            if (db.scripts.length === 0) return bot.answerCallbackQuery(query.id, { text: "Kosong!", show_alert: true });

            // 1. Logika Halaman
            const page = data.startsWith("page_") ? parseInt(data.split("_")[1]) : 0;
            const perPage = 5; 
            const start = page * perPage;
            const end = start + perPage;
            const items = db.scripts.slice(start, end);

            // 2. Buat Tombol Script (Gunakan Index Asli supaya buy_ tetap benar)
            let buttons = items.map((s, index) => [
                { text: `📂 ${s.name} [ ${s.price.toLocaleString()} ]`, callback_data: `buy_${start + index}` }
            ]);

            // 3. Tombol Navigasi Sejajar (Back, Home, Next)
            let navRow = [];
            
            // Tombol Back
            if (page > 0) {
                navRow.push({ text: "⬅️ Back", style: 'danger', callback_data: `page_${page - 1}` });
            } else {
                navRow.push({ text: "⬛", style: 'success', callback_data: "none" }); // Placeholder
            }

            // Tombol Home
            navRow.push({ text: "🏠 HOME", style: 'danger', callback_data: "back_home" });

            // Tombol Next
            if (end < db.scripts.length) {
                navRow.push({ text: "Next ➡️", style: 'success', callback_data: `page_${page + 1}` });
            } else {
                navRow.push({ text: "⬛", style: 'primary', callback_data: "none" }); // Placeholder
            }

            buttons.push(navRow);

            bot.editMessageCaption(`<b>📂 LIST SCRIPT (Hal: ${page + 1})</b>\n\nPilih script yang ingin ditukar:`, { 
                chat_id: userId, 
                message_id: msgId, 
                parse_mode: 'HTML', 
                reply_markup: { inline_keyboard: buttons } 
            }).catch(() => {});
        }

        if (data.startsWith('buy_')) {
            const index = data.split('_')[1]; const script = db.scripts[index];
            if (db.users[userId].coin < script.price) return bot.answerCallbackQuery(query.id, { text: "❌ Koin tidak cukup!", show_alert: true });
            
            db.users[userId].coin -= script.price;
            await saveDB();
            
            await bot.sendDocument(userId, script.fileId, { 
                caption: `<b>✅ PENUKARAN BERHASIL</b>\n\n┣ 📂 <b>Nama:</b> ${script.name}\n┗ 💸 <b>Harga:</b> ${script.price.toLocaleString()} Coins`, 
                parse_mode: 'HTML' 
            }).catch(() => {});

            sendNotifMessage(`<b>🚀 LOG PENUKARAN</b>\n<blockquote>👤 User: <code>${userId}</code>\n📂 Script: ${escapeHtml(script.name)}\n💰 Harga: ${script.price.toLocaleString()}</blockquote>`).catch(() => {});
            bot.answerCallbackQuery(query.id, { text: "✅ Berhasil!", show_alert: true });
        }

// FITUR KLAIM HARIAN
    if (data === "daily_claim") {
        const now = Date.now();
        const last = db.users[userId].lastClaim || 0;
        if (now - last < 86400000) {
            const sisa = 86400000 - (now - last);
            const jam = Math.floor(sisa / (1000 * 60 * 60));
            return bot.answerCallbackQuery(query.id, { text: `⏳ Tunggu ${jam} jam lagi!`, show_alert: true });
        }
        db.users[userId].coin += 5000;
        db.users[userId].lastClaim = now;
        await saveDB();
        bot.answerCallbackQuery(query.id, { text: "🎉 +5.000 Koin Harian!", show_alert: true });
        bot.editMessageCaption(mainMenu(userId).caption, { chat_id: userId, message_id: msgId, ...mainMenu(userId) });
    }

    // FITUR LUCKY SPIN
    if (data === "lucky_spin") {
        if (db.users[userId].coin < 2000) return bot.answerCallbackQuery(query.id, { text: "❌ Butuh 500 koin!", show_alert: true });
        db.users[userId].coin -= 2000;
        const r = Math.random();
        let win = 0; let txt = "💀 Zonk!";
        if (r > 0.9) { win = 5000; txt = "🔥 JACKPOT 5.000!"; }
        else if (r > 0.6) { win = 3000; txt = "🎉 MENANG 3.000!"; }
        else if (r > 0.3) { win = 2000; txt = "⚖️ Balik Modal!"; }
        db.users[userId].coin += win;
        await saveDB();
        bot.answerCallbackQuery(query.id, { text: txt, show_alert: true });
        bot.editMessageCaption(mainMenu(userId).caption, { chat_id: userId, message_id: msgId, ...mainMenu(userId) });
    }
    
        if (data === "back_home") {
            bot.editMessageCaption(mainMenu(userId).caption, { chat_id: userId, message_id: msgId, parse_mode: 'HTML', reply_markup: mainMenu(userId).reply_markup });
        }

        // OWNER DASHBOARD (VERSI UPDATE DENGAN RESET)
        if (data === "owner_menu" && userId === config.ownerId) {
            bot.editMessageCaption(`<b>──〔 🛠 OWNER DASHBOARD 〕───</b>\n\nSelamat datang Owner! Gunakan menu di bawah untuk mengelola database bot kamu.`, {
                chat_id: userId, 
                message_id: msgId, 
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
            [{ text: "➕ Tambah Script", style: 'primary', callback_data: "add_script" }, { text: "🗑 Hapus Script", style: 'success', callback_data: "del_script" }],
            [{ text: "💰 Koin Per User", style: 'danger', callback_data: "add_coin_user" }, { text: "🎁 Buat Redeem", style: 'primary', callback_data: "create_redeem" }],
            [{ text: "📢 Buat Misi Join", style: 'success', callback_data: "create_misi_ads" }, { text: "📥 Backup Database", style: 'danger', callback_data: "backup_db" }],
            [{ text: "♻️ Update Database", style: 'primary', callback_data: "update_database" }],
            [{ text: "🔥 RESET DATABASE", style: 'success', callback_data: "ask_reset" }],
            [{ text: "⬅️ Kembali", style: 'danger', callback_data: "back_home" }]
        ]
                }
            });
        }

// --- FITUR RESET DATABASE (OWNER ONLY) ---

// Tahap 1: Tanya Konfirmasi
if (data === "ask_reset" && userId === config.ownerId) {
    bot.editMessageCaption(`<b>⚠️ PERINGATAN KERAS!</b>\n\nApakah kamu yakin ingin menghapus <b>SEMUA DATA</b>? (User, Koin, Script, & Redeem).\n\n<i>Tindakan ini tidak dapat dibatalkan!</i>`, {
        chat_id: userId,
        message_id: msgId,
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [{ text: "✅ YA, HAPUS SEMUA", style: 'success', callback_data: "confirm_reset_all" }],
                [{ text: "❌ BATALKAN", style: 'danger', callback_data: "owner_menu" }]
            ]
        }
    });
}

// Tahap 2: Eksekusi Reset
if (data === "confirm_reset_all" && userId === config.ownerId) {
    // Reset variabel db ke struktur awal
    db = { 
        users: {}, 
        scripts: [], 
        redeemCodes: {} 
    };
    
    // Simpan ke file database.json
    await saveDB();

    bot.answerCallbackQuery(query.id, { text: "💥 Database telah dikosongkan!", show_alert: true });
    
    // Kirim pesan start baru agar database user owner terbuat kembali otomatis
    bot.sendMessage(userId, "✅ <b>RESET SUKSES!</b>\nDatabase sekarang kosong. Silahkan ketik /start untuk mendaftarkan ulang akun owner kamu.", { parse_mode: 'HTML' });
}
        if (data === "backup_db" && userId === config.ownerId) {
            try {
                await bot.answerCallbackQuery(query.id, { text: "⏳ Membuat backup semua file..." });
                const zipPath = await createFullBackup();
                await bot.sendDocument(userId, zipPath, {
                    caption: "📦 <b>FULL BACKUP BOT</b>\n\nSemua file project + database sudah dikemas ke ZIP.\nBackup ini bisa dipakai untuk restore saat pindah/reinstall panel.",
                    parse_mode: 'HTML'
                });
                await fs.remove(zipPath);
            } catch (err) {
                console.error("❌ Gagal membuat backup:", err);
                await bot.sendMessage(userId, "❌ Gagal membuat backup ZIP. Cek log panel untuk detail error.");
            }
        }

        if (data === "update_database" && userId === config.ownerId) {
            ownerState[userId] = { step: 'waiting_database_file' };
            return bot.sendMessage(userId, "♻️ <b>UPDATE DATABASE</b>\n\nSilahkan kirim file <code>database.json</code> yang baru.\n\n⚠️ Database lama akan diganti sepenuhnya, lalu bot akan otomatis restart.", { parse_mode: 'HTML' });
        }

        if (data === "create_redeem" && userId === config.ownerId) {
            ownerState[userId] = { step: 'rd_code' };
            bot.sendMessage(userId, "🎁 <b>BUAT REDEEM</b>\nMasukkan Kode (Contoh: ara2026):");
        }

        if (data === "add_coin_user" && userId === config.ownerId) {
            ownerState[userId] = { step: 'waiting_user_id' };
            bot.sendMessage(userId, "👤 Masukkan ID Target:");
        }

        if (data === "add_script" && userId === config.ownerId) {
    ownerState[userId] = { 
        step: 'waiting_file', 
        tempFiles: [] // Wajib ada ini supaya tidak error
    };
    bot.sendMessage(userId, "📤 Silahkan kirim semua file script sekaligus.\n\nJika sudah selesai, ketik: <b>DONE</b>", { parse_mode: 'HTML' });
}

        if (data === "del_script" && userId === config.ownerId) {
            let buttons = db.scripts.map((s, index) => [{ text: `🗑 Hapus: ${s.name}`, style: 'danger', callback_data: `confirm_del_${index}` }]);
            buttons.push([{ text: "⬅️ Batal", style: 'primary', callback_data: "owner_menu" }]);
            bot.editMessageCaption(`🗑 Hapus yang mana?`, { chat_id: userId, message_id: msgId, reply_markup: { inline_keyboard: buttons } });
        }

        if (data.startsWith('confirm_del_') && userId === config.ownerId) {
            const index = data.split('_')[2];
            db.scripts.splice(index, 1);
            await saveDB();
            bot.sendMessage(userId, "✅ Terhapus.");
        }
    } catch (e) { console.error(e); }
});

// --- STATE MESSAGES (UNTUK PROSES INPUT) ---
bot.on('message', async (msg) => {
    try {
        await dbReady;
        const userId = msg.from.id;
        const text = msg.text;

        // --- 1. TAMBAHKAN SATPAM MAINTENANCE DI SINI ---
        if (db.maintenance && userId !== config.ownerId) {
            // Jika user mengetik /maint off (untuk owner), jangan diblokir
            if (text === '/maint off') return; 

            return bot.sendMessage(userId, "🚧 <b>BOT SEDANG MAINTENANCE</b>\n\nSabar ya, bot lagi diperbaiki agar lebih kencang! Coba lagi nanti.", { parse_mode: 'HTML' });
        }

        const state = ownerState[userId] || null;

        // --- 2. KODE ON/OFF (Taruh di bawah state agar bisa diproses) ---
        if (text === '/maint on' && userId === config.ownerId) {
            db.maintenance = true;
            await saveDB();
            return bot.sendMessage(userId, "🔴 <b>Maintenance DIAKTIFKAN!</b>");
        }
        if (text === '/maint off' && userId === config.ownerId) {
            db.maintenance = false;
            await saveDB();
            return bot.sendMessage(userId, "🟢 <b>Maintenance DIMATIKAN!</b>");
        }

        // ... Sisa kode kamu yang lain (isJoined, Pendaftaran, dll) ...

    // --- LOGIKA PENANGKAP NAMA & PASSWORD ---
    if (state) {
        // Jika user sedang di tahap input NAMA
        if (state.step === 'reg_name' && text) {
            ownerState[userId] = { step: 'reg_pass', name: text }; // Simpan nama sementara di state
            return bot.sendMessage(userId, `👤 Nama diterima: <b>${text}</b>\n\nSekarang masukkan <b>Password</b> untuk akun kamu:`, { parse_mode: 'HTML' });
        } 
        
        // Jika user sedang di tahap input PASSWORD
        if (state.step === 'reg_pass' && text) {
            // Simpan data permanen ke Database
            db.users[userId] = {
                registered: true,
                nama: state.name,
                password: text,
                coin: 0
            };
            
            await saveDB(); // Pastikan fungsi saveDB kamu jalan
            delete ownerState[userId]; // Hapus state karena pendaftaran selesai

            return bot.sendMessage(userId, `✅ <b>AKUN BERHASIL DIBUAT!</b>\n\n👤 Nama: <code>${state.name}</code>\n🔑 Pass: <code>${text}</code>`, {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [[{ text: "🚀 BOT INFO", url: channelLink('infoChannel') }]]
                }
            });
        }
    }
    
    if (state) {
    // Tahap 1: Menangkap Foto Bukti
    if (state.step === 'waiting_bukti_share') {
        if (!msg.photo) return bot.sendMessage(userId, "❌ Kirim dalam bentuk <b>FOTO</b> (Screenshot)!", { parse_mode: 'HTML' });
        
        state.fotoBukti = msg.photo[msg.photo.length - 1].file_id; 
        state.step = 'waiting_id_gratis';
        return bot.sendMessage(userId, "✅ Bukti diterima! Sekarang masukkan ID Akun kamu:");
    }

    // Tahap 2: Menangkap ID & Kirim ke Owner (Update: Ditambah Tombol ACC Otomatis)
    if (state.step === 'waiting_id_gratis' && text) {
        const userTargetId = text.trim();
        
        // Kirim Laporan ke Kamu (Owner) dengan Inline Keyboard
        await bot.sendPhoto(config.ownerId, state.fotoBukti, {
            caption: `<b>🚨 LAPORAN MISI COIN GRATIS</b>\n\n👤 Pengirim: <code>${userId}</code>\n🆔 ID Target: <code>${userTargetId}</code>\n💰 Reward: 5.000 Coin`,
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: "✅ ACC (Auto Tambah)", style: 'success', callback_data: `acc_share_${userTargetId}` },
                        { text: "❌ TOLAK", style: 'danger', callback_data: `tolak_share_${userTargetId}` }
                    ]
                ]
            }
        });

        delete ownerState[userId]; // Selesai
        return bot.sendMessage(userId, "✅ <b>Bukti Berhasil Dikirim ke Owner!</b>\n\nSilahkan Tunggu 1-5 menit. Owner akan mengecek dan koin akan masuk otomatis jika bukti valid.", {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: [[{ text: "🏠 Kembali ke Menu", style: 'danger', callback_data: "back_home" }]] }
        });
    }
}

// TAHAP 1: Menangkap Link
if (state && state.step === 'create_misi_link' && userId === config.ownerId) {
    if (!text || !text.includes('t.me/')) {
        return bot.sendMessage(userId, "❌ Link tidak valid! Kirim link channel/grup (Contoh: https://t.me/username)");
    }
    state.linkMisi = text;
    state.step = 'create_misi_reward';
    return bot.sendMessage(userId, "💰 <b>Berapa hadiah coin untuk misi ini?</b>\nKirim dalam bentuk angka saja.", { parse_mode: 'HTML' });
}

// TAHAP 2: Menangkap Reward, lalu WAJIB cek bot sudah ADMIN sebelum broadcast.
if (state && state.step === 'create_misi_reward' && userId === config.ownerId) {
    const reward = parseInt(text);
    if (isNaN(reward) || reward <= 0) return bot.sendMessage(userId, "❌ Masukkan jumlah coin yang valid! (Contoh: 5000)");

    state.reward = reward;
    state.step = 'waiting_misi_admin';

    const linkTujuan = state.linkMisi;
    const adminReady = await isBotAdminInMission(linkTujuan);

    if (!adminReady) {
        return bot.sendMessage(userId,
            `⚠️ <b>BOT BELUM MENJADI ADMIN</b>\n\n` +
            `Sebelum misi disebarkan, jadikan bot ini <b>ADMIN</b> di channel/grup tersebut.\n\n` +
            `🔗 Target: <code>${escapeHtml(linkTujuan)}</code>\n\n` +
            `Setelah bot sudah menjadi admin, tekan tombol <b>Refresh Status</b>.`,
            {
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard: [
                    [{ text: '🔄 Refresh Status', style: 'primary', callback_data: 'refresh_misi_admin' }],
                    [{ text: '❌ Batal', style: 'danger', callback_data: 'cancel_misi_admin' }]
                ]}
            }
        );
    }

    await broadcastMission(userId);
}

        if (state) {
        // LOGIKA TRANSFER USER
        if (state.step === 'tf_id' && msg.text) {
            const targetId = msg.text.trim();
            if (targetId == userId) return bot.sendMessage(userId, "❌ Tidak bisa transfer ke diri sendiri!");
            if (!db.users[targetId]) return bot.sendMessage(userId, "❌ ID User tidak ditemukan!");
            state.targetId = targetId; state.step = 'tf_amount';
            bot.sendMessage(userId, `💰 Masukkan jumlah koin untuk ID ${targetId}:`);
        } else if (state.step === 'tf_amount' && msg.text) {
            const amount = parseInt(msg.text.replace(/\./g, ''));
            if (isNaN(amount) || amount < 100) return bot.sendMessage(userId, "❌ Minimal transfer 100!");
            if ((db.users[userId].coin || 0) < amount) return bot.sendMessage(userId, "❌ Koin tidak cukup!");
            
            db.users[userId].coin -= amount;
            db.users[state.targetId].coin = (db.users[state.targetId].coin || 0) + amount;
            await saveDB();
            bot.sendMessage(userId, "✅ Transfer Sukses!");
            bot.sendMessage(state.targetId, `📩 Terima ${amount.toLocaleString()} koin dari ${userId}`);
            delete ownerState[userId];
        }

        // --- UPDATE DATABASE DARI FILE YANG DIKIRIM OWNER ---
    if (state && state.step === 'waiting_database_file' && userId === config.ownerId) {
        if (!msg.document) {
            return bot.sendMessage(userId, "❌ Kirim file <code>database.json</code> sebagai document.", { parse_mode: 'HTML' });
        }

        const fileName = (msg.document.file_name || '').toLowerCase();
        if (fileName !== 'database.json') {
            return bot.sendMessage(userId, "❌ File harus bernama <code>database.json</code>.", { parse_mode: 'HTML' });
        }

        const tempDir = path.join(__dirname, 'backups', 'restore-temp');
        await fs.ensureDir(tempDir);
        const tempDb = path.join(tempDir, 'database.json');

        try {
            const downloadedPath = await bot.downloadFile(msg.document.file_id, tempDir);
            const raw = await fs.readFile(downloadedPath, 'utf8');
            const parsed = JSON.parse(raw);

            if (!parsed || typeof parsed !== 'object' || typeof parsed.users !== 'object' || !Array.isArray(parsed.scripts) || typeof parsed.redeemCodes !== 'object') {
                throw new Error('Struktur database.json tidak valid.');
            }

            const safeDb = {
                users: parsed.users || {},
                scripts: Array.isArray(parsed.scripts) ? parsed.scripts : [],
                redeemCodes: parsed.redeemCodes || {},
                maintenance: parsed.maintenance === true
            };

            await fs.writeJson(tempDb, safeDb, { spaces: 2 });
            await fs.move(tempDb, dbFile, { overwrite: true });
            db = safeDb;
            await fs.remove(tempDir);
            delete ownerState[userId];

            await bot.sendMessage(userId, "✅ <b>DATABASE BERHASIL DIUPDATE!</b>\n\nDatabase lama sudah diganti dengan database baru.\n🔄 Bot akan otomatis melakukan <b>npm restart</b> sekarang...", { parse_mode: 'HTML' });

            setTimeout(() => {
                exec('npm restart', { cwd: __dirname }, (err, stdout, stderr) => {
                    if (err) console.error('❌ npm restart gagal:', err.message);
                    else console.log('♻️ npm restart dijalankan:', stdout || stderr);
                });
                setTimeout(() => process.exit(0), 2500);
            }, 800);
            return;
        } catch (err) {
            await fs.remove(tempDir).catch(() => {});
            console.error('❌ Gagal update database:', err);
            return bot.sendMessage(userId, `❌ <b>Update database gagal!</b>\n\n<code>${escapeHtml(err.message)}</code>`, { parse_mode: 'HTML' });
        }
    }

    // --- BAGIAN 2: LOGIKA OWNER BUAT KODE (Taruh di bot.on('message')) ---

// Tahap 1: Owner input Nama Kode
if (state.step === 'rd_code' && msg.text) {
    state.code = msg.text.trim().toUpperCase(); // Simpan nama kode
    state.step = 'rd_reward'; // Ubah step ke tahap tanya jumlah koin
    
    bot.sendMessage(userId, `✅ Kode <b>${state.code}</b> disimpan.\n\n💰 Sekarang masukkan jumlah hadiah koinnya (Contoh: 5000):`, { parse_mode: 'HTML' });
} 

// Tahap 2: Owner input Jumlah Koin
else if (state.step === 'rd_reward' && msg.text) {
    const reward = parseInt(msg.text.replace(/\./g, '')); // Ambil angka saja
    
    if (isNaN(reward) || reward <= 0) {
        return bot.sendMessage(userId, "❌ Masukkan jumlah koin yang valid (lebih dari 0):");
    }

    state.reward = reward;
    state.step = 'rd_limit';
    return bot.sendMessage(userId, `💰 Hadiah: <b>${reward.toLocaleString()}</b> Coins\n\n👥 Sekarang masukkan <b>Max Claim</b> (Contoh: 5):`, { parse_mode: 'HTML' });
}

// Tahap 3: Owner input Max Claim lalu simpan & posting ke channel
else if (state.step === 'rd_limit' && msg.text) {
    const limit = parseInt(msg.text.replace(/\./g, ''));
    if (isNaN(limit) || limit <= 0) {
        return bot.sendMessage(userId, "❌ Max Claim harus berupa angka lebih dari 0. Contoh: 5");
    }

    const reward = state.reward;

    // 1. Simpan ke Database
    if (!db.redeemCodes) db.redeemCodes = {};
    db.redeemCodes[state.code] = { 
        reward: reward, 
        limit: limit, 
        claimedBy: [] 
    };
    await saveDB();

    // 2. Siapkan pesan untuk Channel
    const botInfo = await bot.getMe();
    const textChannel = `<b>🎁 KODE REDEEM BARU!</b>\n\n` +
                        `Halo Pengguna Bot! Ada hadiah koin gratis buat <b>${limit} orang</b> tercepat.\n\n` +
                        `┣ 🔑 <b>Kode :</b> <code>${state.code}</code>\n` +
                        `┣ 💰 <b>Hadiah :</b> ${reward.toLocaleString()} Koin\n` +
                        `┗ 👥 <b>Kuota :</b> ${limit} Orang\n\n` +
                        `<b>📌 Cara Klaim:</b>\n` +
                        `Buka bot @${botInfo.username} lalu ketik:\n` +
                        `<code>/redeem ${state.code}</code>`;
    
    // 3. Kirim ke channel otomatis
    bot.sendMessage(config.links?.infoChannel || config.channels?.[1], textChannel, { parse_mode: 'HTML' })
        .then(() => {
            bot.sendMessage(userId, `✅ Berhasil!\n\nKode <b>${state.code}</b> aktif dan sudah diposting ke channel <b>${escapeHtml(config.links?.infoChannel || config.channels?.[1] || "")}</b>.`, { parse_mode: 'HTML' });
        })
        .catch((err) => {
            bot.sendMessage(userId, `✅ Kode <b>${state.code}</b> aktif di database, tapi <b>GAGAL</b> kirim ke channel.\n\nPastikan bot kamu sudah jadi <b>ADMIN</b> di <b>${escapeHtml(config.links?.infoChannel || config.channels?.[1] || '')}</b>!`);
            console.error(err);
        });

    delete ownerState[userId]; // Hapus status owner agar bisa perintah lain
}

        // OWNER: TAMBAH KOIN USER
        else if (state.step === 'waiting_user_id' && msg.text) {
            state.targetId = msg.text.trim();
            if (!db.users[state.targetId]) return bot.sendMessage(userId, "❌ ID tidak ada!");
            state.step = 'waiting_user_amount';
            bot.sendMessage(userId, `👤 ID: ${state.targetId}. Masukkan jumlah koin:`);
        } else if (state.step === 'waiting_user_amount' && msg.text) {
            const amount = parseInt(msg.text.replace(/\./g, ''));
            db.users[state.targetId].coin = (db.users[state.targetId].coin || 0) + amount;
            await saveDB();
            bot.sendMessage(state.targetId, `🎁 Kamu dapat ${amount.toLocaleString()} koin dari Owner!`).catch(() => {});
            bot.sendMessage(userId, "✅ Terkirim!");
            delete ownerState[userId];
        }

        // OWNER: TAMBAH SCRIPT (VERSI BULK UPLOAD)
        else if (state.step === 'waiting_file') {
            if (msg.document) {
                // Menampung file (Bot diam/tidak balas agar tidak spam)
                state.tempFiles.push({
                    name: msg.document.file_name,
                    fileId: msg.document.file_id
                });
            } else if (msg.text && msg.text.toUpperCase() === 'DONE') {
                if (state.tempFiles.length === 0) return bot.sendMessage(userId, "❌ Kirim filenya dulu!");
                state.step = 'waiting_price_bulk';
                bot.sendMessage(userId, `📦 Total <b>${state.tempFiles.length} Script</b> diterima.\n💰 Masukkan Harga untuk semua script ini:`, { parse_mode: 'HTML' });
            }
        } else if (state.step === 'waiting_price_bulk' && msg.text) {
            const price = parseInt(msg.text.replace(/\./g, ''));
            if (isNaN(price)) return bot.sendMessage(userId, "❌ Masukkan angka saja!");

            // Masukkan semua file ke database
            state.tempFiles.forEach(f => {
                db.scripts.push({ name: f.name, fileId: f.fileId, price: price });
            });
            await saveDB();

            // Notifikasi update dikirim ke channel laporan, bukan broadcast ke semua user.
            const scriptNotif = `<b>🆕 NEW UPDATE!</b>\n\n` +
                                `<blockquote>Sebanyak <b>${state.tempFiles.length} Script baru</b> telah ditambahkan!\n` +
                                `💰 Harga: <b>${price.toLocaleString()} Coins</b></blockquote>\n` +
                                `🛒 Cek sekarang di menu Store!`;
            await sendNotifMessage(scriptNotif).catch(() => {});

            bot.sendMessage(userId, `✅ Berhasil menambah ${state.tempFiles.length} script!\n📢 Notifikasi juga sudah dikirim ke ${config.notifChannel}.`);
            delete ownerState[userId];
        } // Tutup step waiting_price_bulk

        }

    } catch (e) { 
        console.error("Error di handler message:", e); 
    }
}); // <--- PASTIKAN ADA INI (Tutup bot.on('message'))

// --- KODE SISTEM (DI LUAR FUNGSI) ---
process.on('uncaughtException', (err) => { 
    console.log('Error:', err.message); 
});
// mak lu kontol 
process.on('unhandledRejection', (reason, promise) => { 
    console.log('Rejection:', reason); 
});

console.log("Bot Running...");