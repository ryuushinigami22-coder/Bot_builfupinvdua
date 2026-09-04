// src/features/virusscanner.js
// Fitur Scan Virus untuk file ZIP

const path = require('path');
const AdmZip = require('adm-zip');

// ─── DAFTAR EKSTENSI BERBAHAYA ──────────────────────────────────────────────
const DANGEROUS_EXTENSIONS = new Set([
    // Executable files
    '.exe', '.scr', '.com', '.bat', '.cmd', '.ps1', '.vbs', '.vbe', '.js', '.jse',
    '.wsf', '.wsh', '.msi', '.msp', '.msm', '.app', '.cpl', '.hta', '.pif',
    '.application', '.gadget', '.msh', '.msh1', '.msh2', '.mshxml', '.msh1xml', '.msh2xml',
    '.psc1', '.psc2', '.ps1xml', '.ps2xml', '.ps1', '.ps2',
    // Macro files
    '.docm', '.dotm', '.xlsm', '.xltm', '.pptm', '.potm', '.ppam', '.ppsm', '.sldm',
    // Other dangerous
    '.jar', '.apk', '.dex', '.so', '.dll', '.sys', '.drv', '.ocx', '.vbx', '.olb',
    '.vxd', '.vx', '.386', '.acm', '.ax', '.cpl', '.dpl', '.bpl',
]);

// ─── EKSTENSI YANG MENCURIGAKAN (DOUBLE EXTENSION) ──────────────────────────
const SUSPICIOUS_PATTERNS = [
    /\.(jpg|jpeg|png|gif|bmp|webp|ico|svg|pdf|doc|docx|xls|xlsx|ppt|pptx|txt|rtf|odt|ods|odp)\.(exe|scr|com|bat|cmd|ps1|vbs|js|jar|apk|dll)$/i,
    /\.(zip|rar|7z|tar|gz|bz2)\.(exe|scr|com|bat|cmd|ps1|vbs|js|jar)$/i,
];

// ─── FILE TERSEMBUNYI ─────────────────────────────────────────────────────────
const HIDDEN_FILE_PATTERNS = [
    /^\./,
    /^~/,
    /^Thumbs\.db$/i,
    /^desktop\.ini$/i,
    /^\.DS_Store$/i,
    /^\$RECYCLE\.BIN$/i,
    /^System Volume Information$/i,
];

// ─── POLA KONTEN BERBAHAYA ───────────────────────────────────────────────────
const MALICIOUS_CONTENT_PATTERNS = [
    // JavaScript/HTML injection
    /<script[\s\S]*?>/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /document\.write/i,
    /eval\s*\(/i,
    /setTimeout\s*\(/i,
    /setInterval\s*\(/i,
    // Base64 obfuscation
    /atob\s*\(/i,
    /btoa\s*\(/i,
    // PowerShell
    /powershell\.exe/i,
    /Invoke-Expression/i,
    /IEX\s+/i,
    // CMD
    /cmd\.exe/i,
    /\/c\s+/i,
    // Dangerous functions
    /System\.Runtime\.InteropServices/i,
    /ShellExecute/i,
    /CreateProcess/i,
    /WScript\.Shell/i,
    /Shell\.Application/i,
    /MSXML2\.XMLHTTP/i,
    /WinHttp\.WinHttpRequest/i,
    // PHP malicious
    /system\s*\(/i,
    /exec\s*\(/i,
    /shell_exec\s*\(/i,
    /passthru\s*\(/i,
    /eval\s*\(/i,
    /base64_decode\s*\(/i,
    /gzuncompress\s*\(/i,
    // Python malicious
    /__import__\s*\(/i,
    /exec\s*\(/i,
    /eval\s*\(/i,
    /compile\s*\(/i,
    /subprocess\./i,
    /os\.system/i,
    // Ruby malicious
    /Kernel\.system/i,
    /Kernel\.exec/i,
    /IO\.popen/i,
    // Perl malicious
    /system\s*\(/i,
    /exec\s*\(/i,
    // Java malicious
    /java\.lang\.Runtime\.getRuntime/i,
    /java\.lang\.ProcessBuilder/i,
    /javax\.script\.ScriptEngine/i,
];

// ─── STRUKTUR ZIP MENCURIGAKAN ──────────────────────────────────────────────
function checkSuspiciousZipStructure(entries) {
    const warnings = [];
    let totalSize = 0;
    let maxFileSize = 0;
    let suspiciousFileCount = 0;

    // Cek path traversal
    for (const entry of entries) {
        const name = entry.entryName.replace(/\\/g, '/');
        if (name.includes('../') || name.includes('..\\')) {
            warnings.push('⚠️ Path traversal terdeteksi (../) - Potensi Zip Slip attack');
            break;
        }
    }

    // Cek ukuran total dan file terbesar
    for (const entry of entries) {
        if (!entry.isDirectory) {
            totalSize += entry.header.size;
            if (entry.header.size > maxFileSize) maxFileSize = entry.header.size;
            if (entry.header.size > 100 * 1024 * 1024) { // >100MB
                suspiciousFileCount++;
            }
        }
    }

    // Cek rasio kompresi mencurigakan (bom zip)
    const fileCount = entries.filter(e => !e.isDirectory).length;
    if (fileCount > 10000) {
        warnings.push(`⚠️ Jumlah file sangat besar (${fileCount}) - Potensi ZIP Bomb`);
    }

    if (totalSize > 500 * 1024 * 1024 && fileCount > 5000) {
        warnings.push('⚠️ Ukuran total besar dengan banyak file - Potensi ZIP Bomb');
    }

    return warnings;
}

// ─── FUNGSI UTAMA SCAN VIRUS ─────────────────────────────────────────────────
async function scanZipForVirus(zipPath, zipBuffer = null) {
    const results = {
        isSafe: true,
        threats: [],
        warnings: [],
        summary: {
            totalFiles: 0,
            dangerousFiles: 0,
            suspiciousFiles: 0,
            hiddenFiles: 0,
            totalSize: 0,
        },
        details: {
            dangerousExtensions: [],
            suspiciousExtensions: [],
            hiddenFilesList: [],
            maliciousContent: [],
            pathTraversal: false,
            zipBomb: false,
        }
    };

    let zip;
    try {
        if (zipBuffer) {
            zip = new AdmZip(zipBuffer);
        } else if (zipPath) {
            const buffer = fs.readFileSync(zipPath);
            zip = new AdmZip(buffer);
        } else {
            throw new Error('Tidak ada file ZIP yang diberikan');
        }
    } catch (err) {
        results.isSafe = false;
        results.threats.push({
            level: 'error',
            message: `Gagal membaca file ZIP: ${err.message}`,
        });
        return results;
    }

    const entries = zip.getEntries();
    results.summary.totalFiles = entries.filter(e => !e.isDirectory).length;

    // ─── Scan struktur ZIP ──────────────────────────────────────────────────
    const structureWarnings = checkSuspiciousZipStructure(entries);
    if (structureWarnings.length > 0) {
        results.warnings.push(...structureWarnings);
        results.details.zipBomb = true;
    }

    // ─── Scan setiap file ──────────────────────────────────────────────────
    for (const entry of entries) {
        if (entry.isDirectory) continue;

        const fileName = entry.entryName.replace(/\\/g, '/');
        const baseName = path.basename(fileName);
        const ext = path.extname(baseName).toLowerCase();
        const fileSize = entry.header.size;
        results.summary.totalSize += fileSize;

        let isDangerous = false;
        let isSuspicious = false;
        let isHidden = false;

        // 1. Cek ekstensi berbahaya
        if (DANGEROUS_EXTENSIONS.has(ext)) {
            isDangerous = true;
            results.details.dangerousExtensions.push({
                file: fileName,
                ext: ext,
                size: fileSize,
            });
        }

        // 2. Cek pattern mencurigakan
        for (const pattern of SUSPICIOUS_PATTERNS) {
            if (pattern.test(fileName)) {
                isSuspicious = true;
                results.details.suspiciousExtensions.push({
                    file: fileName,
                    pattern: pattern.toString(),
                    size: fileSize,
                });
                break;
            }
        }

        // 3. Cek file tersembunyi
        for (const pattern of HIDDEN_FILE_PATTERNS) {
            if (pattern.test(baseName)) {
                isHidden = true;
                results.details.hiddenFilesList.push({
                    file: fileName,
                    pattern: pattern.toString(),
                });
                break;
            }
        }

        // 4. Cek konten berbahaya (untuk file teks kecil)
        if (fileSize < 1024 * 1024) { // Maks 1MB untuk scanning konten
            try {
                const content = entry.getData().toString('utf8');
                for (const pattern of MALICIOUS_CONTENT_PATTERNS) {
                    if (pattern.test(content)) {
                        results.details.maliciousContent.push({
                            file: fileName,
                            pattern: pattern.toString(),
                            snippet: content.slice(0, 100).replace(/\n/g, ' '),
                        });
                        isSuspicious = true;
                        break;
                    }
                }
            } catch (_) {
                // File binary, skip
            }
        }

        // 5. Cek file dengan ukuran mencurigakan (terlalu besar untuk jenisnya)
        const textExts = new Set(['.txt', '.js', '.json', '.xml', '.html', '.css', '.dart', '.java', '.py', '.rb', '.php']);
        if (textExts.has(ext) && fileSize > 10 * 1024 * 1024) {
            results.warnings.push(`⚠️ File teks berukuran besar (${(fileSize / 1024 / 1024).toFixed(2)}MB): ${fileName}`);
            isSuspicious = true;
        }

        // Update counters
        if (isDangerous) results.summary.dangerousFiles++;
        if (isSuspicious) results.summary.suspiciousFiles++;
        if (isHidden) results.summary.hiddenFiles++;
    }

    // ─── Tentukan hasil akhir ─────────────────────────────────────────────
    const hasDangerous = results.summary.dangerousFiles > 0;
    const hasSuspicious = results.summary.suspiciousFiles > 0;
    const hasMaliciousContent = results.details.maliciousContent.length > 0;
    const hasPathTraversal = results.details.pathTraversal;

    // Isi threats
    if (hasDangerous) {
        results.isSafe = false;
        results.threats.push({
            level: 'critical',
            message: `Ditemukan ${results.summary.dangerousFiles} file dengan ekstensi berbahaya (exe, scr, com, dll, dll)`,
            files: results.details.dangerousExtensions.map(f => f.file),
        });
    }

    if (hasMaliciousContent) {
        results.isSafe = false;
        results.threats.push({
            level: 'critical',
            message: `Ditemukan ${results.details.maliciousContent.length} file dengan konten mencurigakan`,
            files: results.details.maliciousContent.map(f => f.file),
        });
    }

    if (hasPathTraversal) {
        results.isSafe = false;
        results.threats.push({
            level: 'critical',
            message: 'Path traversal terdeteksi - Potensi Zip Slip attack',
        });
    }

    if (hasSuspicious && !hasDangerous && !hasMaliciousContent) {
        results.warnings.push(
            `⚠️ Ditemukan ${results.summary.suspiciousFiles} file mencurigakan (double extension, hidden files, dll)`
        );
        results.isSafe = false;
        results.threats.push({
            level: 'warning',
            message: `Ditemukan file mencurigakan yang perlu diwaspadai`,
            files: results.details.suspiciousExtensions.map(f => f.file),
        });
    }

    if (results.details.zipBomb) {
        results.warnings.push('⚠️ ZIP Bomb terdeteksi - Potensi DoS attack');
        results.isSafe = false;
        results.threats.push({
            level: 'warning',
            message: 'Struktur ZIP mencurigakan (ZIP Bomb)',
        });
    }

    // ─── Tambahan: Deteksi file bernama mencurigakan ──────────────────────
    const suspiciousNames = entries
        .filter(e => !e.isDirectory)
        .map(e => e.entryName.replace(/\\/g, '/'))
        .filter(name => {
            const lower = name.toLowerCase();
            return lower.includes('virus') ||
                   lower.includes('malware') ||
                   lower.includes('trojan') ||
                   lower.includes('ransom') ||
                   lower.includes('keylog') ||
                   lower.includes('spy') ||
                   lower.includes('hack') ||
                   lower.includes('exploit') ||
                   lower.includes('payload') ||
                   lower.includes('backdoor') ||
                   lower.includes('rootkit') ||
                   lower.includes('worm');
        });

    if (suspiciousNames.length > 0) {
        results.warnings.push(`⚠️ Ditemukan ${suspiciousNames.length} file dengan nama mencurigakan`);
        results.details.suspiciousExtensions.push(
            ...suspiciousNames.map(name => ({
                file: name,
                pattern: 'suspicious_name',
                size: 0,
            }))
        );
        results.summary.suspiciousFiles += suspiciousNames.length;
        results.isSafe = false;
        results.threats.push({
            level: 'warning',
            message: `Ditemukan file dengan nama mencurigakan`,
            files: suspiciousNames,
        });
    }

    return results;
}

// ─── FORMAT HASIL SCAN ──────────────────────────────────────────────────────
function formatScanResults(results) {
    const lines = [];
    const threatLevels = {
        critical: '🔴',
        warning: '🟡',
        info: '🔵',
        error: '❌',
    };

    lines.push('🛡️ **HASIL SCAN VIRUS**');
    lines.push('────────────────────────────────');

    // Status
    if (results.isSafe) {
        lines.push('✅ **STATUS :** AMAN');
        lines.push('');
        lines.push('Tidak ditemukan ancaman dalam file ZIP ini.');
        lines.push('');
    } else {
        lines.push('🚨 **STATUS :** BERBAHAYA!');
        lines.push('');
        lines.push(`📊 **Jumlah Ancaman:** ${results.threats.length}`);
        lines.push('');
    }

    // Threats
    if (results.threats.length > 0) {
        lines.push('━ **ANCAMAN TERDETEKSI** ━');
        for (const threat of results.threats) {
            const icon = threatLevels[threat.level] || '⚠️';
            lines.push(`${icon} ${threat.message}`);
            if (threat.files && threat.files.length > 0) {
                const fileList = threat.files.slice(0, 5).join('\n   • ');
                lines.push(`   • ${fileList}`);
                if (threat.files.length > 5) {
                    lines.push(`   ... dan ${threat.files.length - 5} file lainnya`);
                }
            }
            lines.push('');
        }
    }

    // Warnings
    if (results.warnings.length > 0) {
        lines.push('━ **PERINGATAN** ━');
        for (const warning of results.warnings) {
            lines.push(`⚠️ ${warning}`);
        }
        lines.push('');
    }

    // Summary
    lines.push('━ **RINGKASAN** ━');
    lines.push(`📄 Total File: ${results.summary.totalFiles}`);
    lines.push(`🔴 File Berbahaya: ${results.summary.dangerousFiles}`);
    lines.push(`🟡 File Mencurigakan: ${results.summary.suspiciousFiles}`);
    lines.push(`👻 File Tersembunyi: ${results.summary.hiddenFiles}`);
    lines.push(`💾 Total Ukuran: ${(results.summary.totalSize / 1024 / 1024).toFixed(2)} MB`);
    lines.push('');

    // Detail per kategori
    if (results.details.dangerousExtensions.length > 0) {
        lines.push('━ **FILE BERBAHAYA** ━');
        for (const f of results.details.dangerousExtensions.slice(0, 10)) {
            lines.push(`• \`${f.file}\` (${f.ext}) - ${(f.size / 1024).toFixed(1)} KB`);
        }
        if (results.details.dangerousExtensions.length > 10) {
            lines.push(`... dan ${results.details.dangerousExtensions.length - 10} file lainnya`);
        }
        lines.push('');
    }

    if (results.details.maliciousContent.length > 0) {
        lines.push('━ **KONTEN MENCURIGAKAN** ━');
        for (const f of results.details.maliciousContent.slice(0, 5)) {
            lines.push(`• \`${f.file}\``);
            lines.push(`  Pattern: \`${f.pattern}\``);
            if (f.snippet) {
                lines.push(`  Snippet: \`${f.snippet.slice(0, 80)}...\``);
            }
        }
        if (results.details.maliciousContent.length > 5) {
            lines.push(`... dan ${results.details.maliciousContent.length - 5} file lainnya`);
        }
        lines.push('');
    }

    if (results.details.hiddenFilesList.length > 0) {
        lines.push('━ **FILE TERSEMBUNYI** ━');
        for (const f of results.details.hiddenFilesList.slice(0, 10)) {
            lines.push(`• \`${f.file}\``);
        }
        if (results.details.hiddenFilesList.length > 10) {
            lines.push(`... dan ${results.details.hiddenFilesList.length - 10} file lainnya`);
        }
        lines.push('');
    }

    lines.push('────────────────────────────────');
    if (results.isSafe) {
        lines.push('✅ File aman untuk diproses.');
    } else {
        lines.push('🚨 **FILE TIDAK AMAN! JANGAN DIPROSES!**');
        lines.push('');
        lines.push('⚠️ File ini mengandung ancaman keamanan.');
        lines.push('📞 Hubungi admin untuk verifikasi lebih lanjut.');
    }

    return lines.join('\n');
}

// ─── SCAN ZIP DAN KIRIM HASIL ──────────────────────────────────────────────
async function scanAndReportZip(zipPath, chatId, userId, msgId = null) {
    const statusMsg = await send(
        chatId,
        `🛡️ **Memulai Scan Virus...**\n\n` +
        `⏳ __Menganalisis file ZIP untuk potensi ancaman...__`,
        null,
        msgId
    );

    try {
        const results = await scanZipForVirus(zipPath);
        const formattedResult = formatScanResults(results);

        // Kirim hasil scan
        await edit(
            chatId,
            statusMsg.id,
            formattedResult,
            results.isSafe ? 
                [
                    [{ text: "✅ Lanjutkan Proses", data: "scan_continue" }],
                    [{ text: "❌ Batalkan", data: "cancel" }],
                ] :
                [
                    [{ text: "❌ Batalkan", data: "cancel" }],
                ]
        );

        // Simpan hasil scan untuk referensi
        userStates.set(userId, {
            step: 'SCAN_RESULT',
            scanResult: results,
            zipPath: zipPath,
            timestamp: Date.now(),
        });

        return results;

    } catch (err) {
        await edit(
            chatId,
            statusMsg.id,
            `❌ **Gagal Scan Virus**\n\n` +
            `🛑 Error: \`${err.message}\``,
            [[{ text: "❌ Batalkan", data: "cancel" }]]
        );
        return null;
    }
}

// ─── REGISTER FUNCTIONS ──────────────────────────────────────────────────────
Object.assign(globalThis, {
    scanZipForVirus,
    formatScanResults,
    scanAndReportZip,
    DANGEROUS_EXTENSIONS,
    SUSPICIOUS_PATTERNS,
    MALICIOUS_CONTENT_PATTERNS,
});

module.exports = {
    scanZipForVirus,
    formatScanResults,
    scanAndReportZip,
    DANGEROUS_EXTENSIONS,
    SUSPICIOUS_PATTERNS,
    MALICIOUS_CONTENT_PATTERNS,
};