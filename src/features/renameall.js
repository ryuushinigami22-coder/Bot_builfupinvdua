// src/features/renameall.js
// Fitur Rename All: Menggabungkan rename domain, asset (gambar/video), dan nama app dalam satu alur.
// Satu file gambar untuk mengganti SEMUA gambar di assets/ & ic_launcher*
// Satu file video untuk mengganti SEMUA video di assets/

const path = require('path');
const AdmZip = require('adm-zip');

// Ekstensi file teks untuk rename domain & nama app
const TEXT_EXTS = ['.dart', '.js', '.json', '.yaml', '.yml', '.xml', '.gradle', '.properties', '.txt', '.kt', '.swift', '.html', '.ts', '.plist', '.env'];
const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.gif'];
const VIDEO_EXTS = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.m4v'];

function isAssetImage(entryName) {
    const base = path.basename(entryName);
    const lower = entryName.toLowerCase();
    const ext = path.extname(base).toLowerCase();
    if (!IMAGE_EXTS.includes(ext)) return false;

    // Cek apakah file berada di folder assets/ atau merupakan icon
    return (
        lower.includes('/assets/') || lower.startsWith('assets/') ||
        (lower.includes('mipmap') && (base.startsWith('ic_launcher') || base.startsWith('ic_background') || base.startsWith('ic_foreground'))) ||
        lower.includes('appicon.appiconset') ||
        (lower.includes('/icons/') && base.startsWith('Icon-')) ||
        base === 'favicon.png' ||
        lower.includes('splash') || lower.includes('launch_background')
    );
}

function isAssetVideo(entryName) {
    const lower = entryName.toLowerCase();
    const ext = path.extname(entryName).toLowerCase();
    if (!VIDEO_EXTS.includes(ext)) return false;
    return lower.includes('/assets/') || lower.startsWith('assets/');
}

// Fungsi utama untuk memulai proses Rename All
async function handleRenameAll(chatId, userId, deleteMsgId = null) {
    // Cek kredit
    const creditCheck = checkCredit(userId);
    if (!creditCheck.ok) {
        await send(
            chatId,
            `💳 **Credit Habis!**\n\nKamu tidak punya credit tersisa. Hubungi admin/reseller.`,
            [[{ text: "🏠 Menu Utama", data: "start" }]],
            deleteMsgId
        );
        return;
    }

    // Cek proses aktif
    if (isUserBuilding(userId)) {
        const job = getUserJob(userId);
        await send(
            chatId,
            `⚠️ **Proses Aktif Terdeteksi!**\n` +
            `────────────────────────────────\n\n` +
            `📋 **Status :** ${statusLabel(job.status)}\n\n` +
            `Harap tunggu hingga proses sebelumnya selesai, atau gunakan tombol dibawah untuk membatalkan.`,
            [[{ text: "❌ Batalkan", data: "cancel" }]],
            deleteMsgId
        );
        return;
    }

    await sendActionNotification(userId, 'Rename All (Multi-Feature)');

    let username = null;
    let fullName = "Unknown User";
    try {
        const entity = await client.getEntity(userId);
        username = entity?.username || null;
        fullName = [entity?.firstName, entity?.lastName].filter(Boolean).join(" ") || "Unknown User";
    } catch (_) {}

    // Set state awal: menunggu ZIP
    const jobData = {
        status: 'waiting_zip_renameall',
        chatId,
        userId,
        username,
        fullName,
        type: 'renameall',
        updatedAt: Date.now(),
    };
    setUserJob(userId, jobData);

    await send(
        chatId,
        `🔄 **RENAME ALL — MULTI-FEATURE**\n` +
        `────────────────────────────────\n\n` +
        `Fitur ini menggabungkan beberapa proses dalam satu alur:\n` +
        `• 🌐 Rename Domain\n` +
        `• 🖼️ Ganti Semua Gambar/Icon (1 file untuk semua)\n` +
        `• 🎬 Ganti Semua Video (1 file untuk semua)\n` +
        `• 📱 Rename Nama Aplikasi\n\n` +
        `Kirim file **ZIP** project Flutter kamu sekarang.\n\n` +
        `┌── **Persyaratan** ──\n` +
        `│ ✅ Format file : \`.zip\`\n` +
        `│ ✅ Maks ukuran : \`2 GB\`\n` +
        `└────────────────────\n\n` +
        `⚠️ __Bot akan memandu langkah demi langkah. Ketik \`skip\` untuk melewati bagian tertentu.__`,
        [[{ text: "❌ Batalkan", data: "cancel" }]],
        deleteMsgId
    );
}

// Handler untuk menerima file ZIP
async function handleRenameAllZipFile(event) {
    const chatId = event.chatId;
    const userId = Number(event.message.senderId);
    const msg = event.message;
    const job = getUserJob(userId);

    if (!job || job.status !== 'waiting_zip_renameall' || job.type !== 'renameall') return false;

    const media = msg.media;
    if (!media || !media.document) {
        await send(chatId, `⚠️ **[ INPUT ERROR ]**\n────────────────────────────────\n\nKirim file **ZIP** project Flutter kamu ya bray, bukan pesan teks biasa!`);
        return true;
    }

    const doc = media.document;
    const fileName = doc.attributes?.find((a) => a.fileName)?.fileName || 'project.zip';

    if (!fileName.endsWith('.zip')) {
        await send(
            chatId,
            `❌ **FORMAT FILE TIDAK DIDUKUNG!**\n\nFile yang kamu kirim berformat salah bray.\n• **Ekstensi Wajib:** \`.zip\`\n\n💡 __Silakan kompres ulang project Flutter kamu menjadi file .zip lalu kirimkan kembali ke sini!__`
        );
        return true;
    }

    const fileSizeMB = (doc.size / 1024 / 1024).toFixed(1);
    const statusMsg = await send(
        chatId,
        `📥 **Mengunduh ZIP...**\n\n📦 **File** ➜ \`${fileName}\`\n📏 **Ukuran** ➜ \`${fileSizeMB} MB\`\n\n⏳ __Tunggu sebentar...__`
    );
    const msgId = statusMsg.id;

    try {
        if (!fs.existsSync(CONFIG.TMP_DIR)) {
            fs.mkdirSync(CONFIG.TMP_DIR, { recursive: true });
        }

        const localZip = tmpPath(`renameall_${userId}_${Date.now()}.zip`);
        await client.downloadMedia(msg, { outputFile: localZip });

        // Baca ZIP untuk deteksi asset
        const zip = new AdmZip(localZip);
        let hasImgs = false,
            hasVids = false;
        let iconFormat = 'png'; // default

        const iconFormats = {};
        for (const entry of zip.getEntries()) {
            if (entry.isDirectory) continue;
            if (isAssetImage(entry.entryName)) hasImgs = true;
            if (isAssetVideo(entry.entryName)) hasVids = true;

            // Deteksi format ic_launcher
            const base = path.basename(entry.entryName).toLowerCase();
            if (entry.entryName.toLowerCase().includes('mipmap') && base.startsWith('ic_launcher')) {
                const ext = path.extname(base).replace('.', '').toLowerCase();
                if (ext) iconFormats[ext] = (iconFormats[ext] || 0) + 1;
            }
        }

        // Format icon paling dominan
        const sortedFmt = Object.entries(iconFormats).sort((a, b) => b[1] - a[1]);
        if (sortedFmt.length > 0) iconFormat = sortedFmt[0][0];

        // Simpan ZIP buffer di userState (lebih aman daripada file path untuk multi-step)
        const zipBuffer = fs.readFileSync(localZip);
        if (fs.existsSync(localZip)) fs.unlinkSync(localZip); // Hapus file fisik, simpan buffer di memory

        // Update job
        setUserJob(userId, {
            ...job,
            status: 'waiting_new_domain_renameall',
            zipBuffer,
            fileName,
            fileSizeMB,
            hasImgs,
            hasVids,
            iconFormat,
            updatedAt: Date.now(),
        });

        const assetInfo = [];
        if (hasImgs) assetInfo.push(`🖼️ **${zip.getEntries().filter(e => isAssetImage(e.entryName)).length}** gambar/icon (assets + ic_launcher)`);
        if (hasVids) assetInfo.push(`🎬 **${zip.getEntries().filter(e => isAssetVideo(e.entryName)).length}** video`);
        const assetLine = assetInfo.length ? assetInfo.join('\n') : '📭 Tidak ada asset gambar/video';

        await edit(
            chatId,
            msgId,
            `✅ **Project diterima!**\n\n` +
            `📦 **Asset ditemukan:**\n${assetLine}\n\n` +
            `🔹 **Langkah 1 — Domain Baru**\n` +
            `Kirim domain baru (dengan port jika ada).\n` +
            `Contoh: \`api.brand.com:8080\`\n\n` +
            `⏭️ Ketik \`skip\` untuk lewati.`,
            [[{ text: "❌ Batalkan", data: "cancel" }]]
        );
    } catch (err) {
        removeUserJob(userId);
        await edit(chatId, msgId, `❌ **PROCESS FAILED**\n\n🛑 **Error:** \`${err.message}\``);
    }
    return true;
}

// Handler untuk semua input teks selama proses Rename All
async function handleRenameAllText(event) {
    const chatId = event.chatId;
    const userId = Number(event.message.senderId);
    const text = event.message.text?.trim();
    const job = getUserJob(userId);

    if (!job || job.type !== 'renameall') return false;

    const currentStatus = job.status;

    // ─── STEP 1: Terima Domain Baru ──────────────────────────────────────────
    if (currentStatus === 'waiting_new_domain_renameall') {
        const skip = text.toLowerCase() === 'skip';
        const newDomain = skip ? null : text;

        if (!skip && (!text || text.length < 3)) {
            await send(chatId, `❌ **Domain tidak valid!**\n\nKirim domain yang valid, contoh: \`api.brand.com\`\natau ketik \`skip\` untuk melewati.`);
            return true;
        }

        setUserJob(userId, {
            ...job,
            status: 'waiting_old_domain_renameall',
            newDomain,
            updatedAt: Date.now(),
        });

        if (skip) {
            await send(
                chatId,
                `⏭️ Domain baru dilewati.\n\n` +
                `🔹 **Langkah 2 — Domain Lama**\n` +
                `Kirim domain lama yang ingin diganti.\n` +
                `Contoh: \`api.old.com:3000\`\n\n` +
                `⏭️ Ketik \`skip\` untuk lewati.`,
                [[{ text: "❌ Batalkan", data: "cancel" }]]
            );
        } else {
            await send(
                chatId,
                `✅ Domain baru: \`${newDomain}\`\n\n` +
                `🔹 **Langkah 2 — Domain Lama**\n` +
                `Kirim domain lama yang ingin diganti.\n` +
                `Contoh: \`api.old.com:3000\`\n\n` +
                `⏭️ Ketik \`skip\` untuk lewati.`,
                [[{ text: "❌ Batalkan", data: "cancel" }]]
            );
        }
        return true;
    }

    // ─── STEP 2: Terima Domain Lama ──────────────────────────────────────────
    if (currentStatus === 'waiting_old_domain_renameall') {
        const skip = text.toLowerCase() === 'skip';
        const oldDomain = skip ? null : text;

        if (!skip && (!text || text.length < 3)) {
            await send(chatId, `❌ **Domain tidak valid!**\n\nKirim domain yang valid, contoh: \`api.old.com\`\natau ketik \`skip\` untuk melewati.`);
            return true;
        }

        // Jika domain baru ada tapi domain lama skip, atau sebaliknya, tidak masalah.
        // Jika keduanya ada, proses rename domain akan jalan.
        const nextState = {
            ...job,
            status: 'waiting_new_image_renameall',
            oldDomain,
            updatedAt: Date.now(),
        };

        // Cek apakah ada gambar untuk diganti
        if (job.hasImgs) {
            setUserJob(userId, nextState);
            await send(
                chatId,
                `${oldDomain ? `✅ Domain lama: \`${oldDomain}\`\n\n` : ''}` +
                `🔹 **Langkah 3 — Ganti Semua Gambar/Icon**\n\n` +
                `🖼️ **Format icon terdeteksi:** \`${(job.iconFormat || 'png').toUpperCase()}\`\n\n` +
                `Kirim **1 file gambar** dalam format **${(job.iconFormat || 'png').toUpperCase()}** sebagai **Dokumen/File**.\n\n` +
                `Bot akan mengganti KONTEN dari SEMUA file gambar dan icon di project (assets/, ic_launcher*, dll).\n` +
                `Nama file asli akan dipertahankan.\n\n` +
                `⏭️ Ketik \`skip\` untuk lewati.`,
                [
                    [{ text: "⏭️ Skip Ganti Gambar", data: "renameall_skip_img" }],
                    [{ text: "❌ Batalkan", data: "cancel" }],
                ]
            );
        } else if (job.hasVids) {
            setUserJob(userId, { ...nextState, imgBuffer: null, step: 'waiting_new_video_renameall' });
            await promptVideo(chatId);
        } else {
            setUserJob(userId, { ...nextState, imgBuffer: null, step: 'waiting_new_appname_renameall' });
            await promptAppName(chatId);
        }
        return true;
    }

    // ─── SKIP GAMBAR VIA CALLBACK (ditangani di handleCallback) ─────────────
    // ─── STEP 3: Terima Gambar Baru ──────────────────────────────────────────
    // Ini ditangani oleh event media, bukan text
    // ─── STEP 4: Terima Video Baru ──────────────────────────────────────────
    // Ini ditangani oleh event media, bukan text
    // ─── STEP 5: Terima Nama App Baru ──────────────────────────────────────
    if (currentStatus === 'waiting_new_appname_renameall') {
        const skip = text.toLowerCase() === 'skip';
        const newAppName = skip ? null : text;

        if (!skip && (!text || text.length < 1)) {
            await send(chatId, `❌ **Nama aplikasi tidak valid!**\n\nKirim nama aplikasi baru, contoh: \`SuperApp\`\natau ketik \`skip\` untuk melewati.`);
            return true;
        }

        setUserJob(userId, {
            ...job,
            status: 'waiting_old_appname_renameall',
            newAppName,
            updatedAt: Date.now(),
        });

        if (skip) {
            await send(
                chatId,
                `⏭️ Nama app baru dilewati.\n\n` +
                `🔹 **Langkah 6 — Nama App Lama**\n` +
                `Kirim nama aplikasi lama yang ingin diganti.\n` +
                `Contoh: \`MyOldApp\`\n\n` +
                `⏭️ Ketik \`skip\` untuk lewati.`,
                [[{ text: "❌ Batalkan", data: "cancel" }]]
            );
        } else {
            await send(
                chatId,
                `✅ Nama baru: \`${newAppName}\`\n\n` +
                `🔹 **Langkah 6 — Nama App Lama**\n` +
                `Kirim nama aplikasi lama yang ingin diganti.\n` +
                `Contoh: \`MyOldApp\`\n\n` +
                `⏭️ Ketik \`skip\` untuk lewati.`,
                [[{ text: "❌ Batalkan", data: "cancel" }]]
            );
        }
        return true;
    }

    // ─── STEP 6: Terima Nama App Lama ────────────────────────────────────────
    if (currentStatus === 'waiting_old_appname_renameall') {
        const skip = text.toLowerCase() === 'skip';
        const oldAppName = skip ? null : text;

        if (!skip && (!text || text.length < 1)) {
            await send(chatId, `❌ **Nama aplikasi lama tidak valid!**\n\nKirim nama aplikasi lama, contoh: \`MyOldApp\`\natau ketik \`skip\` untuk melewati.`);
            return true;
        }

        // Siapkan data final untuk eksekusi
        const finalJob = {
            ...job,
            status: 'processing_renameall',
            oldAppName,
            updatedAt: Date.now(),
        };
        setUserJob(userId, finalJob);

        // Jalankan eksekusi
        await executeRenameAll(chatId, userId, finalJob);
        return true;
    }

    return false;
}

// Handler untuk menerima file gambar atau video baru
async function handleRenameAllMedia(event) {
    const chatId = event.chatId;
    const userId = Number(event.message.senderId);
    const msg = event.message;
    const job = getUserJob(userId);

    if (!job || job.type !== 'renameall') return false;

    const media = msg.media;
    if (!media) return false;

    const currentStatus = job.status;

    // ─── STEP 3: Terima Gambar Baru ──────────────────────────────────────────
    if (currentStatus === 'waiting_new_image_renameall') {
        const isPhoto = media.photo;
        const isDocument = media.document;

        if (!isPhoto && !isDocument) {
            await send(chatId, `⚠️ **Kirim gambar dalam bentuk Foto atau File Gambar!**`);
            return true;
        }

        const statusMsg = await send(chatId, `📥 **Mengunduh gambar...**\n\n⏳ __Tunggu sebentar...__`);
        const msgId = statusMsg.id;

        try {
            const imgBuffer = await client.downloadMedia(msg, { outputFile: undefined }); // Returns buffer

            // Update job
            setUserJob(userId, {
                ...job,
                status: job.hasVids ? 'waiting_new_video_renameall' : 'waiting_new_appname_renameall',
                imgBuffer,
                updatedAt: Date.now(),
            });

            await edit(
                chatId,
                msgId,
                `✅ **Gambar diterima!**\n\n${job.hasVids ? '🔹 **Langkah 4 — Ganti Semua Video**' : '🔹 **Langkah 4 — Nama App Baru**'}`
            );

            if (job.hasVids) {
                await promptVideo(chatId);
            } else {
                await promptAppName(chatId);
            }
        } catch (err) {
            await edit(chatId, msgId, `❌ **Gagal mengunduh gambar!**\n\n🛑 \`${err.message}\``);
        }
        return true;
    }

    // ─── STEP 4: Terima Video Baru ──────────────────────────────────────────
    if (currentStatus === 'waiting_new_video_renameall') {
        const isVideo = media.video;
        const isDocument = media.document;

        if (!isVideo && !isDocument) {
            await send(chatId, `⚠️ **Kirim video dalam bentuk Video atau File Video!**`);
            return true;
        }

        const statusMsg = await send(chatId, `📥 **Mengunduh video...**\n\n⏳ __Tunggu sebentar...__`);
        const msgId = statusMsg.id;

        try {
            const vidBuffer = await client.downloadMedia(msg, { outputFile: undefined }); // Returns buffer

            // Update job
            setUserJob(userId, {
                ...job,
                status: 'waiting_new_appname_renameall',
                vidBuffer,
                updatedAt: Date.now(),
            });

            await edit(
                chatId,
                msgId,
                `✅ **Video diterima!**\n\n🔹 **Langkah 5 — Nama App Baru**`
            );

            await promptAppName(chatId);
        } catch (err) {
            await edit(chatId, msgId, `❌ **Gagal mengunduh video!**\n\n🛑 \`${err.message}\``);
        }
        return true;
    }

    return false;
}

// Fungsi untuk prompt video
async function promptVideo(chatId) {
    await send(
        chatId,
        `🎬 **Langkah 4 — Ganti Semua Video**\n\n` +
        `Kirim **1 file video** sebagai dokumen (MP4/dll).\n\n` +
        `Bot akan mengganti KONTEN dari SEMUA file video di folder \`assets/\`.\n` +
        `Nama file asli akan dipertahankan.\n\n` +
        `⏭️ Ketik \`skip\` untuk lewati.`,
        [
            [{ text: "⏭️ Skip Ganti Video", data: "renameall_skip_vid" }],
            [{ text: "❌ Batalkan", data: "cancel" }],
        ]
    );
}

// Fungsi untuk prompt nama app
async function promptAppName(chatId) {
    await send(
        chatId,
        `📱 **Langkah 5 — Nama App Baru**\n\n` +
        `Kirim **nama aplikasi baru** yang diinginkan.\n` +
        `Contoh: \`Super Brand App\`\n\n` +
        `⏭️ Ketik \`skip\` untuk lewati.`,
        [[{ text: "❌ Batalkan", data: "cancel" }]]
    );
}

// ─── EKSEKUSI RENAME ALL ──────────────────────────────────────────────────────
async function executeRenameAll(chatId, userId, job) {
    const {
        zipBuffer,
        newDomain,
        oldDomain,
        imgBuffer,
        vidBuffer,
        newAppName,
        oldAppName,
        fileName,
    } = job;

    const statusMsg = await send(
        chatId,
        `⚙️ **RENAME ALL — MEMPROSES...**\n\n` +
        `${oldDomain && newDomain ? `🌐 Domain: \`${oldDomain}\` → \`${newDomain}\`` : '🌐 Domain: dilewati'}\n` +
        `${imgBuffer ? '🖼️ Gambar/Icon: akan diganti' : '🖼️ Gambar: dilewati'}\n` +
        `${vidBuffer ? '🎬 Video: akan diganti' : '🎬 Video: dilewati'}\n` +
        `${oldAppName && newAppName ? `📱 Nama App: \`${oldAppName}\` → \`${newAppName}\`` : '📱 Nama App: dilewati'}\n\n` +
        `⏳ __Mohon tunggu...__`
    );
    const msgId = statusMsg.id;

    try {
        const zip = new AdmZip(zipBuffer);
        const outZip = new AdmZip();

        let domainCount = 0,
            imgCount = 0,
            vidCount = 0,
            appCount = 0;
        const totalEntries = zip.getEntries().length;
        let processed = 0;

        for (const entry of zip.getEntries()) {
            processed++;
            if (entry.isDirectory) {
                outZip.addFile(entry.entryName, Buffer.alloc(0));
                continue;
            }

            let content = entry.getData();
            const entryName = entry.entryName;
            const ext = path.extname(entryName).toLowerCase();

            // 1️⃣ Ganti semua gambar & icon dengan 1 file gambar
            if (imgBuffer && isAssetImage(entryName)) {
                outZip.addFile(entryName, imgBuffer);
                imgCount++;
                continue;
            }

            // 2️⃣ Ganti semua video dengan 1 file video
            if (vidBuffer && isAssetVideo(entryName)) {
                outZip.addFile(entryName, vidBuffer);
                vidCount++;
                continue;
            }

            // 3️⃣ Ganti domain & nama app di file teks
            if (TEXT_EXTS.includes(ext)) {
                let text = content.toString('utf8');
                let changed = false;

                if (oldDomain && newDomain && text.includes(oldDomain)) {
                    text = text.replaceAll(oldDomain, newDomain);
                    domainCount++;
                    changed = true;
                }

                if (oldAppName && newAppName && text.includes(oldAppName)) {
                    text = text.replaceAll(oldAppName, newAppName);
                    appCount++;
                    changed = true;
                }

                if (changed) {
                    content = Buffer.from(text, 'utf8');
                }
            }

            outZip.addFile(entryName, content);

            // Update progress setiap 20 file atau setiap 2 detik
            if (processed % 20 === 0 || processed === totalEntries) {
                const percent = Math.floor((processed / totalEntries) * 100);
                await edit(
                    chatId,
                    msgId,
                    `⚙️ **RENAME ALL — MEMPROSES...** (${percent}%)\n\n` +
                    `${oldDomain && newDomain ? `🌐 Domain: \`${oldDomain}\` → \`${newDomain}\`` : '🌐 Domain: dilewati'}\n` +
                    `${imgBuffer ? `🖼️ Gambar/Icon: akan diganti (${imgCount} file)` : '🖼️ Gambar: dilewati'}\n` +
                    `${vidBuffer ? `🎬 Video: akan diganti (${vidCount} file)` : '🎬 Video: dilewati'}\n` +
                    `${oldAppName && newAppName ? `📱 Nama App: \`${oldAppName}\` → \`${newAppName}\`` : '📱 Nama App: dilewati'}\n\n` +
                    `📂 Memproses: ${processed}/${totalEntries}`
                );
            }
        }

        // ── Kirim hasil ──
        const outZipBuffer = outZip.toBuffer();
        const outFileName = fileName ? fileName.replace(/\.zip$/i, '_renameall.zip') : 'project_renameall.zip';

        // Buat ringkasan
        const summary = [
            oldDomain && newDomain ? `🌐 Domain diganti di **${domainCount}** file` : '🌐 Domain: dilewati',
            imgBuffer ? `🖼️ Gambar/Icon diganti: **${imgCount}** file` : '🖼️ Gambar: dilewati',
            vidBuffer ? `🎬 Video diganti: **${vidCount}** file` : '🎬 Video: dilewati',
            oldAppName && newAppName ? `📱 Nama App diganti di **${appCount}** file` : '📱 Nama App: dilewati',
        ].filter(Boolean).join('\n');

        // Hapus job
        removeUserJob(userId);

        // Kirim file ZIP hasil
        await client.sendFile(chatId, {
            file: outZipBuffer,
            forceDocument: true,
            attributes: [new Api.DocumentAttributeFilename({ fileName: outFileName })],
            caption:
                `✅ **RENAME ALL SELESAI!** 🎉\n` +
                `────────────────────────────────\n\n` +
                `${summary}\n` +
                `────────────────────────────────\n\n` +
                `__Terima kasih telah menggunakan layanan ${CONFIG.BOT_NAME}!__`,
            parseMode: 'md',
        });

        // ── Deduct 1 credit ──
        if (!isAdmin(userId)) {
            const remaining = db.deductCredit(userId);
            if (remaining !== null) {
                await client.sendMessage(chatId, {
                    message: `💳 **1 Credit digunakan.** Sisa: \`${remaining}\``,
                    parseMode: 'md',
                });
            }
        }

        await edit(
            chatId,
            msgId,
            `✅ **Rename All Selesai!**\n\nBerkas ZIP hasil sudah dikirim ke chat di atas. 🎉`,
            [[{ text: "🏠 Menu Utama", data: "start" }]]
        );

    } catch (err) {
        removeUserJob(userId);
        await edit(
            chatId,
            msgId,
            `❌ **PROCESS FAILED**\n\n🛑 **Error:** \`${err.message}\``
        );
    }
}

// ─── SKIP HANDLER VIA CALLBACK ───────────────────────────────────────────────
async function handleRenameAllSkip(chatId, userId, msgId, type) {
    const job = getUserJob(userId);
    if (!job || job.type !== 'renameall') return;

    if (type === 'img') {
        // Skip gambar
        const nextStatus = job.hasVids ? 'waiting_new_video_renameall' : 'waiting_new_appname_renameall';
        setUserJob(userId, {
            ...job,
            status: nextStatus,
            imgBuffer: null,
            updatedAt: Date.now(),
        });

        await edit(
            chatId,
            msgId,
            `⏭️ **Gambar dilewati.**\n\n${job.hasVids ? '🔹 **Langkah 4 — Ganti Semua Video**' : '🔹 **Langkah 5 — Nama App Baru**'}`
        );

        if (job.hasVids) {
            await promptVideo(chatId);
        } else {
            await promptAppName(chatId);
        }
    } else if (type === 'vid') {
        // Skip video
        setUserJob(userId, {
            ...job,
            status: 'waiting_new_appname_renameall',
            vidBuffer: null,
            updatedAt: Date.now(),
        });

        await edit(
            chatId,
            msgId,
            `⏭️ **Video dilewati.**\n\n🔹 **Langkah 5 — Nama App Baru**`
        );

        await promptAppName(chatId);
    }
}

// ─── REGISTER FUNCTIONS ───────────────────────────────────────────────────────
Object.assign(globalThis, {
    handleRenameAll,
    handleRenameAllZipFile,
    handleRenameAllText,
    handleRenameAllMedia,
    handleRenameAllSkip,
});

module.exports = {
    handleRenameAll,
    handleRenameAllZipFile,
    handleRenameAllText,
    handleRenameAllMedia,
    handleRenameAllSkip,
};