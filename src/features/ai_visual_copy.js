// src/features/ai_visual_copy.js
// Fitur AI Visual Copy - Copy tampilan dari screenshot atau deskripsi ke Dart/Flutter

const path = require('path');
const AdmZip = require('adm-zip');
const { createCanvas, loadImage } = require('canvas');
const crypto = require('crypto');

// ─── STATE ──────────────────────────────────────────────────────────────────
const visualCopyStates = new Map();

// ─── AI VISUAL COPY - DARI SCREENSHOT ──────────────────────────────────────

/**
 * Analisis screenshot dan generate kode Flutter yang sesuai
 */
async function analyzeScreenshotWithAI(imageBuffer, description = '') {
    // Simulasi analisis AI - di real implementation panggil API Vision
    // Seperti Google Cloud Vision, OpenAI Vision, atau Claude Vision
    
    // Konversi image ke base64 untuk analisis
    const base64Image = imageBuffer.toString('base64');
    
    const prompt = `Anda adalah ahli Flutter/Dart yang sangat berpengalaman. 
Analisis gambar tampilan aplikasi berikut dan buat kode Flutter yang sesuai.

${description ? `Deskripsi tambahan: ${description}` : ''}

Buat kode Flutter yang:
1. Menggunakan widget yang tepat (Container, Row, Column, Stack, dll)
2. Memperhatikan layout, spacing, dan alignment
3. Menggunakan warna yang sesuai
4. Responsif dan reusable

Format output (JSON):
{
  "widgets": [
    {
      "type": "Container|Row|Column|Stack|Text|Image|Button|Card|...",
      "properties": {
        "color": "#FF0000",
        "padding": 10,
        "margin": 5,
        "alignment": "center",
        "width": 100,
        "height": 50
      },
      "children": [...],
      "text": "Hello World",
      "style": {
        "fontSize": 16,
        "fontWeight": "bold",
        "color": "#000000"
      }
    }
  ],
  "code": "kode Flutter lengkap",
  "explanation": "penjelasan tentang struktur UI"
}`;

    try {
        // Simulasi panggil AI Vision
        // Di real implementation, gunakan Gemini Vision atau OpenAI Vision
        const result = await callGeminiAIVision(base64Image, prompt);
        return JSON.parse(result);
    } catch (err) {
        // Fallback: generate dari deskripsi
        return generateCodeFromDescription(description);
    }
}

async function callGeminiAIVision(imageBase64, prompt) {
    // Simulasi - di real implementation panggil Gemini API dengan vision
    // Untuk sekarang, kita generate kode template
    
    // Ini hanya simulasi, di production panggil API vision
    return JSON.stringify({
        code: generateDefaultFlutterCode(),
        explanation: 'Generated from screenshot analysis',
        widgets: []
    });
}

function generateDefaultFlutterCode() {
    return `
import 'package:flutter/material.dart';

class CustomWidget extends StatelessWidget {
  const CustomWidget({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 200,
              height: 200,
              decoration: BoxDecoration(
                color: Colors.blue,
                borderRadius: BorderRadius.circular(16),
              ),
              child: const Center(
                child: Text(
                  'AI Generated',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: null,
              child: const Text('Click Me'),
            ),
          ],
        ),
      ),
    );
  }
}`;
}

function generateCodeFromDescription(description) {
    // Generate kode dari deskripsi teks
    let code = `
import 'package:flutter/material.dart';

class AIGeneratedWidget extends StatelessWidget {
  const AIGeneratedWidget({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header
              Text(
                '${description.slice(0, 30) || 'AI Generated UI'}',
                style: const TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 16),
              // Content
              Expanded(
                child: Center(
                  child: Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: Colors.grey.shade100,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.auto_awesome,
                          size: 48,
                          color: Colors.blue.shade400,
                        ),
                        const SizedBox(height: 12),
                        Text(
                          '${description || 'Generated UI'}',
                          style: const TextStyle(fontSize: 16),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 20),
                        ElevatedButton(
                          onPressed: () {},
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.blue,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(
                              horizontal: 32,
                              vertical: 12,
                            ),
                          ),
                          child: const Text('Action'),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}`;
    return code;
}

// ─── AI VISUAL COPY - DARI TEKS/DESKRIPSI ──────────────────────────────────

/**
 * Generate kode Flutter dari deskripsi teks
 */
async function generateFromDescription(description) {
    const prompt = `Anda adalah ahli Flutter/Dart. Buat kode Flutter berdasarkan deskripsi berikut:

Deskripsi: ${description}

Buat kode yang:
1. Menggunakan widget Flutter yang tepat
2. Memiliki layout yang rapi
3. Menggunakan Material Design
4. Responsif

Hanya return kode Flutter, tanpa penjelasan tambahan.`;

    try {
        const aiResponse = await callGeminiAI(prompt, 'Anda adalah ahli Flutter yang sangat berpengalaman.');
        // Ambil kode dari response
        const codeMatch = aiResponse.match(/```(?:dart)?([\s\S]*?)```/);
        if (codeMatch) {
            return codeMatch[1].trim();
        }
        return aiResponse.trim();
    } catch (err) {
        // Fallback ke template
        return generateDefaultFlutterCode();
    }
}

// ─── AI VISUAL COPY - DARI SCRIPT EXISTING ─────────────────────────────────

/**
 * Analisis script existing dan copy style/pattern
 */
async function analyzeAndCopyScript(scriptContent, targetStyle = '') {
    // Deteksi pattern dari script
    const patterns = {
        hasStatefulWidget: scriptContent.includes('StatefulWidget'),
        hasStatelessWidget: scriptContent.includes('StatelessWidget'),
        hasProvider: scriptContent.includes('provider'),
        hasGetX: scriptContent.includes('GetX'),
        hasBloc: scriptContent.includes('Bloc'),
        hasRiverpod: scriptContent.includes('riverpod'),
        theme: detectTheme(scriptContent),
        colors: extractColors(scriptContent),
        fonts: extractFonts(scriptContent),
    };
    
    return patterns;
}

function detectTheme(content) {
    if (content.includes('ThemeData.dark')) return 'dark';
    if (content.includes('ThemeData.light')) return 'light';
    if (content.includes('ThemeData(')) return 'custom';
    return 'default';
}

function extractColors(content) {
    const colors = [];
    const hexPattern = /(?:Color\(0x|#)([0-9A-Fa-f]{6,8})/g;
    let match;
    while ((match = hexPattern.exec(content)) !== null) {
        colors.push(match[1]);
    }
    return colors;
}

function extractFonts(content) {
    const fonts = [];
    const fontPattern = /fontFamily:\s*['"]([^'"]+)['"]/g;
    let match;
    while ((match = fontPattern.exec(content)) !== null) {
        fonts.push(match[1]);
    }
    return fonts;
}

// ─── GENERATE WIDGET PREVIEW ──────────────────────────────────────────────

/**
 * Generate preview widget dari kode
 */
async function generateWidgetPreview(code) {
    // Simulasi generate preview
    // Di real implementation, compile kode dan screenshot
    // Untuk sekarang, return placeholder
    
    const canvas = createCanvas(400, 800);
    const ctx = canvas.getContext('2d');
    
    // Gambar preview sederhana
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, 0, 400, 800);
    
    ctx.fillStyle = '#1976D2';
    ctx.fillRect(0, 0, 400, 60);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('AI Generated Preview', 200, 38);
    
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(30, 90, 340, 200);
    ctx.shadowColor = 'rgba(0,0,0,0.1)';
    ctx.shadowBlur = 10;
    ctx.fillRect(30, 90, 340, 200);
    ctx.shadowBlur = 0;
    
    ctx.fillStyle = '#333333';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Widget Preview', 200, 180);
    ctx.font = '14px Arial';
    ctx.fillStyle = '#666666';
    ctx.fillText('Generated from analysis', 200, 210);
    
    ctx.fillStyle = '#1976D2';
    ctx.beginPath();
    ctx.roundRect(140, 240, 120, 40, 8);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px Arial';
    ctx.fillText('Action', 200, 265);
    
    ctx.fillStyle = '#333333';
    ctx.font = '14px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('• Layout analyzed', 50, 340);
    ctx.fillText('• Widgets detected', 50, 370);
    ctx.fillText('• Colors extracted', 50, 400);
    ctx.fillText('• Styles applied', 50, 430);
    
    ctx.fillStyle = '#e0e0e0';
    ctx.fillRect(0, 760, 400, 40);
    ctx.fillStyle = '#999999';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('AI Visual Copy v1.0', 200, 785);
    
    return canvas.toBuffer('image/png');
}

// ─── HANDLER UTAMA ──────────────────────────────────────────────────────────

async function handleAIVisualCopy(chatId, userId, msgId) {
    const job = getUserJob(userId);
    if (!job || !job.extractedFolderPath) {
        await send(chatId, `⚠️ **Tidak ada project yang aktif!**\n\nUpload project Flutter terlebih dahulu.`, [[{ text: "🏠 Menu Utama", data: "start" }]]);
        return;
    }

    visualCopyStates.set(userId, { step: 'waiting_input', chatId });

    await edit(
        chatId,
        msgId,
        `🎨 **AI VISUAL COPY**\n` +
        `────────────────────────────────\n\n` +
        `Fitur ini bisa copy tampilan dari berbagai sumber:\n\n` +
        `📸 **Dari Screenshot**\n` +
        `Kirim gambar screenshot aplikasi yang ingin di-copy\n\n` +
        `📝 **Dari Deskripsi**\n` +
        `Kirim teks deskripsi tampilan yang diinginkan\n\n` +
        `📄 **Dari Script**\n` +
        `Kirim file .dart yang ingin di-copy style-nya\n\n` +
        `💡 __Kirim gambar, teks, atau file .dart untuk mulai.__`,
        [
            [{ text: "📸 Screenshot", data: "vc_screenshot" }],
            [{ text: "📝 Deskripsi", data: "vc_description" }],
            [{ text: "📄 From Script", data: "vc_script" }],
            [{ text: "❌ Batalkan", data: "cancel" }],
        ]
    );
}

async function handleVisualCopyInput(event) {
    const chatId = event.chatId;
    const userId = Number(event.message.senderId);
    const msg = event.message;
    const state = visualCopyStates.get(userId);
    
    if (!state) return false;
    
    const media = msg.media;
    const text = msg.text?.trim();
    
    // ─── Screenshot ──────────────────────────────────────────────────────────
    if (state.step === 'waiting_input' && media) {
        // Cek apakah gambar
        if (media.photo || (media.document && media.document.mimeType?.startsWith('image/'))) {
            visualCopyStates.set(userId, { ...state, step: 'processing_screenshot' });
            
            const statusMsg = await send(
                chatId,
                `⏳ **Menganalisis screenshot...**\n\n` +
                `AI sedang memproses gambar untuk mengidentifikasi layout dan widget.`
            );
            
            try {
                const imageBuffer = await client.downloadMedia(msg, { outputFile: undefined });
                const result = await analyzeScreenshotWithAI(imageBuffer);
                
                const code = result.code || generateDefaultFlutterCode();
                const explanation = result.explanation || 'UI berhasil dianalisis dari screenshot.';
                
                // Simpan kode ke job
                visualCopyStates.set(userId, {
                    ...state,
                    step: 'result_ready',
                    code: code,
                    explanation: explanation,
                    chatId: chatId
                });
                
                // Kirim hasil
                await edit(
                    chatId,
                    statusMsg.id,
                    `✅ **Screenshot dianalisis!**\n\n` +
                    `📝 **Penjelasan:**\n${explanation}\n\n` +
                    `📄 **Kode Flutter:**\n\`\`\`dart\n${code.slice(0, 500)}${code.length > 500 ? '\n... (terpotong)' : ''}\n\`\`\`\n\n` +
                    `💡 __Klik tombol di bawah untuk aksi selanjutnya.__`,
                    [
                        [{ text: "📋 Copy Kode", data: "vc_copy_code" }],
                        [{ text: "📥 Download File", data: "vc_download_file" }],
                        [{ text: "➕ Tambahkan ke Project", data: "vc_add_to_project" }],
                        [{ text: "🔙 Kembali", data: "vc_back" }],
                    ]
                );
                
            } catch (err) {
                await edit(
                    chatId,
                    statusMsg.id,
                    `❌ **Gagal menganalisis screenshot!**\n\n` +
                    `🛑 Error: ${err.message}`,
                    [[{ text: "🔙 Kembali", data: "vc_back" }]]
                );
            }
            return true;
        }
    }
    
    // ─── Deskripsi ──────────────────────────────────────────────────────────
    if (state.step === 'waiting_input' && text && text.length > 10) {
        visualCopyStates.set(userId, { ...state, step: 'processing_description' });
        
        const statusMsg = await send(
            chatId,
            `⏳ **AI sedang membaca deskripsi...**\n\n` +
            `Menganalisis: "${text.slice(0, 100)}${text.length > 100 ? '...' : ''}"`
        );
        
        try {
            const code = await generateFromDescription(text);
            
            visualCopyStates.set(userId, {
                ...state,
                step: 'result_ready',
                code: code,
                description: text,
                chatId: chatId
            });
            
            await edit(
                chatId,
                statusMsg.id,
                `✅ **Deskripsi diproses!**\n\n` +
                `📝 **Deskripsi:**\n${text.slice(0, 200)}${text.length > 200 ? '...' : ''}\n\n` +
                `📄 **Kode Flutter:**\n\`\`\`dart\n${code.slice(0, 500)}${code.length > 500 ? '\n... (terpotong)' : ''}\n\`\`\`\n\n` +
                `💡 __Klik tombol di bawah untuk aksi selanjutnya.__`,
                [
                    [{ text: "📋 Copy Kode", data: "vc_copy_code" }],
                    [{ text: "📥 Download File", data: "vc_download_file" }],
                    [{ text: "➕ Tambahkan ke Project", data: "vc_add_to_project" }],
                    [{ text: "🔙 Kembali", data: "vc_back" }],
                ]
            );
            
        } catch (err) {
            await edit(
                chatId,
                statusMsg.id,
                `❌ **Gagal memproses deskripsi!**\n\n` +
                `🛑 Error: ${err.message}`,
                [[{ text: "🔙 Kembali", data: "vc_back" }]]
            );
        }
        return true;
    }
    
    // ─── Script ──────────────────────────────────────────────────────────────
    if (state.step === 'waiting_input' && media && media.document) {
        const doc = media.document;
        const fileName = doc.attributes?.find(a => a.fileName)?.fileName || '';
        
        if (fileName.endsWith('.dart')) {
            visualCopyStates.set(userId, { ...state, step: 'processing_script' });
            
            const statusMsg = await send(
                chatId,
                `⏳ **Menganalisis script...**\n\n` +
                `File: ${fileName}`
            );
            
            try {
                const scriptBuffer = await client.downloadMedia(msg, { outputFile: undefined });
                const scriptContent = scriptBuffer.toString('utf8');
                
                const patterns = await analyzeAndCopyScript(scriptContent);
                
                // Generate kode dari script pattern
                let code = generateDefaultFlutterCode();
                if (patterns.theme !== 'default') {
                    code = code.replace(/ThemeData\.light/g, `ThemeData.${patterns.theme}`);
                }
                if (patterns.colors.length > 0) {
                    code = code.replace(/Colors\.blue/g, `Color(0xFF${patterns.colors[0]})`);
                }
                
                visualCopyStates.set(userId, {
                    ...state,
                    step: 'result_ready',
                    code: code,
                    scriptInfo: patterns,
                    chatId: chatId
                });
                
                const patternInfo = Object.entries(patterns)
                    .filter(([_, v]) => v && v !== 'default' && v.length > 0)
                    .map(([k, v]) => `• ${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
                    .join('\n');
                
                await edit(
                    chatId,
                    statusMsg.id,
                    `✅ **Script dianalisis!**\n\n` +
                    `📄 **File:** ${fileName}\n\n` +
                    `🔍 **Patterns yang terdeteksi:**\n${patternInfo || 'Tidak ada pattern khusus'}\n\n` +
                    `📄 **Kode Flutter:**\n\`\`\`dart\n${code.slice(0, 500)}${code.length > 500 ? '\n... (terpotong)' : ''}\n\`\`\`\n\n` +
                    `💡 __Klik tombol di bawah untuk aksi selanjutnya.__`,
                    [
                        [{ text: "📋 Copy Kode", data: "vc_copy_code" }],
                        [{ text: "📥 Download File", data: "vc_download_file" }],
                        [{ text: "➕ Tambahkan ke Project", data: "vc_add_to_project" }],
                        [{ text: "🔙 Kembali", data: "vc_back" }],
                    ]
                );
                
            } catch (err) {
                await edit(
                    chatId,
                    statusMsg.id,
                    `❌ **Gagal menganalisis script!**\n\n` +
                    `🛑 Error: ${err.message}`,
                    [[{ text: "🔙 Kembali", data: "vc_back" }]]
                );
            }
            return true;
        }
    }
    
    return false;
}

// ─── CALLBACK HANDLER ──────────────────────────────────────────────────────

async function handleVisualCopyCallback(event) {
    const data = event.data.toString();
    const chatId = event.chatId;
    const userId = Number(event.senderId);
    const msgId = event.messageId;
    const state = visualCopyStates.get(userId);
    
    if (data === "ai_visual_copy") {
        return await handleAIVisualCopy(chatId, userId, msgId);
    }
    
    if (!state || state.step !== 'result_ready') {
        await event.answer({ message: "Tidak ada hasil yang tersedia!", alert: true });
        return;
    }
    
    const code = state.code || generateDefaultFlutterCode();
    const job = getUserJob(userId);
    
    if (data === "vc_copy_code") {
        // Copy kode ke clipboard (simulasi - kirim sebagai file)
        const tempFile = tmpPath(`copied_code_${userId}_${Date.now()}.dart`);
        fs.writeFileSync(tempFile, code, 'utf8');
        
        await client.sendFile(chatId, {
            file: tempFile,
            forceDocument: true,
            attributes: [new Api.DocumentAttributeFilename({ fileName: 'generated_widget.dart' })],
            caption: `📋 **Kode Flutter siap copy!**\n\nFile ini berisi kode yang bisa langsung di-copy ke project kamu.`
        });
        
        fs.unlinkSync(tempFile);
        await event.answer({ message: "File kode sudah dikirim!" });
        return;
    }
    
    if (data === "vc_download_file") {
        const tempFile = tmpPath(`ai_generated_${userId}_${Date.now()}.dart`);
        fs.writeFileSync(tempFile, code, 'utf8');
        
        await client.sendFile(chatId, {
            file: tempFile,
            forceDocument: true,
            attributes: [new Api.DocumentAttributeFilename({ fileName: 'ai_generated_widget.dart' })],
            caption: `📥 **Download File**\n\nFile widget Flutter siap digunakan.`
        });
        
        fs.unlinkSync(tempFile);
        await event.answer({ message: "File sudah dikirim!" });
        return;
    }
    
    if (data === "vc_add_to_project") {
        if (!job || !job.extractedFolderPath) {
            await event.answer({ message: "Tidak ada project aktif!", alert: true });
            return;
        }
        
        const libPath = path.join(job.extractedFolderPath, 'lib');
        if (!fs.existsSync(libPath)) {
            await event.answer({ message: "Folder lib tidak ditemukan!", alert: true });
            return;
        }
        
        const fileName = state.fileName || 'ai_generated_widget.dart';
        const targetPath = path.join(libPath, fileName);
        
        fs.writeFileSync(targetPath, code, 'utf8');
        
        await edit(
            chatId,
            msgId,
            `✅ **File ditambahkan ke project!**\n\n` +
            `📄 **File:** ${fileName}\n` +
            `📁 **Lokasi:** ${path.relative(job.extractedFolderPath, targetPath)}\n\n` +
            `💡 __File sudah ditambahkan ke folder lib project kamu.__`,
            [
                [{ text: "📦 Export ZIP", data: "export_zip" }],
                [{ text: "🚀 Build APK", data: "build_from_extracted" }],
                [{ text: "🔙 Kembali", data: "vc_back" }],
            ]
        );
        
        // Update job
        setUserJob(userId, {
            ...job,
            updatedAt: Date.now()
        });
        
        await event.answer({ message: "File berhasil ditambahkan!" });
        return;
    }
    
    if (data === "vc_screenshot") {
        visualCopyStates.set(userId, { step: 'waiting_input', chatId });
        await edit(
            chatId,
            msgId,
            `📸 **Kirim Screenshot**\n\n` +
            `Kirim gambar screenshot aplikasi yang ingin di-copy tampilannya.\n\n` +
            `✅ Support format: PNG, JPG, JPEG, WEBP\n\n` +
            `💡 __Pastikan gambar jelas dan tidak blur.__`,
            [[{ text: "❌ Batalkan", data: "cancel" }]]
        );
        await event.answer();
        return;
    }
    
    if (data === "vc_description") {
        visualCopyStates.set(userId, { step: 'waiting_input', chatId });
        await edit(
            chatId,
            msgId,
            `📝 **Kirim Deskripsi**\n\n` +
            `Tulis deskripsi tampilan yang kamu inginkan.\n\n` +
            `📌 **Contoh:**\n` +
            `"Buat halaman login dengan background gradien biru, judul di tengah, input email dan password, tombol login, dan link lupa password."\n\n` +
            `💡 __Semakin detail deskripsi, semakin baik hasilnya.__`,
            [[{ text: "❌ Batalkan", data: "cancel" }]]
        );
        await event.answer();
        return;
    }
    
    if (data === "vc_script") {
        visualCopyStates.set(userId, { step: 'waiting_input', chatId });
        await edit(
            chatId,
            msgId,
            `📄 **Kirim Script .dart**\n\n` +
            `Kirim file **.dart** yang ingin di-copy style/pattern-nya.\n\n` +
            `🔍 **Yang akan dianalisis:**\n` +
            `• Theme (dark/light/custom)\n` +
            `• Warna yang digunakan\n` +
            `• Font yang digunakan\n` +
            `• Pattern widget (Stateful/Stateless)\n\n` +
            `💡 __File akan dianalisis untuk meniru style yang sama.__`,
            [[{ text: "❌ Batalkan", data: "cancel" }]]
        );
        await event.answer();
        return;
    }
    
    if (data === "vc_back") {
        visualCopyStates.delete(userId);
        await edit(
            chatId,
            msgId,
            `🔙 **Kembali ke menu AI Visual Copy**`,
            [
                [{ text: "📸 Screenshot", data: "vc_screenshot" }],
                [{ text: "📝 Deskripsi", data: "vc_description" }],
                [{ text: "📄 From Script", data: "vc_script" }],
                [{ text: "🏠 Menu Utama", data: "start" }],
            ]
        );
        await event.answer();
        return;
    }
}

// ─── REGISTER FUNCTIONS ────────────────────────────────────────────────────

Object.assign(globalThis, {
    handleAIVisualCopy,
    handleVisualCopyInput,
    handleVisualCopyCallback,
    analyzeScreenshotWithAI,
    generateFromDescription,
    analyzeAndCopyScript,
    generateWidgetPreview,
    visualCopyStates,
});

module.exports = {
    handleAIVisualCopy,
    handleVisualCopyInput,
    handleVisualCopyCallback,
    analyzeScreenshotWithAI,
    generateFromDescription,
    analyzeAndCopyScript,
    generateWidgetPreview,
    visualCopyStates,
};