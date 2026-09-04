// src/features/airombak.js
// Fitur AI Rombak Aplikasi - Ubah apapun di dalam ZIP dengan AI

const path = require('path');
const AdmZip = require('adm-zip');

// ─── AI ROMBAK PROJECT ──────────────────────────────────────────────────────

async function aiRombakProject(zipBuffer, instructions, fileName) {
    const zip = new AdmZip(zipBuffer);
    const fileList = [];
    const fileContents = {};

    // Kumpulkan semua file .dart
    for (const entry of zip.getEntries()) {
        if (entry.isDirectory) continue;
        const normalized = entry.entryName.replace(/\\/g, "/");
        if (!normalized.endsWith('.dart') && !normalized.endsWith('.js') && !normalized.endsWith('.json')) continue;
        if (!/(^|\/)lib\//.test(normalized) && !/(^|\/)src\//.test(normalized)) continue;

        try {
            const content = entry.getData().toString('utf8');
            fileList.push(normalized);
            fileContents[normalized] = content;
        } catch (_) { continue; }
    }

    // Buat prompt untuk AI
    const fileListStr = fileList.slice(0, 50).join('\n');
    const fileContentsStr = Object.entries(fileContents)
        .slice(0, 10)
        .map(([file, content]) => `--- ${file} ---\n${content.slice(0, 500)}...`)
        .join('\n\n');

    const prompt = `Anda adalah AI developer Flutter expert. Berikut adalah project Flutter dengan file-file berikut:

DAFTAR FILE:
${fileListStr}

INSTRUKSI DARI USER:
${instructions}

Tugas Anda:
1. Analisis struktur project
2. Tentukan perubahan apa yang perlu dilakukan
3. Berikan kode perbaikan untuk setiap file yang perlu diubah
4. Jika perlu menambah file baru, berikan kode lengkapnya

Format output (JSON):
{
  "changes": [
    {
      "file": "path/to/file.dart",
      "action": "modify|add|delete",
      "content": "kode lengkap yang baru",
      "explanation": "penjelasan perubahan"
    }
  ],
  "summary": "ringkasan perubahan"
}

Jangan berikan teks lain selain JSON!`;

    try {
        const aiResponse = await callGeminiAI(prompt, 'Anda adalah ahli Flutter yang sangat berpengalaman.');
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('Tidak dapat parse response AI');
        
        const result = JSON.parse(jsonMatch[0]);
        
        // Terapkan perubahan
        let modifiedFiles = 0;
        const changes = [];

        for (const change of result.changes) {
            if (change.action === 'modify') {
                // Update file yang ada
                const entry = zip.getEntries().find(e => 
                    e.entryName.replace(/\\/g, "/") === change.file
                );
                if (entry) {
                    zip.updateFile(entry, Buffer.from(change.content, 'utf8'));
                    modifiedFiles++;
                    changes.push({
                        file: change.file,
                        action: 'modify',
                        explanation: change.explanation,
                    });
                }
            } else if (change.action === 'add') {
                // Tambah file baru
                zip.addFile(change.file, Buffer.from(change.content, 'utf8'));
                modifiedFiles++;
                changes.push({
                    file: change.file,
                    action: 'add',
                    explanation: change.explanation,
                });
            } else if (change.action === 'delete') {
                // Hapus file
                const entry = zip.getEntries().find(e => 
                    e.entryName.replace(/\\/g, "/") === change.file
                );
                if (entry) {
                    zip.deleteFile(entry.entryName);
                    modifiedFiles++;
                    changes.push({
                        file: change.file,
                        action: 'delete',
                        explanation: change.explanation,
                    });
                }
            }
        }

        return {
            success: modifiedFiles > 0,
            zipBuffer: zip.toBuffer(),
            modifiedFiles,
            changes,
            summary: result.summary || `✅ ${modifiedFiles} file berhasil diubah`,
        };

    } catch (err) {
        return {
            success: false,
            error: err.message,
            summary: `❌ Gagal merombak project: ${err.message}`,
        };
    }
}

// ─── HANDLER UTAMA ──────────────────────────────────────────────────────────

async function handleAIRombakApp(chatId, userId, deleteMsgId = null) {
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
            `⚠️ **Proses Aktif Terdeteksi!**\n\n📋 **Status :** ${statusLabel(job.status)}`,
            [[{ text: "❌ Batalkan", data: "cancel" }]],
            deleteMsgId
        );
        return;
    }

    await sendActionNotification(userId, 'AI Rombak Aplikasi');

    let username = null;
    let fullName = "Unknown User";
    try {
        const entity = await client.getEntity(userId);
        username = entity?.username || null;
        fullName = [entity?.firstName, entity?.lastName].filter(Boolean).join(" ") || "Unknown User";
    } catch (_) {}

    setUserJob(userId, {
        status: "waiting_zip_airombak",
        chatId,
        userId,
        username,
        fullName,
        type: "airombak",
        updatedAt: Date.now(),
    });

    await send(
        chatId,
        `🤖 **AI ROMBAK APLIKASI**\n` +
        `────────────────────────────────\n\n` +
        `Fitur ini menggunakan AI untuk merombak project Flutter kamu sesuai instruksi.\n\n` +
        `📌 **Cara Kerja:**\n` +
        `1️⃣ Kirim file **ZIP** project Flutter\n` +
        `2️⃣ Kirim instruksi perubahan (contoh: "Tambah login Google, buat tema dark, tambah bottom navigation")\n` +
        `3️⃣ AI menganalisis dan menentukan perubahan\n` +
        `4️⃣ AI memberikan kode perbaikan\n` +
        `5️⃣ Bot mengirim ZIP hasil rombakan\n\n` +
        `✅ Support: Tambah fitur, Ubah UI, Perbaiki code\n` +
        `⚠️ __Bot akan menggunakan AI untuk merombak project!__`,
        [
            [{ text: "📤 Kirim ZIP", data: "airombak_upload" }],
            [{ text: "❌ Batalkan", data: "cancel" }],
        ],
        deleteMsgId
    );
}

async function handleAIRombakZip(event) {
    const chatId = event.chatId;
    const userId = Number(event.message.senderId);
    const msg = event.message;
    const job = getUserJob(userId);

    if (!job || job.status !== "waiting_zip_airombak" || job.type !== "airombak") return false;

    const media = msg.media;
    if (!media || !media.document) {
        await send(chatId, `⚠️ Kirim file **ZIP** project Flutter kamu!`);
        return true;
    }

    const doc = media.document;
    const fileName = doc.attributes?.find((a) => a.fileName)?.fileName || 'project.zip';

    if (!fileName.endsWith('.zip')) {
        await send(chatId, `❌ **Format file tidak didukung!**\n\nHanya \`.zip\` yang diterima.`);
        return true;
    }

    const statusMsg = await send(
        chatId,
        `📥 **Mengunduh ZIP...**\n\n📦 **File:** \`${fileName}\`\n\n⏳ __Siap menerima instruksi...__`
    );
    const msgId = statusMsg.id;

    try {
        if (!fs.existsSync(CONFIG.TMP_DIR)) fs.mkdirSync(CONFIG.TMP_DIR, { recursive: true });

        const localZip = tmpPath(`airombak_${userId}_${Date.now()}.zip`);
        await client.downloadMedia(msg, { outputFile: localZip });
        const zipBuffer = fs.readFileSync(localZip);
        if (fs.existsSync(localZip)) fs.unlinkSync(localZip);

        setUserJob(userId, {
            ...job,
            status: "airombak_waiting_instruction",
            zipBuffer,
            fileName,
            updatedAt: Date.now(),
        });

        await edit(
            chatId,
            msgId,
            `✅ **ZIP diterima!**\n\n` +
            `🤖 **AI ROMBAK APLIKASI**\n────────────────────────────────\n\n` +
            `📦 **File:** \`${fileName}\`\n\n` +
            `✏️ **Kirim instruksi perubahan** yang kamu inginkan.\n\n` +
            `📌 **Contoh:**\n` +
            `• "Tambah login Google"\n` +
            `• "Buat tema dark dengan warna #1a1a2e"\n` +
            `• "Tambah bottom navigation dengan 3 menu: Home, Profile, Settings"\n` +
            `• "Ubah semua warna menjadi biru"\n` +
            `• "Tambah fitur search di halaman utama"\n\n` +
            `💡 __Semakin detail instruksi, semakin baik hasilnya!__`,
            [[{ text: "❌ Batalkan", data: "cancel" }]]
        );

    } catch (err) {
        removeUserJob(userId);
        await edit(chatId, msgId, `❌ **Gagal memproses!**\n\n🛑 Error: \`${err.message}\``);
    }

    return true;
}

async function handleAIRombakInstruction(event) {
    const chatId = event.chatId;
    const userId = Number(event.message.senderId);
    const text = event.message.text?.trim();
    const job = getUserJob(userId);

    if (!job || job.status !== "airombak_waiting_instruction" || job.type !== "airombak") return false;

    if (!text || text.length < 5) {
        await send(
            chatId,
            `❌ **Instruksi terlalu pendek!**\n\nBerikan instruksi yang jelas dan detail.\nContoh: "Tambah login Google dan buat tema dark"`,
            [[{ text: "❌ Batalkan", data: "cancel" }]]
        );
        return true;
    }

    const statusMsg = await send(
        chatId,
        `🧠 **AI Sedang Merombak Project...**\n\n` +
        `📝 **Instruksi:**\n"${text}"\n\n` +
        `⏳ __Mohon tunggu, AI sedang bekerja... (bisa memakan waktu 1-2 menit)__`
    );
    const msgId = statusMsg.id;

    try {
        const result = await aiRombakProject(job.zipBuffer, text, job.fileName);

        if (!result.success) {
            await edit(
                chatId,
                msgId,
                `❌ **Gagal Merombak Project!**\n\n🛑 Error: ${result.error || result.summary}`,
                [[{ text: "🏠 Menu Utama", data: "start" }]]
            );
            return true;
        }

        // Kirim hasil
        const outFileName = job.fileName ? job.fileName.replace(/\.zip$/i, '_airombak.zip') : 'project_airombak.zip';

        await client.sendFile(chatId, {
            file: result.zipBuffer,
            forceDocument: true,
            attributes: [new Api.DocumentAttributeFilename({ fileName: outFileName })],
            caption:
                `✅ **AI ROMBAK APLIKASI SELESAI!** 🎉\n` +
                `────────────────────────────────\n\n` +
                `📋 **Ringkasan:**\n${result.summary}\n\n` +
                `📂 **File Diubah:** \`${result.modifiedFiles}\`\n\n` +
                `📝 **Perubahan:**\n${result.changes.map(c => `• ${c.action.toUpperCase()}: ${c.file}\n  ${c.explanation}`).join('\n\n')}\n` +
                `────────────────────────────────\n\n` +
                `__Terima kasih telah menggunakan layanan ${CONFIG.BOT_NAME}!__`,
            parseMode: "md",
        });

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
            `✅ **AI Rombak Selesai!**\n\nBerkas ZIP hasil sudah dikirim di atas. 🎉`,
            [[{ text: "🏠 Menu Utama", data: "start" }]]
        );

    } catch (err) {
        removeUserJob(userId);
        await edit(chatId, msgId, `❌ **Gagal merombak project!**\n\n🛑 Error: \`${err.message}\``);
    }

    return true;
}

// ─── CALLBACK HANDLER ──────────────────────────────────────────────────────────

async function handleAIRombakCallback(event) {
    const data = event.data.toString();
    const chatId = event.chatId;
    const userId = Number(event.senderId);
    const msgId = event.messageId;

    if (data === "airombak_upload") {
        const job = getUserJob(userId);
        if (!job || job.type !== 'airombak') return;
        await edit(
            chatId,
            msgId,
            `📤 **Kirim ZIP Project**\n\nKirim file **ZIP** project Flutter kamu.\n\n📌 Hanya \`.zip\` yang diterima.`,
            [[{ text: "❌ Batalkan", data: "cancel" }]]
        );
        await event.answer();
        return;
    }

    if (data === "airombak") {
        return await handleAIRombakApp(chatId, userId, msgId);
    }
}

// ─── REGISTER FUNCTIONS ───────────────────────────────────────────────────────

Object.assign(globalThis, {
    handleAIRombakApp,
    handleAIRombakZip,
    handleAIRombakInstruction,
    handleAIRombakCallback,
    aiRombakProject,
});

module.exports = {
    handleAIRombakApp,
    handleAIRombakZip,
    handleAIRombakInstruction,
    handleAIRombakCallback,
    aiRombakProject,
};