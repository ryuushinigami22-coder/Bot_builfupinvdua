// src/features/recolour.js
// Fitur Recolour: Mengganti warna di seluruh file .dart
// Mode Manual: User menentukan HEX yang ingin diganti
// Mode AI: AI menganalisis dan menentukan warna yang aman untuk diganti

const path = require('path');
const AdmZip = require('adm-zip');

// Pola warna yang umum digunakan di Flutter
const COMMON_COLORS = [
    { name: 'Primary', patterns: ['primaryColor', 'primarySwatch', 'primary'] },
    { name: 'Secondary', patterns: ['secondaryColor', 'secondary'] },
    { name: 'Background', patterns: ['backgroundColor', 'background'] },
    { name: 'Surface', patterns: ['surfaceColor', 'surface'] },
    { name: 'Error', patterns: ['errorColor', 'error'] },
    { name: 'Text', patterns: ['textColor', 'color', 'fontColor'] },
    { name: 'Accent', patterns: ['accentColor', 'accent'] },
    { name: 'Divider', patterns: ['dividerColor', 'divider'] },
    { name: 'Shadow', patterns: ['shadowColor', 'shadow'] },
    { name: 'Highlight', patterns: ['highlightColor', 'highlight'] },
    { name: 'Splash', patterns: ['splashColor', 'splash'] },
    { name: 'Hover', patterns: ['hoverColor', 'hover'] },
    { name: 'Focus', patterns: ['focusColor', 'focus'] },
    { name: 'Disabled', patterns: ['disabledColor', 'disabled'] },
    { name: 'Button', patterns: ['buttonColor', 'btnColor'] },
    { name: 'Icon', patterns: ['iconColor', 'icon'] },
    { name: 'Border', patterns: ['borderColor', 'border'] },
    { name: 'Card', patterns: ['cardColor', 'card'] },
    { name: 'Dialog', patterns: ['dialogColor', 'dialog'] },
    { name: 'AppBar', patterns: ['appBarColor', 'appBar'] },
];

// Fungsi untuk mengekstrak semua warna HEX dari file .dart
function extractColorsFromDart(content) {
    const colors = [];
    const hexPatterns = [
        /0xFF([0-9A-F]{6})/gi,
        /0xff([0-9A-F]{6})/gi,
        /#([0-9A-F]{6})/gi,
        /0xFF([0-9A-F]{8})/gi,
        /0xff([0-9A-F]{8})/gi,
        /#([0-9A-F]{8})/gi,
    ];

    for (const pattern of hexPatterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
            const hex = match[1].toUpperCase();
            const fullHex = match[0];
            const context = getColorContext(content, match.index);
            colors.push({
                hex: hex,
                fullHex: fullHex,
                context: context,
                line: getLineAtPosition(content, match.index),
            });
        }
    }
    return colors;
}

function getColorContext(content, position) {
    // Ambil 50 karakter sebelum dan sesudah untuk konteks
    const start = Math.max(0, position - 50);
    const end = Math.min(content.length, position + 50);
    const context = content.substring(start, end);
    // Cari tahu ini warna apa berdasarkan konteks
    const lowerContext = context.toLowerCase();
    for (const colorDef of COMMON_COLORS) {
        for (const pattern of colorDef.patterns) {
            if (lowerContext.includes(pattern.toLowerCase())) {
                return colorDef.name;
            }
        }
    }
    return 'Unknown';
}

function getLineAtPosition(content, position) {
    const lines = content.substring(0, position).split('\n');
    return lines.length;
}

// Fungsi AI untuk menganalisis warna yang aman diganti
async function analyzeColorsWithAI(colors, projectType = 'flutter') {
    if (!GEMINI_API_KEY) {
        return colors.map(c => ({ ...c, safe: true, reason: 'AI tidak tersedia' }));
    }

    const colorList = colors.map((c, i) => 
        `${i + 1}. HEX: ${c.hex}, Konteks: ${c.context}, Baris: ${c.line}`
    ).join('\n');

    const prompt = `Anda adalah ahli Flutter/Dart. Analisis daftar warna berikut dari project Flutter.

Daftar Warna:
${colorList}

Tentukan mana warna yang AMAN untuk diganti dan mana yang TIDAK AMAN untuk diganti.
Pertimbangan:
- Warna yang aman: warna tema, warna UI, warna aksen, warna latar belakang
- Warna yang TIDAK aman: warna yang merupakan bagian dari library, warna sistem, warna yang digunakan untuk validasi/status

Format output (JSON):
{
  "analysis": [
    {"index": 1, "safe": true/false, "reason": "alasan singkat"}
  ]
}

Hanya return JSON, tanpa teks lain.`;

    try {
        const response = await callGeminiAI(prompt, 'Anda adalah ahli Flutter yang menganalisis warna.');
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('Tidak dapat parse response AI');
        
        const result = JSON.parse(jsonMatch[0]);
        const analysisMap = {};
        for (const item of result.analysis) {
            analysisMap[item.index - 1] = { safe: item.safe, reason: item.reason };
        }

        return colors.map((c, i) => ({
            ...c,
            safe: analysisMap[i]?.safe ?? true,
            reason: analysisMap[i]?.reason || 'Tidak dianalisis'
        }));
    } catch (error) {
        console.error('AI Analysis Error:', error);
        return colors.map(c => ({ ...c, safe: true, reason: 'AI error, default safe' }));
    }
}

// ─── HANDLER RECOLOUR MANUAL ──────────────────────────────────────────────────
async function handleRecolourManual(chatId, userId, deleteMsgId = null) {
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

    await sendActionNotification(userId, 'Recolour Manual');

    let username = null;
    let fullName = "Unknown User";
    try {
        const entity = await client.getEntity(userId);
        username = entity?.username || null;
        fullName = [entity?.firstName, entity?.lastName].filter(Boolean).join(" ") || "Unknown User";
    } catch (_) {}

    setUserJob(userId, {
        status: 'waiting_zip_recolour',
        chatId,
        userId,
        username,
        fullName,
        type: 'recolour_manual',
        updatedAt: Date.now(),
    });

    await send(
        chatId,
        `🎨 **RECOLOUR MANUAL**\n` +
        `────────────────────────────────\n\n` +
        `Fitur ini mengganti warna di seluruh file \`.dart\` project kamu.\n\n` +
        `Kirim file **ZIP** project Flutter kamu sekarang.\n\n` +
        `┌── **Persyaratan** ──\n` +
        `│ ✅ Format file : \`.zip\`\n` +
        `│ ✅ Wajib ada folder : \`lib/\`\n` +
        `│ ✅ Maks ukuran : \`2 GB\`\n` +
        `└────────────────────\n\n` +
        `⚠️ __Bot akan memandu langkah demi langkah menentukan warna yang ingin diganti.__`,
        [
            [{ text: "🎨 Recolour AI (Smart)", data: "recolour_ai" }],
            [{ text: "❌ Batalkan", data: "cancel" }],
        ],
        deleteMsgId
    );
}

// ─── HANDLER RECOLOUR AI ──────────────────────────────────────────────────────
async function handleRecolourAI(chatId, userId, deleteMsgId = null) {
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

    if (!GEMINI_API_KEY) {
        await send(
            chatId,
            `⚠️ **AI Tidak Tersedia!**\n\n` +
            `Fitur AI membutuhkan API Key Gemini yang valid.\n\n` +
            `Silakan gunakan **Recolour Manual** atau hubungi admin.`,
            [
                [{ text: "🎨 Recolour Manual", data: "recolour_manual" }],
                [{ text: "🏠 Menu Utama", data: "start" }],
            ],
            deleteMsgId
        );
        return;
    }

    await sendActionNotification(userId, 'Recolour AI (Smart)');

    let username = null;
    let fullName = "Unknown User";
    try {
        const entity = await client.getEntity(userId);
        username = entity?.username || null;
        fullName = [entity?.firstName, entity?.lastName].filter(Boolean).join(" ") || "Unknown User";
    } catch (_) {}

    setUserJob(userId, {
        status: 'waiting_zip_recolour_ai',
        chatId,
        userId,
        username,
        fullName,
        type: 'recolour_ai',
        updatedAt: Date.now(),
    });

    await send(
        chatId,
        `🤖 **RECOLOUR AI (SMART)**\n` +
        `────────────────────────────────\n\n` +
        `AI akan menganalisis project kamu dan menentukan warna mana yang AMAN untuk diganti.\n\n` +
        `🔍 **Cara Kerja AI:**\n` +
        `• Menganalisis semua warna di file \`.dart\`\n` +
        `• Mengidentifikasi warna tema, UI, aksen (AMAN)\n` +
        `• Mengidentifikasi warna library, sistem, validasi (TIDAK AMAN)\n` +
        `• Memberi rekomendasi warna yang bisa diganti\n\n` +
        `Kirim file **ZIP** project Flutter kamu sekarang.`,
        [
            [{ text: "🎨 Recolour Manual", data: "recolour_manual" }],
            [{ text: "❌ Batalkan", data: "cancel" }],
        ],
        deleteMsgId
    );
}

// ─── ZIP HANDLER ──────────────────────────────────────────────────────────────
async function handleRecolourZipFile(event) {
    const chatId = event.chatId;
    const userId = Number(event.message.senderId);
    const msg = event.message;
    const job = getUserJob(userId);

    const isManual = job?.type === 'recolour_manual';
    const isAI = job?.type === 'recolour_ai';
    if (!job || (!isManual && !isAI) || (job.status !== 'waiting_zip_recolour' && job.status !== 'waiting_zip_recolour_ai')) return false;

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

        const localZip = tmpPath(`recolour_${userId}_${Date.now()}.zip`);
        await client.downloadMedia(msg, { outputFile: localZip });
        const zipBuffer = fs.readFileSync(localZip);
        if (fs.existsSync(localZip)) fs.unlinkSync(localZip);

        // Cek apakah ada folder lib/
        const zip = new AdmZip(zipBuffer);
        const hasLib = zip.getEntries().some(e => /(^|\/)lib\//.test(e.entryName.replace(/\\/g, "/")));
        if (!hasLib) {
            removeUserJob(userId);
            await edit(
                chatId,
                msgId,
                `⚠️ **Folder \`lib\` tidak ditemukan!**\n\nPastikan project Flutter kamu valid (memiliki folder \`lib/\`) lalu coba lagi.`,
                [[{ text: "🏠 Menu Utama", data: "start" }]]
            );
            return true;
        }

        // Kumpulkan semua warna dari file .dart
        const allColors = [];
        const dartFiles = [];
        for (const entry of zip.getEntries()) {
            if (entry.isDirectory) continue;
            const normalized = entry.entryName.replace(/\\/g, "/");
            if (!normalized.endsWith('.dart')) continue;
            if (!/(^|\/)lib\//.test(normalized)) continue;

            try {
                const content = entry.getData().toString('utf8');
                const colors = extractColorsFromDart(content);
                if (colors.length > 0) {
                    dartFiles.push({ path: normalized, content, colors });
                    allColors.push(...colors.map(c => ({ ...c, file: normalized })));
                }
            } catch (_) {}
        }

        if (allColors.length === 0) {
            removeUserJob(userId);
            await edit(
                chatId,
                msgId,
                `ℹ️ **Tidak ada warna ditemukan!**\n\nTidak ada warna HEX yang ditemukan di file \`.dart\` project kamu.\n\n💡 __Pastikan file \`.dart\` kamu menggunakan format warna HEX seperti \`#FF0000\` atau \`0xFFFF0000\`.__`,
                [[{ text: "🏠 Menu Utama", data: "start" }]]
            );
            return true;
        }

        // Update job dengan data yang sudah ditemukan
        const baseJob = {
            ...job,
            status: isAI ? 'waiting_ai_analysis' : 'waiting_old_hex_recolour',
            zipBuffer,
            fileName,
            fileSizeMB,
            allColors,
            dartFiles,
            updatedAt: Date.now(),
        };

        if (isAI) {
            // AI Mode: Analisis warna dengan AI
            setUserJob(userId, { ...baseJob, status: 'analyzing_ai' });
            await edit(
                chatId,
                msgId,
                `🤖 **Menganalisis dengan AI...**\n\n` +
                `📊 Menemukan **${allColors.length}** warna di **${dartFiles.length}** file .dart\n\n` +
                `⏳ __AI sedang menentukan warna mana yang aman untuk diganti...__`
            );

            try {
                const analyzedColors = await analyzeColorsWithAI(allColors);
                const safeColors = analyzedColors.filter(c => c.safe);
                const unsafeColors = analyzedColors.filter(c => !c.safe);

                setUserJob(userId, {
                    ...baseJob,
                    status: 'waiting_old_hex_recolour',
                    analyzedColors,
                    safeColors,
                    unsafeColors,
                    updatedAt: Date.now(),
                });

                let safeList = safeColors.map((c, i) => 
                    `${i + 1}. \`#${c.hex}\` (${c.context}) - ${c.reason}`
                ).join('\n');

                let unsafeList = unsafeColors.map((c, i) => 
                    `${i + 1}. \`#${c.hex}\` (${c.context}) - ${c.reason}`
                ).join('\n');

                if (safeColors.length === 0) {
                    await edit(
                        chatId,
                        msgId,
                        `🤖 **Hasil Analisis AI**\n` +
                        `────────────────────────────────\n\n` +
                        `⚠️ **Tidak ada warna yang aman untuk diganti!**\n\n` +
                        `Semua warna yang terdeteksi adalah warna sistem/library.\n\n` +
                        `📋 **Warna yang tidak aman (${unsafeColors.length}):**\n${unsafeList.slice(0, 20)}\n\n` +
                        `💡 __Coba gunakan Recolour Manual untuk mengganti warna tertentu.__`,
                        [
                            [{ text: "🎨 Recolour Manual", data: "recolour_manual" }],
                            [{ text: "🏠 Menu Utama", data: "start" }],
                        ]
                    );
                    return true;
                }

                await edit(
                    chatId,
                    msgId,
                    `🤖 **Hasil Analisis AI**\n` +
                    `────────────────────────────────\n\n` +
                    `✅ **Warna AMAN diganti (${safeColors.length}):**\n${safeList.slice(0, 15)}\n\n` +
                    (unsafeColors.length > 0 ? `⚠️ **Warna TIDAK AMAN (${unsafeColors.length}):**\n${unsafeList.slice(0, 10)}\n\n` : '') +
                    `🔹 **Langkah Selanjutnya — Warna Lama**\n` +
                    `Kirim kode **HEX warna lama** yang ingin diganti (contoh: \`FF0000\`).\n\n` +
                    `💡 __Ketik \`list\` untuk melihat daftar warna aman lagi.__`,
                    [
                        [{ text: "📋 Lihat Daftar Warna", data: "recolour_list" }],
                        [{ text: "❌ Batalkan", data: "cancel" }],
                    ]
                );
            } catch (error) {
                console.error('AI Analysis Error:', error);
                // Fallback ke manual
                setUserJob(userId, {
                    ...baseJob,
                    status: 'waiting_old_hex_recolour',
                    analyzedColors: allColors.map(c => ({ ...c, safe: true, reason: 'AI error, default safe' })),
                    updatedAt: Date.now(),
                });
                await edit(
                    chatId,
                    msgId,
                    `⚠️ **AI Error: Fallback ke Manual**\n\n` +
                    `Terjadi error saat analisis AI. Silakan lanjutkan secara manual.\n\n` +
                    `🔹 **Langkah — Warna Lama**\n` +
                    `Kirim kode **HEX warna lama** yang ingin diganti (contoh: \`FF0000\`).\n\n` +
                    `💡 __Ketik \`list\` untuk melihat daftar warna.__`,
                    [[{ text: "❌ Batalkan", data: "cancel" }]]
                );
            }
        } else {
            // Manual Mode: Langsung minta warna lama
            setUserJob(userId, baseJob);

            const colorSummary = allColors
                .slice(0, 20)
                .map(c => `• \`#${c.hex}\` (${c.context})`)
                .join('\n');

            await edit(
                chatId,
                msgId,
                `✅ **ZIP diterima!**\n\n` +
                `📊 Menemukan **${allColors.length}** warna di **${dartFiles.length}** file .dart\n\n` +
                `🔹 **Langkah 1 — Warna Lama**\n` +
                `Kirim kode **HEX warna lama** yang ingin diganti (contoh: \`FF0000\`).\n\n` +
                `📋 **Contoh warna yang ditemukan:**\n${colorSummary}\n\n` +
                `💡 __Ketik \`list\` untuk melihat semua warna.__`,
                [
                    [{ text: "📋 Lihat Semua Warna", data: "recolour_list" }],
                    [{ text: "❌ Batalkan", data: "cancel" }],
                ]
            );
        }
    } catch (err) {
        removeUserJob(userId);
        await edit(chatId, msgId, `❌ **PROCESS FAILED**\n\n🛑 **Error:** \`${err.message}\``);
    }
    return true;
}

// ─── TEXT HANDLER ──────────────────────────────────────────────────────────────
async function handleRecolourText(event) {
    const chatId = event.chatId;
    const userId = Number(event.message.senderId);
    const text = event.message.text?.trim();
    const job = getUserJob(userId);

    if (!job || (job.type !== 'recolour_manual' && job.type !== 'recolour_ai')) return false;
    if (job.status !== 'waiting_old_hex_recolour' && job.status !== 'waiting_new_hex_recolour') return false;

    // ─── LIST COMMAND ──────────────────────────────────────────────────────────
    if (text === 'list' || text === 'list warna') {
        const colors = job.analyzedColors || job.allColors || [];
        const safeColors = job.safeColors || colors;

        let listText = `📋 **DAFTAR WARNA (${colors.length})**\n────────────────────────────────\n\n`;
        if (job.type === 'recolour_ai' && job.safeColors) {
            listText += `✅ **Warna AMAN (${job.safeColors.length}):**\n`;
            job.safeColors.slice(0, 30).forEach((c, i) => {
                listText += `${i + 1}. \`#${c.hex}\` (${c.context})\n`;
            });
            if (job.safeColors.length > 30) listText += `... dan ${job.safeColors.length - 30} warna lainnya\n`;
            listText += `\n⚠️ **Warna TIDAK AMAN (${job.unsafeColors?.length || 0}):**\n`;
            (job.unsafeColors || []).slice(0, 30).forEach((c, i) => {
                listText += `${i + 1}. \`#${c.hex}\` (${c.context})\n`;
            });
        } else {
            colors.slice(0, 50).forEach((c, i) => {
                listText += `${i + 1}. \`#${c.hex}\` (${c.context})\n`;
            });
            if (colors.length > 50) listText += `... dan ${colors.length - 50} warna lainnya\n`;
        }

        await send(
            chatId,
            listText,
            [
                [{ text: "⬅️ Kembali", data: "recolour_back" }],
                [{ text: "❌ Batalkan", data: "cancel" }],
            ]
        );
        return true;
    }

    // ─── OLD HEX ───────────────────────────────────────────────────────────────
    if (job.status === 'waiting_old_hex_recolour') {
        const oldHex = text.replace('#', '').toUpperCase();
        if (!/^[0-9A-F]{6,8}$/.test(oldHex)) {
            await send(
                chatId,
                `❌ **Format HEX tidak valid!**\n\nKirim kode HEX 6-8 digit (contoh: \`FF0000\` atau \`#FF0000\`)\natau ketik \`list\` untuk melihat daftar warna.`,
                [
                    [{ text: "📋 Lihat Daftar Warna", data: "recolour_list" }],
                    [{ text: "❌ Batalkan", data: "cancel" }],
                ]
            );
            return true;
        }

        // Cek apakah warna ada di project
        const colors = job.analyzedColors || job.allColors || [];
        const found = colors.find(c => c.hex === oldHex);
        if (!found) {
            await send(
                chatId,
                `⚠️ **Warna \`#${oldHex}\` tidak ditemukan di project!**\n\n` +
                `Kirim HEX yang valid atau ketik \`list\` untuk melihat daftar warna.`,
                [
                    [{ text: "📋 Lihat Daftar Warna", data: "recolour_list" }],
                    [{ text: "❌ Batalkan", data: "cancel" }],
                ]
            );
            return true;
        }

        // Cek apakah warna aman (AI mode)
        if (job.type === 'recolour_ai' && job.safeColors) {
            const isSafe = job.safeColors.some(c => c.hex === oldHex);
            if (!isSafe) {
                const unsafeReason = job.unsafeColors?.find(c => c.hex === oldHex)?.reason || 'Tidak aman';
                await send(
                    chatId,
                    `⚠️ **Warna \`#${oldHex}\` TIDAK AMAN untuk diganti!**\n\n` +
                    `📋 **Alasan AI:** ${unsafeReason}\n\n` +
                    `💡 __Pilih warna lain dari daftar warna AMAN.__\n\n` +
                    `Ketik \`list\` untuk melihat daftar warna aman.`,
                    [
                        [{ text: "📋 Lihat Warna Aman", data: "recolour_list" }],
                        [{ text: "❌ Batalkan", data: "cancel" }],
                    ]
                );
                return true;
            }
        }

        setUserJob(userId, {
            ...job,
            status: 'waiting_new_hex_recolour',
            oldHex,
            updatedAt: Date.now(),
        });

        await send(
            chatId,
            `✅ **Warna lama: \`#${oldHex}\`**\n\n` +
            `🔹 **Langkah 2 — Warna Baru**\n` +
            `Kirim kode **HEX warna baru** pengganti.\n\n` +
            `📌 Contoh: \`00FF00\` atau \`#00FF00\``,
            [
                [{ text: "📋 Lihat Daftar Warna", data: "recolour_list" }],
                [{ text: "❌ Batalkan", data: "cancel" }],
            ]
        );
        return true;
    }

    // ─── NEW HEX ───────────────────────────────────────────────────────────────
    if (job.status === 'waiting_new_hex_recolour') {
        const newHex = text.replace('#', '').toUpperCase();
        if (!/^[0-9A-F]{6,8}$/.test(newHex)) {
            await send(
                chatId,
                `❌ **Format HEX tidak valid!**\n\nKirim kode HEX 6-8 digit (contoh: \`00FF00\` atau \`#00FF00\`)`,
                [[{ text: "❌ Batalkan", data: "cancel" }]]
            );
            return true;
        }

        // Jalankan proses recolour
        await executeRecolour(chatId, userId, job, newHex);
        return true;
    }

    return false;
}

// ─── EKSEKUSI RECOLOUR ──────────────────────────────────────────────────────
async function executeRecolour(chatId, userId, job, newHex) {
    const oldHex = job.oldHex;
    const statusMsg = await send(
        chatId,
        `⚙️ **RECOLOUR — MEMPROSES...**\n\n` +
        `🎨 **Dari:** \`#${oldHex}\`\n` +
        `🎨 **Ke:** \`#${newHex}\`\n\n` +
        `⏳ __Mengganti warna di seluruh file .dart...__`
    );
    const msgId = statusMsg.id;

    try {
        const zip = new AdmZip(job.zipBuffer);
        let modifiedFiles = 0;
        let totalChanges = 0;
        const entries = zip.getEntries();

        const oldHexUpper = oldHex.toUpperCase();
        const newHexUpper = newHex.toUpperCase();
        const oldHexLower = oldHex.toLowerCase();
        const newHexLower = newHex.toLowerCase();

        const patterns = [
            { regex: new RegExp(`0xFF${oldHexUpper}`, 'g'), replace: `0xFF${newHexUpper}` },
            { regex: new RegExp(`0xff${oldHexUpper}`, 'g'), replace: `0xff${newHexUpper}` },
            { regex: new RegExp(`0xFF${oldHexLower}`, 'g'), replace: `0xFF${newHexUpper}` },
            { regex: new RegExp(`0xff${oldHexLower}`, 'g'), replace: `0xff${newHexUpper}` },
            { regex: new RegExp(`#${oldHexUpper}`, 'g'), replace: `#${newHexUpper}` },
            { regex: new RegExp(`#${oldHexLower}`, 'g'), replace: `#${newHexUpper}` },
        ];

        for (const entry of entries) {
            if (entry.isDirectory) continue;
            const normalized = entry.entryName.replace(/\\/g, "/");
            if (!normalized.endsWith('.dart')) continue;
            if (!/(^|\/)lib\//.test(normalized)) continue;

            let content = entry.getData().toString('utf8');
            let modified = false;
            let changes = 0;

            for (const pattern of patterns) {
                const matches = content.match(pattern.regex);
                if (matches) {
                    changes += matches.length;
                    content = content.replace(pattern.regex, pattern.replace);
                    modified = true;
                }
            }

            if (modified) {
                zip.updateFile(entry, Buffer.from(content, 'utf8'));
                modifiedFiles++;
                totalChanges += changes;
            }
        }

        if (modifiedFiles === 0) {
            removeUserJob(userId);
            await edit(
                chatId,
                msgId,
                `⚠️ **Warna \`#${oldHex}\` tidak ditemukan!**\n\n` +
                `Tidak ada file .dart yang mengandung warna tersebut.\n\n` +
                `💡 __Pastikan HEX yang kamu kirim benar dan ada di project.__`,
                [[{ text: "🏠 Menu Utama", data: "start" }]]
            );
            return true;
        }

        // Kirim hasil
        const outZipBuffer = zip.toBuffer();
        const outFileName = job.fileName ? job.fileName.replace(/\.zip$/i, '_recoloured.zip') : 'project_recoloured.zip';

        await client.sendFile(chatId, {
            file: outZipBuffer,
            forceDocument: true,
            attributes: [new Api.DocumentAttributeFilename({ fileName: outFileName })],
            caption:
                `✅ **RECOLOUR SELESAI!** 🎉\n` +
                `────────────────────────────────\n\n` +
                `🎨 **Dari:** \`#${oldHex}\`\n` +
                `🎨 **Ke:** \`#${newHex}\`\n` +
                `📂 **File diubah:** \`${modifiedFiles}\`\n` +
                `🔄 **Total penggantian:** \`${totalChanges}\`\n` +
                `────────────────────────────────\n\n` +
                `__Terima kasih telah menggunakan layanan ${CONFIG.BOT_NAME}!__`,
            parseMode: 'md',
        });

        // Deduct 1 credit
        if (!isAdmin(userId)) {
            const remaining = db.deductCredit(userId);
            if (remaining !== null) {
                await client.sendMessage(chatId, {
                    message: `💳 **1 Credit digunakan.** Sisa: \`${remaining}\``,
                    parseMode: 'md',
                });
            }
        }

        removeUserJob(userId);
        await edit(
            chatId,
            msgId,
            `✅ **Recolour Selesai!**\n\nBerkas ZIP hasil sudah dikirim ke chat di atas. 🎉`,
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
    return true;
}

// ─── CALLBACK HANDLER ──────────────────────────────────────────────────────────
async function handleRecolourCallback(event) {
    const data = event.data.toString();
    const chatId = event.chatId;
    const userId = Number(event.senderId);
    const msgId = event.messageId;

    if (data === "recolour_manual") {
        return await handleRecolourManual(chatId, userId, msgId);
    }

    if (data === "recolour_ai") {
        return await handleRecolourAI(chatId, userId, msgId);
    }

    if (data === "recolour_list") {
        const job = getUserJob(userId);
        if (!job || (job.type !== 'recolour_manual' && job.type !== 'recolour_ai')) {
            await event.answer({ message: "Sesi tidak aktif!", alert: true });
            return;
        }

        const colors = job.analyzedColors || job.allColors || [];
        let listText = `📋 **DAFTAR WARNA (${colors.length})**\n────────────────────────────────\n\n`;
        colors.slice(0, 50).forEach((c, i) => {
            const safe = job.safeColors?.some(sc => sc.hex === c.hex);
            const icon = safe === true ? '✅' : safe === false ? '⚠️' : '•';
            listText += `${icon} \`#${c.hex}\` (${c.context})\n`;
        });
        if (colors.length > 50) listText += `... dan ${colors.length - 50} warna lainnya\n`;

        await edit(
            chatId,
            msgId,
            listText,
            [
                [{ text: "⬅️ Kembali", data: "recolour_back" }],
                [{ text: "❌ Batalkan", data: "cancel" }],
            ]
        );
        await event.answer();
        return;
    }

    if (data === "recolour_back") {
        const job = getUserJob(userId);
        if (!job || (job.type !== 'recolour_manual' && job.type !== 'recolour_ai')) return;

        const colors = job.analyzedColors || job.allColors || [];
        const colorSummary = colors.slice(0, 20).map(c => `• \`#${c.hex}\` (${c.context})`).join('\n');

        await edit(
            chatId,
            msgId,
            `📊 Menemukan **${colors.length}** warna di project\n\n` +
            `🔹 **Langkah 1 — Warna Lama**\n` +
            `Kirim kode **HEX warna lama** yang ingin diganti (contoh: \`FF0000\`).\n\n` +
            `📋 **Contoh warna yang ditemukan:**\n${colorSummary}\n\n` +
            `💡 __Ketik \`list\` untuk melihat semua warna.__`,
            [
                [{ text: "📋 Lihat Semua Warna", data: "recolour_list" }],
                [{ text: "❌ Batalkan", data: "cancel" }],
            ]
        );
        await event.answer();
        return;
    }
}

// ─── REGISTER FUNCTIONS ───────────────────────────────────────────────────────
Object.assign(globalThis, {
    handleRecolourManual,
    handleRecolourAI,
    handleRecolourZipFile,
    handleRecolourText,
    handleRecolourCallback,
    extractColorsFromDart,
    analyzeColorsWithAI,
});

module.exports = {
    handleRecolourManual,
    handleRecolourAI,
    handleRecolourZipFile,
    handleRecolourText,
    handleRecolourCallback,
    extractColorsFromDart,
    analyzeColorsWithAI,
};