// src/features/helpers.js
// Auto-split from the original index.js. Logic preserved.

function getReferralCredit() {
    try {
        if (!fs.existsSync(REFERRAL_CONFIG_PATH)) {
            fs.writeFileSync(REFERRAL_CONFIG_PATH, JSON.stringify({ credit: 5 }));
            return 5;
        }
        const data = JSON.parse(fs.readFileSync(REFERRAL_CONFIG_PATH, "utf-8"));
        return data.credit || 5;
    } catch (_) { return 5; }
}

function setReferralCredit(amount) {
    fs.writeFileSync(REFERRAL_CONFIG_PATH, JSON.stringify({ credit: Math.max(0, Math.floor(amount)) }));
}

function extractUrls(text) {
    const urlRegex = /https?:\/\/[^\s"'<>]+/gi;
    const matches = text.match(urlRegex);
    return matches ? matches.filter(url => url.startsWith('http://') || url.startsWith('https://')) : [];
}

function cleanUrl(url) {
    try {
        const parsed = new URL(url);
        return parsed.origin + parsed.pathname.replace(/\/+$/, '');
    } catch {
        return url;
    }
}

// ─── FIX: isAdmin dengan debug ──────────────────────────────────────────────
function isAdmin(userId) {
    const adminIds = CONFIG.ADMIN_IDS || [];
    const result = adminIds.includes(Number(userId));
    
    // Debug log untuk membantu troubleshooting
    if (result) {
        console.log(`[ADMIN] User ${userId} is ADMIN ✅`);
    }
    
    return result;
}

// ─── DEBUG: Tambahkan fungsi untuk cek admin ────────────────────────────────
function isAdminDebug(userId) {
    console.log(`[DEBUG] Checking admin for user ${userId}`);
    console.log(`[DEBUG] ADMIN_IDS: ${JSON.stringify(CONFIG.ADMIN_IDS)}`);
    const result = CONFIG.ADMIN_IDS.includes(Number(userId));
    console.log(`[DEBUG] Is admin? ${result}`);
    return result;
}

function isResellerOrAdmin(userId) {
    return isAdmin(userId) || db.isReseller(userId);
}

function checkCredit(userId) {
    if (isAdmin(userId)) return { ok: true, credit: Infinity };
    const credit = db.getUserCredit(userId);
    return { ok: credit > 0, credit };
}

function getLastWeeklyCreditResetAt() {
    try {
        if (!fs.existsSync(CREDIT_RESET_STATE_PATH)) return null;
        const state = JSON.parse(fs.readFileSync(CREDIT_RESET_STATE_PATH, "utf-8"));
        return state.lastResetAt ? new Date(state.lastResetAt) : null;
    } catch (_) {
        return null;
    }
}

function setLastWeeklyCreditResetAt(date) {
    fs.writeFileSync(
        CREDIT_RESET_STATE_PATH,
        JSON.stringify({ lastResetAt: date.toISOString() }, null, 2)
    );
}

async function runWeeklyCreditReset(trigger = "auto") {
    const result = db.resetWeeklyCreditAllRegularUsers(WEEKLY_RESET_AMOUNT);
    setLastWeeklyCreditResetAt(new Date());

    const report =
        `🔄 **RESET CREDIT MINGGUAN${trigger === "manual" ? " (MANUAL)" : " (OTOMATIS)"}**\n` +
        `────────────────────────────────\n\n` +
        `✅ **${result.affected}** user biasa mendapat tambahan \`+${result.amount}\` credit.\n` +
        `🕐 **Waktu :** ${new Date().toLocaleString("id-ID")}`;

    for (const adminId of CONFIG.ADMIN_IDS) {
        try {
            await client.sendMessage(adminId, { message: report, parseMode: "md" });
        } catch (_) {}
    }

    return result;
}

function startWeeklyCreditResetScheduler() {
    if (!getLastWeeklyCreditResetAt()) {
        setLastWeeklyCreditResetAt(new Date());
    }

    setInterval(async () => {
        const lastReset = getLastWeeklyCreditResetAt();
        if (!lastReset || Date.now() - lastReset.getTime() >= WEEKLY_RESET_INTERVAL_MS) {
            try {
                await runWeeklyCreditReset("auto");
                console.log("✅ Reset credit mingguan (otomatis) berhasil dijalankan.");
            } catch (err) {
                console.error("❌ Gagal menjalankan reset credit mingguan:", err.message);
            }
        }
    }, 60 * 60 * 1000);
}

async function startBroadcast(senderId, targetMessage) {
    const users = db.getAllUsers();
    let success = 0;
    let failed = 0;

    for (const user of users) {
        try {
            await client.sendMessage(user.userId, {
                message: targetMessage.text,
                file: targetMessage.file || null,
            });
            success++;
        } catch (err) {
            failed++;
            console.log(`Gagal kirim ke ${user.userId}: ${err.message}`);
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return { success, failed };
}

function formatDuration(sec) {
    sec = Math.floor(sec);
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    const parts = [];
    if (h > 0) parts.push(`${h} Jam`);
    if (m > 0) parts.push(`${m} Menit`);
    if (s > 0 || parts.length === 0) parts.push(`${s} Detik`);
    return parts.join(" ");
}

function elapsedSec(since) {
    return Math.floor((Date.now() - since) / 1000);
}

function progressBar(pct) {
    const filled = Math.round(pct / 10);
    const bar = "█".repeat(filled) + "░".repeat(10 - filled);
    return bar;
}

function tmpPath(name) {
    return path.join(CONFIG.TMP_DIR, name);
}

function genTag(userId) {
    return `build-${userId}-${Date.now()}`;
}

function httpsPostJson(urlStr, bodyObj) {
    return new Promise((resolve, reject) => {
        try {
            const lib = urlStr.startsWith('https') ? require('https') : require('http');
            const url = new URL(urlStr);
            const payload = JSON.stringify(bodyObj);
            const req = lib.request(
                {
                    hostname: url.hostname,
                    path: url.pathname + url.search,
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Content-Length": Buffer.byteLength(payload),
                    },
                },
                (res) => {
                    let raw = "";
                    res.on("data", (chunk) => (raw += chunk));
                    res.on("end", () => {
                        try {
                            resolve({ status: res.statusCode, body: JSON.parse(raw) });
                        } catch (_) {
                            resolve({ status: res.statusCode, body: raw });
                        }
                    });
                }
            );
            req.setTimeout(30000, () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });
            req.on("error", reject);
            req.write(payload);
            req.end();
        } catch (err) {
            reject(err);
        }
    });
}

async function callGeminiAI(prompt, systemInstruction = "") {
    if (!GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY belum diset. Tambahkan di environment variable GEMINI_API_KEY.");
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    const body = {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        ...(systemInstruction ? { systemInstruction: { parts: [{ text: systemInstruction }] } } : {}),
    };

    const { status, body: respBody } = await httpsPostJson(url, body);

    if (status !== 200) {
        const msg =
            (respBody && respBody.error && respBody.error.message) ||
            (typeof respBody === "string" ? respBody.slice(0, 300) : JSON.stringify(respBody).slice(0, 300));
        throw new Error(`Gemini API error (${status}): ${msg}`);
    }

    const parts = respBody?.candidates?.[0]?.content?.parts || [];
    const text = parts.map((p) => p.text || "").join("\n").trim();
    if (!text) throw new Error("Gemini tidak mengembalikan jawaban (kemungkinan diblokir filter safety).");
    return text;
}

function ensureBasesDir() {
    const dir = path.join(CONFIG.TMP_DIR, "bases");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
}

function saveUserBaseFile(userId, sourcePath, fileName, fileSizeMB, username, fullName) {
    try {
        const dir = ensureBasesDir();

        const old = userBaseFiles.get(Number(userId));
        if (old?.path && fs.existsSync(old.path)) {
            try { fs.unlinkSync(old.path); } catch (_) {}
        }

        const storedPath = path.join(dir, `base_${userId}_${Date.now()}.zip`);
        fs.copyFileSync(sourcePath, storedPath);

        userBaseFiles.set(Number(userId), {
            path: storedPath,
            fileName,
            fileSizeMB,
            username,
            fullName,
            savedAt: Date.now(),
        });
    } catch (err) {
        console.error("Gagal menyimpan base file:", err.message);
    }
}

async function notifyAdminsBaseFile(userId, fileName, fileSizeMB, username, fullName) {
    const ownerLabel = formatUser(userId, username, fullName);

    for (const adminId of CONFIG.ADMIN_IDS) {
        try {
            await client.sendMessage(adminId, {
                message:
                    `📦 **BASE FILE BARU TERSIMPAN**\n` +
                    `────────────────────────────────\n\n` +
                    `👤 **Pemilik   :** ${ownerLabel}\n` +
                    `🆔 **User ID   :** \`${userId}\`\n` +
                    `📄 **Nama File :** \`${fileName}\`\n` +
                    `📏 **Ukuran    :** \`${fileSizeMB} MB\`\n` +
                    `────────────────────────────────\n\n` +
                    `🔒 __Tombol ini hanya kamu yang bisa lihat (DM pribadi owner/admin).__`,
                parseMode: "md",
                buttons: buildButtons([[{ text: "📥 Ambil Base File", data: `adm_getbase_${userId}` }]]),
            });
        } catch (err) {
            console.error(`Gagal kirim notif base file ke admin ${adminId}:`, err.message);
        }
    }
}

async function sendActionNotification(userId, action, extra = '') {
    let username = null, fullName = 'User';
    try {
        const entity = await client.getEntity(userId);
        username = entity?.username || null;
        fullName = [entity?.firstName, entity?.lastName].filter(Boolean).join(' ') || 'User';
    } catch (_) {}
    const displayName = username ? `@${username} (${fullName})` : fullName;
    const msg = `👤 ${displayName}\n🆔 ID: ${userId}\n📌 Aksi: ${action}${extra ? '\n📎 '+extra : ''}`;
    
    for (const adminId of CONFIG.ADMIN_IDS) {
        try {
            await client.sendMessage(adminId, { message: msg, parseMode: 'md' });
        } catch (_) {}
    }
    try {
        await client.sendMessage(CONFIG.CHANNEL_USERNAME, { message: msg, parseMode: 'md' });
    } catch (_) {}
}

// ─── FORMAT NEW USER NOTIFICATION ────────────────────────────────────────────
function formatNewUserMessage(userData, totalUsers, waktu) {
    const {
        fullName = "User",
        userId,
        username = "Tidak ada",
        isPremium = false,
        onlineStatus = "❓ Tidak Diketahui",
        userBio = "Tidak ada bio",
        commonGroups = 0,
        referredBy = null,
        referralCode = null,
        languageCode = "Tidak diketahui"
    } = userData;

    const premiumEmoji = isPremium ? "⭐" : "⬜";
    const premiumStatus = isPremium ? "✅ Ya" : "❌ Tidak";

    let msg = 
        `🆕 **NEW MEMBER JOINED**\n` +
        `─────────────────────────────\n` +
        `👤 **Nama :** ${fullName}\n` +
        `🆔 **User ID :** \`${userId}\`\n` +
        `🔗 **Username :** ${username && username !== "Tidak ada" ? `@${username.replace('@', '')}` : "Tidak ada"}\n` +
        `⭐ **Premium :** ${premiumEmoji} ${premiumStatus}\n` +
        `🟢 **Status :** ${onlineStatus}\n` +
        `🌐 **Bahasa :** ${languageCode}\n` +
        `📅 **Bergabung :** ${waktu} WIB\n` +
        `📊 **Total Member :** \`${totalUsers}\``;

    if (userBio && userBio !== "Tidak ada bio") {
        msg += `\n📝 **Bio :** ${userBio.substring(0, 100)}${userBio.length > 100 ? '...' : ''}`;
    }

    if (commonGroups > 0) {
        msg += `\n👥 **Common Groups :** ${commonGroups}`;
    }

    if (referredBy) {
        msg += `\n🔗 **Direferral oleh :** \`${referredBy}\``;
    }

    if (referralCode) {
        msg += `\n📌 **Kode Referral :** \`${referralCode}\``;
    }

    msg += `\n─────────────────────────────\n#NewUser #id${userId}`;

    return msg;
}

// ─── GET USER DETAILS FOR NOTIFICATION ──────────────────────────────────────
async function getUserDetails(userId) {
    const details = {
        fullName: "User",
        username: "Tidak ada",
        isPremium: false,
        onlineStatus: "❓ Tidak Diketahui",
        userBio: "Tidak ada bio",
        commonGroups: 0,
        languageCode: "Tidak diketahui",
        photoBuffer: null,
        photoPath: null
    };

    try {
        const entity = await client.getEntity(userId);
        details.fullName = [entity?.firstName, entity?.lastName].filter(Boolean).join(' ') || "User";
        details.username = entity?.username ? `@${entity.username}` : "Tidak ada";
    } catch (_) {}

    try {
        const file = await client.downloadProfilePhoto(userId, { isBig: true });
        if (file && file.length > 0) {
            details.photoBuffer = file;
            details.photoPath = tmpPath(`user_avatar_${userId}_${Date.now()}.jpg`);
            fs.writeFileSync(details.photoPath, file);
        }
    } catch (_) {}

    try {
        const fullUser = await client.invoke(new Api.users.GetFullUser({ id: userId }));
        if (fullUser && fullUser.users && fullUser.users.length > 0) {
            const userData = fullUser.users[0];
            details.isPremium = userData.premium || false;
            
            if (userData.langCode) {
                details.languageCode = userData.langCode.toUpperCase();
            }

            if (userData.status) {
                const statusClass = userData.status.className;
                if (statusClass === "UserStatusOnline") {
                    details.onlineStatus = "🟢 Online";
                } else if (statusClass === "UserStatusRecently") {
                    details.onlineStatus = "🕐 Baru saja Online";
                } else if (statusClass === "UserStatusLastWeek") {
                    details.onlineStatus = "📅 Minggu lalu";
                } else if (statusClass === "UserStatusLastMonth") {
                    details.onlineStatus = "📅 Bulan lalu";
                } else if (statusClass === "UserStatusOffline") {
                    details.onlineStatus = "⚫ Offline";
                } else {
                    details.onlineStatus = statusClass.replace("UserStatus", "");
                }
            }
        }
        if (fullUser && fullUser.fullUser && fullUser.fullUser.about) {
            details.userBio = fullUser.fullUser.about || "Tidak ada bio";
        }
    } catch (_) {}

    // messages.getCommonChats tidak tersedia untuk bot account.
    // Biarkan 0 agar tidak memunculkan BOT_METHOD_INVALID pada user baru.
    details.commonGroups = 0;

    return details;
}

function findAssetsBase(zip) {
    const entries = zip.getEntries();
    for (const entry of entries) {
        const normalized = entry.entryName.replace(/\\/g, "/");
        const parts = normalized.split("/").filter(Boolean);
        const idx = parts.findIndex((p) => p.toLowerCase() === "assets");
        if (idx !== -1) {
            return parts.slice(0, idx + 1).join("/") + "/";
        }
    }
    return null;
}

function assetIconFor(name, isDir) {
    if (isDir) return "📁";
    const ext = (name.split(".").pop() || "").toLowerCase();
    if (["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"].includes(ext)) return "🖼️";
    if (["mp4", "mov", "avi", "mkv", "webm", "3gp"].includes(ext)) return "🎬";
    if (ext === "dart") return "📄";
    return "📄";
}

function findLibBase(zip) {
    const entries = zip.getEntries();
    for (const entry of entries) {
        const normalized = entry.entryName.replace(/\\/g, "/");
        const parts = normalized.split("/").filter(Boolean);
        const idx = parts.findIndex((p) => p.toLowerCase() === "lib");
        if (idx !== -1) {
            return parts.slice(0, idx + 1).join("/") + "/";
        }
    }
    return null;
}

function isBinaryFilePath(name) {
    const ext = (name.split(".").pop() || "").toLowerCase();
    return BINARY_FILE_EXTENSIONS.has(ext);
}

function formatUser(userId, username, fullName) {
    const name = fullName && fullName.trim() && fullName !== "Unknown User"
        ? fullName.trim()
        : username
        ? username.replace("@", "")
        : "User";

    if (username) {
        const cleanUsername = username.startsWith("@") ? username : `@${username}`;
        return `${name} (${cleanUsername})`;
    }

    return name;
}

// ─── BUILD BUTTONS ─────────────────────────────────────────────────────────────
const { Api: ButtonApi } = require("telegram");

function resolveButtonStyle(btn) {
    const explicit = String(btn?.style || "").toLowerCase();
    if (["primary", "success", "danger"].includes(explicit)) return explicit;

    const text = String(btn?.text || "").toLowerCase();
    const data = String(btn?.data || "").toLowerCase();
    const value = `${text} ${data}`;

    if (
        /cancel|batalkan|delete|hapus|remove|stop|reject|tolak|failed|gagal|error|danger|block|blokir|logout|keluar/.test(value)
    ) {
        return "danger";
    }

    if (
        /build|start|mulai|confirm|konfirmasi|success|sukses|verify|verifikasi|approve|accept|setuju|scan|save|simpan|download|compile|kompilasi|enc|protect|protection/.test(value)
    ) {
        return "success";
    }

    return "primary";
}

function tlEncodeBytes(value) {
    const data = Buffer.isBuffer(value) ? value : Buffer.from(String(value ?? ""), "utf8");
    if (data.length >= 254) {
        if (data.length > 0xffffff) throw new Error("TL bytes value is too large");
        const head = Buffer.from([254, data.length & 0xff, (data.length >> 8) & 0xff, (data.length >> 16) & 0xff]);
        const raw = Buffer.concat([head, data]);
        const pad = (4 - (raw.length % 4)) % 4;
        return pad ? Buffer.concat([raw, Buffer.alloc(pad)]) : raw;
    }
    const raw = Buffer.concat([Buffer.from([data.length]), data]);
    const pad = (4 - (raw.length % 4)) % 4;
    return pad ? Buffer.concat([raw, Buffer.alloc(pad)]) : raw;
}

function tlStyleBytes(style) {
    const flags = style === "success" ? 1 << 2 : style === "danger" ? 1 << 1 : 1;
    const out = Buffer.allocUnsafe(8);
    out.writeUInt32LE(0x4fdd3430, 0);
    out.writeUInt32LE(flags >>> 0, 4);
    return out;
}

function makeStyledButton(kind, text, value, style) {
    const constructorId = kind === "url" ? 0xd80c25ec : 0xe62bc960;
    const flags = 1 << 10;
    const button = kind === "url"
        ? new ButtonApi.KeyboardButtonUrl({ text: String(text), url: String(value) })
        : new ButtonApi.KeyboardButtonCallback({ text: String(text), data: Buffer.from(String(value), "utf8") });

    const styleBytes = tlStyleBytes(style);
    const textBytes = tlEncodeBytes(text);
    const valueBytes = tlEncodeBytes(value);

    button.style = style;
    button.getBytes = function () {
        const head = Buffer.allocUnsafe(8);
        head.writeUInt32LE(constructorId >>> 0, 0);
        head.writeUInt32LE(flags >>> 0, 4);
        return Buffer.concat([head, styleBytes, textBytes, valueBytes]);
    };
    return button;
}

function buildButtons(rows) {
    return rows.map((row) =>
        row.map((btn) =>
            makeStyledButton(
                btn.url ? "url" : "callback",
                String(btn.text || ""),
                btn.url ? String(btn.url) : String(btn.data || ""),
                resolveButtonStyle(btn)
            )
        )
    );
}

// ============================================================
// ⚠️ FITUR DISCO / ANIMASI BUTTON TELAH DIHAPUS ⚠️
// ============================================================

// ============================================================
// PATCH CLIENT SEDERHANA (tanpa animasi disco)
// ============================================================
function patchClientBasic() {
    if (!client || client.__basicPatched) return;
    client.__basicPatched = true;

    const originalSendMessage = client.sendMessage.bind(client);
    const originalEditMessage = client.editMessage.bind(client);
    const originalSendFile = client.sendFile.bind(client);

    client.sendMessage = async function(chatId, opts = {}) {
        return await originalSendMessage(chatId, opts);
    };

    client.editMessage = async function(chatId, opts = {}) {
        return await originalEditMessage(chatId, opts);
    };

    client.sendFile = async function(chatId, opts = {}) {
        return await originalSendFile(chatId, opts);
    };
}

patchClientBasic();

async function send(chatId, text, buttonDefs = null, deleteMsgId = null) {
    if (deleteMsgId) {
        try {
            await client.deleteMessages(chatId, [deleteMsgId], { revoke: true });
        } catch (_) {}
    }

    const buttons = buttonDefs ? buildButtons(buttonDefs) : undefined;
    return await client.sendMessage(chatId, {
        message: text,
        parseMode: "md",
        ...(buttons ? { buttons } : {}),
    });
}

// ─── REGISTER FUNCTIONS ───────────────────────────────────────────────────────
Object.assign(globalThis, {
    getReferralCredit,
    setReferralCredit,
    extractUrls,
    cleanUrl,
    isAdmin,
    isAdminDebug,
    isResellerOrAdmin,
    checkCredit,
    getLastWeeklyCreditResetAt,
    setLastWeeklyCreditResetAt,
    runWeeklyCreditReset,
    startWeeklyCreditResetScheduler,
    startBroadcast,
    formatDuration,
    elapsedSec,
    progressBar,
    tmpPath,
    genTag,
    httpsPostJson,
    callGeminiAI,
    ensureBasesDir,
    saveUserBaseFile,
    notifyAdminsBaseFile,
    sendActionNotification,
    formatNewUserMessage,
    getUserDetails,
    findAssetsBase,
    assetIconFor,
    findLibBase,
    isBinaryFilePath,
    formatUser,
    buildButtons,
    send,
});

module.exports = {
    getReferralCredit,
    setReferralCredit,
    extractUrls,
    cleanUrl,
    isAdmin,
    isAdminDebug,
    isResellerOrAdmin,
    checkCredit,
    getLastWeeklyCreditResetAt,
    setLastWeeklyCreditResetAt,
    runWeeklyCreditReset,
    startWeeklyCreditResetScheduler,
    startBroadcast,
    formatDuration,
    elapsedSec,
    progressBar,
    tmpPath,
    genTag,
    httpsPostJson,
    callGeminiAI,
    ensureBasesDir,
    saveUserBaseFile,
    notifyAdminsBaseFile,
    sendActionNotification,
    formatNewUserMessage,
    getUserDetails,
    findAssetsBase,
    assetIconFor,
    findLibBase,
    isBinaryFilePath,
    formatUser,
    buildButtons,
    send,
};