// src/features/dartpreview.js
// Fitur Dart Preview - Preview widget Flutter dari file .dart

const crypto = require('crypto');

// ─── DART PREVIEW HANDLER ──────────────────────────────────────────────────────

/**
 * Ambil source dari file .dart, wrap kalau perlu, lalu render lewat API.
 */
async function handleDartPreviewProcess(dartBuffer, filename) {
    let dartCode = dartBuffer.toString('utf-8');

    // Auto-wrap kalau tidak ada main() — user kirim widget doang
    const hasMain = /void\s+main\s*\(/.test(dartCode);
    const hasImportMaterial = dartCode.includes("import 'package:flutter/material.dart'");
    const hasImportWidgets = dartCode.includes("import 'package:flutter/widgets.dart'");

    if (!hasMain) {
        // Cari nama class pertama yang extends StatelessWidget / StatefulWidget
        const classMatch = dartCode.match(/class\s+(\w+)\s+extends\s+(?:Stateless|Stateful)Widget/);
        const widgetName = classMatch ? classMatch[1] : 'MyWidget';

        const imports = (!hasImportMaterial && !hasImportWidgets)
            ? "import 'package:flutter/material.dart';\n\n"
            : '';

        dartCode = `${imports}${dartCode}

void main() {
  runApp(
    MaterialApp(
      debugShowCheckedModeBanner: false,
      home: Scaffold(
        body: Center(child: ${widgetName}()),
      ),
    ),
  );
}
`;
    } else if (!hasImportMaterial && !hasImportWidgets) {
        dartCode = "import 'package:flutter/material.dart';\n\n" + dartCode;
    }

    // ─── Coba compile dulu lewat DartPad ────────────────────────────────────
    let compileResult;
    try {
        const compRes = await httpsPostJson('https://dartpad.dev/api/dartservices/v2/compile', {
            source: dartCode
        });
        compileResult = compRes.body;
    } catch (e) {
        throw new Error(`Koneksi ke DartPad gagal: ${e.message}`);
    }

    if (compileResult && compileResult.error) {
        const errMsg = compileResult.error || 'Compile error';
        throw new Error(`❌ Kode Dart gagal compile:\n\n${errMsg}`);
    }

    // ─── Upload ke DartPad ──────────────────────────────────────────────────
    const shareId = await uploadToDartPad(dartCode);
    if (!shareId) throw new Error('Gagal upload ke DartPad. Coba lagi nanti.');

    const embedUrl = `https://dartpad.dev/embed-flutter.html?id=${shareId}&theme=dark&run=true`;
    const imageBuffer = await screenshotViaApi(embedUrl);

    return {
        imageBuffer,
        shareId,
        embedUrl: `https://dartpad.dev/?id=${shareId}`,
        dartCode,
    };
}

/**
 * Upload kode dart ke DartPad gist-like API, return ID
 */
async function uploadToDartPad(dartCode) {
    try {
        const response = await httpsPostJson('https://dartpad.dev/api/dartservices/v2/shareDart', {
            dart: dartCode
        });
        if (response.status !== 200) return null;
        return response.body?.uuid || null;
    } catch {
        return null;
    }
}

/**
 * Screenshot URL lewat beberapa API screenshot gratis
 */
async function screenshotViaApi(url) {
    const apis = [
        `https://image.thum.io/get/width/390/crop/844/allowJPG/wait/5/noanimate/${encodeURIComponent(url)}`,
        `https://mini.s-shot.ru/390x844/PNG/390/Z1/?${encodeURIComponent(url)}`,
        `https://api.screenshotone.com/take?url=${encodeURIComponent(url)}&viewport_width=390&viewport_height=844&format=png&timeout=25`,
    ];

    for (const apiUrl of apis) {
        try {
            const response = await fetchUrl(apiUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15' },
                timeout: 30000,
            });
            if (!response || response.status !== 200) continue;
            
            const ct = response.headers.get('content-type') || '';
            if (ct.includes('image') || ct.includes('png') || ct.includes('jpeg')) {
                if (response.body && response.body.length > 5000) {
                    return response.body;
                }
            }
        } catch (_) {
            continue;
        }
    }

    throw new Error('Semua API screenshot gagal. Coba lagi beberapa saat.');
}

/**
 * Fetch URL dengan timeout dan return buffer
 */
function fetchUrl(urlStr, options = {}) {
    return new Promise((resolve) => {
        const timeout = options.timeout || 30000;
        let timer;
        
        const lib = urlStr.startsWith('https') ? require('https') : require('http');
        const url = new URL(urlStr);
        
        const req = lib.request({
            hostname: url.hostname,
            path: url.pathname + url.search,
            method: 'GET',
            headers: options.headers || {},
        }, (res) => {
            const chunks = [];
            res.on('data', (c) => chunks.push(c));
            res.on('end', () => {
                clearTimeout(timer);
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    body: Buffer.concat(chunks),
                });
            });
            res.on('error', () => {
                clearTimeout(timer);
                resolve(null);
            });
        });
        
        req.setTimeout(timeout, () => {
            req.destroy();
            clearTimeout(timer);
            resolve(null);
        });
        
        req.on('error', () => {
            clearTimeout(timer);
            resolve(null);
        });
        
        req.end();
    });
}

// ─── HANDLER UTAMA ─────────────────────────────────────────────────────────────

async function handleDartPreview(chatId, userId, deleteMsgId = null) {
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
            `Harap tunggu hingga proses sebelumnya selesai,\natau gunakan tombol dibawah untuk membatalkan.`,
            [[{ text: "❌ Batalkan", data: "cancel" }]],
            deleteMsgId
        );
        return;
    }

    await sendActionNotification(userId, 'Dart Preview');

    let username = null;
    let fullName = "Unknown User";
    try {
        const entity = await client.getEntity(userId);
        username = entity?.username || null;
        fullName = [entity?.firstName, entity?.lastName].filter(Boolean).join(" ") || "Unknown User";
    } catch (_) {}

    setUserJob(userId, {
        status: 'waiting_dart_preview',
        chatId,
        userId,
        username,
        fullName,
        type: 'dart_preview',
        updatedAt: Date.now(),
    });

    await send(
        chatId,
        `📱 **DART PREVIEW**\n` +
        `────────────────────────────────\n\n` +
        `Fitur ini menampilkan preview UI dari widget Flutter (.dart) yang kamu kirim.\n\n` +
        `📌 **Cara kerja:**\n` +
        `• Kirim file **.dart** berisi widget Flutter\n` +
        `• Bot akan compile & tampilkan screenshot preview\n` +
        `• Mendukung StatelessWidget / StatefulWidget\n` +
        `• Otomatis dibungkus dengan MaterialApp jika belum ada main()\n\n` +
        `💡 __Kirim file .dart sekarang untuk melihat preview UI-nya!__`,
        [
            [{ text: "📱 Preview Dart", data: "dart_preview" }],
            [{ text: "❌ Batalkan", data: "cancel" }],
        ],
        deleteMsgId
    );
}

async function handleDartPreviewFile(event) {
    const chatId = event.chatId;
    const userId = Number(event.message.senderId);
    const msg = event.message;
    const job = getUserJob(userId);

    if (!job || job.status !== 'waiting_dart_preview' || job.type !== 'dart_preview') return false;

    const media = msg.media;
    if (!media || !media.document) {
        await send(chatId, `⚠️ **[ INPUT ERROR ]**\n────────────────────────────────\n\nKirim file **.dart** widget Flutter kamu ya bray!`);
        return true;
    }

    const doc = media.document;
    const fileName = doc.attributes?.find((a) => a.fileName)?.fileName || 'widget.dart';

    if (!fileName.toLowerCase().endsWith('.dart')) {
        await send(
            chatId,
            `❌ **FORMAT FILE TIDAK DIDUKUNG!**\n\n` +
            `• **Ekstensi Wajib:** \`.dart\`\n\n` +
            `💡 __Kirim file .dart berisi widget Flutter.__`
        );
        return true;
    }

    const statusMsg = await send(
        chatId,
        `📥 **Memproses Dart Preview...**\n\n` +
        `📄 **File:** \`${fileName}\`\n\n` +
        `⏳ __Mengunduh & mengompilasi...__`
    );
    const msgId = statusMsg.id;

    try {
        // Download file .dart
        const dartBuffer = await client.downloadMedia(msg, { outputFile: undefined });

        // Proses preview
        await edit(
            chatId,
            msgId,
            `⚙️ **Mengompilasi & Mengambil Screenshot...**\n\n` +
            `📄 **File:** \`${fileName}\`\n\n` +
            `⏳ __Mohon tunggu sebentar...__`
        );

        const result = await handleDartPreviewProcess(dartBuffer, fileName);

        // Kirim hasil preview
        await client.sendFile(chatId, {
            file: result.imageBuffer,
            forceDocument: false,
            caption:
                `✅ **DART PREVIEW SELESAI!** 🎉\n` +
                `────────────────────────────────\n\n` +
                `📄 **File:** \`${fileName}\`\n` +
                `🔗 **DartPad:** [Buka di DartPad](${result.embedUrl})\n` +
                `────────────────────────────────\n\n` +
                `__Preview dihasilkan dari kode widget Flutter kamu.__`,
            parseMode: "md",
        });

        // Deduct credit
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
            `✅ **Dart Preview Selesai!**\n\nPreview UI sudah dikirim di atas. 🎉`,
            [[{ text: "🏠 Menu Utama", data: "start" }]]
        );

    } catch (err) {
        removeUserJob(userId);
        await edit(
            chatId,
            msgId,
            `❌ **GAGAL MEMPROSES!**\n\n` +
            `🛑 **Error:**\n\`${err.message}\`\n\n` +
            `💡 __Pastikan kode .dart kamu valid dan berisi widget Flutter.__`
        );
    }

    return true;
}

// ─── CALLBACK HANDLER ──────────────────────────────────────────────────────────

async function handleDartPreviewCallback(event) {
    const data = event.data.toString();
    const chatId = event.chatId;
    const userId = Number(event.senderId);
    const msgId = event.messageId;

    if (data === "dart_preview") {
        return await handleDartPreview(chatId, userId, msgId);
    }
}

// ─── REGISTER FUNCTIONS ────────────────────────────────────────────────────────

Object.assign(globalThis, {
    handleDartPreview,
    handleDartPreviewFile,
    handleDartPreviewCallback,
    handleDartPreviewProcess,
    uploadToDartPad,
    screenshotViaApi,
    fetchUrl,
});

module.exports = {
    handleDartPreview,
    handleDartPreviewFile,
    handleDartPreviewCallback,
    handleDartPreviewProcess,
    uploadToDartPad,
    screenshotViaApi,
    fetchUrl,
};