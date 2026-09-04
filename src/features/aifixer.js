// src/features/aifixer.js
// Fitur AI Fixer - Perbaiki API/Script dan Function Error berbasis AI

const path = require('path');
const AdmZip = require('adm-zip');

// ─── DETEKSI ERROR DI FILE ──────────────────────────────────────────────────

function detectErrorsInFiles(zipBuffer) {
    const zip = new AdmZip(zipBuffer);
    const errors = [];
    const fileContents = {};

    // Pola error umum di Dart/Flutter
    const errorPatterns = [
        // API/Network errors
        { pattern: /(http|https):\/\/[^\s"'<>]+/gi, type: 'api', severity: 'warning' },
        { pattern: /\.then\(|\.catch\(|async\s+await/gi, type: 'async', severity: 'info' },
        { pattern: /try\s*\{[\s\S]*?\}\s*catch\s*\([^)]*\)\s*\{/gi, type: 'trycatch', severity: 'info' },
        // Null safety issues
        { pattern: /!\s*\./g, type: 'null_safety', severity: 'warning' },
        { pattern: /\?\./g, type: 'null_safety', severity: 'info' },
        { pattern: /late\s+\w+\s+[^;]+;/g, type: 'late_init', severity: 'warning' },
        // Type issues
        { pattern: /dynamic\s+\w+\s*=/g, type: 'dynamic_type', severity: 'warning' },
        { pattern: /as\s+\w+/g, type: 'type_cast', severity: 'info' },
        // Common Flutter issues
        { pattern: /BuildContext\s+context/g, type: 'context', severity: 'info' },
        { pattern: /setState\s*\(/g, type: 'setstate', severity: 'info' },
        { pattern: /Widget\s+build/g, type: 'widget_build', severity: 'info' },
        // Syntax issues
        { pattern: /;\s*$/gm, type: 'semicolon', severity: 'warning' },
        { pattern: /\(\s*\)\s*=>\s*\{/g, type: 'arrow_function', severity: 'info' },
        // Error handling
        { pattern: /print\s*\(/g, type: 'debug_print', severity: 'warning' },
        { pattern: /debugPrint\s*\(/g, type: 'debug_print', severity: 'warning' },
        // Performance
        { pattern: /for\s*\(/g, type: 'loop', severity: 'info' },
        { pattern: /\.map\s*\(/g, type: 'map', severity: 'info' },
    ];

    // Pola error function
    const functionErrorPatterns = [
        { pattern: /function\s+(\w+)\s*\([^)]*\)\s*\{[^}]*error[^}]*\}/gi, type: 'function_error', severity: 'error' },
        { pattern: /(\w+)\s*\([^)]*\)\s*\{\s*throw\s+/g, type: 'throw_error', severity: 'error' },
        { pattern: /(\w+)\s*\([^)]*\)\s*\{\s*return\s+null/g, type: 'null_return', severity: 'warning' },
        { pattern: /(\w+)\s*\([^)]*\)\s*\{\s*\/\/\s*TODO/g, type: 'todo', severity: 'warning' },
        { pattern: /(\w+)\s*\([^)]*\)\s*\{\s*\/\/\s*FIXME/g, type: 'fixme', severity: 'warning' },
    ];

    for (const entry of zip.getEntries()) {
        if (entry.isDirectory) continue;
        const normalized = entry.entryName.replace(/\\/g, "/");
        if (!normalized.endsWith('.dart') && !normalized.endsWith('.js') && !normalized.endsWith('.ts')) continue;
        if (!/(^|\/)lib\//.test(normalized) && !/(^|\/)src\//.test(normalized)) continue;

        try {
            const content = entry.getData().toString('utf8');
            fileContents[normalized] = content;

            // Scan error patterns
            for (const pattern of errorPatterns) {
                pattern.pattern.lastIndex = 0;
                let match;
                while ((match = pattern.pattern.exec(content)) !== null) {
                    const lineNumber = content.substring(0, match.index).split('\n').length;
                    const context = getErrorContext(content, match.index);
                    
                    errors.push({
                        file: normalized,
                        line: lineNumber,
                        type: pattern.type,
                        severity: pattern.severity,
                        match: match[0],
                        context: context,
                        message: generateErrorMessage(pattern.type, match[0], context),
                    });
                }
            }

            // Scan function errors
            for (const pattern of functionErrorPatterns) {
                pattern.pattern.lastIndex = 0;
                let match;
                while ((match = pattern.pattern.exec(content)) !== null) {
                    const funcName = match[1] || 'unknown';
                    const lineNumber = content.substring(0, match.index).split('\n').length;
                    
                    errors.push({
                        file: normalized,
                        line: lineNumber,
                        type: pattern.type,
                        severity: 'error',
                        function: funcName,
                        match: match[0],
                        context: getErrorContext(content, match.index),
                        message: generateFunctionErrorMessage(pattern.type, funcName),
                    });
                }
            }
        } catch (_) { continue; }
    }

    // Group errors by type
    const grouped = {};
    for (const err of errors) {
        if (!grouped[err.type]) grouped[err.type] = [];
        grouped[err.type].push(err);
    }

    return { errors, grouped, fileContents };
}

function getErrorContext(content, index) {
    const start = Math.max(0, index - 80);
    const end = Math.min(content.length, index + 80);
    return content.substring(start, end).trim();
}

function generateErrorMessage(type, match, context) {
    const messages = {
        'api': `⚠️ API endpoint terdeteksi: ${match.slice(0, 50)}...`,
        'async': `ℹ️ Async/await pattern ditemukan`,
        'trycatch': `ℹ️ Try-catch block ditemukan`,
        'null_safety': `⚠️ Null safety issue: ${match}`,
        'late_init': `⚠️ Late initialization: ${match}`,
        'dynamic_type': `⚠️ Dynamic type digunakan: ${match}`,
        'type_cast': `ℹ️ Type casting: ${match}`,
        'context': `ℹ️ BuildContext digunakan`,
        'setstate': `ℹ️ setState() digunakan`,
        'widget_build': `ℹ️ Widget build method`,
        'semicolon': `⚠️ Missing semicolon atau syntax issue`,
        'arrow_function': `ℹ️ Arrow function`,
        'debug_print': `⚠️ Debug print ditemukan - hapus di production`,
        'loop': `ℹ️ Loop ditemukan`,
        'map': `ℹ️ Map operation ditemukan`,
        'function_error': `❌ Error pada function: ${match.slice(0, 50)}`,
        'throw_error': `❌ Throw error ditemukan`,
        'null_return': `⚠️ Return null ditemukan`,
        'todo': `⚠️ TODO ditemukan - belum selesai`,
        'fixme': `⚠️ FIXME ditemukan - perlu diperbaiki`,
    };
    return messages[type] || `⚠️ Issue ditemukan: ${type}`;
}

function generateFunctionErrorMessage(type, funcName) {
    const messages = {
        'function_error': `❌ Function '${funcName}' mengandung error`,
        'throw_error': `❌ Function '${funcName}' melakukan throw error`,
        'null_return': `⚠️ Function '${funcName}' return null`,
        'todo': `⚠️ Function '${funcName}' belum selesai (TODO)`,
        'fixme': `⚠️ Function '${funcName}' perlu diperbaiki (FIXME)`,
    };
    return messages[type] || `⚠️ Issue pada function '${funcName}'`;
}

// ─── AI FIX API/SCRIPT ──────────────────────────────────────────────────────

async function aiFixApiScript(zipBuffer, errorList) {
    const zip = new AdmZip(zipBuffer);
    let fixedFiles = 0;
    const changes = [];

    // Kumpulkan semua API/URL yang ditemukan
    const apiUrls = [];
    const apiErrors = errorList.filter(e => e.type === 'api');
    
    for (const err of apiErrors) {
        const urlMatch = err.match.match(/https?:\/\/[^\s"'<>]+/gi);
        if (urlMatch) {
            for (const url of urlMatch) {
                if (!apiUrls.includes(url)) apiUrls.push(url);
            }
        }
    }

    if (apiUrls.length === 0) {
        return { fixed: false, message: 'Tidak ada API/URL yang ditemukan untuk diperbaiki.' };
    }

    // Gunakan AI untuk menganalisis dan memperbaiki
    const prompt = `Analisis URL/API berikut dari project Flutter:
${apiUrls.join('\n')}

Berikan saran perbaikan untuk setiap URL/API:
1. Apakah URL valid?
2. Apakah ada masalah keamanan?
3. Apakah perlu dienkripsi?
4. Saran perbaikan spesifik.

Format output (JSON):
{
  "analysis": [
    {"url": "original_url", "valid": true/false, "issue": "deskripsi", "fix": "saran perbaikan"}
  ]
}`;

    try {
        const aiResponse = await callGeminiAI(prompt, 'Anda adalah ahli keamanan API dan Flutter.');
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('Tidak dapat parse response AI');
        
        const result = JSON.parse(jsonMatch[0]);
        
        // Terapkan perbaikan
        for (const item of result.analysis) {
            if (item.issue) {
                for (const entry of zip.getEntries()) {
                    if (entry.isDirectory) continue;
                    const normalized = entry.entryName.replace(/\\/g, "/");
                    if (!normalized.endsWith('.dart') && !normalized.endsWith('.js')) continue;
                    
                    try {
                        let content = entry.getData().toString('utf8');
                        if (content.includes(item.url)) {
                            const newContent = content.replaceAll(item.url, item.fix || item.url);
                            if (newContent !== content) {
                                zip.updateFile(entry, Buffer.from(newContent, 'utf8'));
                                fixedFiles++;
                                changes.push({
                                    file: normalized,
                                    old: item.url,
                                    new: item.fix || item.url,
                                    issue: item.issue,
                                });
                            }
                        }
                    } catch (_) { continue; }
                }
            }
        }

        return {
            fixed: fixedFiles > 0,
            zipBuffer: zip.toBuffer(),
            fixedFiles,
            changes,
            message: fixedFiles > 0 ? `✅ ${fixedFiles} API/URL berhasil diperbaiki` : 'Tidak ada API yang perlu diperbaiki',
        };
    } catch (err) {
        return {
            fixed: false,
            message: `❌ Gagal menganalisis dengan AI: ${err.message}`,
        };
    }
}

// ─── AI FIX FUNCTION ERROR ──────────────────────────────────────────────────

async function aiFixFunctionError(zipBuffer, errorList) {
    const zip = new AdmZip(zipBuffer);
    let fixedFiles = 0;
    const changes = [];

    // Ambil error function
    const functionErrors = errorList.filter(e => 
        e.type === 'function_error' || 
        e.type === 'throw_error' || 
        e.type === 'null_return'
    );

    if (functionErrors.length === 0) {
        return { 
            fixed: false, 
            message: 'Tidak ada error function yang ditemukan.',
            suggestions: []
        };
    }

    // Kumpulkan function yang error
    const funcList = functionErrors.map(e => 
        `- ${e.function || 'unknown'} (${e.file}:${e.line}) - ${e.message}`
    ).join('\n');

    const prompt = `Berikut adalah function yang bermasalah dalam project Flutter:

${funcList}

Untuk setiap function, berikan:
1. Analisis penyebab error
2. Perbaikan yang diperlukan (kode contoh)
3. Penjelasan singkat

Format output (JSON):
{
  "fixes": [
    {
      "function": "nama_function",
      "error": "deskripsi error",
      "cause": "penyebab error",
      "fix": "kode perbaikan",
      "explanation": "penjelasan"
    }
  ]
}`;

    try {
        const aiResponse = await callGeminiAI(prompt, 'Anda adalah ahli debugging Flutter dan Dart.');
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('Tidak dapat parse response AI');
        
        const result = JSON.parse(jsonMatch[0]);
        
        // Tampilkan saran perbaikan
        const suggestions = result.fixes.map(f => 
            `📌 **${f.function}**\n` +
            `❌ Error: ${f.error}\n` +
            `🔍 Penyebab: ${f.cause}\n` +
            `✅ Perbaikan:\n\`\`\`dart\n${f.fix}\n\`\`\`\n` +
            `📝 Penjelasan: ${f.explanation}`
        );

        return {
            fixed: true,
            suggestions,
            message: `✅ ${result.fixes.length} function dianalisis`,
            functionCount: result.fixes.length,
        };
    } catch (err) {
        return {
            fixed: false,
            message: `❌ Gagal menganalisis dengan AI: ${err.message}`,
            suggestions: []
        };
    }
}

// ─── FIX FUNCTION ERROR - AUTO FIX ─────────────────────────────────────────

async function autoFixFunctionError(zipBuffer, functionName, fixCode) {
    const zip = new AdmZip(zipBuffer);
    let fixed = false;
    let changes = [];

    for (const entry of zip.getEntries()) {
        if (entry.isDirectory) continue;
        const normalized = entry.entryName.replace(/\\/g, "/");
        if (!normalized.endsWith('.dart')) continue;

        try {
            let content = entry.getData().toString('utf8');
            // Cari function dan replace
            const funcRegex = new RegExp(`(function\\s+${functionName}\\s*\\([^)]*\\)\\s*\\{[^}]*\\}|${functionName}\\s*\\([^)]*\\)\\s*\\{[^}]*\\})`, 'g');
            const match = funcRegex.exec(content);
            if (match) {
                const newContent = content.replace(match[0], fixCode);
                if (newContent !== content) {
                    zip.updateFile(entry, Buffer.from(newContent, 'utf8'));
                    fixed = true;
                    changes.push({
                        file: normalized,
                        old: match[0].slice(0, 100) + '...',
                        new: fixCode.slice(0, 100) + '...',
                    });
                }
            }
        } catch (_) { continue; }
    }

    return {
        fixed,
        zipBuffer: fixed ? zip.toBuffer() : null,
        changes,
        message: fixed ? '✅ Function berhasil diperbaiki' : '❌ Gagal memperbaiki function',
    };
}

// ─── HANDLER UTAMA ──────────────────────────────────────────────────────────

async function handleAIFixApiScript(chatId, userId, deleteMsgId = null) {
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

    await sendActionNotification(userId, 'AI Fix API/Script');

    let username = null;
    let fullName = "Unknown User";
    try {
        const entity = await client.getEntity(userId);
        username = entity?.username || null;
        fullName = [entity?.firstName, entity?.lastName].filter(Boolean).join(" ") || "Unknown User";
    } catch (_) {}

    setUserJob(userId, {
        status: "waiting_zip_aifixer",
        chatId,
        userId,
        username,
        fullName,
        type: "aifixer",
        updatedAt: Date.now(),
    });

    await send(
        chatId,
        `🤖 **AI FIX API/SCRIPT**\n` +
        `────────────────────────────────\n\n` +
        `Fitur ini menggunakan AI untuk menganalisis dan memperbaiki error pada API/Script di project kamu.\n\n` +
        `📌 **Cara Kerja:**\n` +
        `1️⃣ Kirim file **ZIP** project Flutter\n` +
        `2️⃣ AI scan semua file .dart & .js\n` +
        `3️⃣ Deteksi error API, syntax, function\n` +
        `4️⃣ Tampilkan daftar error dengan saran perbaikan\n` +
        `5️⃣ Pilih error yang ingin diperbaiki\n` +
        `6️⃣ AI akan memberikan kode perbaikan\n\n` +
        `✅ Support: API error, Function error, Syntax error\n` +
        `⚠️ __Bot akan mendeteksi secara otomatis!__`,
        [
            [{ text: "📤 Kirim ZIP", data: "aifixer_upload" }],
            [{ text: "❌ Batalkan", data: "cancel" }],
        ],
        deleteMsgId
    );
}

async function handleAIFixApiScriptZip(event) {
    const chatId = event.chatId;
    const userId = Number(event.message.senderId);
    const msg = event.message;
    const job = getUserJob(userId);

    if (!job || job.status !== "waiting_zip_aifixer" || job.type !== "aifixer") return false;

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
        `📥 **Mengunduh ZIP...**\n\n📦 **File:** \`${fileName}\`\n\n⏳ __AI sedang menganalisis...__`
    );
    const msgId = statusMsg.id;

    try {
        if (!fs.existsSync(CONFIG.TMP_DIR)) fs.mkdirSync(CONFIG.TMP_DIR, { recursive: true });

        const localZip = tmpPath(`aifixer_${userId}_${Date.now()}.zip`);
        await client.downloadMedia(msg, { outputFile: localZip });
        const zipBuffer = fs.readFileSync(localZip);
        if (fs.existsSync(localZip)) fs.unlinkSync(localZip);

        await edit(chatId, msgId, `🔍 **AI Menganalisis project...**\n\n⏳ __Mohon tunggu sebentar...__`);

        // Deteksi error
        const { errors, grouped, fileContents } = detectErrorsInFiles(zipBuffer);

        if (errors.length === 0) {
            removeUserJob(userId);
            await edit(
                chatId,
                msgId,
                `✅ **Tidak ada error ditemukan!**\n\nProject kamu bersih dari error API/Script.\n\n🎉 Siap untuk dibuild!`,
                [
                    [{ text: "🚀 Build APK", data: "build_from_extracted" }],
                    [{ text: "🏠 Menu Utama", data: "start" }],
                ]
            );
            return true;
        }

        // Simpan data
        setUserJob(userId, {
            ...job,
            status: "aifixer_list",
            zipBuffer,
            fileName,
            errors,
            grouped,
            fileContents,
            updatedAt: Date.now(),
        });

        // Tampilkan daftar error
        const errorSummary = Object.entries(grouped).map(([type, list]) => 
            `• ${list.length}x ${type}`
        ).join('\n');

        const errorDetails = errors.slice(0, 20).map((e, i) => 
            `${i + 1}. ${e.message}\n   📁 ${e.file}:${e.line}`
        ).join('\n\n');

        const total = errors.length;
        const moreText = total > 20 ? `\n\n... dan ${total - 20} error lainnya` : '';

        const buttons = [];
        // Tombol untuk setiap jenis error
        const types = Object.keys(grouped).slice(0, 10);
        for (const type of types) {
            buttons.push([{ 
                text: `🔧 Fix ${type} (${grouped[type].length})`, 
                data: `aifixer_fix_${type}` 
            }]);
        }

        buttons.push([{ text: "🔍 Lihat Semua Error", data: "aifixer_list_all" }]);
        buttons.push([{ text: "📤 Lanjutkan Project", data: "aifixer_continue" }]);
        buttons.push([{ text: "⏹️ Stop Project", data: "cancel" }]);

        await edit(
            chatId,
            msgId,
            `🤖 **HASIL ANALISIS AI**\n────────────────────────────────\n\n` +
            `📊 **Total Error:** ${total}\n\n` +
            `📋 **Ringkasan:**\n${errorSummary}\n\n` +
            `📝 **Detail Error (${Math.min(20, total)} ditampilkan):**\n${errorDetails}${moreText}\n\n` +
            `💡 __Pilih jenis error yang ingin diperbaiki dengan tombol di bawah.__`,
            buttons
        );

    } catch (err) {
        removeUserJob(userId);
        await edit(chatId, msgId, `❌ **Gagal memproses!**\n\n🛑 Error: \`${err.message}\``);
    }

    return true;
}

async function handleAIFixType(event, type) {
    const chatId = event.chatId;
    const userId = Number(event.senderId);
    const msgId = event.messageId;
    const job = getUserJob(userId);

    if (!job || job.type !== 'aifixer' || job.status !== 'aifixer_list') {
        await event.answer({ message: "Sesi tidak aktif!", alert: true });
        return;
    }

    const errors = job.errors || [];
    const typeErrors = errors.filter(e => e.type === type);

    if (typeErrors.length === 0) {
        await event.answer({ message: `Tidak ada error type ${type}!`, alert: true });
        return;
    }

    await edit(chatId, msgId, `⏳ **AI Sedang memperbaiki ${type}...**\n\n${typeErrors.length} error ditemukan. Mohon tunggu...`);

    try {
        let result;

        if (type === 'api') {
            // Fix API
            result = await aiFixApiScript(job.zipBuffer, typeErrors);
        } else if (['function_error', 'throw_error', 'null_return'].includes(type)) {
            // Fix Function
            result = await aiFixFunctionError(job.zipBuffer, typeErrors);
        } else {
            // Fix generic
            result = {
                fixed: true,
                message: `✅ ${typeErrors.length} error ${type} dianalisis`,
                suggestions: typeErrors.map(e => 
                    `📌 **${e.file}:${e.line}**\n${e.message}\n\n💡 Saran: Perbaiki kode sesuai dengan konteks error.`
                )
            };
        }

        if (result.fixed && result.suggestions) {
            // Tampilkan hasil perbaikan
            const suggestionsText = result.suggestions.slice(0, 10).join('\n\n---\n\n');
            const moreText = result.suggestions.length > 10 ? `\n\n... dan ${result.suggestions.length - 10} saran lainnya` : '';

            const buttons = [
                [{ text: "📥 Download Hasil Fix", data: "aifixer_download_fix" }],
                [{ text: "🔍 Lihat Semua Error", data: "aifixer_list_all" }],
                [{ text: "⬅️ Kembali", data: "aifixer_back" }],
                [{ text: "❌ Batalkan", data: "cancel" }],
            ];

            // Simpan hasil fix
            if (result.zipBuffer) {
                setUserJob(userId, {
                    ...job,
                    fixResult: result,
                    fixedZipBuffer: result.zipBuffer,
                    updatedAt: Date.now(),
                });
            }

            await edit(
                chatId,
                msgId,
                `🤖 **HASIL PERBAIKAN ${type.toUpperCase()}**\n────────────────────────────────\n\n` +
                `${result.message}\n\n` +
                `📋 **Saran Perbaikan:**\n${suggestionsText}${moreText}\n\n` +
                `💡 __Klik tombol di bawah untuk aksi selanjutnya.__`,
                buttons
            );
        } else {
            await edit(
                chatId,
                msgId,
                `⚠️ **Tidak ada perbaikan yang dilakukan**\n\n${result.message || 'Error tidak dapat diperbaiki secara otomatis.'}`,
                [
                    [{ text: "⬅️ Kembali", data: "aifixer_back" }],
                    [{ text: "❌ Batalkan", data: "cancel" }],
                ]
            );
        }

    } catch (err) {
        await edit(chatId, msgId, `❌ **Gagal memperbaiki!**\n\n🛑 Error: \`${err.message}\``);
    }
}

async function handleAIFixDownload(chatId, userId, msgId) {
    const job = getUserJob(userId);
    if (!job || job.type !== 'aifixer' || !job.fixedZipBuffer) {
        await send(chatId, `⚠️ **Tidak ada hasil fix untuk didownload!**`);
        return;
    }

    const outFileName = job.fileName ? job.fileName.replace(/\.zip$/i, '_aifixed.zip') : 'project_aifixed.zip';

    await client.sendFile(chatId, {
        file: job.fixedZipBuffer,
        forceDocument: true,
        attributes: [new Api.DocumentAttributeFilename({ fileName: outFileName })],
        caption:
            `✅ **AI FIX API/SCRIPT SELESAI!** 🎉\n` +
            `────────────────────────────────\n\n` +
            `📊 **Error diperbaiki:** ${job.errors?.length || 0}\n` +
            `📁 **File diperbaiki:** ${job.fixResult?.fixedFiles || 0}\n` +
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
}

async function handleAIFixFunctionError(chatId, userId, deleteMsgId = null) {
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

    await sendActionNotification(userId, 'Fix Function Error');

    let username = null;
    let fullName = "Unknown User";
    try {
        const entity = await client.getEntity(userId);
        username = entity?.username || null;
        fullName = [entity?.firstName, entity?.lastName].filter(Boolean).join(" ") || "Unknown User";
    } catch (_) {}

    setUserJob(userId, {
        status: "waiting_zip_fixfunction",
        chatId,
        userId,
        username,
        fullName,
        type: "fixfunction",
        updatedAt: Date.now(),
    });

    await send(
        chatId,
        `🔧 **FIX FUNCTION ERROR**\n` +
        `────────────────────────────────\n\n` +
        `Fitur ini mendeteksi error pada function dan memberikan perbaikan otomatis.\n\n` +
        `📌 **Cara Kerja:**\n` +
        `1️⃣ Kirim file **ZIP** project Flutter\n` +
        `2️⃣ Bot scan semua file .dart\n` +
        `3️⃣ Deteksi function yang error\n` +
        `4️⃣ Tampilkan error dan saran perbaikan\n` +
        `5️⃣ Pilih function yang ingin diperbaiki\n` +
        `6️⃣ Bot berikan kode yang sudah diperbaiki\n\n` +
        `✅ Support: Function error, Throw error, Null return\n` +
        `⚠️ __Bot akan mendeteksi secara otomatis!__`,
        [
            [{ text: "📤 Kirim ZIP", data: "fixfunction_upload" }],
            [{ text: "❌ Batalkan", data: "cancel" }],
        ],
        deleteMsgId
    );
}

// ─── CALLBACK HANDLER ──────────────────────────────────────────────────────────

async function handleAIFixerCallback(event) {
    const data = event.data.toString();
    const chatId = event.chatId;
    const userId = Number(event.senderId);
    const msgId = event.messageId;

    if (data === "aifixer_upload") {
        const job = getUserJob(userId);
        if (!job || job.type !== 'aifixer') return;
        await edit(
            chatId,
            msgId,
            `📤 **Kirim ZIP Project**\n\nKirim file **ZIP** project Flutter kamu.\n\n📌 Hanya \`.zip\` yang diterima.`,
            [[{ text: "❌ Batalkan", data: "cancel" }]]
        );
        await event.answer();
        return;
    }

    if (data.startsWith("aifixer_fix_")) {
        const type = data.replace("aifixer_fix_", "");
        return await handleAIFixType(event, type);
    }

    if (data === "aifixer_list_all") {
        const job = getUserJob(userId);
        if (!job || job.type !== 'aifixer') return;

        const errors = job.errors || [];
        let text = `📋 **DAFTAR SEMUA ERROR (${errors.length})**\n────────────────────────────────\n\n`;
        
        const grouped = job.grouped || {};
        for (const [type, list] of Object.entries(grouped)) {
            text += `🔴 **${type.toUpperCase()}** (${list.length})\n`;
            for (const err of list.slice(0, 5)) {
                text += `   • ${err.message}\n`;
                text += `     📁 ${err.file}:${err.line}\n`;
            }
            if (list.length > 5) text += `   ... dan ${list.length - 5} lainnya\n`;
            text += '\n';
        }

        await edit(
            chatId,
            msgId,
            text,
            [
                [{ text: "⬅️ Kembali", data: "aifixer_back" }],
                [{ text: "❌ Batalkan", data: "cancel" }],
            ]
        );
        await event.answer();
        return;
    }

    if (data === "aifixer_back") {
        const job = getUserJob(userId);
        if (!job || job.type !== 'aifixer') return;

        const errors = job.errors || [];
        const grouped = job.grouped || {};
        
        const errorSummary = Object.entries(grouped).map(([type, list]) => 
            `• ${list.length}x ${type}`
        ).join('\n');

        const errorDetails = errors.slice(0, 20).map((e, i) => 
            `${i + 1}. ${e.message}\n   📁 ${e.file}:${e.line}`
        ).join('\n\n');

        const total = errors.length;
        const moreText = total > 20 ? `\n\n... dan ${total - 20} error lainnya` : '';

        const buttons = [];
        const types = Object.keys(grouped).slice(0, 10);
        for (const type of types) {
            buttons.push([{ 
                text: `🔧 Fix ${type} (${grouped[type].length})`, 
                data: `aifixer_fix_${type}` 
            }]);
        }

        buttons.push([{ text: "🔍 Lihat Semua Error", data: "aifixer_list_all" }]);
        buttons.push([{ text: "📤 Lanjutkan Project", data: "aifixer_continue" }]);
        buttons.push([{ text: "⏹️ Stop Project", data: "cancel" }]);

        await edit(
            chatId,
            msgId,
            `🤖 **HASIL ANALISIS AI**\n────────────────────────────────\n\n` +
            `📊 **Total Error:** ${total}\n\n` +
            `📋 **Ringkasan:**\n${errorSummary}\n\n` +
            `📝 **Detail Error (${Math.min(20, total)} ditampilkan):**\n${errorDetails}${moreText}\n\n` +
            `💡 __Pilih jenis error yang ingin diperbaiki dengan tombol di bawah.__`,
            buttons
        );
        await event.answer();
        return;
    }

    if (data === "aifixer_continue") {
        const job = getUserJob(userId);
        if (!job || job.type !== 'aifixer') return;

        // Ekstrak project
        const zip = new AdmZip(job.zipBuffer);
        const extractFolder = tmpPath(`extract_aifixer_${userId}_${Date.now()}`);
        fs.mkdirSync(extractFolder, { recursive: true });
        zip.extractAllTo(extractFolder, true);

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
            `📊 **Error terdeteksi:** ${job.errors?.length || 0}\n\n` +
            `🔧 **Pilih Aksi:**`,
            [
                [{ text: "🛠 Add Tools", data: "tools_menu" }, { text: "📂 Copy/Clone", data: "copy_clone" }],
                [{ text: "📦 Export ZIP", data: "export_zip" }, { text: "🚀 Build APK", data: "build_from_extracted" }],
                [{ text: "❌ Batal", data: "cancel" }]
            ]
        );
        await event.answer();
        return;
    }

    if (data === "aifixer_download_fix") {
        return await handleAIFixDownload(chatId, userId, msgId);
    }

    if (data === "fixfunction_upload") {
        const job = getUserJob(userId);
        if (!job || job.type !== 'fixfunction') return;
        await edit(
            chatId,
            msgId,
            `📤 **Kirim ZIP Project**\n\nKirim file **ZIP** project Flutter kamu.\n\n📌 Hanya \`.zip\` yang diterima.`,
            [[{ text: "❌ Batalkan", data: "cancel" }]]
        );
        await event.answer();
        return;
    }

    if (data === "fixfunction") {
        return await handleAIFixFunctionError(chatId, userId, msgId);
    }
}

// ─── REGISTER FUNCTIONS ───────────────────────────────────────────────────────

Object.assign(globalThis, {
    handleAIFixApiScript,
    handleAIFixApiScriptZip,
    handleAIFixType,
    handleAIFixDownload,
    handleAIFixFunctionError,
    handleAIFixerCallback,
    detectErrorsInFiles,
    aiFixApiScript,
    aiFixFunctionError,
    autoFixFunctionError,
});

module.exports = {
    handleAIFixApiScript,
    handleAIFixApiScriptZip,
    handleAIFixType,
    handleAIFixDownload,
    handleAIFixFunctionError,
    handleAIFixerCallback,
    detectErrorsInFiles,
    aiFixApiScript,
    aiFixFunctionError,
    autoFixFunctionError,
};