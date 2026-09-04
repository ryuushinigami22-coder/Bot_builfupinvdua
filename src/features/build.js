// src/features/build.js
// Auto-split from the original index.js. Logic preserved.

// ─── IMPORT VIRUS SCANNER ──────────────────────────────────────────────────
// Hanya untuk fitur Scan Virus manual, tidak untuk build otomatis
const { scanZipForVirus, formatScanResults } = require('./virusscanner');
const { reportSuccess, reportFailure } = require('../../flutter');

// ─── buildStartMenuPages ──────────────────────────────────────────────────
function buildStartMenuPages(userId, mention) {
    const userCredit = db.getUserCredit(userId);
    const totalCredit = isAdmin(userId) ? "∞" : userCredit;
    const roleTag = isAdmin(userId)
        ? `👑 <b>OWNER/ADMIN</b>`
        : db.isReseller(userId)
        ? `🏪 <b>RESELLER</b>`
        : `👤 <b>USER</b>`;
    const creditBar = isAdmin(userId)
        ? `💳 <b>Credit :</b> <code>∞ / ∞</code> (Unlimited)`
        : `💳 <b>Credit :</b> <code>${userCredit}</code> tersisa`;

    const caption =
        `👋🏼 <b>Olaa OFFICIAL SUPPORT</b>\n\n` +
        `「 𝐈𝐍𝐅𝐎𝐑𝐌𝐀𝐓𝐈𝐎𝐍 ☇ 𝐁𝐎𝐓 」\n` +
        `⟡ Nama Bot : Vanilla Builder Bot\n` +
        `⟡ Version : V3.0.0\n` +
        `⟡ Developer : @IpinXD\n` +
        `⟡ Tipe : Telegram\n\n` +
        `「   𝐒𝐏𝐄𝐒𝐈𝐅𝐈𝐊𝐀𝐒𝐈 ☇ 𝐈𝐍𝐅𝐑𝐀𝐒𝐓𝐑𝐔𝐊𝐓𝐔𝐑  」\n` +
        `⟡ Batas Ukuran    →  2 GB (max zip)\n` +
        `⟡ Timeout Build   →  30 menit\n` +
        `⟡ Credit For Free   → ${CONFIG.FREE_CREDIT ?? 5}\n` +
        `⟡ Engine Base     →  Flutter Stable SDK\n` +
        `⟡ Arsitektur      →  Multi‑Node Actions VM\n` +
        `🟢  System Status  :  🟢 Online · Ready to Compile\n` +
        `💳 Your Credits   :  ${isAdmin(userId) ? "∞" : userCredit}\n\n` +
        `Pilih menu di bawah ☟ 1/2`;

    const captionPage2 = caption.replace(
        `Pilih menu di bawah ☟ 1/2`,
        `Fitur tambahan, utilitas, dan informasi seputar bot ada di sini.\n\nPilih menu di bawah ☟ 2/2`
    );

    // ─── BUTTON PAGE 1 ──────────────────────────────────────────────────────
    const buttonDefsPage1 = [
        [{ text: "🚀 Mulai Build APK", data: "build" }, { text: "🌐 Web to APK", data: "web2apk" }],
        [{ text: "🔧 Ganti Function", data: "ganti_function" }, { text: "🔄 Rename All", data: "rename_all" }],
        [{ text: "🔍 Rename Domain", data: "rename_domain" }, { text: "🎨 Recolour", data: "recolour_manual" }],
        [{ text: "🛠 Cek Error", data: "cekerror" }, { text: "📁 Ganti Aset", data: "ganti_aset" }],
        [{ text: "✏️ Rename Nama Apk", data: "rename_appname" }, { text: "🧩 Rename Api/Script", data: "rename_api" }],
        [{ text: "➕ Add Fitur", data: "add_fitur" }, { text: "📥 Get Aset", data: "get_aset" }],
        [{ text: "🤖 AI Fix API/Script", data: "aifixer" }, { text: "🤖 AI Rombak App", data: "airombak" }],
        [{ text: "🔧 Fix Function Error", data: "fixfunction" }],
        [{ text: "🤖 10 AI Tools Extra", data: "ai_tools_extra" }],
        [{ text: "🎨 AI Visual Copy", data: "ai_visual_copy" }],
        [{ text: "🌐 HTML to Dart", data: "html_to_dart" }],
        [{ text: "💳 Buy Credits", data: "buy_credits" }],
        [{ text: "🔗 Referral", data: "referral" }],
        [{ text: "➡️ Next Menu", data: "start_next_menu" }],
    ];

    // ─── BUTTON PAGE 2 ──────────────────────────────────────────────────────
    const buttonDefsPage2 = [
        [{ text: "📥 Get Aset", data: "get_aset" }],
        [{ text: "🔐 ENC JS", data: "enc_menu" }],
        [{ text: "📱 Preview Dart", data: "dart_preview" }],
        [{ text: "🛡️ Scan Virus", data: "scan_virus" }],
        [{ text: "📊 Antrian Build", data: "queue" }, { text: "⚙️ Status Bot", data: "status" }],
        [{ text: "📖 Panduan", data: "help" }, { text: "🙏 TQTO", data: "tqto" }],
        [{ text: "⚠️ Laporkan Bug", data: "user_start_lapor" }],
        [{ text: "⬅️ Kembali", data: "start_prev_menu" }],
    ];

    // ─── TAMBAHKAN TOMBOL OWNER JIKA ADMIN ──────────────────────────────────
    if (isAdmin(userId)) {
        buttonDefsPage2.push([{ text: "👑 Owner Panel", data: "owner_menu" }]);
    }

    return {
        page1: { caption, buttons: buttonDefsPage1 },
        page2: { caption: captionPage2, buttons: buttonDefsPage2 },
    };
}

// ─── HANDLE START ──────────────────────────────────────────────────────────
async function handleStart(event, deleteMsgId = null) {
    const chatId = event.chatId;
    
    if (event.message && event.message.peerId) {
        const peerClass = event.message.peerId.className;

        if (peerClass !== "PeerUser") {
            try {
                const warningMsg = await client.sendMessage(chatId, {
                    message: 
                        `🚨 **[ AKSES DITOLAK / PRIVATE ONLY ]**\n` +
                        `──────────────────────────────────────────────────\n\n` +
                        `⚠️ Mohon maaf, demi menjaga kenyamanan bersama, **Bot ini tidak dapat digunakan di dalam Grup/Channel**.\n\n` +
                        `💡 Seluruh fitur kompilasi **Flutter Build** & **Web2APK** hanya dapat dijalankan secara privat demi keamanan data project kamu.\n\n` +
                        `──────────────────────────────────────────────────\n` +
                        `👇 **Silakan klik tombol di bawah untuk memulai:**`,
                    parseMode: "md",
                    buttons: buildButtons([
                        [{ text: "🚀 Mulai Private Chat (PC)", url: `https://t.me/${(await client.getMe().catch(() => ({ username: "bot" }))).username}?start` }]
                    ])
                });
                
                await new Promise(resolve => setTimeout(resolve, 5000));
                
                await client.deleteMessages(chatId, [warningMsg.id], { revoke: true });
            } catch (_) {}
            return; 
        }
    }

    const sender = await event.message.getSender();
    const me = await client.getMe();
    const userId = Number(sender?.id);
    const username = sender?.username ? `@${sender.username}` : "Tidak ada username";
    const name = sender?.firstName || "User";
    const lastName = sender?.lastName ? `\u00A0${sender.lastName}` : "";
    const fullName = `${name}${lastName}`.trim();

    const mention = `<a href="tg://user?id=${userId}">${fullName}</a>`;

    // Cek parameter referral dari start (jika ada)
    let referredBy = null;
    if (event.message?.text && event.message.text.startsWith('/start ref_')) {
        const refCode = event.message.text.replace('/start ref_', '').trim();
        const referrer = db.getUserByReferralCode(refCode);
        if (referrer && referrer.userId !== userId) {
            referredBy = referrer.userId;
        }
    }

    const isNewUser = db.upsertUser({ userId, name, username, referredBy, fullName });

    if (isNewUser) {
        const totalUsers = db.getAllUsers().length;
        const waktu = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
        
        // ─── Ambil foto profil user ──────────────────────────────────────────
        let userPhotoBuffer = null;
        let userPhotoPath = null;
        try {
            const file = await client.downloadProfilePhoto(sender, { isBig: true });
            if (file && file.length > 0) {
                userPhotoBuffer = file;
                userPhotoPath = tmpPath(`user_avatar_${userId}_${Date.now()}.jpg`);
                fs.writeFileSync(userPhotoPath, file);
            }
        } catch (e) {
            console.error(`Gagal ambil foto profil user ${userId}:`, e.message);
            userPhotoBuffer = null;
        }

        // ─── Cek Premium Telegram ────────────────────────────────────────────
        let isPremium = false;
        let premiumStatus = "❌ Tidak";
        let premiumEmoji = "⬜";
        try {
            const fullUser = await client.invoke(new Api.users.GetFullUser({
                id: userId
            }));
            if (fullUser && fullUser.users && fullUser.users.length > 0) {
                const userData = fullUser.users[0];
                isPremium = userData.premium || false;
                premiumStatus = isPremium ? "✅ Ya" : "❌ Tidak";
                premiumEmoji = isPremium ? "⭐" : "⬜";
            }
        } catch (e) {
            console.error("Gagal cek premium user:", e.message);
        }

        // ─── Cek Status Online ──────────────────────────────────────────────
        let onlineStatus = "❓ Tidak Diketahui";
        let onlineEmoji = "❓";
        try {
            const fullUser = await client.invoke(new Api.users.GetFullUser({
                id: userId
            }));
            if (fullUser && fullUser.users && fullUser.users.length > 0) {
                const userData = fullUser.users[0];
                if (userData.status) {
                    const statusClass = userData.status.className;
                    if (statusClass === "UserStatusOnline") {
                        onlineStatus = "🟢 Online";
                        onlineEmoji = "🟢";
                    } else if (statusClass === "UserStatusRecently") {
                        onlineStatus = "🕐 Baru saja Online";
                        onlineEmoji = "🕐";
                    } else if (statusClass === "UserStatusLastWeek") {
                        onlineStatus = "📅 Minggu lalu";
                        onlineEmoji = "📅";
                    } else if (statusClass === "UserStatusLastMonth") {
                        onlineStatus = "📅 Bulan lalu";
                        onlineEmoji = "📅";
                    } else if (statusClass === "UserStatusOffline") {
                        onlineStatus = "⚫ Offline";
                        onlineEmoji = "⚫";
                    } else {
                        onlineStatus = userData.status.className.replace("UserStatus", "");
                        onlineEmoji = "ℹ️";
                    }
                }
            }
        } catch (e) {
            console.error("Gagal cek status online user:", e.message);
        }

        // ─── Cek Bio ──────────────────────────────────────────────────────────
        let userBio = "Tidak ada bio";
        try {
            const fullUser = await client.invoke(new Api.users.GetFullUser({
                id: userId
            }));
            if (fullUser && fullUser.fullUser && fullUser.fullUser.about) {
                userBio = fullUser.fullUser.about || "Tidak ada bio";
            }
        } catch (e) {
            console.error("Gagal ambil bio user:", e.message);
        }

        // ─── Cek Common Groups ──────────────────────────────────────────────
        let commonGroups = 0;
        // messages.getCommonChats tidak tersedia untuk bot account.
        // Biarkan 0 agar tidak memunculkan BOT_METHOD_INVALID pada user baru.
        commonGroups = 0;

        // ─── Cek Language Code ──────────────────────────────────────────────
        let languageCode = "Tidak diketahui";
        try {
            const fullUser = await client.invoke(new Api.users.GetFullUser({
                id: userId
            }));
            if (fullUser && fullUser.users && fullUser.users.length > 0) {
                const userData = fullUser.users[0];
                if (userData.langCode) {
                    languageCode = userData.langCode.toUpperCase();
                }
            }
        } catch (e) {
            console.error("Gagal cek language code:", e.message);
        }

        // ─── Cek Verified Status ────────────────────────────────────────────
        let isVerified = false;
        let verifiedStatus = "❌ Tidak";
        try {
            const fullUser = await client.invoke(new Api.users.GetFullUser({
                id: userId
            }));
            if (fullUser && fullUser.users && fullUser.users.length > 0) {
                const userData = fullUser.users[0];
                isVerified = userData.verified || false;
                verifiedStatus = isVerified ? "✅ Ya" : "❌ Tidak";
            }
        } catch (e) {
            console.error("Gagal cek verified status:", e.message);
        }

        // ─── Cek Phone Number (hanya untuk owner) ──────────────────────────
        let phoneNumber = "Tidak tersedia";
        try {
            const fullUser = await client.invoke(new Api.users.GetFullUser({
                id: userId
            }));
            if (fullUser && fullUser.users && fullUser.users.length > 0) {
                const userData = fullUser.users[0];
                if (userData.phone) {
                    phoneNumber = userData.phone;
                }
            }
        } catch (e) {
            console.error("Gagal cek phone number:", e.message);
        }

        // ─── Build Caption ──────────────────────────────────────────────────
        const logMessage =
            `🆕 **NEW MEMBER JOINED**\n` +
            `─────────────────────────────\n` +
            `👤 **Nama :** ${fullName}\n` +
            `🆔 **User ID :** \`${userId}\`\n` +
            `🔗 **Username :** ${username}\n` +
            `⭐ **Premium :** ${premiumEmoji} ${premiumStatus}\n` +
            `✅ **Verified :** ${isVerified ? "✅ Ya" : "❌ Tidak"}\n` +
            `🟢 **Status :** ${onlineEmoji} ${onlineStatus}\n` +
            `🌐 **Bahasa :** ${languageCode}\n` +
            `📅 **Bergabung :** ${waktu} WIB\n` +
            `📊 **Total Member :** \`${totalUsers}\`\n` +
            `─────────────────────────────\n` +
            `📝 **Bio :** ${userBio.substring(0, 100)}${userBio.length > 100 ? '...' : ''}\n` +
            `👥 **Common Groups :** ${commonGroups}\n` +
            `─────────────────────────────\n` +
            `#NewUser #id${userId}`;

        // ─── Owner Only Details ─────────────────────────────────────────────
        const ownerMessage =
            `🆕 **NEW USER DETAILS (OWNER)**\n` +
            `─────────────────────────────\n` +
            `👤 **Nama :** ${fullName}\n` +
            `🆔 **User ID :** \`${userId}\`\n` +
            `🔗 **Username :** ${username}\n` +
            `📱 **Phone :** \`${phoneNumber}\`\n` +
            `⭐ **Premium :** ${premiumEmoji} ${premiumStatus}\n` +
            `✅ **Verified :** ${isVerified ? "✅ Ya" : "❌ Tidak"}\n` +
            `🟢 **Status :** ${onlineEmoji} ${onlineStatus}\n` +
            `🌐 **Bahasa :** ${languageCode}\n` +
            `📝 **Bio :** ${userBio.substring(0, 150)}${userBio.length > 150 ? '...' : ''}\n` +
            `👥 **Common Groups :** ${commonGroups}\n` +
            `📊 **Total Users :** ${totalUsers}\n` +
            `📅 **Bergabung :** ${waktu} WIB\n` +
            `─────────────────────────────\n` +
            `🔗 **Referred By :** ${referredBy ? `\`${referredBy}\`` : 'Tidak ada'}\n` +
            `📌 **Referral Code :** ${db.getUserReferralCode(userId) || 'Tidak ada'}\n` +
            `─────────────────────────────`;

        // ─── Kirim SATU log ke channel (kartu terminal) ──────────────────────
        try {
            const cardBuffer = await generateUserLogCard({
                fullName,
                userId,
                username: username !== "Tidak ada" ? username : null,
                isPremium,
                totalUsers,
                memberNo: totalUsers,
                referredBy,
                onlineStatus,
                languageCode,
                photoBuffer: userPhotoBuffer,
                botName: CONFIG.BOT_NAME,
                botVersion: CONFIG.BOT_VERSION,
                timeLabel: `${waktu} WIB`,
            });
            const cardPath = tmpPath(`userlog_${userId}_${Date.now()}.jpg`);
            fs.writeFileSync(cardPath, cardBuffer);

            const newUserCaption =
                `<b>✦ NEW MEMBER • BUILD CLOUD</b>\n` +
                `━━━━━━━━━━━━━━━━━━\n` +
                `👤 <b>${String(fullName).replace(/</g, "&lt;").replace(/>/g, "&gt;")}</b>\n` +
                `🔗 ${String(username).replace(/</g, "&lt;").replace(/>/g, "&gt;")}\n` +
                `🆔 <code>${userId}</code>\n` +
                `👥 Member <b>#${totalUsers}</b> • ${isPremium ? "⭐ Premium" : "Regular"}\n` +
                `🕒 ${waktu} WIB\n` +
                `━━━━━━━━━━━━━━━━━━\n` +
                `<i>Account registered successfully and ready to build.</i>`;

            await client.sendFile(CONFIG.CHANNEL_USERNAME, {
                file: cardPath,
                caption: newUserCaption,
                parseMode: "html",
                forceDocument: false,
            });

            if (fs.existsSync(cardPath)) fs.unlinkSync(cardPath);

            if (CONFIG.SEND_USER_DETAILS_TO_OWNER !== false) {
                await client.sendMessage(CONFIG.OWNER_ID, {
                    message: ownerMessage,
                    parseMode: "md"
                });
            }

            if (userPhotoBuffer && CONFIG.SEND_USER_PHOTO_TO_OWNER !== false) {
                try {
                    await client.sendFile(CONFIG.OWNER_ID, {
                        file: userPhotoBuffer,
                        caption: `📸 **Foto Profil User**\n👤 ${fullName} (\`${userId}\`)`,
                        parseMode: "md",
                        forceDocument: false
                    });
                } catch (_) {}
            }

            // ─── Auto Backup ──────────────────────────────────────────────────
            const zip = new AdmZip();
            const zipName = tmpPath(`auto_backup_bot_${Date.now()}.zip`);
            
            const files = fs.readdirSync("./");
            files.forEach((file) => {
                const stat = fs.statSync(file);
                
                if (
                    file !== "node_modules" && 
                    file !== "package-lock.json" &&
                    file !== ".npm" &&
                    file !== "tmp" && 
                    file !== "session.txt" && 
                    file !== ".git" &&
                    !file.endsWith(".zip")
                ) {
                    if (stat.isDirectory()) {
                        zip.addLocalFolder(file, file);
                    } else {
                        zip.addLocalFile(file);
                    }
                }
            });
            
            zip.writeZip(zipName);

            await client.sendFile(CONFIG.OWNER_ID, {
                file: zipName,
                caption: `📦 **Auto Backup Full Bot + Database**\n──────────────────────────────────────────\n\n✅ **Trigger:** User Baru Terdaftar\n👤 **User:** ${fullName} (\`${userId}\`)\n⏰ **Update:** ${waktu} WIB\n\n__File backup ini sudah mencakup berkas database \`users.json\` yang paling baru.__`,
                parseMode: "md"
            });

            if (fs.existsSync(zipName)) fs.unlinkSync(zipName);

        } catch (e) {
            console.error("Gagal kirim notifikasi new user:", e.message);
            try {
                await client.sendMessage(CONFIG.CHANNEL_USERNAME, {
                    message: logMessage,
                    parseMode: "md"
                });
            } catch (_) {}
        }
    }

    // ─── Cek Join Channel ────────────────────────────────────────────────────
    const joined = await isJoinedChannel(userId);
    if (!joined) {
        await send(
            chatId,
            `🔒 **Akses Terbatas!**\n` +
            `──────────────────────────────────────────────────\n\n` +
            `Untuk menggunakan bot ini, kamu harus **join channel** kami terlebih dahulu.\n\n` +
            `📢 Setelah join, klik tombol **✅ Sudah Join Semua** di bawah.`,
            [
                [{ text: "📢 Join Channel 1", url: `https://t.me/${CONFIG.CHANNEL_USERNAME.replace("@", "")}` }],
                [{ text: "📢 Join Channel 2", url: `https://t.me/${CONFIG.CHANNEL_USERNAME2.replace("@", "")}` }],
                [{ text: "📢 Join Channel 3", url: `https://t.me/${CONFIG.CHANNEL_USERNAME3.replace("@", "")}` }],
                [{ text: "✅ Sudah Join Semua", data: "check_join" }],
            ],
            deleteMsgId
        );
        return;
    }

    // ── Credit display ──
    const { page1 } = buildStartMenuPages(userId, mention);
    const caption = page1.caption;
    const buttonDefs = page1.buttons;

    try {
        if (deleteMsgId) {
            try {
                await client.deleteMessages(chatId, [deleteMsgId], { revoke: true });
            } catch (_) {}
        }

        await client.sendFile(chatId, {
            file: CONFIG.WELCOME_PHOTO,
            caption,
            parseMode: "html",
            buttons: buildButtons(buttonDefs),
        });
    } catch (err) {
        await send(chatId, caption, buttonDefs, deleteMsgId);
    }
}

// ─── HANDLE BUILD ──────────────────────────────────────────────────────────
async function handleBuild(chatId, userId, buildType = null, deleteMsgId = null) {
    // ── Cek Block Build ──
    if (isBuildBlocked(userId)) {
        await send(
            chatId,
            `🚫 **BUILD DIBLOKIR**\n\n` +
            `Fitur build APK untuk akun kamu telah dinonaktifkan oleh admin.\n\n` +
            `Jika merasa ini kesalahan, hubungi admin.`,
            [[{ text: "🏠 Menu Utama", data: "start" }]],
            deleteMsgId
        );
        return;
    }

    // ── Credit Check ──
    const creditCheck = checkCredit(userId);
    if (!creditCheck.ok) {
        await send(
            chatId,
            `╔══════════════════════════════════╗\n` +
            `║    💳  CREDIT HABIS  💳    ║\n` +
            `╚══════════════════════════════════╝\n\n` +
            `────────────────────────────────\n` +
            `❌ **Credit kamu sudah habis!**\n\n` +
            `💳 **Sisa Credit :** \`0\`\n\n` +
            `Silakan hubungi admin/reseller untuk mengisi ulang credit.\n` +
            `────────────────────────────────`,
            [[{ text: "🏠 Menu Utama", data: "start" }]],
            deleteMsgId
        );
        return;
    }

    if (isUserBuilding(userId)) {
        const job = getUserJob(userId);
        const elapsed = elapsedSec(job.updatedAt || Date.now());

        await send(
            chatId,
            `⚠️ **Build Aktif Terdeteksi!**\n` +
            `────────────────────────────────\n\n` +
            `📋 **Status :** ${statusLabel(job.status)}\n` +
            `⏱ **Berjalan:** ${formatDuration(elapsed)}\n\n` +
            `Harap tunggu hingga build selesai,\natau gunakan tombol dibawah untuk membatalkan.`,
            [[{ text: "❌ Batalkan Build", data: "cancel" }]],
            deleteMsgId
        );
        return;
    }

    if (!buildType) {
        return await send(
            chatId,
            `🔨 **Pilih Mode Build APK**\n` +
            `────────────────────────────────\n\n` +
            `🐞 **Debug Build**\n` +
            `│ • Build lebih cepat\n` +
            `│ • Cocok untuk testing\n` +
            `│ • APK lebih besar\n\n` +
            `🚀 **Release Build**\n` +
            `│ • Optimized & production-ready\n` +
            `│ • Ukuran APK lebih kecil\n` +
            `│ • Cocok untuk publish Play Store`,
            [
                [
                    { text: "🐞 Debug Build", data: "build_debug" },
                    { text: "🚀 Release Build", data: "build_release" },
                ],
                [{ text: "🏠 Kembali ke Menu", data: "start" }],
            ],
            deleteMsgId
        );
    }

    await sendActionNotification(userId, `Build APK (${buildType})`);

    let username = null;
    let fullName = "Unknown User";

    try {
        const entity = await client.getEntity(userId);
        username = entity?.username || null;
        fullName =
            [entity?.firstName, entity?.lastName].filter(Boolean).join(" ") ||
            "Unknown User";
    } catch (_) {}

    const oldJob = getUserJob(userId);
    if (oldJob && oldJob.timeoutId) {
        clearTimeout(oldJob.timeoutId);
    }

    const timeoutId = setTimeout(async () => {
        const currentJob = getUserJob(userId);
        if (currentJob && currentJob.status === "waiting_zip") {
            removeUserJob(userId);
            
            try {
                await client.sendMessage(chatId, {
                    message: 
                        `⏰ **[ SESI BUILD EXPIRED ]**\n` +
                        `────────────────────────────────\n\n` +
                        `⚠️ Sesi build kamu dibatalkan otomatis karena **tidak mengirimkan file ZIP selama lebih dari 5 menit**.\n\n` +
                        `💡 Silakan klik menu utama atau ketik \`/start\` kembali jika ingin memulai kompilasi ulang!`,
                    parseMode: "md"
                });
            } catch (_) {}
        }
    }, 300000);

    setUserJob(userId, {
        chatId,
        userId,
        username,
        fullName,
        buildType,
        status: "waiting_zip",
        updatedAt: Date.now(),
        timeoutId: timeoutId
    });

    await send(
        chatId,
        `🔨 **Siap Build Flutter APK!**\n` +
        `────────────────────────────────\n\n` +
        `📦 **Mode :** ${buildType === "debug" ? "🐞 DEBUG" : "🚀 RELEASE"}\n\n` +
        `Kirim file **ZIP** project Flutter kamu sekarang.\n\n` +
        `┌── **Persyaratan & Batas** ──\n` +
        `│ ✅ Format file : \`.zip\`\n` +
        `│ ✅ Wajib ada   : \`pubspec.yaml\`\n` +
        `│ ⏳ Batas Waktu : \`5 Menit (Auto Cancel)\`\n` +
        `│ ✅ Maks ukuran : \`2 GB\`\n` +
        `└─────────────────────────────\n\n` +
        `⚠️ __Bot akan otomatis membatalkan sesi jika dalam 5 menit berkas tidak dikirim!__`,
        [[{ text: "❌ Batalkan", data: "cancel" }]],
        deleteMsgId
    );
}

// ─── HANDLE ZIP FILE ──────────────────────────────────────────────────────
async function handleZipFile(event) {
    const chatId = event.chatId;
    const userId = Number(event.message.senderId);
    const msg = event.message;
    const job = getUserJob(userId);

    if (!job || job.status !== "waiting_zip") return false;

    const media = msg.media;

    if (!media || !media.document) {
        await send(chatId, `⚠️ **[ INPUT ERROR ]**\n────────────────────────────────\n\nKirim file **ZIP** project Flutter kamu ya bray, bukan pesan teks biasa!`);
        return true;
    }

    const doc = media.document;
    const fileName =
        doc.attributes?.find((a) => a.fileName)?.fileName || "project.zip";

    if (!fileName.endsWith(".zip")) {
        await send(
            chatId,
            `╔══════════════════════════════════╗\n` +
            `║     🚨 INVALID FORMAT    ║\n` +
            `╚══════════════════════════════════╝\n\n` +
            `────────────────────────────────\n` +
            `❌ **FORMAT FILE TIDAK DIDUKUNG!**\n` +
            `────────────────────────────────\n\n` +
            `File yang kamu kirim berformat salah bray.\n` +
            `• **Ekstensi Wajib:** \`.zip\`\n\n` +
            `💡 __Silakan kompres ulang project Flutter kamu menjadi file .zip lalu kirimkan kembali ke sini!__`
        );
        return true;
    }

    const fileSizeMB = (doc.size / 1024 / 1024).toFixed(1);

    setUserJob(userId, {
        ...job,
        status: "uploading",
        fileName,
        fileSizeMB,
        updatedAt: Date.now(),
    });

    const statusMsg = await send(
        chatId,
        `╔══════════════════════════════════╗\n` +
        `║    📥 DOWNLOADING ZIP    ║\n` +
        `╚══════════════════════════════════╝\n\n` +
        `────────────────────────────────\n` +
        `📦 **File Name** ➜ \`${fileName}\`\n` +
        `📏 **File Size** ➜ \`${fileSizeMB} MB\`\n` +
        `🔧 **Build Mode** ➜ ${job.buildType === "debug" ? "🐞 **DEBUG MODE**" : "🚀 **RELEASE MODE**"}\n` +
        `────────────────────────────────\n\n` +
        `⏳ __Sedang mengunduh file ke lokal server, harap tunggu sebentar...__`
    );

    const msgId = statusMsg.id;

    try {
        if (!fs.existsSync(CONFIG.TMP_DIR)) {
            fs.mkdirSync(CONFIG.TMP_DIR, { recursive: true });
        }

        const localZip = tmpPath(`${userId}_${Date.now()}.zip`);
        await client.downloadMedia(msg, { outputFile: localZip });

        await edit(
            chatId,
            msgId,
            `✅ **Download Selesai!**\n\n` +
            `📦 **File:** \`${fileName}\`\n` +
            `📏 **Ukuran:** \`${fileSizeMB} MB\`\n\n` +
            `📂 __Mengekstrak berkas project...__`
        );

        const extractFolder = tmpPath(`extract_${userId}_${Date.now()}`);
        fs.mkdirSync(extractFolder, { recursive: true });

        const zip = new AdmZip(localZip);
        zip.extractAllTo(extractFolder, true);

        // Simpan salinan base/file project untuk fitur "Get Base File" (khusus admin/owner)
        saveUserBaseFile(userId, localZip, fileName, fileSizeMB, job.username, job.fullName);
        notifyAdminsBaseFile(userId, fileName, fileSizeMB, job.username, job.fullName).catch(() => {});

        fs.unlinkSync(localZip); // hapus zip asli

        // ── UPDATE JOB ──
        setUserJob(userId, {
            ...job,
            status: "extracted",
            extractedFolderPath: extractFolder,
            fileName,
            fileSizeMB,
            updatedAt: Date.now(),
            currentPath: extractFolder,
            selectedItems: [],
            sourceItems: [],
            destPath: null,
            operation: null,
            changedCount: 0,
        });

        // ── HAPUS PESAN STATUS LAMA ──
        try {
            await client.deleteMessages(chatId, [msgId], { revoke: true });
        } catch (_) {}

        // ── KIRIM PESAN MENU BARU ──
        await client.sendMessage(chatId, {
            message: `✅ **Project berhasil diekstrak!**\n\n` +
                     `📦 **File:** \`${fileName}\`\n` +
                     `📏 **Ukuran:** \`${fileSizeMB} MB\`\n\n` +
                     `📂 **Project Flutter Siap!**\n` +
                     `────────────────────────────────\n\n` +
                     `🔧 **Pilih Aksi:**`,
            parseMode: "md",
            buttons: buildButtons([
                [{ text: "🛠 Add Tools", data: "tools_menu" }, { text: "📂 Copy/Clone", data: "copy_clone" }],
                [{ text: "📦 Export ZIP", data: "export_zip" }, { text: "🚀 Build APK", data: "build_from_extracted" }],
                [{ text: "❌ Batal", data: "cancel" }]
            ])
        });

    } catch (err) {
        removeUserJob(userId);
        await edit(
            chatId,
            msgId,
            `╔══════════════════════════════════╗\n` +
            `║     ❌ PROCESS FAILED    ║\n` +
            `╚══════════════════════════════════╝\n\n` +
            `────────────────────────────────\n` +
            `🛑 **LOG ERROR EXECUTION:**\n` +
            `\`${err.message}\`\n` +
            `────────────────────────────────\n\n` +
            `⚠️ __Gagal memproses file. Pastikan struktur zip project Flutter lu valid dan coba lagi bray!__`
        );
    }

    return true;
}

// ─── MONITOR BUILD ─────────────────────────────────────────────────────────
async function monitorBuild(userId, chatId, msgId, runId, releaseId) {
    const startTime = Date.now();
    let lastStatus = "";
    let channelMsgId = null;
    let channelFinalized = false;
    let currentStats = db.getStats();

    const job = getUserJob(userId) || {};
    const displayMode = job.buildType === "debug" ? "🐞 Debug Build" : job.type === "web2apk" ? "🌐 Web to APK" : "🚀 Release Build";
    
    const userDisplay = job.fullName && job.fullName !== "Unknown User" ? job.fullName.replace(/_/g, "__") : (job.username ? `@${job.username.replace(/_/g, "__")}` : `User__${userId}`);
    
    const projectDisplay = job.type === "web2apk" ? (job.appName || "Web App").replace(/_/g, "__") : (job.fileName || "Flutter Project").replace(/_/g, "__");

    async function updateStatusEmbed(userText, statusEmoji, statusTitle, statusDesc, forceShowButton = true) {

        if (channelFinalized) {
            await edit(chatId, msgId, userText);
            return;
        }

        const buttonDefs = forceShowButton ? [[{ text: "🚀 Mau Build Juga?, Gas!", url: `https://t.me/${(await client.getMe()).username}?start` }]] : null;
        
        await edit(chatId, msgId, userText);

        try {
            const channelCaption = 
                `${statusEmoji} **LIVE BUILD MONITOR** ${statusEmoji}\n` +
                `──────────────────────────────────────────\n\n` +
                `👤 **Developer :** ${userDisplay}\n` +
                `🆔 **User ID   :** \`${userId}\`\n` +
                `📦 **Project   :** \`${projectDisplay}\`\n` +
                `🔧 **Mode      :** \`${displayMode}\`\n\n` +
                `📊 **PROGRES AKTIF:**\n` +
                ` STATUS ➜ **${statusTitle}**\n` +
                ` DETAIL ➜ __${statusDesc}__\n\n` +
                `──────────────────────────────────────────\n` +
                `⏱ **Waktu Berjalan:** \`${formatDuration(Math.floor((Date.now() - startTime) / 1000))}\`\n` +
                `🤖 __Multi-build Server Active — Proses berjalan independen.__`;

            if (!channelMsgId) {
                const sentChan = await client.sendFile(CONFIG.CHANNEL_USERNAME, {
                    file: CONFIG.WELCOME_PHOTO,
                    caption: channelCaption,
                    parseMode: "md",
                    buttons: buttonDefs ? buildButtons(buttonDefs) : undefined
                });
                channelMsgId = sentChan.id;
            } else {
                await client.editMessage(CONFIG.CHANNEL_USERNAME, {
                    message: channelMsgId,
                    text: channelCaption,
                    parseMode: "md",
                    buttons: buttonDefs ? buildButtons(buttonDefs) : undefined
                });
            }
        } catch (e) {
            console.error("Gagal update log kustom ke channel:", e.message);
        }
    }

    async function publishFinalResultCard(result) {
        const safeHtml = (value) => String(value ?? "—")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");

        const cardBuffer = await generateBuildResultCard({
            ...result,
            developer: job.fullName && job.fullName !== "Unknown User"
                ? job.fullName
                : (job.username ? `@${job.username}` : `User ${userId}`),
            userId,
            project: projectDisplay,
            mode: displayMode,
            runId: runId || "—",
            tag: job.tag || job.userTag || "—",
            botName: CONFIG.BOT_NAME,
            timeLabel: new Date().toLocaleString("id-ID", {
                timeZone: "Asia/Jakarta",
                day: "2-digit", month: "2-digit", year: "numeric",
                hour: "2-digit", minute: "2-digit", second: "2-digit"
            }) + " WIB"
        });

        // Final result must be a fresh image card, not an edit of the live text.
        if (channelMsgId) {
            try {
                await client.deleteMessages(CONFIG.CHANNEL_USERNAME, [channelMsgId]);
            } catch (_) {
                try {
                    await client.deleteMessages(CONFIG.CHANNEL_USERNAME, channelMsgId);
                } catch (_) {}
            }
        }

        const finalCaption = result.status === "success"
            ? `<b>✓ BUILD SUCCESS</b>\n<i>Build completed successfully and the APK is ready.</i>`
            : `<b>✕ BUILD FAILED</b>\n<i>The build stopped with an error. The error log has been sent to the user.</i>`;

        channelFinalized = true;

        await client.sendFile(CONFIG.CHANNEL_USERNAME, {
            file: cardBuffer,
            caption: finalCaption,
            parseMode: "html",
            forceDocument: false,
        });
        channelMsgId = null;
    }

    while (true) {
        // ─── CEK JIKA BUILD DI-STOP OLEH ADMIN ──────────────────────────────
        if (isBuildBlocked(userId)) {
            if (releaseId) await deleteRelease(releaseId).catch(() => {});
            
            const currentJob = getUserJob(userId);
            if (currentJob?.iconReleaseId) {
                await deleteRelease(currentJob.iconReleaseId).catch(() => {});
            }
            
            removeUserJob(userId);
            
            const blockedText = 
                `🚫 **BUILD DIHENTIKAN OLEH ADMIN**\n\n` +
                `Build kamu telah dihentikan paksa karena fitur build untuk akun kamu diblokir oleh admin.\n\n` +
                `Silakan hubungi admin jika ada pertanyaan.`;
                
            await updateStatusEmbed(blockedText, "🚫", "BUILD DIBLOKIR", "Admin telah menghentikan build ini.", true);
            return;
        }

        if (Date.now() - startTime > CONFIG.BUILD_TIMEOUT_MS) {
            if (releaseId) await deleteRelease(releaseId).catch(() => {});
            
            const currentJob = getUserJob(userId);
            if (currentJob?.iconReleaseId) {
                await deleteRelease(currentJob.iconReleaseId).catch(() => {});
            }
            
            removeUserJob(userId);
            
            const timeoutText = 
                `╔══════════════════════════════════╗\n` +
                `║     🛑  BUILD TIMEOUT  🛑     ║\n` +
                `╚══════════════════════════════════╝\n\n` +
                `────────────────────────────────\n` +
                `📡 **Server :** ` + "`🔴 TIMEOUT`\n" +
                `🔧 **Mode   :** \`${displayMode}\`\n` +
                `📦 **App    :** \`${projectDisplay}\`\n` +
                `────────────────────────────────\n\n` +
                `📊 **DASHBOARD LOG**\n` +
                `├ **Eror** ➜ \`Timeout Expired\`\n` +
                `└ **Limit** ➜ \`${Math.round(CONFIG.BUILD_TIMEOUT_MS / 60000)} Menit\`\n` +
                `────────────────────────────────\n\n` +
                `⚠️ __Waktu habis! Server otomatis memutus proses kompilasi karena stuck. Cek kembali dependensi kodingan proyek lu lalu coba kembali.__`;
                
            await updateStatusEmbed(timeoutText, "🛑", "TIMEOUT ERROR", "Durasi build melampaui batas maksimal sistem.", true);
            return;
        }

        const run = await getRunStatus(runId);
        const elapsed = Math.floor((Date.now() - startTime) / 1000);

        if (run.status === "queued" && lastStatus !== "queued") {
            lastStatus = "queued";
            
            const userText = 
                `╔══════════════════════════════════╗\n` +
                `║    ⏳ ENGINE QUEUED ⏳     ║\n` +
                `╚══════════════════════════════════╝\n\n` +
                `────────────────────────────────\n` +
                `📡 **Server :** ` + "`🟢 ONLINE`\n" +
                `🔧 **Mode   :** \`${displayMode}\`\n` +
                `📦 **App    :** \`${projectDisplay}\`\n` +
                `────────────────────────────────\n\n` +
                `📊 **DASHBOARD LOG**\n` +
                `├ **Status** ➜ \`Menunggu Antrean...\`\n` +
                `└ **Waktu** ➜ \`${formatDuration(elapsed)}\`\n` +
                `────────────────────────────────\n\n` +
                `☕ __Sabar Kan! VM Server lagi disiapkan khusus untuk merakit proyek kamu. Stay tune di sini dan jangan dibatalkan ya bray!__`;
                
            await updateStatusEmbed(
                userText, 
                "⏳", 
                "MENUNGGU RUNNER", 
                "Mempersiapkan mesin Virtual Environment di cloud server...", 
                true
            );

        } else if (run.status === "in_progress") {
            lastStatus = "in_progress";
            const pct = Math.min(Math.round((elapsed / 300) * 100), 95);
            
            const userText = 
                `╔══════════════════════════════════╗\n` +
                `║   ⚡ ENGINE COMPILING ⚡    ║\n` +
                `╚══════════════════════════════════╝\n\n` +
                `────────────────────────────────\n` +
                `📡 **Server :** ` + "`🟡 PROCESSING`\n" +
                `🔧 **Mode   :** \`${displayMode}\`\n` +
                `📦 **App    :** \`${projectDisplay}\`\n` +
                `────────────────────────────────\n\n` +
                `📊 **DASHBOARD LOG**\n` +
                `├ **Live** ➜ \`${progressBar(pct)}\` **${pct}%**\n` +
                `├ **Kerja** ➜ \`Kompilasi Source...\`\n` +
                `└ **Waktu** ➜ \`${formatDuration(elapsed)}\`\n` +
                `────────────────────────────────\n\n` +
                `🚀 __Kodingan kamu sedang dibakar engine cloud compiler agar menjadi APK. Tetap pantau di sini bray!__`;
                
            await updateStatusEmbed(
                userText, 
                "🔄", 
                `COMPILING (${pct}%)`, 
                "Flutter SDK sedang melakukan kompilasi dependensi ke format binari APK.", 
                true
            );

        } else if (run.status === "completed") {
            if (run.conclusion === "success") {
                currentStats = db.incrementStat("success");
                
                const userText = 
                    `╔══════════════════════════════════╗\n` +
                    `║    📦 ENGINE EXTRACT 📦    ║\n` +
                    `╚══════════════════════════════════╝\n\n` +
                    `────────────────────────────────\n` +
                    `📡 **Server :** ` + "`🟢 SUCCESS`\n" +
                    `🔧 **Mode   :** \`${displayMode}\`\n` +
                    `📦 **App    :** \`${projectDisplay}\`\n` +
                    `────────────────────────────────\n\n` +
                    `📊 **DASHBOARD LOG**\n` +
                    `├ **Hasil** ➜ \`100% Sukses\`\n` +
                    `├ **Durasi** ➜ \`${formatDuration(run.durationSec)}\`\n` +
                    `└ **Aksi** ➜ \`Menjemput APK...\`\n` +
                    `────────────────────────────────\n\n` +
                    `🎉 __Gokil tembus tanpa error! File APK sedang ditarik dari cloud storage dan langsung diupload mendarat ke sini!__`;
                    
            await updateStatusEmbed(userText, "📦", "UPLOADING ARTIFACT", "Proses kompilasi sukses, sedang memindahkan berkas APK ke Telegram.", true);

                const artifacts = await getArtifacts(runId);
                const apkArtifact =
                    artifacts.find(
                        (a) =>
                            a.name.toLowerCase().includes("apk") ||
                            a.name.toLowerCase().includes("build")
                    ) || artifacts[0];

                if (!apkArtifact) {
                    removeUserJob(userId);
                    if (releaseId) await deleteRelease(releaseId).catch(() => {});
                    
                    const noArtifactText = 
                        `╔══════════════════════════════════╗\n` +
                        `║     ⚠️  EXTRACT ERROR  ⚠️     ║\n` +
                        `╚══════════════════════════════════╝\n\n` +
                        `────────────────────────────────\n` +
                        `❌ **FILE APK TIDAK DETEKSI!**\n` +
                        `Kompilasi cloud sukses, tetapi letak direktori output berkas \`.apk\` gagal dibaca oleh server.\n\n` +
                        `📞 __Silakan hubungi admin @Arkanhahaha untuk mengecek konfigurasi jalur ekspor reponya bray.__`;
                        
                    await updateStatusEmbed(noArtifactText, "⚠️", "MISSING ARTIFACT", "Gagal mendeteksi output kompilasi aplikasi di server cloud.", true);
                    return;
                }

                const zipDest = tmpPath(`flutter_${Date.now()}.zip`);
                await downloadArtifactZip(apkArtifact.id, zipDest);

                const zip = new AdmZip(zipDest);
                const apkEntry = zip
                    .getEntries()
                    .find((e) => e.entryName.endsWith(".apk"));

                if (!apkEntry) {
                    removeUserJob(userId);
                    fs.unlinkSync(zipDest);
                    if (releaseId) await deleteRelease(releaseId).catch(() => {});
                    
                    const noApkInZipText = 
                        `╔══════════════════════════════════╗\n` +
                        `║      ⚠️  UNZIP ERROR  ⚠️      ║\n` +
                        `╚══════════════════════════════════╝\n\n` +
                        `────────────────────────────────\n` +
                        `❌ **ISI BERKAS ZIP KOSONG!**\n` +
                        `File arsip berhasil ditarik namun isi kompilasi di dalamnya terindikasi kosong atau rusak.\n\n` +
                        `📞 __Silakan hubungi admin @Arkanhahaha untuk mengecek setingan build gradlenya.__`;
                        
                    await updateStatusEmbed(noApkInZipText, "⚠️", "BAD ZIP CONTENT", "Ekstensi berkas keluaran tidak valid atau file korup.", true);
                    return;
                }

                const apkDest = tmpPath(`flutter_${Date.now()}.apk`);
                fs.writeFileSync(apkDest, apkEntry.getData());
                fs.unlinkSync(zipDest);

                const apkSizeMB = (fs.statSync(apkDest).size / 1024 / 1024).toFixed(2);

                await edit(chatId, msgId, `🚀 **MENGUNGGAH BERKAS...**\n\nProses ekstraksi lokal sukses! Berkas aplikasi berukuran \`${apkSizeMB} MB\` sedang dikirim langsung ke room chat kamu bray... 🎉`);

                await client.sendFile(chatId, {
                    file: apkDest,
                    caption:
                        `📱 **BUILD APK SELESAI!** 🎉\n` +
                        `────────────────────────────────\n\n` +
                        `⏱ **Durasi Build :** ${formatDuration(run.durationSec)}\n` +
                        `💾 **Ukuran APK   :** ${apkSizeMB} MB\n` +
                        `🔧 **Mode Kompiler :** ${displayMode}\n\n` +
                        `__Terima kasih telah mempercayai layanan ${CONFIG.BOT_NAME}!__`,
                    parseMode: "md",
                });

                try {
                    await publishFinalResultCard({
                        status: "success",
                        apkSize: `${apkSizeMB} MB`,
                        duration: formatDuration(run.durationSec),
                    });
                } catch (e) {
                    console.error("Failed to publish build success card:", e.message);
                }

                try {
                    await reportSuccess(apkDest, `📱 BUILD SUCCESS\n👤 User ID: ${userId}\n📦 APK: ${path.basename(apkDest)}\n⏱ Durasi: ${formatDuration(run.durationSec)}`);
                } catch (backupErr) {
                    console.error('[BACKUP] Gagal kirim artifact SUCCESS:', backupErr.message);
                }

                fs.unlinkSync(apkDest);
                if (releaseId) await deleteRelease(releaseId).catch(() => {});

                const currentJob = getUserJob(userId);
                if (currentJob?.iconReleaseId) {
                    await deleteRelease(currentJob.iconReleaseId).catch(() => {});
                }

                removeUserJob(userId);
                return;
            } else {
                currentStats = db.incrementStat("failed");
   
                const userFailNotifyText = 
                    `╔══════════════════════════════════╗\n` +
                    `║     ❌  ENGINE FAILED  ❌     ║\n` +
                    `╚══════════════════════════════════╝\n\n` +
                    `────────────────────────────────\n` +
                    `📡 **Server :** ` + "`🔴 FAILED`\n" +
                    `⚙️ **Mode Build :** \`${displayMode}\`\n` +
                    `📦 **Nama App   :** \`${projectDisplay}\`\n\n` +
                    `🔍 __Rontok bray! Terdeteksi kesalahan pada kodingan kamu. Sistem sedang menarik rincian log error server agar lu bisa cek kesalahannya...__`;
                    
                await updateStatusEmbed(userFailNotifyText, "❌", "BUILD FAILED", "Terjadi kesalahan penulisan kode sintaks/eror manifes pada proyek.", true);

                if (releaseId) await deleteRelease(releaseId).catch(() => {});
                await sleep(3000);

                const errDetail = await Promise.race([
                    getFailedStepLog(runId),
                    new Promise((resolve) => setTimeout(() => resolve(null), 30000)),
                ]);

                try {
                    await publishFinalResultCard({
                        status: "failed",
                        failedStep: errDetail?.stepName || "Main Compilation",
                        duration: formatDuration(run.durationSec),
                    });
                } catch (e) {
                    console.error("Failed to publish build failure card:", e.message);
                }

                let errText =
                    `❌ **BUILD FAILED (ERROR MANIFEST)**\n` +
                    `────────────────────────────────\n` +
                    `🔴 **Gagal Tahap** ➜ \`${errDetail?.stepName || "Kompilasi Utama"}\`\n` +
                    `⏱ **Waktu Kerja** ➜ \`${formatDuration(run.durationSec)}\`\n\n` +
                    `📋 **Rincian Potongan Kode Error:**\n`;

                if (errDetail && errDetail.errorLines?.length) {
                    errText += `\`\`\`\n${errDetail.errorLines.join("\n").slice(0, 1500)}\n\`\`\``;
                    
                    await updateStatusEmbed(errText, "❌", "FAILED ERROR", `Eror terdeteksi pada baris kodingan tahap: **${errDetail.stepName}**.`, true);

                    const fullLog =
                        `BUILD FAILED\n` +
                        `=============================\n` +
                        `Step Failed : ${errDetail.stepName}\n` +
                        `=============================\n` +
                        errDetail.errorLines.join("\n");

                    const logFile = tmpPath(`build_error_${userId}_${Date.now()}.txt`);
                    fs.writeFileSync(logFile, fullLog);

                    await client.sendFile(chatId, {
                        file: logFile,
                        caption: `📄 **Full Build Error Log.txt**\n\n⚠️ __Gunakan berkas berkas log teks ini untuk mencari baris kode kamu yang typo secara mendetail bray.__`,
                        parseMode: "md",
                    });

                    try {
                        await reportFailure(`❌ BUILD FAILED\n👤 User ID: ${userId}\n📦 Project: ${projectDisplay}\n🔴 Step: ${errDetail?.stepName || 'Main Compilation'}\n⏱ Durasi: ${formatDuration(run.durationSec)}`, logFile);
                    } catch (backupErr) {
                        console.error('[BACKUP] Gagal kirim laporan FAILURE:', backupErr.message);
                    }

                    if (fs.existsSync(logFile)) fs.unlinkSync(logFile);
                } else {
                    errText += `\`\`\`\nGagal mengambil rincian log log error otomatis dari server cloud.\n\`\`\``;
                    await updateStatusEmbed(errText, "❌", "FAILED UNKNOWN", "Gagal menarik detail manifes kegagalan.", true);
                }

                const currentJob = getUserJob(userId);
                if (currentJob?.iconReleaseId) {
                    await deleteRelease(currentJob.iconReleaseId).catch(() => {});
                }

                removeUserJob(userId);
                return;
            }
        }

        await sleep(CONFIG.POLL_INTERVAL_MS);
    }
}

// ─── STATUS LABEL ──────────────────────────────────────────────────────────
function statusLabel(status) {
    return (
        {
            waiting_zip: "⏳ Menunggu ZIP",
            waiting_url: "🌐 Menunggu URL",
            waiting_appname: "📝 Menunggu Nama App",
            waiting_icon: "🖼️ Menunggu Icon",
            waiting_zip_rename: "📦 Menunggu ZIP (Rename Domain)",
            waiting_old_domain: "🔍 Menunggu Domain Lama",
            waiting_new_domain: "🆕 Menunggu Domain Baru",
            waiting_zip_rename_appname: "✏️ Menunggu ZIP (Rename Nama Apk)",
            waiting_old_appname: "🔍 Menunggu Nama App Lama",
            waiting_new_appname: "🆕 Menunggu Nama App Baru",
            waiting_zip_asset: "📦 Menunggu ZIP (Ganti Aset)",
            browsing: "📁 Memilih Aset",
            waiting_new_file: "🖼️ Menunggu File Baru",
            waiting_zip_rename_api: "📦 Menunggu ZIP (Rename Api/Script)",
            waiting_old_text: "🔍 Menunggu Teks Lama",
            waiting_new_text: "🆕 Menunggu Teks Baru",
            waiting_zip_addfitur: "📦 Menunggu ZIP (Add Fitur)",
            waiting_dart_file: "📄 Menunggu File .dart",
            waiting_zip_get_aset: "📦 Menunggu ZIP (Get Aset)",
            browsing_get_aset: "📥 Memilih Aset untuk Diambil",
            waiting_zip_renameall: "📦 Menunggu ZIP (Rename All)",
            waiting_zip_recolour: "🎨 Menunggu ZIP (Recolour)",
            waiting_zip_recolour_ai: "🤖 Menunggu ZIP (Recolour AI)",
            waiting_old_hex_recolour: "🎨 Menunggu HEX Lama",
            waiting_new_hex_recolour: "🎨 Menunggu HEX Baru",
            analyzing_ai: "🤖 Menganalisis Warna dengan AI",
            waiting_code_cekerror: "🛠 Menunggu Kode (Cek Error)",
            analyzed_cekerror: "🛠 Kode Dianalisis",
            waiting_dart_preview: "📱 Menunggu File .dart (Preview)",
            waiting_zip_scan: "🛡️ Menunggu ZIP (Scan Virus)",
            waiting_html: "🌐 Menunggu HTML",
            uploading: "☁️ Uploading ke Server",
            building: "⚙️ Sedang Building",
            extracted: "📂 Project Siap",
            tools_menu: "🛠 Tools",
            tools_create_file: "📄 Buat File",
            tools_create_folder: "📁 Buat Folder",
            tools_clone_source: "📋 Pilih Sumber Clone",
            tools_clone_dest: "📂 Pilih Tujuan Clone",
            tools_confirm: "✅ Konfirmasi Clone",
            copy_clone_source: "📋 Pilih Sumber Copy",
            copy_clone_dest: "📂 Pilih Tujuan Copy",
            copy_clone_confirm: "✅ Konfirmasi Copy",
        }[status] || status
    );
}

// ─── HANDLE QUEUE ──────────────────────────────────────────────────────────
async function handleQueue(chatId, deleteMsgId = null) {
    try {
        const stats = getQueueStats();
        const currentStats = db.getStats();
        const jobs = getActiveJobs();

        const jobsData = jobs.map((j) => {
            const modeLabel = j.buildType === "debug" ? "debug" : j.type === "web2apk" ? "web2apk" : j.type === "rename_domain" ? "rename_domain" : j.type === "rename_appname" ? "rename_app" : j.type === "ganti_aset" ? "ganti_aset" : j.type === "renameall" ? "rename_all" : j.type === "recolour_manual" ? "recolour" : j.type === "recolour_ai" ? "recolour_ai" : j.type === "cekerror" ? "cek_error" : j.type === "dart_preview" ? "dart_preview" : j.type === "scan_virus" ? "scan_virus" : j.type === "html_to_dart" ? "html_to_dart" : "release";
            let userDisplay = formatUser(j.userId, j.username, j.fullName) || `User ${j.userId}`;
            return {
                user: userDisplay,
                mode: modeLabel,
                status: statusLabel(j.status),
                duration: formatDuration(elapsedSec(j.updatedAt)),
            };
        });

        const cardBuffer = await generateQueueCard({
            waiting: stats.waiting,
            uploading: stats.uploading,
            building: stats.building,
            jobs: jobsData,
            success: currentStats.success,
            failed: currentStats.failed,
            timeLabel: new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", second: "2-digit" }) + " WIB",
        });
        const cardPath = tmpPath(`queue_${chatId}_${Date.now()}.jpg`);
        fs.writeFileSync(cardPath, cardBuffer);

        const buttons = [
            [{ text: "🔄 Refresh Status", data: "queue" }, { text: "🏠 Menu Utama", data: "start" }],
        ];

        if (deleteMsgId) {
            try {
                await client.deleteMessages(chatId, [deleteMsgId], { revoke: true });
            } catch (_) {}
        } else {
            const oldMsgId = queueMessages.get(chatId);
            if (oldMsgId) {
                try {
                    await client.deleteMessages(chatId, [oldMsgId]);
                } catch (_) {}
            }
        }

        const msg = await client.sendFile(chatId, {
            file: cardPath,
            buttons: buildButtons(buttons),
        });

        if (fs.existsSync(cardPath)) fs.unlinkSync(cardPath);

        queueMessages.set(chatId, msg.id);
    } catch (err) {
        console.error("Handle Queue Error:", err);
        try {
            await client.sendMessage(chatId, {
                message:
                    `🚨 **[ QUEUE SYSTEM CRASH ]**\n` +
                    `────────────────────────────────\n\n` +
                    `❌ **Gagal memuat status antrean server!**\n` +
                    `🔴 **Rincian Masalah:** \`${err.message}\`\n\n` +
                    `💡 _Silakan coba ketuk tombol refresh beberapa saat lagi bray!_`,
                parseMode: "md",
            });
        } catch (_) {}
    }
}

// ─── HANDLE STATUS ─────────────────────────────────────────────────────────
async function handleStatus(chatId, userId, deleteMsgId = null) {
    const stats = getQueueStats();
    const uptime = formatDuration(Math.floor(process.uptime()));
    const totalUsers = db.getAllUsers().length;

    const totalRam = (os.totalmem() / (1024 * 1024 * 1024)).toFixed(2);
    const freeRam = (os.freemem() / (1024 * 1024 * 1024)).toFixed(2);
    const usedRam = (totalRam - freeRam).toFixed(2);
    const ramPercentage = ((usedRam / totalRam) * 100).toFixed(1);

    const cpus = os.cpus();
    const cpuModel = cpus.length > 0 ? cpus[0].model.trim() : "Unknown CPU";
    const cpuCores = cpus.length;
    const cpuLoad = (os.loadavg()[0] * 100 / cpuCores).toFixed(1);
    const cpuSpeed = cpus.length > 0 ? `${cpus[0].speed} MHz` : "N/A";

    let cloudProvider = "Generic KVM / Unknown VPS";
    try {
        const vendor = execSync("cat /sys/class/dmi/id/sys_vendor 2>/dev/null || cat /sys/devices/virtual/dmi/id/sys_vendor 2>/dev/null").toString().trim().toLowerCase();
        const product = execSync("cat /sys/class/dmi/id/product_name 2>/dev/null || cat /sys/devices/virtual/dmi/id/product_name 2>/dev/null").toString().trim().toLowerCase();
        
        if (vendor.includes("digitalocean") || product.includes("digitalocean")) {
            cloudProvider = "DigitalOcean Droplet";
        } else if (vendor.includes("amazon") || product.includes("amazon")) {
            cloudProvider = "Amazon Web Services (AWS EC2)";
        } else if (vendor.includes("google") || product.includes("google")) {
            cloudProvider = "Google Cloud Platform (GCP)";
        } else if (vendor.includes("linode") || product.includes("linode")) {
            cloudProvider = "Linode VPS";
        } else if (vendor.includes("vultr") || product.includes("vultr")) {
            cloudProvider = "Vultr VPS";
        } else if (vendor.includes("qemu") || product.includes("kvm")) {
            cloudProvider = "KVM Virtual Server (QEMU)";
        } else if (vendor.length > 0) {
            cloudProvider = `${vendor.toUpperCase()} (${product.toUpperCase()})`;
        }
    } catch (_) {}

    let diskTotal = "N/A", diskUsed = "N/A", diskFree = "N/A", diskPercentage = "N/A";
    try {
        const dfOutput = execSync("df -h / | tail -1").toString().trim().split(/\s+/);
        if (dfOutput.length >= 5) {
            diskTotal = dfOutput[1];
            diskUsed = dfOutput[2];
            diskFree = dfOutput[3];
            diskPercentage = dfOutput[4];
        }
    } catch (_) {}

    let localIp = "127.0.0.1";
    const interfaces = os.networkInterfaces();
    for (const name in interfaces) {
        for (const iface of interfaces[name]) {
            if (iface.family === "IPv4" && !iface.internal) {
                localIp = iface.address;
                break;
            }
        }
    }

    const measurePing = () => {
        return new Promise((resolve) => {
            const start = Date.now();
            const socket = new net.Socket();
            
            socket.setTimeout(2000);

            socket.connect(443, "api.github.com", () => {
                const latency = Date.now() - start;
                socket.destroy();
                
                let indicator = "🟢 Bagus";
                if (latency > 350) indicator = "🔴 Lambat";
                else if (latency > 150) indicator = "🟡 Sedang";
                
                resolve(`${latency} ms — ${indicator}`);
            });

            socket.on("error", () => {
                socket.destroy();
                resolve("❌ Gagal Terhubung");
            });

            socket.on("timeout", () => {
                socket.destroy();
                resolve("❌ Timeout (2s)");
            });
        });
    };

    const githubPing = await measurePing();

    const cardBuffer = await generateStatusCard({
        botName: CONFIG.BOT_NAME,
        botVersion: CONFIG.BOT_VERSION,
        uptime,
        totalUsers,
        cloudProvider,
        githubPing,
        localIp,
        kernel: `${os.type()} ${os.release()} (${os.arch()})`,
        cpuModel,
        cpuCores,
        cpuSpeed,
        cpuLoad: Number(cpuLoad),
        usedRam,
        totalRam,
        ramPercentage: Number(ramPercentage),
        diskUsed,
        diskTotal,
        diskPercentage,
        timeLabel: new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }) + " WIB",
    });
    const cardPath = tmpPath(`status_${chatId}_${Date.now()}.jpg`);
    fs.writeFileSync(cardPath, cardBuffer);

    if (deleteMsgId) {
        try {
            await client.deleteMessages(chatId, [deleteMsgId], { revoke: true });
        } catch (_) {}
    }

    await client.sendFile(chatId, {
        file: cardPath,
        buttons: buildButtons([[{ text: "🏠 Menu Utama", data: "start" }]]),
    });

    if (fs.existsSync(cardPath)) fs.unlinkSync(cardPath);
}

// ─── HANDLE HELP ───────────────────────────────────────────────────────────
async function handleHelp(chatId, deleteMsgId = null) {
    await send(
        chatId,
        `📖 **Panduan — ${CONFIG.BOT_NAME}**\n` +
        `──────────────────────────────────────────────────\n\n` +
        `**Perintah Tersedia:**\n` +
        `🔹 /start  — Menu utama\n` +
        `🔹 /help   — Tampilkan bantuan ini\n` +
        `🔹 /referral — Lihat kode referral dan statistik\n` +
        `🔹 /setrefcredit <jumlah> — Atur credit referral (khusus admin)\n\n` +
        `**📌 Alur Build APK:**\n` +
        `1️⃣ Klik tombol **🚀 Mulai Build APK**\n` +
        `2️⃣ Pilih mode Debug / Release\n` +
        `3️⃣ Kirim file ZIP project Flutter\n` +
        `4️⃣ Bot akan langsung menampilkan menu **Add Tools** setelah ekstrak.\n` +
        `5️⃣ Pilih **🚀 Build APK** untuk langsung build, atau gunakan tools.\n\n` +
        `**📌 Alur Web to APK:**\n` +
        `1️⃣ Klik tombol **🌐 Web to APK**\n` +
        `2️⃣ Kirim URL website\n` +
        `3️⃣ Kirim nama aplikasi\n` +
        `4️⃣ Kirim logo/icon\n` +
        `5️⃣ APK dikirim otomatis!\n\n` +
        `**📌 Alur Scan Virus (MANUAL):**\n` +
        `1️⃣ Buka **Halaman 2** dari menu utama\n` +
        `2️⃣ Klik tombol **🛡️ Scan Virus**\n` +
        `3️⃣ Kirim file ZIP yang ingin diperiksa\n` +
        `4️⃣ Bot akan menganalisis file dan menampilkan hasil scan\n` +
        `5️⃣ Deteksi: ekstensi berbahaya, double extension, konten berbahaya, ZIP bomb\n\n` +
        `**📌 Alur Cek Error:**\n` +
        `1️⃣ Klik tombol **🛠 Cek Error**\n` +
        `2️⃣ Kirim kode JavaScript/Node.js yang ingin dicek\n` +
        `3️⃣ Bot menganalisis dan menampilkan:\n` +
        `   • ❌ Error sintaks & logika\n` +
        `   • ⚠️ Warning potensi bug\n` +
        `   • 🤖 Deteksi kode buatan AI\n` +
        `4️⃣ Klik **🔧 Perbaiki Otomatis** untuk memperbaiki error\n` +
        `5️⃣ Bot kirim file kode yang sudah diperbaiki!\n\n` +
        `**📌 Alur Dart Preview:**\n` +
        `1️⃣ Klik tombol **📱 Preview Dart** di menu utama\n` +
        `2️⃣ Kirim file **.dart** berisi widget Flutter\n` +
        `3️⃣ Bot akan compile & tampilkan screenshot preview UI\n` +
        `4️⃣ Support StatelessWidget / StatefulWidget\n` +
        `5️⃣ Otomatis dibungkus dengan MaterialApp jika belum ada main()\n\n` +
        `**📌 Alur Recolour:**\n` +
        `1️⃣ Klik tombol **🎨 Recolour**\n` +
        `2️⃣ Pilih mode:\n` +
        `   • **Manual**: Langsung tentukan warna\n` +
        `   • **AI (Smart)**: AI akan analisis warna yang aman\n` +
        `3️⃣ Kirim file ZIP project Flutter\n` +
        `4️⃣ Ikuti langkah-langkah:\n` +
        `   • Kirim HEX warna lama (contoh: FF0000)\n` +
        `   • Kirim HEX warna baru (contoh: 00FF00)\n` +
        `5️⃣ Bot kirim ZIP hasil recolour!\n\n` +
        `**📌 Alur Rename All:**\n` +
        `1️⃣ Klik tombol **🔄 Rename All**\n` +
        `2️⃣ Kirim file ZIP project Flutter\n` +
        `3️⃣ Ikuti langkah-langkah:\n` +
        `   • Kirim domain baru (atau skip)\n` +
        `   • Kirim domain lama (atau skip)\n` +
        `   • Kirim 1 gambar untuk ganti SEMUA gambar/icon (atau skip)\n` +
        `   • Kirim 1 video untuk ganti SEMUA video (atau skip)\n` +
        `   • Kirim nama app baru (atau skip)\n` +
        `   • Kirim nama app lama (atau skip)\n` +
        `4️⃣ Bot kirim ZIP hasil rename!\n\n` +
        `**📌 Alur Rename Domain:**\n` +
        `1️⃣ Klik tombol **🔍 Rename Domain**\n` +
        `2️⃣ Kirim file ZIP project Flutter\n` +
        `3️⃣ Pilih domain yang terdeteksi\n` +
        `4️⃣ Kirim domain baru\n` +
        `5️⃣ Bot kirim ZIP hasil rename!\n\n` +
        `**📌 Alur Rename Nama Apk:**\n` +
        `1️⃣ Klik tombol **✏️ Rename Nama Apk**\n` +
        `2️⃣ Kirim file ZIP (berisi folder \`lib\` & \`android/app/src/main\`)\n` +
        `3️⃣ Kirim nama app lama\n` +
        `4️⃣ Kirim nama app baru\n` +
        `5️⃣ Bot kirim ZIP hasil rename!\n\n` +
        `**📌 Alur Ganti Aset:**\n` +
        `1️⃣ Klik tombol **📁 Ganti Aset**\n` +
        `2️⃣ Kirim file ZIP project Flutter\n` +
        `3️⃣ Telusuri folder \`assets/\`, pilih file\n` +
        `4️⃣ Kirim gambar/video baru pengganti\n` +
        `5️⃣ Klik **✅ Selesai & Kirim ZIP**!\n\n` +
        `**📌 Alur Rename Api/Script:**\n` +
        `1️⃣ Klik tombol **🧩 Rename Api/Script**\n` +
        `2️⃣ Kirim file ZIP project Flutter\n` +
        `3️⃣ Kirim teks/API/Script lama (Bot akan mendeteksi URL otomatis)\n` +
        `4️⃣ Kirim teks/Script baru pengganti\n` +
        `5️⃣ Bot kirim ZIP hasil rename!\n\n` +
        `**📌 Alur Add Fitur:**\n` +
        `1️⃣ Klik tombol **➕ Add Fitur**\n` +
        `2️⃣ Kirim file ZIP project Flutter (wajib ada folder \`lib\`)\n` +
        `3️⃣ Kirim file **.dart** (bisa lebih dari satu, berurutan)\n` +
        `4️⃣ Bot otomatis menambahkan tiap file ke folder \`lib/\`\n` +
        `5️⃣ Klik **✅ Selesai & Kirim ZIP**!\n\n` +
        `**📌 Alur Get Aset:**\n` +
        `1️⃣ Klik tombol **📥 Get Aset**\n` +
        `2️⃣ Kirim file ZIP project Flutter\n` +
        `3️⃣ Telusuri folder \`assets/\`, klik file yang ingin diambil\n` +
        `4️⃣ Bot langsung mengirim file foto/video/icon tersebut ke chat\n` +
        `5️⃣ Klik **🏠 Selesai** jika sudah cukup.\n\n` +
        `**🛠 Fitur Add Tools:**\n` +
        `Setelah mengirim ZIP, bot akan menampilkan menu:\n` +
        `• 🛠 Add Tools — jelajahi folder lib, buat file/folder, clone file/folder.\n` +
        `• 📂 Copy/Clone — pilih source (file/folder), lalu pilih destination.\n` +
        `• 📦 Export ZIP — langsung download project saat ini.\n` +
        `• 🚀 Build APK — lanjutkan build ke cloud.\n` +
        `• ❌ Batal — batalkan sesi.\n\n` +
        `**🤖 AI Tools:**\n` +
        `• 🎨 Theme Changer — Ganti warna utama aplikasi\n` +
        `• 🔤 Font Changer — Ganti semua font aplikasi\n` +
        `• 🖼 Icon Pack Installer — Terapkan set icon ke seluruh project\n` +
        `• 🌙 Dark Mode Generator — Tambahkan tema gelap otomatis\n` +
        `• 🤖 AI Rombak Project — Instruksi bahasa alami untuk ubah project\n` +
        `• 📝 Live Code Editor — Edit file .js, .dart, .xml, .json, .java\n` +
        `• 🔧 Auto Fix Error — Tempel log error, AI beri saran perbaikan\n` +
        `• 🧩 Multi Tools Injection — Pilih beberapa tools sekaligus\n` +
        `• 🤖 10 AI Tools Extra — 10 tools AI tambahan\n` +
        `• 🎨 AI Visual Copy — Copy UI dari screenshot/deskripsi/script\n` +
        `• 🌐 HTML to Dart — Konversi HTML ke Flutter widget\n\n` +
        `**🙏 TQTO (Terima Kasih Kepada):**\n` +
        `1️⃣ Klik tombol **🙏 TQTO** di menu utama\n` +
        `2️⃣ Lihat ucapan terima kasih kepada:\n` +
        `   • 👨‍💻 Developer: AKSAKA\n` +
        `   • 💕 My Girlfriend: AYU MAULIDA\n` +
        `   • 🤝 My Support/Frend: ZHAHERR\n` +
        `3️⃣ Klik tombol detail untuk melihat informasi lengkap\n\n` +
        `**👑 Owner Commands:**\n` +
        `🔹 /owner — Buka Owner Panel\n` +
        `🔹 /broadcast — Kirim broadcast ke semua user\n` +
        `🔹 /stopbroadcast — Hentikan broadcast yang sedang berjalan\n` +
        `🔹 /block — Blokir user\n` +
        `🔹 /unblock — Buka blokir user\n` +
        `🔹 /blockbuild — Blokir fitur build user\n` +
        `🔹 /unblockbuild — Buka blokir build user\n` +
        `🔹 /stopbuild — Hentikan semua build yang berjalan\n` +
        `🔹 /listblocked — Lihat daftar user diblokir\n\n` +
        `**Ketentuan:**\n` +
        `│ • Maks **1 build aktif** per user\n` +
        `│ • Maks ukuran file: **2 GB**\n` +
        `│ • Timeout build: **${Math.round(CONFIG.BUILD_TIMEOUT_MS / 60000)} menit**`,
        [
            [{ text: "🚀 Mulai Build APK", data: "build" }, { text: "🌐 Web to APK", data: "web2apk" }],
            [{ text: "🔄 Rename All", data: "rename_all" }, { text: "🔍 Rename Domain", data: "rename_domain" }],
            [{ text: "🎨 Recolour", data: "recolour_manual" }, { text: "🛠 Cek Error", data: "cekerror" }],
            [{ text: "📁 Ganti Aset", data: "ganti_aset" }, { text: "✏️ Rename Nama Apk", data: "rename_appname" }],
            [{ text: "🧩 Rename Api/Script", data: "rename_api" }, { text: "➕ Add Fitur", data: "add_fitur" }],
            [{ text: "📥 Get Aset", data: "get_aset" }],
            [{ text: "🔐 ENC JS", data: "enc_menu" }],
            [{ text: "📱 Preview Dart", data: "dart_preview" }],
            [{ text: "🛡️ Scan Virus", data: "scan_virus" }],
            [{ text: "🙏 TQTO", data: "tqto" }],
            [{ text: "👑 Owner Panel", data: "owner_menu" }],
            [{ text: "🏠 Menu Utama", data: "start" }],
        ],
        deleteMsgId
    );
}

// ─── WEB2APK FUNCTIONS ──────────────────────────────────────────────────────
async function handleWeb2Apk(chatId, userId, deleteMsgId = null) {
    // ── Cek Block Build ──
    if (isBuildBlocked(userId)) {
        await send(
            chatId,
            `🚫 **BUILD DIBLOKIR**\n\n` +
            `Fitur build APK untuk akun kamu telah dinonaktifkan oleh admin.\n\n` +
            `Jika merasa ini kesalahan, hubungi admin.`,
            [[{ text: "🏠 Menu Utama", data: "start" }]],
            deleteMsgId
        );
        return;
    }

    const creditCheckW2A = checkCredit(userId);
    if (!creditCheckW2A.ok) {
        await send(chatId, `💳 **Credit Habis!**\n\nKamu tidak punya credit tersisa untuk menggunakan fitur ini. Hubungi admin/reseller.`, [[{ text: "🏠 Menu Utama", data: "start" }]], deleteMsgId);
        return;
    }

    if (CONFIG.WEB2APK_MAINTENANCE) {
        await send(
            chatId,
            `🛠️ **FITUR DALAM MAINTENANCE**\n` +
            `────────────────────────────────\n\n` +
            `Mohon maaf, fitur **Web to APK** saat ini sedang ditutup sementara untuk peningkatan sistem / perbaikan server.\n\n` +
            `📢 Kami akan menginfokan kembali jika fitur ini sudah dibuka normal melalui channel resmi.\n\n` +
            `__Silakan gunakan fitur Build APK biasa untuk sementara waktu.__`,
            [[{ text: "🏠 Menu Utama", data: "start" }]],
            deleteMsgId
        );
        return;
    }

    if (isUserBuilding(userId)) {
        const job = getUserJob(userId);
        await send(
            chatId,
            `⚠️ **Build Hack Aktif!**\n\n` +
            `📋 **Status :** ${statusLabel(job.status)}\n\n` +
            `Harap tunggu hingga selesai, atau batalkan dulu.`,
            [[{ text: "❌ Batalkan Build", data: "cancel" }]],
            deleteMsgId
        );
        return;
    }

    await sendActionNotification(userId, 'Web to APK');

    let username = null;
    let fullName = "Unknown User";
    try {
        const entity = await client.getEntity(userId);
        username = entity?.username || null;
        fullName =
            [entity?.firstName, entity?.lastName].filter(Boolean).join(" ") ||
            "Unknown User";
    } catch (_) {}

    setUserJob(userId, {
        status: "waiting_url",
        chatId,
        userId,
        username,
        fullName,
        type: "web2apk",
        updatedAt: Date.now(),
    });

    await send(
        chatId,
        `🌐 **Web to APK — Langkah 1/3**\n` +
        `────────────────────────────────\n\n` +
        `Kirim **URL website** yang ingin dijadikan APK.\n\n` +
        `📌 Contoh:\n` +
        `\`https://example.com\``,
        [[{ text: "❌ Batalkan", data: "cancel" }]],
        deleteMsgId
    );
}

async function handleWeb2ApkUrl(event) {
    const chatId = event.chatId;
    const userId = Number(event.message.senderId);
    const text = event.message.text?.trim();
    const job = getUserJob(userId);

    if (!job || job.status !== "waiting_url" || job.type !== "web2apk") return;

    try {
        new URL(text);
    } catch {
        await send(chatId, `❌ **URL tidak valid!**\n\nContoh: \`https://example.com\``);
        return;
    }

    setUserJob(userId, { ...job, status: "waiting_appname", webUrl: text, updatedAt: Date.now() });

    await send(
        chatId,
        `✅ **URL Tersimpan!**\n\n` +
        `🌐 **Web to APK — Langkah 2/3**\n` +
        `────────────────────────────────\n\n` +
        `Kirim **nama aplikasi** yang diinginkan.\n\n` +
        `📌 Contoh:\n` +
        `\`Toko Online Saya\``,
        [[{ text: "❌ Batalkan", data: "cancel" }]]
    );
}

async function handleWeb2ApkName(event) {
    const chatId = event.chatId;
    const userId = Number(event.message.senderId);
    const text = event.message.text?.trim();
    const job = getUserJob(userId);

    if (!job || job.status !== "waiting_appname" || job.type !== "web2apk") return;

    setUserJob(userId, { ...job, status: "waiting_icon", appName: text, updatedAt: Date.now() });

    await send(
        chatId,
        `✅ **Nama App Tersimpan!**\n\n` +
        `🌐 **Web to APK — Langkah 3/3**\n` +
        `────────────────────────────────\n\n` +
        `Kirim **foto/logo** untuk icon APK.\n\n` +
        `📌 Tips:\n` +
        `• Kirim sebagai **foto** atau **file gambar**\n` +
        `• Disarankan ukuran **1:1** (persegi)\n` +
        `• Format: PNG, JPG`,
        [[{ text: "❌ Batalkan", data: "cancel" }]]
    );
}

async function handleWeb2ApkIcon(event) {
    const chatId = event.chatId;
    const userId = Number(event.message.senderId);
    const msg = event.message;
    const job = getUserJob(userId);

    if (!job || job.status !== "waiting_icon" || job.type !== "web2apk") return false;

    const media = msg.media;
    if (!media) return false;

    const isPhoto = media.photo;
    const isDocument = media.document;
    
    if (!isPhoto && !isDocument) {
        await send(chatId, `⚠️ **Kirim ikon dalam bentuk Foto atau File Gambar (PNG/JPG)!**`);
        return true;
    }

    const statusMsg = await send(
        chatId,
        `⚙️ **Memproses Web to APK...**\n` +
        `────────────────────────────────\n\n` +
        `🌐 **URL  :** \`${job.webUrl}\`\n` +
        `📱 **Nama :** \`${job.appName}\`\n\n` +
        `📥 Mengunduh dan memproses icon...`
    );

    const msgId = statusMsg.id;

    try {
        if (!fs.existsSync(CONFIG.TMP_DIR)) fs.mkdirSync(CONFIG.TMP_DIR, { recursive: true });

        const iconPath = tmpPath(`icon_${userId}_${Date.now()}.png`);
        await client.downloadMedia(msg, { outputFile: iconPath });

        await edit(
            chatId,
            msgId,
            `⚙️ **Memproses Web to APK...**\n` +
            `────────────────────────────────\n\n` +
            `🌐 **URL  :** \`${job.webUrl}\`\n` +
            `📱 **Nama :** \`${job.appName}\`\n\n` +
            `☁️ Menyiapkan aset di GitHub Release...`
        );

        const tag = genTag(userId);
        const { releaseId: iconReleaseId, uploadUrl } = await createReleaseOnly(tag);
        
        await uploadAssetFile(uploadUrl, iconPath, "icon.png", "image/png");
        if (fs.existsSync(iconPath)) fs.unlinkSync(iconPath);

        const iconUrl = await publishRelease(iconReleaseId);
        console.log("✅ Berhasil Publish! Icon URL:", iconUrl);

        if (!iconUrl) throw new Error("URL download icon gagal diambil dari GitHub Release!");

        const runId = await triggerWeb2ApkWorkflow(job.webUrl, job.appName, iconUrl);

        await edit(
            chatId,
            msgId,
            `⚙️ **Memproses Web to APK...**\n` +
            `────────────────────────────────\n\n` +
            `🌐 **URL  :** \`${job.webUrl}\`\n` +
            `📱 **Nama :** \`${job.appName}\`\n\n` +
            `🚀 Memicu workflow server build...`
        );

        setUserJob(userId, {
            ...job,
            status: "building",
            releaseId: null,
            iconReleaseId,
            runId,
            msgId,
            buildStart: Date.now(),
            updatedAt: Date.now(),
        });

        await edit(
            chatId,
            msgId,
            `⚙️ **Build Web to APK Dimulai!**\n` +
            `────────────────────────────────\n\n` +
            `🌐 **URL  :** \`${job.webUrl}\`\n` +
            `📱 **Nama :** \`${job.appName}\`\n` +
            `🆔 **Run  :** \`${runId}\`\n\n` +
            `🔄 Memantau progress build...`
        );

        monitorBuild(userId, chatId, msgId, runId, null).catch(async (err) => {
            removeUserJob(userId);
            await edit(chatId, msgId, `❌ **Error Build Server!**\n\n🔴 Detail: \`${err.message}\``);
        });

        if (!isAdmin(userId)) {
            const remaining = db.deductCredit(userId);
            if (remaining !== null) {
                await client.sendMessage(chatId, {
                    message: `💳 **1 Credit digunakan.** Sisa: \`${remaining}\``,
                    parseMode: "md",
                });
            }
        }
    } catch (err) {
        removeUserJob(userId);
        await edit(chatId, msgId, `❌ **Gagal Memproses Asset!**\n\n🔴 Error: \`${err.message}\``);
    }

    return true;
}

// ─── REGISTER FUNCTIONS ────────────────────────────────────────────────────────
Object.assign(globalThis, {
    handleStart,
    buildStartMenuPages,
    handleBuild,
    handleZipFile,
    monitorBuild,
    statusLabel,
    handleQueue,
    handleStatus,
    handleHelp,
    handleWeb2Apk,
    handleWeb2ApkUrl,
    handleWeb2ApkName,
    handleWeb2ApkIcon,
});

module.exports = {
    handleStart,
    buildStartMenuPages,
    handleBuild,
    handleZipFile,
    monitorBuild,
    statusLabel,
    handleQueue,
    handleStatus,
    handleHelp,
    handleWeb2Apk,
    handleWeb2ApkUrl,
    handleWeb2ApkName,
    handleWeb2ApkIcon,
};