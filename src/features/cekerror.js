// src/features/cekerror.js
// Fitur Cek Error Func: Analisis kode JavaScript, deteksi AI, dan perbaikan otomatis

// ─── DETEKSI KODE BUATAN AI ───────────────────────────────
function detectAiGenerated(code) {
    let score = 0;
    const signals = [];

    // Pola komentar khas AI
    const aiCommentPatterns = [
        /\/\/\s*(TODO|FIXME|NOTE|HINT|Step \d+|This function|Helper function|Main function|Utility|Example usage)/i,
        /\/\/\s*(Handle|Process|Check|Validate|Initialize|Setup|Configure)\s+\w+/i,
        /\/\*\*[\s\S]*?@param[\s\S]*?\*\//,
    ];
    for (const pat of aiCommentPatterns) {
        if (pat.test(code)) { score += 2; signals.push('Komentar khas AI ditemukan'); break; }
    }

    const genericNames = /\b(result|data|response|output|input|value|item|element|temp|tmp|helper|util|payload|callback|handler|obj|arr|str|num)\b/g;
    const genericMatches = (code.match(genericNames) || []).length;
    if (genericMatches >= 4) { score += 2; signals.push(`Banyak nama variabel generik (${genericMatches}x)`); }

    if (/try\s*\{[\s\S]*?catch\s*\(e\)\s*\{[\s\S]*?e\.message/i.test(code)) {
        score += 2; signals.push('Pola try-catch dengan e.message sangat khas AI');
    }

    const templateLogs = (code.match(/console\.(log|error)\(`[^`]{10,}`\)/g) || []).length;
    if (templateLogs >= 2) { score += 1; signals.push(`Console log dengan template literal (${templateLogs}x)`); }

    const asyncArrows = (code.match(/=\s*async\s*\([^)]*\)\s*=>/g) || []).length;
    if (asyncArrows >= 3) { score += 2; signals.push(`Banyak async arrow function (${asyncArrows}x)`); }

    const lines = code.split('\n').filter(l => l.trim());
    const commentLines = lines.filter(l => l.trim().startsWith('//'));
    const commentRatio = lines.length > 0 ? commentLines.length / lines.length : 0;
    if (commentRatio > 0.3) { score += 2; signals.push(`Rasio komentar tinggi (${Math.round(commentRatio * 100)}% baris = komentar)`); }

    if (/return\s*\{[\s\S]{5,200}\};/.test(code)) { score += 1; signals.push('Return object literal langsung'); }

    const destructParams = (code.match(/function\s*\w*\s*\(\s*\{[^}]+\}/g) || []).length;
    if (destructParams >= 2) { score += 1; signals.push(`Destrukturisasi parameter (${destructParams}x)`); }

    const isAi = score >= 5;
    return { isAi, score, signals };
}

// ─── ANALISIS ERROR FUNC ──────────────────────────────────
function analyzeFunc(code) {
    const lines = code.split('\n');
    const errors = [];
    const warnings = [];
    const suggestions = [];
    const fixes = [];

    // Bracket balance global
    const openBrace = (code.match(/\{/g) || []).length;
    const closeBrace = (code.match(/\}/g) || []).length;
    if (openBrace !== closeBrace) {
        errors.push(`❌ Bracket { } tidak seimbang — buka: ${openBrace}, tutup: ${closeBrace}. Cek penutup fungsi di akhir kode.`);
        fixes.push({ type: 'bracket', openBrace, closeBrace });
    }

    const openParen = (code.match(/\(/g) || []).length;
    const closeParen = (code.match(/\)/g) || []).length;
    if (openParen !== closeParen) {
        errors.push(`❌ Kurung ( ) tidak seimbang — buka: ${openParen}, tutup: ${closeParen}. Kemungkinan ada pemanggilan fungsi yang tidak ditutup.`);
        fixes.push({ type: 'parenthesis', openParen, closeParen });
    }

    // Deteksi fungsi yang dideklarasikan
    const declaredFuncs = new Map();
    const funcPatterns = [
        /(?:^|\s)function\s+(\w+)\s*\(/gm,
        /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/gm,
        /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?function/gm,
        /(?:^|\s)async\s+function\s+(\w+)\s*\(/gm,
    ];
    for (const pat of funcPatterns) {
        pat.lastIndex = 0;
        let m;
        while ((m = pat.exec(code)) !== null) {
            const name = m[1];
            if (!name || name.length < 2) continue;
            const ln = code.substring(0, m.index).split('\n').length;
            if (declaredFuncs.has(name)) {
                errors.push(`❌ Fungsi duplikat: \`${name}\` dideklarasikan 2x (pertama di baris ${declaredFuncs.get(name)}, lagi di baris ${ln}). Hapus salah satunya.`);
                fixes.push({ type: 'duplicate_func', name, line: ln });
            } else {
                declaredFuncs.set(name, ln);
            }
        }
    }

    // Cek baris per baris
    lines.forEach((line, i) => {
        const ln = i + 1;
        const t = line.trim();
        if (!t || t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return;

        // Syntax: tanda kutip tidak ditutup
        const singleQ = (t.match(/(?<!\\)'/g) || []).length;
        const doubleQ = (t.match(/(?<!\\)"/g) || []).length;
        if (singleQ % 2 !== 0) {
            errors.push(`❌ Baris ${ln}: Tanda kutip tunggal (') tidak ditutup → \`${t.substring(0, 60)}\``);
            fixes.push({ type: 'unclosed_quote', line: ln, char: "'" });
        }
        if (doubleQ % 2 !== 0) {
            errors.push(`❌ Baris ${ln}: Tanda kutip ganda (") tidak ditutup → \`${t.substring(0, 60)}\``);
            fixes.push({ type: 'unclosed_quote', line: ln, char: '"' });
        }

        // Pakai == bukan ===
        if (/[^=!<>]={2}[^=]/.test(t) && !/['"`]/.test(t.substring(0, t.search(/={2}/)))) {
            warnings.push(`⚠️ Baris ${ln}: Pakai \`==\` bukan \`===\` → \`${t.substring(0, 60)}\` (bisa bug type coercion)`);
            suggestions.push({ type: 'use_strict_equal', line: ln });
        }

        // var masih dipakai
        if (/^\s*var\s+/.test(line)) {
            warnings.push(`⚠️ Baris ${ln}: Masih pakai \`var\` → ganti ke \`const\` atau \`let\``);
            suggestions.push({ type: 'replace_var', line: ln });
        }

        // console.log tertinggal
        if (/console\.(log|warn|debug)\s*\(/.test(t)) {
            warnings.push(`⚠️ Baris ${ln}: \`console.log\` tertinggal → sebaiknya dihapus di production`);
            suggestions.push({ type: 'remove_console', line: ln });
        }

        // Empty catch
        if (/catch\s*\([^)]*\)\s*\{\s*\}/.test(t)) {
            errors.push(`❌ Baris ${ln}: Empty catch block → error ditelan diam-diam, tambahkan penanganan error`);
            fixes.push({ type: 'empty_catch', line: ln });
        }

        // Semicolon hilang di akhir statement sederhana
        if (
            /^(const|let|var|return|throw)\s+/.test(t) &&
            !t.endsWith('{') && !t.endsWith(',') && !t.endsWith(';') &&
            !t.endsWith('(') && !t.endsWith(')') && !t.includes('=>')
        ) {
            warnings.push(`⚠️ Baris ${ln}: Mungkin kurang titik koma (;) → \`${t.substring(0, 60)}\``);
            suggestions.push({ type: 'add_semicolon', line: ln });
        }

        // Async function tanpa try/catch
        if (/async\s+function\s+\w+|=\s*async\s*\(|=\s*async\s+function/.test(t)) {
            const block = lines.slice(i, Math.min(i + 20, lines.length)).join('\n');
            if (!block.includes('try') && !block.includes('.catch(')) {
                warnings.push(`⚠️ Baris ${ln}: Fungsi async tanpa try/catch → error tidak tertangkap jika promise reject`);
                suggestions.push({ type: 'add_trycatch', line: ln });
            }
        }

        // Undefined variable detection sederhana
        // Cari variable yang mungkin undefined
        const varUsage = t.match(/\b([a-zA-Z_$][a-zA-Z0-9_$]*)\b/g) || [];
        for (const v of varUsage) {
            if (['if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 
                 'return', 'throw', 'try', 'catch', 'finally', 'const', 'let', 'var', 'function',
                 'async', 'await', 'new', 'this', 'typeof', 'instanceof', 'void', 'delete', 'in',
                 'class', 'extends', 'super', 'import', 'export', 'default', 'from', 'as'].includes(v)) {
                continue;
            }
            // Cek apakah variable dideklarasikan di scope yang sama
            // Skip: terlalu kompleks untuk analisis sederhana
        }
    });

    return { errors, warnings, suggestions, fixes, totalFuncs: declaredFuncs.size };
}

// ─── PERBAIKAN OTOMATIS ──────────────────────────────────
function autoFixCode(code, fixes, suggestions) {
    let fixed = code;
    const changes = [];

    // Perbaikan priority: errors > warnings
    const allFixes = [...fixes, ...suggestions.map(s => ({ ...s, isSuggestion: true }))];

    for (const fix of allFixes) {
        const lines = fixed.split('\n');
        const ln = fix.line - 1;

        if (ln < 0 || ln >= lines.length) continue;

        let line = lines[ln];

        switch (fix.type) {
            case 'use_strict_equal':
                // Ganti == dengan ===
                const newLine = line.replace(/([^=!<>])={2}([^=])/g, '$1===$2');
                if (newLine !== line) {
                    lines[ln] = newLine;
                    changes.push(`Baris ${fix.line}: == → ===`);
                }
                break;

            case 'replace_var':
                // Ganti var dengan const/let (deteksi berdasarkan reassign)
                const isReassigned = lines.some(l => l.includes(` = `) && l.includes(fix.varName));
                const replacement = isReassigned ? 'let' : 'const';
                lines[ln] = line.replace(/^\s*var\s+/, `$&${replacement} `);
                changes.push(`Baris ${fix.line}: var → ${replacement}`);
                break;

            case 'remove_console':
                // Hapus console.log (comment out)
                lines[ln] = line.replace(/console\.(log|warn|debug)\s*\([^)]*\)\s*;?/, '// $&');
                changes.push(`Baris ${fix.line}: console.log di-comment`);
                break;

            case 'add_semicolon':
                if (!line.endsWith(';') && !line.endsWith('{') && !line.endsWith('}') && !line.endsWith(')')) {
                    lines[ln] = line + ';';
                    changes.push(`Baris ${fix.line}: tambah ;`);
                }
                break;

            case 'add_trycatch':
                // Tambahkan try-catch di sekitar async function
                // Ini lebih kompleks, kita bungkus dengan try-catch di sekitar panggilan
                const indent = line.match(/^\s*/)[0];
                lines[ln] = `${indent}try {\n${line}\n${indent}} catch (error) {\n${indent}  console.error('Error:', error);\n${indent}  throw error;\n${indent}}`;
                changes.push(`Baris ${fix.line}: tambah try-catch`);
                break;

            case 'empty_catch':
                // Isi empty catch
                const catchIndent = line.match(/^\s*/)[0];
                lines[ln] = line.replace(/\{\s*\}/, `{\n${catchIndent}  console.error('Caught error:', error);\n${catchIndent}  throw error;\n${catchIndent}}`);
                changes.push(`Baris ${fix.line}: isi empty catch`);
                break;

            case 'unclosed_quote':
                // Tambahkan quote penutup (sederhana)
                if (line.includes(`'`) && !line.includes(`'` + fix.char)) {
                    // Coba perbaiki dengan menambahkan quote di akhir
                    lines[ln] = line + fix.char;
                    changes.push(`Baris ${fix.line}: tambah quote penutup`);
                }
                break;
        }
    }

    fixed = lines.join('\n');
    return { fixed, changes };
}

// ─── HANDLER UTAMA ────────────────────────────────────────
async function handleCekError(chatId, userId, deleteMsgId = null) {
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

    await sendActionNotification(userId, 'Cek Error Func');

    let username = null;
    let fullName = "Unknown User";
    try {
        const entity = await client.getEntity(userId);
        username = entity?.username || null;
        fullName = [entity?.firstName, entity?.lastName].filter(Boolean).join(" ") || "Unknown User";
    } catch (_) {}

    setUserJob(userId, {
        status: 'waiting_code_cekerror',
        chatId,
        userId,
        username,
        fullName,
        type: 'cekerror',
        updatedAt: Date.now(),
    });

    await send(
        chatId,
        `🛠 **CEK ERROR FUNC**\n` +
        `────────────────────────────────\n\n` +
        `Fitur ini menganalisis kode JavaScript/Node.js dan mendeteksi:\n` +
        `• ❌ Error sintaks & logika\n` +
        `• ⚠️ Warning potensi bug\n` +
        `• 🤖 Deteksi kode buatan AI\n` +
        `• 🔧 Perbaikan otomatis (untuk error yang ditemukan)\n\n` +
        `Kirimkan **kode fungsi** JavaScript yang ingin dicek.\n\n` +
        `📌 Contoh:\n` +
        `\`function hitungTotal(items) {\n  let total = 0;\n  for (let i = 0; i < items.length; i++) {\n    total += items[i].harga;\n  }\n  return total;\n}\`\n\n` +
        `⚠️ __Bot akan menganalisis dan memberikan rekomendasi perbaikan.__`,
        [
            [{ text: "🔧 Perbaiki Otomatis", data: "cekerror_autofix" }],
            [{ text: "❌ Batalkan", data: "cancel" }],
        ],
        deleteMsgId
    );
}

// ─── TEXT HANDLER ──────────────────────────────────────────
async function handleCekErrorText(event) {
    const chatId = event.chatId;
    const userId = Number(event.message.senderId);
    const text = event.message.text?.trim();
    const job = getUserJob(userId);

    if (!job || job.type !== 'cekerror' || job.status !== 'waiting_code_cekerror') return false;

    if (!text || text.length < 10) {
        await send(
            chatId,
            `❌ **Kode terlalu pendek!**\n\nKirimkan kode fungsi JavaScript minimal 10 karakter untuk dianalisis.`,
            [[{ text: "❌ Batalkan", data: "cancel" }]]
        );
        return true;
    }

    const statusMsg = await send(
        chatId,
        `🔍 **Menganalisis kode...**\n\n⏳ __Mohon tunggu sebentar...__`
    );
    const msgId = statusMsg.id;

    try {
        const { errors, warnings, suggestions, fixes, totalFuncs } = analyzeFunc(text);
        const { isAi, score, signals } = detectAiGenerated(text);

        let reply = `🛠 **HASIL CEK ERROR FUNC**\n────────────────────────────────\n\n`;

        // Deteksi AI
        if (isAi) {
            reply += `🤖 **KODE INI TERDETEKSI BUATAN AI**\n`;
            reply += `📊 Skor AI: **${score}/10**\n`;
            reply += `📌 Indikator:\n`;
            for (const s of signals.slice(0, 5)) reply += `  • ${s}\n`;
            reply += `\n`;
        } else {
            reply += `👤 **Kode dibuat manual** (bukan AI)\n\n`;
        }

        reply += `📁 Fungsi ditemukan: **${totalFuncs}**\n`;
        reply += `❌ Error: **${errors.length}** | ⚠️ Warning: **${warnings.length}**\n\n`;

        if (errors.length === 0 && warnings.length === 0) {
            reply += `✅ **Tidak ada error atau warning ditemukan!**\n\nKode kamu bersih dan siap digunakan. 🎉`;
        } else {
            if (errors.length > 0) {
                reply += `🔴 **— ERROR (${errors.length}) —**\n`;
                for (const e of errors.slice(0, 15)) reply += `${e}\n\n`;
                if (errors.length > 15) reply += `_...dan ${errors.length - 15} error lainnya_\n\n`;
            }
            if (warnings.length > 0) {
                reply += `🟡 **— WARNING (${warnings.length}) —**\n`;
                for (const w of warnings.slice(0, 15)) reply += `${w}\n\n`;
                if (warnings.length > 15) reply += `_...dan ${warnings.length - 15} warning lainnya_\n\n`;
            }
        }

        // Simpan hasil analisis di job
        const jobData = {
            ...job,
            status: 'analyzed_cekerror',
            analyzedCode: text,
            errors,
            warnings,
            suggestions,
            fixes,
            isAi,
            score,
            signals,
            totalFuncs,
            msgId: statusMsg.id,
            updatedAt: Date.now(),
        };
        setUserJob(userId, jobData);

        // Kirim hasil
        if (reply.length > 4000) {
            reply = reply.slice(0, 3950) + '\n\n_...(dipotong karena terlalu panjang)_';
        }

        const buttons = [
            [{ text: "🔧 Perbaiki Otomatis", data: "cekerror_autofix" }],
            [{ text: "🏠 Menu Utama", data: "start" }],
        ];

        await edit(chatId, msgId, reply, buttons);

    } catch (err) {
        await edit(chatId, msgId, `❌ **Gagal analisis!**\n\n🛑 Error: \`${err.message}\``);
    }

    return true;
}

// ─── PERBAIKAN OTOMATIS ──────────────────────────────────
async function handleCekErrorAutofix(chatId, userId, msgId) {
    const job = getUserJob(userId);
    if (!job || job.type !== 'cekerror' || job.status !== 'analyzed_cekerror') {
        await send(chatId, `⚠️ **Tidak ada kode yang dianalisis!**\n\nSilakan kirim kode dulu untuk dicek.`, [[{ text: "🛠 Cek Error", data: "cekerror" }]]);
        return;
    }

    const { analyzedCode, errors, warnings, suggestions, fixes } = job;

    // Cek apakah ada error yang bisa diperbaiki
    const hasErrors = errors.length > 0;
    const hasWarnings = warnings.length > 0;

    if (!hasErrors && !hasWarnings) {
        await edit(
            chatId,
            msgId,
            `✅ **Tidak ada yang perlu diperbaiki!**\n\nKode kamu sudah bersih dan tidak ada error/warning. 🎉`,
            [[{ text: "🏠 Menu Utama", data: "start" }]]
        );
        return;
    }

    const statusMsg = await edit(
        chatId,
        msgId,
        `🔧 **Memperbaiki kode...**\n\n` +
        `❌ Error: **${errors.length}**\n` +
        `⚠️ Warning: **${warnings.length}**\n\n` +
        `⏳ __Mohon tunggu sebentar...__`
    );

    try {
        // Lakukan perbaikan otomatis
        const { fixed, changes } = autoFixCode(analyzedCode, fixes, suggestions);

        // Cek apakah ada perubahan
        if (changes.length === 0) {
            await edit(
                chatId,
                msgId,
                `ℹ️ **Tidak ada perbaikan otomatis yang bisa dilakukan!**\n\n` +
                `Beberapa error mungkin memerlukan perbaikan manual oleh developer.\n\n` +
                `📋 **Rekomendasi:**\n${errors.map(e => `• ${e}`).join('\n')}`,
                [[{ text: "🏠 Menu Utama", data: "start" }]]
            );
            return;
        }

        // Tampilkan perubahan yang dilakukan
        let changesText = `🔧 **PERBAIKAN OTOMATIS DILAKUKAN**\n────────────────────────────────\n\n`;
        changesText += `📝 **Perubahan (${changes.length}):**\n`;
        for (const change of changes) {
            changesText += `• ${change}\n`;
        }
        changesText += `\n📊 **Status:**\n`;
        changesText += `❌ Error tersisa: **${errors.length}** (mungkin perlu perbaikan manual)\n`;
        changesText += `⚠️ Warning tersisa: **${warnings.length}**\n\n`;

        if (errors.length === 0 && warnings.length === 0) {
            changesText += `✅ **Semua error dan warning telah diperbaiki!** 🎉`;
        } else {
            changesText += `💡 __Beberapa error/warning mungkin perlu perbaikan manual oleh developer.__`;
        }

        // Kirim kode yang sudah diperbaiki sebagai file
        const fileName = `fixed_code_${userId}_${Date.now()}.js`;
        const filePath = tmpPath(fileName);
        fs.writeFileSync(filePath, fixed, 'utf8');

        await client.sendFile(chatId, {
            file: filePath,
            forceDocument: true,
            attributes: [new Api.DocumentAttributeFilename({ fileName })],
            caption: changesText,
            parseMode: 'md',
        });

        // Hapus file setelah dikirim
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

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
            `✅ **Perbaikan selesai!**\n\nFile kode yang sudah diperbaiki sudah dikirim di atas. 🎉`,
            [[{ text: "🏠 Menu Utama", data: "start" }]]
        );

    } catch (err) {
        await edit(chatId, msgId, `❌ **Gagal memperbaiki kode!**\n\n🛑 Error: \`${err.message}\``);
    }
}

// ─── CALLBACK HANDLER ──────────────────────────────────────
async function handleCekErrorCallback(event) {
    const data = event.data.toString();
    const chatId = event.chatId;
    const userId = Number(event.senderId);
    const msgId = event.messageId;

    if (data === "cekerror") {
        return await handleCekError(chatId, userId, msgId);
    }

    if (data === "cekerror_autofix") {
        return await handleCekErrorAutofix(chatId, userId, msgId);
    }
}

// ─── REGISTER FUNCTIONS ────────────────────────────────────
Object.assign(globalThis, {
    handleCekError,
    handleCekErrorText,
    handleCekErrorAutofix,
    handleCekErrorCallback,
    detectAiGenerated,
    analyzeFunc,
    autoFixCode,
});

module.exports = {
    handleCekError,
    handleCekErrorText,
    handleCekErrorAutofix,
    handleCekErrorCallback,
    detectAiGenerated,
    analyzeFunc,
    autoFixCode,
};