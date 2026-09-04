// src/features/runtime.js
const { TelegramClient, Api } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { NewMessage } = require("telegram/events");
const { CallbackQuery } = require("telegram/events/CallbackQuery");
const { Button } = require("telegram/tl/custom/button");

const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");
const os = require("os");
const { execSync } = require("child_process");
const net = require("net");
const readline = require("readline");

const github = require("../../github");
const CONFIG = require("../../config");

const {
    getUserJob,
    setUserJob,
    removeUserJob,
    isUserBuilding,
    getActiveJobs,
    getQueueStats,
} = require("../../queue");

const {
    githubRequest,
    uploadZipToRelease,
    deleteRelease,
    triggerWorkflow,
    getRunStatus,
    getArtifacts,
    downloadArtifactZip,
    getFailedStepLog,
    sleep,
    createReleaseOnly,
    uploadAssetFile,
    triggerWeb2ApkWorkflow,
    publishRelease,
    getGitHubToken,
    getRepoPublicKey,
    createOrUpdateRepoSecret,
    createOrUpdateWorkflowFile,
    runAutoSetupGitHub,
} = require("../../github");

const SESSION_FILE = "./session.txt";

const sessionString = fs.existsSync(SESSION_FILE)
    ? fs.readFileSync(SESSION_FILE, "utf8").trim()
    : "";

const API_ID = parseInt(process.env.API_ID || "30562861");
const API_HASH = process.env.API_HASH || "99e6496275e9ccde000c7b7e3d755374";

const client = new TelegramClient(new StringSession(sessionString), API_ID, API_HASH, {
    connectionRetries: 5,
});

const userStates = new Map();
const REFERRAL_CONFIG_PATH = "./referral_config.json";
const domainDetectionStates = new Map();
const DB_PATH = "./users.json";
const STATS_PATH = "./stats.json";
const CREDIT_RESET_STATE_PATH = "./credit_reset_state.json";
const REDEEM_CODES_PATH = "./redeem_codes.json";
const REDEEM_CREDIT_AMOUNT = Number(CONFIG.FREE_CREDIT || 5);

if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify([]));
}
if (!fs.existsSync(REDEEM_CODES_PATH)) {
    fs.writeFileSync(REDEEM_CODES_PATH, JSON.stringify([], null, 2));
}

const WEEKLY_RESET_AMOUNT = Number(CONFIG.FREE_CREDIT || 5);
const WEEKLY_RESET_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

const db = {
    // USER MANAGEMENT
    upsertUser: (userData) => {
        const data = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
        const index = data.findIndex((u) => u.userId === userData.userId);
        if (index !== -1) {
            data[index] = { 
                ...data[index], 
                ...userData, 
                fullName: userData.fullName || data[index].fullName || userData.name || "User",
                lastActive: new Date() 
            };
        } else {
            const newUser = {
                ...userData,
                fullName: userData.fullName || userData.name || "User",
                credit: userData.credit ?? Number(CONFIG.FREE_CREDIT || 5),
                freeCredit: userData.freeCredit ?? (userData.credit ?? Number(CONFIG.FREE_CREDIT || 5)),
                redeemCredit: userData.redeemCredit ?? 0,
                bonusCredit: userData.bonusCredit ?? 0,
                joinedAt: new Date(),
                referralCode: db.generateReferralCode(userData.userId),
                referredBy: userData.referredBy || null,
                isVerified: false,
                referralCount: 0,
                isPremium: false,
                lastSeen: new Date(),
                languageCode: null,
                bio: null,
                lastReferralClaim: null,
                lastReferralCheck: null,
            };
            data.push(newUser);
        }
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
        return index === -1;
    },

    getAllUsers: () => {
        return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
    },

    getUser: (userId) => {
        const data = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
        return data.find((u) => u.userId === Number(userId)) || null;
    },

    updateUserField: (userId, field, value) => {
        const data = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
        const index = data.findIndex((u) => u.userId === Number(userId));
        if (index !== -1) {
            data[index][field] = value;
            data[index].lastActive = new Date();
            fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
            return true;
        }
        return false;
    },

    // REPORT BLOCK SYSTEM
    blockedReportUsers: new Set(),
    isReportBlocked(userId) {
        return this.blockedReportUsers.has(userId);
    },
    blockReportUser(userId) {
        this.blockedReportUsers.add(userId);
    },
    unblockReportUser(userId) {
        this.blockedReportUsers.delete(userId);
    },

    // GLOBAL STATS MANAGEMENT
    getStats() {
        if (!fs.existsSync(STATS_PATH)) {
            const initialStats = { success: 0, failed: 0 };
            fs.writeFileSync(STATS_PATH, JSON.stringify(initialStats, null, 2));
            return initialStats;
        }
        return JSON.parse(fs.readFileSync(STATS_PATH, "utf-8"));
    },

    incrementStat(type) {
        const stats = this.getStats();
        if (type === "success") stats.success += 1;
        if (type === "failed") stats.failed += 1;
        fs.writeFileSync(STATS_PATH, JSON.stringify(stats, null, 2));
        return stats;
    },

    // LIMIT / CREDIT SYSTEM
    getUserCredit(userId) {
        const data = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
        const user = data.find((u) => u.userId === Number(userId));
        return user?.credit ?? 0;
    },

    setUserCredit(userId, amount) {
        const data = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
        const index = data.findIndex((u) => u.userId === Number(userId));
        const safeAmount = Math.max(0, Math.floor(amount));

        if (index !== -1) {
            data[index].credit = safeAmount;
            data[index].freeCredit = safeAmount;
            data[index].redeemCredit = 0;
            data[index].bonusCredit = 0;
            data[index].lastActive = new Date();
        } else {
            data.push({ userId: Number(userId), credit: safeAmount, freeCredit: safeAmount, redeemCredit: 0, bonusCredit: 0, joinedAt: new Date() });
        }

        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
        return safeAmount;
    },

    addUserCredit(userId, amount) {
        const data = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
        const index = data.findIndex((u) => u.userId === Number(userId));
        const safeAmount = Math.floor(Number(amount) || 0);

        let newAmount;
        if (index !== -1) {
            const u = data[index];
            if (!Number.isFinite(Number(u.freeCredit)) || !Number.isFinite(Number(u.redeemCredit)) || !Number.isFinite(Number(u.bonusCredit))) {
                u.freeCredit = Math.max(0, Math.floor(Number(u.credit) || 0));
                u.redeemCredit = 0;
                u.bonusCredit = 0;
            }
            u.bonusCredit = Math.max(0, Math.floor((u.bonusCredit || 0) + safeAmount));
            u.credit = Math.max(0, Math.floor((u.freeCredit || 0) + (u.redeemCredit || 0) + (u.bonusCredit || 0)));
            newAmount = u.credit;
            u.lastActive = new Date();
        } else {
            newAmount = Math.max(0, safeAmount);
            data.push({ userId: Number(userId), credit: newAmount, freeCredit: 0, redeemCredit: 0, bonusCredit: newAmount, joinedAt: new Date() });
        }

        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
        return newAmount;
    },

    addRedeemCredit(userId, amount) {
        const data = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
        const index = data.findIndex((u) => u.userId === Number(userId));
        const safeAmount = Math.max(0, Math.floor(Number(amount) || 0));

        let newAmount;
        if (index !== -1) {
            const u = data[index];
            if (!Number.isFinite(Number(u.freeCredit)) || !Number.isFinite(Number(u.redeemCredit)) || !Number.isFinite(Number(u.bonusCredit))) {
                u.freeCredit = Math.max(0, Math.floor(Number(u.credit) || 0));
                u.redeemCredit = 0;
                u.bonusCredit = 0;
            }
            u.redeemCredit = Math.max(0, Math.floor((u.redeemCredit || 0) + safeAmount));
            u.credit = Math.max(0, Math.floor((u.freeCredit || 0) + (u.redeemCredit || 0) + (u.bonusCredit || 0)));
            newAmount = u.credit;
            u.lastActive = new Date();
        } else {
            newAmount = safeAmount;
            data.push({ userId: Number(userId), credit: newAmount, freeCredit: 0, redeemCredit: safeAmount, bonusCredit: 0, joinedAt: new Date() });
        }

        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
        return newAmount;
    },

    // REDEEM CODE SYSTEM
    // Format: /credeem {max claim}:{credit per claim}:{kode}
    // Kode sengaja tidak dinormalisasi selain trim: huruf besar/kecil dan
    // karakter khusus tetap dipertahankan persis seperti yang dibuat owner.
    createRedeemCode(code, maxClaims = 1, amount = REDEEM_CREDIT_AMOUNT) {
        const normalized = String(code ?? '').trim();
        const safeMaxClaims = Math.floor(Number(maxClaims));
        const safeAmount = Math.floor(Number(amount));

        if (!normalized || safeMaxClaims < 1 || safeAmount < 1 || safeAmount > 1000) {
            return { ok: false, reason: 'invalid' };
        }

        const data = JSON.parse(fs.readFileSync(REDEEM_CODES_PATH, 'utf-8'));
        if (data.some(r => r.code === normalized)) {
            return { ok: false, reason: 'exists' };
        }

        data.push({
            code: normalized,
            maxClaims: safeMaxClaims,
            claimCount: 0,
            amount: safeAmount,
            usedBy: [],
            createdAt: new Date().toISOString(),
        });
        fs.writeFileSync(REDEEM_CODES_PATH, JSON.stringify(data, null, 2));
        return { ok: true, code: normalized, maxClaims: safeMaxClaims, amount: safeAmount, claimCount: 0 };
    },

    redeemCode(userId, code) {
        const normalized = String(code ?? '').trim();
        const data = JSON.parse(fs.readFileSync(REDEEM_CODES_PATH, 'utf-8'));
        const index = data.findIndex(r => r.code === normalized);

        if (index === -1) return { ok: false, reason: 'invalid' };

        const redeem = data[index];
        // Backward compatibility for old single-use records.
        if (!Array.isArray(redeem.usedBy)) redeem.usedBy = redeem.usedBy ? [Number(redeem.usedBy)] : [];
        if (!Number.isFinite(Number(redeem.maxClaims)) || Number(redeem.maxClaims) < 1) redeem.maxClaims = 1;
        if (!Number.isFinite(Number(redeem.claimCount))) redeem.claimCount = redeem.usedBy.length;

        const numericUserId = Number(userId);
        if (redeem.usedBy.includes(numericUserId)) return { ok: false, reason: 'already_claimed' };
        if (redeem.claimCount >= redeem.maxClaims) return { ok: false, reason: 'limit' };

        const amount = Math.max(0, Math.floor(Number(redeem.amount) || 0));
        if (amount < 1 || amount > 1000) return { ok: false, reason: 'invalid' };

        const newCredit = this.addRedeemCredit(userId, amount);

        redeem.claimCount += 1;
        redeem.usedBy.push(numericUserId);
        redeem.lastClaimAt = new Date().toISOString();
        fs.writeFileSync(REDEEM_CODES_PATH, JSON.stringify(data, null, 2));

        return {
            ok: true,
            amount,
            newCredit,
            code: redeem.code,
            maxClaims: redeem.maxClaims,
            claimCount: redeem.claimCount,
            remainingClaims: Math.max(0, redeem.maxClaims - redeem.claimCount),
        };
    },

    // RESELLER SYSTEM
    isReseller(userId) {
        const data = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
        const user = data.find((u) => u.userId === Number(userId));
        return user?.isReseller === true;
    },

    setReseller(userId, value = true) {
        const data = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
        const index = data.findIndex((u) => u.userId === Number(userId));
        if (index !== -1) {
            data[index].isReseller = value;
            data[index].lastActive = new Date();
        } else {
            data.push({ userId: Number(userId), isReseller: value, credit: 0, joinedAt: new Date() });
        }
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    },

    getAllResellers() {
        const data = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
        return data.filter((u) => u.isReseller === true);
    },

    // CREDIT DEDUCTION
    deductCredit(userId) {
        const data = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
        const index = data.findIndex((u) => u.userId === Number(userId));
        if (index !== -1) {
            const u = data[index];
            if (!Number.isFinite(Number(u.freeCredit)) || !Number.isFinite(Number(u.redeemCredit)) || !Number.isFinite(Number(u.bonusCredit))) {
                u.freeCredit = Math.max(0, Math.floor(Number(u.credit) || 0));
                u.redeemCredit = 0;
                u.bonusCredit = 0;
            }
            const total = Math.max(0, Math.floor((u.freeCredit || 0) + (u.redeemCredit || 0) + (u.bonusCredit || 0)));
            if (total > 0) {
                // Free credit is consumed first. Redeemed credit is consumed only
                // after the free/bonus buckets are exhausted, and never reset.
                if ((u.freeCredit || 0) > 0) u.freeCredit -= 1;
                else if ((u.bonusCredit || 0) > 0) u.bonusCredit -= 1;
                else u.redeemCredit = Math.max(0, (u.redeemCredit || 0) - 1);

                u.credit = Math.max(0, Math.floor((u.freeCredit || 0) + (u.redeemCredit || 0) + (u.bonusCredit || 0)));
                u.lastActive = new Date();
                fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
                return u.credit;
            }
        }
        return null;
    },

    // WEEKLY CREDIT RESET
    resetWeeklyCreditAllRegularUsers(amount = WEEKLY_RESET_AMOUNT) {
        const data = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
        let affected = 0;
        const safeAmount = Math.max(0, Math.floor(Number(amount) || 0));

        for (const u of data) {
            const isRegularUser = !isAdmin(u.userId) && u.isReseller !== true;
            if (isRegularUser) {
                if (!Number.isFinite(Number(u.freeCredit)) || !Number.isFinite(Number(u.redeemCredit)) || !Number.isFinite(Number(u.bonusCredit))) {
                    u.freeCredit = Math.max(0, Math.floor(Number(u.credit) || 0));
                    u.redeemCredit = 0;
                    u.bonusCredit = 0;
                }
                // Only the free-credit bucket is refreshed. Redeemed credit
                // remains untouched and therefore survives the weekly reset.
                u.freeCredit = Math.max(0, Math.floor((u.freeCredit || 0) + safeAmount));
                u.credit = Math.max(0, Math.floor((u.freeCredit || 0) + (u.redeemCredit || 0) + (u.bonusCredit || 0)));
                u.lastActive = new Date();
                affected++;
            }
        }

        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
        return { affected, amount: safeAmount };
    },

    // REFERRAL SYSTEM
    generateReferralCode(userId) {
        const str = `${userId}-${Date.now()}`;
        return Buffer.from(str).toString('base64').replace(/[+/=]/g, '').slice(0, 12);
    },

    getUserReferralCode(userId) {
        const data = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
        const user = data.find(u => u.userId === Number(userId));
        return user?.referralCode || null;
    },

    getUserByReferralCode(code) {
        const data = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
        return data.find(u => u.referralCode === code) || null;
    },

    setUserVerified(userId) {
        const data = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
        const user = data.find(u => u.userId === Number(userId));
        if (user) {
            user.isVerified = true;
            fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
            return true;
        }
        return false;
    },

    getReferredBy(userId) {
        const data = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
        const user = data.find(u => u.userId === Number(userId));
        return user?.referredBy || null;
    },

    incrementReferralCount(userId) {
        const data = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
        const user = data.find(u => u.userId === Number(userId));
        if (user) {
            user.referralCount = (user.referralCount || 0) + 1;
            user.lastReferralCheck = new Date().toISOString();
            fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
            return user.referralCount;
        }
        return null;
    },

    // REFERRAL WEEKLY BONUS
    canClaimWeeklyBonus(userId) {
        const user = this.getUser(userId);
        if (!user) return false;
        
        const referralCount = user.referralCount || 0;
        if (referralCount < 5) return false;
        
        const lastClaim = user.lastReferralClaim;
        if (lastClaim) {
            const diff = Date.now() - new Date(lastClaim).getTime();
            if (diff < 7 * 24 * 60 * 60 * 1000) return false;
        }
        
        return true;
    },

    claimWeeklyBonus(userId) {
        const user = this.getUser(userId);
        if (!user) return null;
        
        const bonus = 20;
        const newCredit = this.addUserCredit(userId, bonus);
        this.updateUserField(userId, 'lastReferralClaim', new Date().toISOString());
        
        return { bonus, newCredit };
    }
};

// GLOBAL VARIABLES
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || CONFIG.GEMINI_API_KEY || "";
const GEMINI_MODEL = "gemini-2.0-flash";

const userBaseFiles = new Map();

const BINARY_FILE_EXTENSIONS = new Set([
    "png", "jpg", "jpeg", "gif", "webp", "bmp", "ico", "mp4", "mov", "avi", "mkv",
    "webm", "3gp", "mp3", "wav", "ogg", "ttf", "otf", "woff", "woff2", "zip", "jar",
    "apk", "aar", "so", "dex", "keystore", "jks", "class", "exe", "dll", "bin",
    "db", "sqlite", "pdf", "psd", "ai", "eot",
]);

const queueMessages = new Map();

const AI_TOOLS_INFO = [
    { key: "theme", title: "🎨 Theme Changer", desc: "Ganti warna utama aplikasi secara otomatis." },
    { key: "font", title: "🔤 Font Changer", desc: "Ganti semua font aplikasi dengan satu klik." },
    { key: "icon", title: "🖼 Icon Pack Installer", desc: "Terapkan satu set icon ke seluruh project." },
    { key: "dark", title: "🌙 Dark Mode Generator", desc: "Menambahkan tema gelap otomatis." },
    { key: "rombak", title: "🤖 AI Rombak Project", desc: "Contoh: Buat tema dark, tambah login Google, tambah bottom navigation — AI menyusun rencana perubahan filenya." },
    { key: "editor", title: "📝 Live Code Editor", desc: "Edit file .js, .dart, .xml, .json, .java langsung dari bot." },
    { key: "autofix", title: "🔧 Auto Fix Error", desc: "Tempel log error build, AI menganalisis & memberi saran perbaikan." },
    { key: "multi", title: "🧩 Multi Tools Injection", desc: "Pilih beberapa tools sekaligus, bot otomatis inject ke project." },
];

const ICON_PACKS = {
    material: { label: "Material Icons (bawaan)", dep: null },
    cupertino: { label: "Cupertino Icons (bawaan)", dep: null },
    fontawesome: { label: "Font Awesome", dep: "font_awesome_flutter: ^10.7.0" },
    feather: { label: "Feather Icons", dep: "flutter_feather_icons: ^2.0.0+1" },
};

const LIVE_EDIT_EXTENSIONS = new Set(["js", "dart", "xml", "json", "java"]);

const MULTI_INJECT_TOOLS = {
    dark: {
        label: "🌙 Dark Mode Generator",
        run: async (job) => {
            const mainDartPath = path.join(job.extractedFolderPath, "lib", "main.dart");
            if (!fs.existsSync(mainDartPath)) return "⚠️ main.dart tidak ditemukan";
            const content = fs.readFileSync(mainDartPath, "utf-8");
            if (/darkTheme\s*:/.test(content)) return "ℹ️ sudah ada darkTheme";
            const themeIdx = content.indexOf("theme:");
            if (themeIdx === -1) return "⚠️ properti theme: tidak ditemukan";
            const parenIdx = content.indexOf("(", themeIdx);
            const closeIdx = findClosingParenIndex(content, parenIdx);
            if (closeIdx === -1) return "⚠️ gagal parsing theme";
            const insertText = ",\n      darkTheme: ThemeData.dark(useMaterial3: true),\n      themeMode: ThemeMode.system";
            const newContent = content.slice(0, closeIdx + 1) + insertText + content.slice(closeIdx + 1);
            fs.writeFileSync(mainDartPath, newContent, "utf-8");
            return "✅ darkTheme & themeMode ditambahkan";
        },
    },
    theme: {
        label: "🎨 Theme Changer (default #6750A4)",
        run: async (job) => {
            const libPath = path.join(job.extractedFolderPath, "lib");
            const changed = applyThemeColor(libPath, "6750A4");
            return "✅ " + changed + " file diubah ke warna #6750A4";
        },
    },
    font: {
        label: "🔤 Font Changer (default Poppins)",
        run: async (job) => {
            const result = applyFontChange(job.extractedFolderPath, "Poppins");
            return "✅ pubspec " + (result.pubspecUpdated ? "diupdate" : "sudah ada") + ", " + result.dartFilesUpdated + " file diubah";
        },
    },
    icon: {
        label: "🖼 Icon Pack (default Font Awesome)",
        run: async (job) => {
            const pubspecPath = path.join(job.extractedFolderPath, "pubspec.yaml");
            if (!fs.existsSync(pubspecPath)) return "⚠️ pubspec.yaml tidak ditemukan";
            let pubspec = fs.readFileSync(pubspecPath, "utf-8");
            if (/font_awesome_flutter\s*:/.test(pubspec)) return "ℹ️ sudah ada dependency";
            if (!/dependencies:\s*\n/.test(pubspec)) return "⚠️ blok dependencies: tidak ditemukan";
            pubspec = pubspec.replace(/dependencies:\s*\n/, function(m) { return m + "  font_awesome_flutter: ^10.7.0\n"; });
            fs.writeFileSync(pubspecPath, pubspec, "utf-8");
            return "✅ dependency font_awesome_flutter ditambahkan";
        },
    },
};

// BUY CREDITS
const buyCreditStates = new Map();

async function handleBuyCredits(chatId, userId, deleteMsgId) {
    if (buyCreditStates.has(userId)) {
        await send(
            chatId,
            "⚠️ **Proses Buy Credit Sedang Aktif!**\n\nSilakan selesaikan atau batalkan dulu.",
            [[{ text: "❌ Batalkan", data: "cancel_buy" }]],
            deleteMsgId
        );
        return;
    }

    const ownerId = CONFIG.OWNER_ID;
    let ownerName = "Owner";
    let ownerUsername = "";
    
    try {
        const entity = await client.getEntity(ownerId);
        ownerName = entity?.firstName || "Owner";
        ownerUsername = entity?.username ? "@" + entity.username : "";
    } catch (_) {}

    const mention = ownerUsername ? 
        "<a href=\"https://t.me/" + ownerUsername.replace("@", "") + "\">" + ownerName + "</a>" : 
        "<a href=\"tg://user?id=" + ownerId + "\">" + ownerName + "</a>";

    const text = 
        "💳 **BUY CREDITS**\n" +
        "────────────────────────────────\n\n" +
        "💰 **Harga:**\n" +
        "• 10 Credits = Rp 10.000\n" +
        "• 25 Credits = Rp 20.000\n" +
        "• 50 Credits = Rp 35.000\n" +
        "• 100 Credits = Rp 50.000\n\n" +
        "📝 **Cara Order:**\n" +
        "1. Kirim jumlah credit yang ingin dibeli\n" +
        "2. Bot akan memberikan instruksi pembayaran\n" +
        "3. Setelah pembayaran, admin akan menambahkan credit\n\n" +
        "👤 **Hubungi Admin:** " + mention + "\n" +
        "📌 ID Admin: `" + ownerId + "`\n\n" +
        "💡 __Ketik jumlah credit yang ingin dibeli.__\n" +
        "Contoh: `25` atau `50`";

    buyCreditStates.set(userId, { step: 'waiting_amount', chatId: chatId });
    await send(chatId, text, [[{ text: "❌ Batalkan", data: "cancel_buy" }]], deleteMsgId);
}

async function handleBuyCreditAmount(event) {
    const chatId = event.chatId;
    const userId = Number(event.message.senderId);
    const text = event.message.text?.trim();
    const state = buyCreditStates.get(userId);

    if (!state || state.step !== 'waiting_amount') return false;

    const amount = parseInt(text);
    if (isNaN(amount) || amount < 1) {
        await send(
            chatId,
            "❌ **Jumlah tidak valid!**\n\nKirim angka minimal 1.\nContoh: `25` atau `50`",
            [[{ text: "❌ Batalkan", data: "cancel_buy" }]]
        );
        return true;
    }

    let price = 0;
    if (amount <= 10) price = 10000;
    else if (amount <= 25) price = 20000;
    else if (amount <= 50) price = 35000;
    else if (amount <= 100) price = 50000;
    else {
        price = Math.ceil(amount / 100) * 50000;
    }

    const priceStr = new Intl.NumberFormat('id-ID', { 
        style: 'currency', 
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(price);

    const ownerId = CONFIG.OWNER_ID;
    let ownerName = "Owner";
    let ownerUsername = "";
    
    try {
        const entity = await client.getEntity(ownerId);
        ownerName = entity?.firstName || "Owner";
        ownerUsername = entity?.username ? "@" + entity.username : "";
    } catch (_) {}

    const mention = ownerUsername ? 
        "<a href=\"https://t.me/" + ownerUsername.replace("@", "") + "\">" + ownerName + "</a>" : 
        "<a href=\"tg://user?id=" + ownerId + "\">" + ownerName + "</a>";

    const textMsg = 
        "📝 **ORDER CREDIT**\n" +
        "────────────────────────────────\n\n" +
        "✅ **Jumlah:** " + amount + " Credits\n" +
        "💰 **Total:** " + priceStr + "\n\n" +
        "📌 **Langkah Pembayaran:**\n" +
        "1. Transfer ke rekening berikut:\n" +
            "   • Bank: Dana\n" +
        "   • No Rek: 089517848185\n" +
        "   • Atas Nama: " + CONFIG.BOT_NAME + "\n" +
        "2. Kirim bukti transfer ke admin\n" +
        "3. Admin akan menambahkan credit\n\n" +
        "👤 **Hubungi Admin:** " + mention + "\n" +
        "📌 ID Admin: `" + ownerId + "`\n\n" +
        "📎 **Kirim bukti transfer** ke admin dengan format:\n" +
        "`BUY " + amount + " - [Nama Bank] - [Jumlah] - [Tanggal]`";

    buyCreditStates.set(userId, { 
        step: 'payment_instruction', 
        chatId: chatId, 
        amount: amount, 
        price: price 
    });

    await send(chatId, textMsg, [
        [{ text: "📤 Kirim ke Admin", data: "buy_send_to_admin_" + amount }],
        [{ text: "❌ Batalkan", data: "cancel_buy" }]
    ]);
    return true;
}

async function handleBuySendToAdmin(event) {
    const data = event.data.toString();
    const chatId = event.chatId;
    const userId = Number(event.senderId);
    const msgId = event.messageId;
    const state = buyCreditStates.get(userId);

    if (!state || state.step !== 'payment_instruction') return;

    const amount = parseInt(data.replace("buy_send_to_admin_", ""));
    const ownerId = CONFIG.OWNER_ID;

    let userName = "User";
    let userUsername = "";
    try {
        const entity = await client.getEntity(userId);
        userName = entity?.firstName || "User";
        userUsername = entity?.username ? "@" + entity.username : "";
    } catch (_) {}

    const userMention = userUsername ? 
        "<a href=\"https://t.me/" + userUsername.replace("@", "") + "\">" + userName + "</a>" : 
        "<a href=\"tg://user?id=" + userId + "\">" + userName + "</a>";

    try {
        await client.sendMessage(ownerId, {
            message: 
                "💳 **PERMINTAAN BUY CREDIT**\n" +
                "────────────────────────────────\n\n" +
                "👤 **User:** " + userMention + "\n" +
                "🆔 **User ID:** `" + userId + "`\n" +
                "📦 **Jumlah:** " + amount + " Credits\n\n" +
                "📌 **Aksi:**\n" +
                "• /addcredit " + userId + " " + amount + " - Tambahkan credit\n" +
                "• /block " + userId + " - Blokir user (jika penipuan)",
            parseMode: "html",
            buttons: buildButtons([
                [{ text: "✅ Tambah " + amount + " Credit", data: "adm_credit_add_" + userId + "_" + amount }],
                [{ text: "🔒 Blokir User", data: "adm_blk_" + userId }],
            ])
        });
    } catch (err) {
        console.error("Gagal kirim notifikasi ke owner:", err);
    }

    buyCreditStates.delete(userId);

    await edit(
        chatId,
        msgId,
        "✅ **Permintaan Dikirim!**\n\n" +
        "📦 **Jumlah:** " + amount + " Credits\n\n" +
        "📌 **Langkah Selanjutnya:**\n" +
        "1. Admin akan menghubungi Anda\n" +
        "2. Kirim bukti transfer ke admin\n" +
        "3. Credit akan ditambahkan setelah konfirmasi\n\n" +
        "💡 __Harap bersabar menunggu konfirmasi admin.__",
        [[{ text: "🏠 Menu Utama", data: "start" }]]
    );

    await event.answer({ message: "✅ Permintaan " + amount + " credit dikirim ke admin!" });
}

async function handleCancelBuy(chatId, userId, msgId) {
    buyCreditStates.delete(userId);
    await send(
        chatId,
        "✅ **Proses Buy Credit Dibatalkan.**",
        [[{ text: "🏠 Menu Utama", data: "start" }]],
        msgId
    );
}

// REFERRAL SYSTEM
const REFERRAL_BONUS = 20;
const REFERRAL_WEEKLY_BONUS = 20;
const REFERRAL_TARGET = 5;

const referralStates = new Map();

async function handleReferralSystem(chatId, userId, deleteMsgId) {
    const userData = db.getUser(userId);
    const referralCode = db.getUserReferralCode(userId);
    const referralCount = userData?.referralCount || 0;
    const referredBy = userData?.referredBy || null;

    const canClaim = db.canClaimWeeklyBonus(userId);

    const link = "https://t.me/" + (await client.getMe()).username + "?start=ref_" + referralCode;

    let text = 
        "🔗 **REFERRAL SYSTEM**\n" +
        "────────────────────────────────\n\n" +
        "📌 **Kode Referral:** `" + referralCode + "`\n" +
        "🔥 **Total Referral:** " + referralCount + "\n" +
        "💰 **Bonus per Referral:** " + REFERRAL_BONUS + " Credits\n" +
        "🎯 **Target Mingguan:** " + REFERRAL_TARGET + " Referral\n" +
        "💰 **Bonus Mingguan:** " + REFERRAL_WEEKLY_BONUS + " Credits\n\n";

    if (referredBy) {
        text += "👤 **Direferral oleh:** `" + referredBy + "`\n\n";
    }

    if (canClaim) {
        text += "🎉 **Kamu memenuhi target mingguan!**\n" +
                "💰 Dapatkan " + REFERRAL_WEEKLY_BONUS + " Credits bonus!\n\n" +
                "Klik tombol di bawah untuk klaim bonus.";
    } else {
        const remaining = Math.max(0, REFERRAL_TARGET - referralCount);
        text += "📊 **Butuh " + remaining + " referral lagi** untuk bonus mingguan.\n\n";
    }

    text += "🔗 **Bagikan Link:**\n" + link + "\n\n" +
            "💡 __Setiap teman yang join dan verifikasi, kamu dapat " + REFERRAL_BONUS + " Credits!__";

    const buttons = [];
    if (canClaim) {
        buttons.push([{ text: "💰 Klaim Bonus Mingguan", data: "referral_claim_weekly" }]);
    }
    buttons.push([{ text: "🔗 Bagikan Link", data: "referral_share" }]);
    buttons.push([{ text: "🏠 Menu Utama", data: "start" }]);

    await send(chatId, text, buttons, deleteMsgId);
}

async function handleReferralClaimWeekly(chatId, userId, msgId) {
    const canClaim = db.canClaimWeeklyBonus(userId);

    if (!canClaim) {
        const userData = db.getUser(userId);
        const referralCount = userData?.referralCount || 0;
        
        if (referralCount < REFERRAL_TARGET) {
            await edit(
                chatId,
                msgId,
                "⚠️ **Belum Mencapai Target!**\n\n" +
                "Kamu perlu **" + REFERRAL_TARGET + " referral** untuk klaim bonus mingguan.\n" +
                "Saat ini: **" + referralCount + "** referral.\n\n" +
                "Ajak " + (REFERRAL_TARGET - referralCount) + " teman lagi!",
                [[{ text: "🔗 Kembali ke Referral", data: "referral" }]]
            );
        } else {
            await edit(
                chatId,
                msgId,
                "⏳ **Sudah Klaim Minggu Ini!**\n\n" +
                "Bonus mingguan sudah kamu klaim.\n" +
                "Tunggu minggu depan untuk klaim lagi.",
                [[{ text: "🔗 Kembali ke Referral", data: "referral" }]]
            );
        }
        return;
    }

    const result = db.claimWeeklyBonus(userId);
    if (!result) {
        await edit(
            chatId,
            msgId,
            "❌ **Gagal Klaim Bonus!**\n\nSilakan coba lagi nanti.",
            [[{ text: "🔗 Kembali ke Referral", data: "referral" }]]
        );
        return;
    }

    await edit(
        chatId,
        msgId,
        "🎉 **BONUS MINGGUAN BERHASIL DIKLAIM!**\n\n" +
        "💰 **" + result.bonus + " Credits** ditambahkan.\n" +
        "💳 **Total Credit:** `" + result.newCredit + "`\n\n" +
        "📊 **Referral Saat Ini:** " + (db.getUser(userId)?.referralCount || 0) + "\n\n" +
        "Terus ajak teman untuk mendapatkan lebih banyak bonus! 🚀",
        [[{ text: "🔗 Kembali ke Referral", data: "referral" }]]
    );
}

async function handleReferralShare(chatId, userId, msgId) {
    const referralCode = db.getUserReferralCode(userId);
    const link = "https://t.me/" + (await client.getMe()).username + "?start=ref_" + referralCode;

    await edit(
        chatId,
        msgId,
        "🔗 **Bagikan Link Referral**\n────────────────────────────────\n\n" +
        "Salin link di bawah dan bagikan ke teman-teman kamu:\n\n" +
        "`" + link + "`\n\n" +
        "📌 **Cara Pakai:**\n" +
        "1. Kirim link ke teman\n" +
        "2. Teman klik link dan mulai bot\n" +
        "3. Teman verifikasi join channel\n" +
        "4. Kamu dapat " + REFERRAL_BONUS + " Credits!\n\n" +
        "📊 **Total Referral:** " + (db.getUser(userId)?.referralCount || 0),
        [
            [{ text: "📋 Salin Link", data: "referral_copy" }],
            [{ text: "🔗 Kembali ke Referral", data: "referral" }],
        ]
    );
}

async function handleReferralCopy(chatId, userId, msgId) {
    const referralCode = db.getUserReferralCode(userId);
    const link = "https://t.me/" + (await client.getMe()).username + "?start=ref_" + referralCode;

    await edit(
        chatId,
        msgId,
        "📋 **Link Referral:**\n\n`" + link + "`\n\n" +
        "💡 __Salin link di atas dan bagikan ke teman-teman kamu!__",
        [[{ text: "🔗 Kembali ke Referral", data: "referral" }]]
    );
}

// EXPOSE RUNTIME DEPENDENCIES
Object.assign(globalThis, {
    TelegramClient, Api, StringSession, NewMessage, CallbackQuery, Button,
    fs, path, AdmZip, os, execSync, net, readline, github,
    CONFIG,
    getUserJob, setUserJob, removeUserJob, isUserBuilding, getActiveJobs, getQueueStats,
    githubRequest, uploadZipToRelease, deleteRelease, triggerWorkflow,
    getRunStatus, getArtifacts, downloadArtifactZip, getFailedStepLog, sleep,
    createReleaseOnly, uploadAssetFile, triggerWeb2ApkWorkflow, publishRelease,
    getGitHubToken, getRepoPublicKey, createOrUpdateRepoSecret, createOrUpdateWorkflowFile, runAutoSetupGitHub,
    SESSION_FILE, sessionString, API_ID, API_HASH,
    client, userStates, REFERRAL_CONFIG_PATH, domainDetectionStates,
    DB_PATH, STATS_PATH, CREDIT_RESET_STATE_PATH, REDEEM_CODES_PATH, REDEEM_CREDIT_AMOUNT,
    WEEKLY_RESET_AMOUNT, WEEKLY_RESET_INTERVAL_MS,
    db,
    GEMINI_API_KEY, GEMINI_MODEL,
    userBaseFiles, BINARY_FILE_EXTENSIONS,
    queueMessages, AI_TOOLS_INFO, ICON_PACKS, LIVE_EDIT_EXTENSIONS, MULTI_INJECT_TOOLS,
    // Buy Credits
    handleBuyCredits,
    handleBuyCreditAmount,
    handleBuySendToAdmin,
    handleCancelBuy,
    buyCreditStates,
    // Referral System
    handleReferralSystem,
    handleReferralClaimWeekly,
    handleReferralShare,
    handleReferralCopy,
    referralStates,
    REFERRAL_BONUS,
    REFERRAL_WEEKLY_BONUS,
    REFERRAL_TARGET,
});

module.exports = {
    // Buy Credits
    handleBuyCredits,
    handleBuyCreditAmount,
    handleBuySendToAdmin,
    handleCancelBuy,
    buyCreditStates,
    // Referral System
    handleReferralSystem,
    handleReferralClaimWeekly,
    handleReferralShare,
    handleReferralCopy,
    referralStates,
    REFERRAL_BONUS,
    REFERRAL_WEEKLY_BONUS,
    REFERRAL_TARGET,
};
