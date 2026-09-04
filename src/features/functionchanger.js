// src/features/functionchanger.js
// Fitur Ganti Function - Deteksi dan ganti function di seluruh file .dart

const path = require('path');
const AdmZip = require('adm-zip');

// ─── DETEKSI FUNCTION DI FILE DART ──────────────────────────────────────────

/**
 * Scan semua file .dart dan deteksi function yang ada
 */
function scanFunctionsInDart(zipBuffer) {
    const zip = new AdmZip(zipBuffer);
    const functions = [];
    const fileMap = {};

    // Pattern untuk mendeteksi function di Dart
    const functionPatterns = [
        // void functionName() {}
        /(void|Future|FutureOr|String|int|double|bool|dynamic|Widget|Widgets|StatelessWidget|StatefulWidget|WidgetBuilder|Function|void|Future<void>|Future<[^>]+>|Stream|Stream<[^>]+>|Iterable|Iterable<[^>]+>|List<[^>]+>|Set<[^>]+>|Map<[^>]+>|Object)\s+(\w+)\s*\([^)]*\)\s*\{/g,
        // functionName() {}
        /(\w+)\s*\([^)]*\)\s*\{/g,
        // (parameters) => { ... } atau (parameters) => expression
        /\([^)]*\)\s*=>\s*\{/g,
        /\([^)]*\)\s*=>\s*[^;{]+/g,
        // async function
        /(void|Future|FutureOr|String|int|double|bool|dynamic|Widget|Widgets|StatelessWidget|StatefulWidget|WidgetBuilder|Function|void|Future<void>|Future<[^>]+>|Stream|Stream<[^>]+>|Iterable|Iterable<[^>]+>|List<[^>]+>|Set<[^>]+>|Map<[^>]+>|Object)\s+(\w+)\s*\([^)]*\)\s*async\s*\{/g,
        // async functionName() async {}
        /(\w+)\s*\([^)]*\)\s*async\s*\{/g,
    ];

    // Pattern untuk class methods
    const methodPatterns = [
        /(\w+)\s*\([^)]*\)\s*\{/g,
        /@override\s*\n\s*(\w+)\s*\([^)]*\)\s*\{/g,
    ];

    for (const entry of zip.getEntries()) {
        if (entry.isDirectory) continue;
        const normalized = entry.entryName.replace(/\\/g, "/");
        if (!normalized.endsWith('.dart')) continue;
        if (!/(^|\/)lib\//.test(normalized)) continue;

        try {
            const content = entry.getData().toString('utf8');
            fileMap[normalized] = { content, entry };

            // Scan function patterns
            for (const pattern of functionPatterns) {
                pattern.lastIndex = 0;
                let match;
                while ((match = pattern.exec(content)) !== null) {
                    const funcName = match[2] || match[1];
                    if (!funcName || funcName.length < 2) continue;
                    if (['if', 'for', 'while', 'switch', 'try', 'catch', 'finally', 'class', 'enum', 'typedef', 'extension'].includes(funcName)) continue;
                    
                    const lineNumber = content.substring(0, match.index).split('\n').length;
                    const signature = content.substring(match.index, match.index + 200).split('\n')[0] || match[0];
                    
                    // Cek apakah ini method class (dalam class)
                    const isMethod = content.substring(0, match.index).includes('class ');
                    
                    functions.push({
                        name: funcName,
                        file: normalized,
                        line: lineNumber,
                        signature: signature.trim(),
                        isMethod: isMethod,
                        fullMatch: match[0],
                        index: match.index,
                        context: getFunctionContext(content, match.index),
                    });
                }
            }
        } catch (_) { continue; }
    }

    // Hapus duplikat
    const unique = [];
    const seen = new Set();
    for (const f of functions) {
        const key = `${f.file}:${f.name}`;
        if (!seen.has(key)) {
            seen.add(key);
            unique.push(f);
        }
    }

    return unique;
}

function getFunctionContext(content, index) {
    const start = Math.max(0, index - 100);
    const end = Math.min(content.length, index + 100);
    const context = content.substring(start, end);
    return context.trim();
}

// ─── REPLACE FUNCTION ──────────────────────────────────────────────────────────

/**
 * Ganti nama function di semua file .dart
 */
async function replaceFunctionInProject(zipBuffer, oldFuncName, newFuncName) {
    const zip = new AdmZip(zipBuffer);
    let filesAffected = 0;
    let totalChanges = 0;
    const changes = [];

    for (const entry of zip.getEntries()) {
        if (entry.isDirectory) continue;
        const normalized = entry.entryName.replace(/\\/g, "/");
        if (!normalized.endsWith('.dart')) continue;
        if (!/(^|\/)lib\//.test(normalized)) continue;

        try {
            let content = entry.getData().toString('utf8');
            let modified = false;
            let fileChanges = [];

            // Pattern untuk function call dan declaration
            const patterns = [
                // functionName(
                new RegExp(`\\b${oldFuncName}\\s*\\(`, 'g'),
                // functionName (
                new RegExp(`\\b${oldFuncName}\\s*\\s*\\(`, 'g'),
                // functionName
                new RegExp(`\\b${oldFuncName}\\b`, 'g'),
            ];

            for (const pattern of patterns) {
                const matches = content.match(pattern);
                if (matches) {
                    const count = matches.length;
                    // Hati-hati: jangan ganti semua, hanya yang tepat
                    // Gunakan regex dengan word boundary
                    const safePattern = new RegExp(`\\b${oldFuncName}\\b`, 'g');
                    const newContent = content.replace(safePattern, newFuncName);
                    if (newContent !== content) {
                        const diff = (content.match(safePattern) || []).length;
                        content = newContent;
                        fileChanges.push(`Ganti ${oldFuncName} → ${newFuncName} (${diff}x)`);
                        modified = true;
                        totalChanges += diff;
                    }
                }
            }

            if (modified) {
                zip.updateFile(entry, Buffer.from(content, 'utf8'));
                filesAffected++;
                changes.push({
                    file: normalized,
                    changes: fileChanges,
                });
            }
        } catch (_) { continue; }
    }

    return {
        zipBuffer: zip.toBuffer(),
        filesAffected,
        totalChanges,
        changes,
    };
}

// ─── HANDLER UTAMA ────────────────────────────────────────────────────────────

async function handleGantiFunction(chatId, userId, deleteMsgId = null) {
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

    await sendActionNotification(userId, 'Ganti Function');

    let username = null;
    let fullName = "Unknown User";
    try {
        const entity = await client.getEntity(userId);
        username = entity?.username || null;
        fullName = [entity?.firstName, entity?.lastName].filter(Boolean).join(" ") || "Unknown User";
    } catch (_) {}

    setUserJob(userId, {
        status: "waiting_zip_function",
        chatId,
        userId,
        username,
        fullName,
        type: "ganti_function",
        updatedAt: Date.now(),
    });

    await send(
        chatId,
        `🔧 **GANTI FUNCTION — AI DETECTION**\n` +
        `────────────────────────────────\n\n` +
        `Fitur ini mendeteksi semua function di project Flutter kamu dan mengganti nama function yang dipilih.\n\n` +
        `📌 **Cara Kerja:**\n` +
        `1️⃣ Kirim file **ZIP** project Flutter\n` +
        `2️⃣ Bot scan semua file .dart & deteksi function\n` +
        `3️⃣ Pilih function yang ingin diganti\n` +
        `4️⃣ Kirim nama function baru\n` +
        `5️⃣ Bot ganti function di seluruh project\n\n` +
        `✅ Support: function, method class, async function\n` +
        `⚠️ __Bot akan mendeteksi secara otomatis, tidak perlu manual!__`,
        [
            [{ text: "📤 Kirim ZIP", data: "function_upload" }],
            [{ text: "❌ Batalkan", data: "cancel" }],
        ],
        deleteMsgId
    );
}

async function handleGantiFunctionZipFile(event) {
    const chatId = event.chatId;
    const userId = Number(event.message.senderId);
    const msg = event.message;
    const job = getUserJob(userId);

    if (!job || job.status !== "waiting_zip_function" || job.type !== "ganti_function") return false;

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
        `📥 **Mengunduh ZIP...**\n\n📦 **File:** \`${fileName}\`\n\n⏳ __Scanning function...__`
    );
    const msgId = statusMsg.id;

    try {
        if (!fs.existsSync(CONFIG.TMP_DIR)) fs.mkdirSync(CONFIG.TMP_DIR, { recursive: true });

        const localZip = tmpPath(`function_${userId}_${Date.now()}.zip`);
        await client.downloadMedia(msg, { outputFile: localZip });
        const zipBuffer = fs.readFileSync(localZip);
        if (fs.existsSync(localZip)) fs.unlinkSync(localZip);

        // Scan function
        await edit(chatId, msgId, `🔍 **Menganalisis function di project...**\n\n⏳ __Mohon tunggu...__`);

        const functions = scanFunctionsInDart(zipBuffer);

        if (functions.length === 0) {
            removeUserJob(userId);
            await edit(
                chatId,
                msgId,
                `⚠️ **Tidak ada function ditemukan!**\n\nTidak ada function yang terdeteksi di file .dart project kamu.\n\n💡 __Pastikan project Flutter valid dan memiliki file .dart di folder lib/.__`,
                [[{ text: "🏠 Menu Utama", data: "start" }]]
            );
            return true;
        }

        // Kelompokkan function berdasarkan file
        const groupedByFile = {};
        for (const f of functions) {
            if (!groupedByFile[f.file]) groupedByFile[f.file] = [];
            groupedByFile[f.file].push(f);
        }

        // Simpan data di job
        setUserJob(userId, {
            ...job,
            status: "function_list",
            zipBuffer,
            fileName,
            functions,
            groupedByFile,
            updatedAt: Date.now(),
        });

        // Tampilkan daftar function
        const funcList = functions.slice(0, 30).map((f, i) => 
            `${i + 1}. \`${f.name}\` (${f.file.split('/').pop()})${f.isMethod ? ' 📌 method' : ''}`
        ).join('\n');

        const total = functions.length;
        const moreText = total > 30 ? `\n... dan ${total - 30} function lainnya` : '';

        const buttons = [];
        // Buat tombol pilihan function (maks 20)
        const displayFuncs = functions.slice(0, 20);
        for (let i = 0; i < displayFuncs.length; i++) {
            const f = displayFuncs[i];
            buttons.push([{ 
                text: `${i + 1}. ${f.name}${f.isMethod ? ' 📌' : ''}`, 
                data: `func_pick_${i}` 
            }]);
        }

        buttons.push([{ text: "📋 Lihat Semua Function", data: "func_list_all" }]);
        buttons.push([{ text: "📤 Lanjutkan Project", data: "func_continue" }]);
        buttons.push([{ text: "⏹️ Stop Project", data: "cancel" }]);

        await edit(
            chatId,
            msgId,
            `🔍 **Function Ditemukan (${total})**\n` +
            `────────────────────────────────\n\n` +
            `📋 **Daftar Function (${Math.min(30, total)} ditampilkan):**\n${funcList}${moreText}\n\n` +
            `Pilih function yang ingin diganti dengan klik tombol di bawah.\n\n` +
            `💡 __Klik tombol nomor function untuk memilih, lalu kirim nama function baru.__`,
            buttons
        );

    } catch (err) {
        removeUserJob(userId);
        await edit(chatId, msgId, `❌ **Gagal memproses!**\n\n🛑 Error: \`${err.message}\``);
    }

    return true;
}

async function handleFunctionPick(event, index) {
    const chatId = event.chatId;
    const userId = Number(event.senderId);
    const msgId = event.messageId;
    const job = getUserJob(userId);

    if (!job || job.type !== 'ganti_function' || job.status !== 'function_list') {
        await event.answer({ message: "Sesi tidak aktif!", alert: true });
        return;
    }

    const functions = job.functions || [];
    if (index >= functions.length) {
        await event.answer({ message: "Function tidak ditemukan!", alert: true });
        return;
    }

    const selected = functions[index];
    setUserJob(userId, {
        ...job,
        status: "waiting_new_function_name",
        selectedFunction: selected,
        updatedAt: Date.now(),
    });

    await event.answer({ message: `✅ Dipilih: ${selected.name}` });

    await edit(
        chatId,
        msgId,
        `✅ **Function Dipilih:** \`${selected.name}\`\n\n` +
        `📁 **File:** \`${selected.file}\`\n` +
        `📊 **Baris:** ${selected.line}\n` +
        `📝 **Signature:**\n\`${selected.signature.slice(0, 100)}...\`\n\n` +
        `✏️ **Kirim nama function baru** sebagai pengganti.\n\n` +
        `📌 Contoh: \`newFunctionName\``,
        [
            [{ text: "⬅️ Kembali ke Daftar", data: "func_back" }],
            [{ text: "❌ Batalkan", data: "cancel" }],
        ]
    );
}

async function handleFunctionListAll(chatId, userId, msgId) {
    const job = getUserJob(userId);
    if (!job || job.type !== 'ganti_function') return;

    const functions = job.functions || [];
    const grouped = job.groupedByFile || {};

    let text = `📋 **DAFTAR SEMUA FUNCTION (${functions.length})**\n────────────────────────────────\n\n`;

    for (const [file, funcs] of Object.entries(grouped)) {
        text += `📁 **${file.split('/').pop()}** (${funcs.length})\n`;
        for (const f of funcs) {
            text += `   • \`${f.name}\`${f.isMethod ? ' 📌 method' : ''}\n`;
        }
        text += '\n';
    }

    text += `────────────────────────────────\n💡 Klik tombol **⬅️ Kembali** untuk memilih function.`;

    await edit(
        chatId,
        msgId,
        text,
        [
            [{ text: "⬅️ Kembali ke Daftar Pilihan", data: "func_back" }],
            [{ text: "❌ Batalkan", data: "cancel" }],
        ]
    );
}

async function handleFunctionBack(chatId, userId, msgId) {
    const job = getUserJob(userId);
    if (!job || job.type !== 'ganti_function') return;

    // Kembali ke daftar function
    const functions = job.functions || [];
    const total = functions.length;

    const funcList = functions.slice(0, 30).map((f, i) => 
        `${i + 1}. \`${f.name}\` (${f.file.split('/').pop()})${f.isMethod ? ' 📌 method' : ''}`
    ).join('\n');

    const moreText = total > 30 ? `\n... dan ${total - 30} function lainnya` : '';

    const buttons = [];
    const displayFuncs = functions.slice(0, 20);
    for (let i = 0; i < displayFuncs.length; i++) {
        const f = displayFuncs[i];
        buttons.push([{ 
            text: `${i + 1}. ${f.name}${f.isMethod ? ' 📌' : ''}`, 
            data: `func_pick_${i}` 
        }]);
    }

    buttons.push([{ text: "📋 Lihat Semua Function", data: "func_list_all" }]);
    buttons.push([{ text: "📤 Lanjutkan Project", data: "func_continue" }]);
    buttons.push([{ text: "⏹️ Stop Project", data: "cancel" }]);

    await edit(
        chatId,
        msgId,
        `🔍 **Function Ditemukan (${total})**\n────────────────────────────────\n\n` +
        `📋 **Daftar Function (${Math.min(30, total)} ditampilkan):**\n${funcList}${moreText}\n\n` +
        `Pilih function yang ingin diganti dengan klik tombol di bawah.`,
        buttons
    );
}

async function handleFunctionContinue(chatId, userId, msgId) {
    const job = getUserJob(userId);
    if (!job || job.type !== 'ganti_function') return;

    // Tanyakan apakah user ingin melanjutkan atau stop
    await edit(
        chatId,
        msgId,
        `📤 **Lanjutkan Project?**\n────────────────────────────────\n\n` +
        `Project siap untuk diproses lebih lanjut.\n\n` +
        `📊 **Function terdeteksi:** ${job.functions?.length || 0}\n` +
        `📁 **File .dart:** ${Object.keys(job.groupedByFile || {}).length}\n\n` +
        `Pilih aksi:`,
        [
            [{ text: "✅ Lanjutkan ke Menu Tools", data: "func_continue_confirm" }],
            [{ text: "⏹️ Stop Project", data: "cancel" }],
        ]
    );
}

async function handleFunctionContinueConfirm(chatId, userId, msgId) {
    const job = getUserJob(userId);
    if (!job || job.type !== 'ganti_function') return;

    // Simpan ZIP buffer ke job dan ubah status ke extracted
    const zip = new AdmZip(job.zipBuffer);
    const extractFolder = tmpPath(`extract_func_${userId}_${Date.now()}`);
    fs.mkdirSync(extractFolder, { recursive: true });
    zip.extractAllTo(extractFolder, true);

    // Simpan base file
    const localZip = tmpPath(`func_base_${userId}_${Date.now()}.zip`);
    fs.writeFileSync(localZip, job.zipBuffer);
    saveUserBaseFile(userId, localZip, job.fileName || 'project.zip', '0', job.username, job.fullName);

    setUserJob(userId, {
        ...job,
        status: "extracted",
        extractedFolderPath: extractFolder,
        currentPath: extractFolder,
        updatedAt: Date.now(),
    });

    await edit(
        chatId,
        msgId,
        `✅ **Project siap!**\n\n` +
        `📂 Project berhasil diekstrak.\n` +
        `📊 **Function terdeteksi:** ${job.functions?.length || 0}\n\n` +
        `🔧 **Pilih Aksi:**`,
        [
            [{ text: "🛠 Add Tools", data: "tools_menu" }, { text: "📂 Copy/Clone", data: "copy_clone" }],
            [{ text: "📦 Export ZIP", data: "export_zip" }, { text: "🚀 Build APK", data: "build_from_extracted" }],
            [{ text: "❌ Batal", data: "cancel" }]
        ]
    );
}

async function handleFunctionNewName(event) {
    const chatId = event.chatId;
    const userId = Number(event.message.senderId);
    const text = event.message.text?.trim();
    const job = getUserJob(userId);

    if (!job || job.status !== "waiting_new_function_name" || job.type !== "ganti_function") return false;

    if (!text || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(text)) {
        await send(
            chatId,
            `❌ **Nama function tidak valid!**\n\nGunakan huruf, angka, atau underscore. Dimulai dengan huruf atau underscore.\nContoh: \`newFunctionName\`, \`_privateMethod\``,
            [[{ text: "❌ Batalkan", data: "cancel" }]]
        );
        return true;
    }

    const oldFuncName = job.selectedFunction?.name;
    const newFuncName = text;

    if (oldFuncName === newFuncName) {
        await send(
            chatId,
            `⚠️ **Nama function sama dengan yang lama!**\n\nKirim nama yang berbeda.`,
            [[{ text: "❌ Batalkan", data: "cancel" }]]
        );
        return true;
    }

    const statusMsg = await send(
        chatId,
        `⚙️ **Mengganti function...**\n\n` +
        `🔍 **Lama:** \`${oldFuncName}\`\n` +
        `🆕 **Baru:** \`${newFuncName}\`\n\n` +
        `⏳ __Mengganti di seluruh file .dart...__`
    );
    const msgId = statusMsg.id;

    try {
        const result = await replaceFunctionInProject(job.zipBuffer, oldFuncName, newFuncName);

        if (result.filesAffected === 0) {
            removeUserJob(userId);
            await edit(
                chatId,
                msgId,
                `⚠️ **Function \`${oldFuncName}\` tidak ditemukan!**\n\nTidak ada file yang mengandung function tersebut.`,
                [[{ text: "🏠 Menu Utama", data: "start" }]]
            );
            return true;
        }

        // Kirim hasil
        const outFileName = job.fileName ? job.fileName.replace(/\.zip$/i, '_function_renamed.zip') : 'project_function_renamed.zip';

        await client.sendFile(chatId, {
            file: result.zipBuffer,
            forceDocument: true,
            attributes: [new Api.DocumentAttributeFilename({ fileName: outFileName })],
            caption:
                `✅ **GANTI FUNCTION SELESAI!** 🎉\n` +
                `────────────────────────────────\n\n` +
                `🔍 **Function Lama:** \`${oldFuncName}\`\n` +
                `🆕 **Function Baru:** \`${newFuncName}\`\n` +
                `📂 **File Diubah:** \`${result.filesAffected}\`\n` +
                `🔄 **Total Diganti:** \`${result.totalChanges}\` kemunculan\n` +
                `────────────────────────────────\n\n` +
                `📋 **Perubahan:**\n${result.changes.map(c => `• ${c.file}: ${c.changes.join(', ')}`).join('\n')}\n` +
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
            `✅ **Ganti Function Selesai!**\n\nBerkas ZIP hasil sudah dikirim di atas. 🎉`,
            [[{ text: "🏠 Menu Utama", data: "start" }]]
        );

    } catch (err) {
        removeUserJob(userId);
        await edit(chatId, msgId, `❌ **Gagal mengganti function!**\n\n🛑 Error: \`${err.message}\``);
    }

    return true;
}

// ─── CALLBACK HANDLER ──────────────────────────────────────────────────────────

async function handleFunctionCallback(event) {
    const data = event.data.toString();
    const chatId = event.chatId;
    const userId = Number(event.senderId);
    const msgId = event.messageId;

    if (data === "ganti_function") {
        return await handleGantiFunction(chatId, userId, msgId);
    }

    if (data === "function_upload") {
        const job = getUserJob(userId);
        if (!job || job.type !== 'ganti_function') return;
        await edit(
            chatId,
            msgId,
            `📤 **Kirim ZIP Project**\n\nKirim file **ZIP** project Flutter kamu.\n\n📌 Hanya \`.zip\` yang diterima.`,
            [[{ text: "❌ Batalkan", data: "cancel" }]]
        );
        await event.answer();
        return;
    }

    if (data.startsWith("func_pick_")) {
        const idx = parseInt(data.replace("func_pick_", ""));
        return await handleFunctionPick(event, idx);
    }

    if (data === "func_list_all") {
        return await handleFunctionListAll(chatId, userId, msgId);
    }

    if (data === "func_back") {
        return await handleFunctionBack(chatId, userId, msgId);
    }

    if (data === "func_continue") {
        return await handleFunctionContinue(chatId, userId, msgId);
    }

    if (data === "func_continue_confirm") {
        return await handleFunctionContinueConfirm(chatId, userId, msgId);
    }
}

// ─── REGISTER FUNCTIONS ───────────────────────────────────────────────────────

Object.assign(globalThis, {
    handleGantiFunction,
    handleGantiFunctionZipFile,
    handleFunctionPick,
    handleFunctionListAll,
    handleFunctionBack,
    handleFunctionContinue,
    handleFunctionContinueConfirm,
    handleFunctionNewName,
    handleFunctionCallback,
    scanFunctionsInDart,
    replaceFunctionInProject,
});

module.exports = {
    handleGantiFunction,
    handleGantiFunctionZipFile,
    handleFunctionPick,
    handleFunctionListAll,
    handleFunctionBack,
    handleFunctionContinue,
    handleFunctionContinueConfirm,
    handleFunctionNewName,
    handleFunctionCallback,
    scanFunctionsInDart,
    replaceFunctionInProject,
};