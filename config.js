// config.js

module.exports = {
  BOT_NAME: "BOT BUILD VANILLA",
  BOT_VERSION: "3.0.0",
  FREE_CREDIT: Number(process.env.FREE_CREDIT || 5),
  BOT_TOKEN: process.env.BOT_TOKEN || "8950341551:AAFsdKiSK_O3ag8qS6liO20jicHJ6D9Tapc",
  ADMIN_IDS: (process.env.ADMIN_IDS || "1495914495").split(",").map(Number).filter(Boolean),

  // ─── TELEGRAM CHANNEL & GROUP CONFIG ────────────────────────────────────────
  CHANNEL_USERNAME: process.env.CHANNEL_USERNAME || "@heheomupin", 
  CHANNEL_USERNAME2: process.env.CHANNEL_USERNAME2 || "@jastebcahnom",
  CHANNEL_USERNAME3: process.env.CHANNEL_USERNAME3 || "@privateUpin",
  REDEEM_TESTIMONI_CHANNEL: process.env.REDEEM_TESTIMONI_CHANNEL || "@heheomupin",
  
  // ID Channel/Grup cadangan tempat bot otomatis melempar file users.json setiap ada user baru
  OWNER_ID: parseInt(process.env.OWNER_ID || "1495914495"),

  // ─── SYSTEM CONFIG ──────────────────────────────────────────────────────────
  WELCOME_PHOTO: process.env.WELCOME_PHOTO || "https://files.catbox.moe/792dok.jpg",
  START_PHOTO: process.env.START_PHOTO || process.env.WELCOME_PHOTO || "https://files.catbox.moe/792dok.jpg",
  NEW_USER_PHOTO: process.env.NEW_USER_PHOTO || "https://files.catbox.moe/792dok.jpg",
  NEW_USER: process.env.NEW_USER || "https://files.catbox.moe/792dok.jpg",
  TMP_DIR: "./tmp",

  BUILD_TIMEOUT_MS: 30 * 60 * 1000, // 30 menit
  POLL_INTERVAL_MS: 7000,            // poll setiap 7 detik
  WEB2APK_MAINTENANCE: null,
  
  // ─── KONFIGURASI BUILD ──────────────────────────────────────────────────────
  MAX_RETRY_GET_STATUS: 5,
  LOG_FETCH_DELAY_MS: 5000,
  ARTIFACT_RETRY_DELAY_MS: 3000,

  // ─── NEW USER NOTIFICATION ──────────────────────────────────────────────────
  SHOW_USER_AVATAR: true,           // Tampilkan foto profil user di notifikasi channel
  SHOW_PREMIUM_STATUS: true,        // Tampilkan status premium user
  SHOW_ONLINE_STATUS: true,         // Tampilkan status online user
  SHOW_USER_BIO: true,              // Tampilkan bio user
  SHOW_COMMON_GROUPS: true,         // Tampilkan jumlah common groups
  SHOW_LANGUAGE_CODE: true,         // Tampilkan kode bahasa user
  SEND_USER_PHOTO_TO_OWNER: true,   // Kirim foto profil user ke owner
  SEND_USER_DETAILS_TO_OWNER: true, // Kirim detail user ke owner

  // ─── TQTO CONFIG ─────────────────────────────────────────────────────────────
  TQTO_PHOTO: process.env.TQTO_PHOTO || "https://files.catbox.moe/792dok.jpg",

  TQTO_DEVELOPER: "IpinXD",
  TQTO_DEVELOPER_ROLE: "DEVELOPER",
  TQTO_DEVELOPER_PHOTO: process.env.TQTO_DEVELOPER_PHOTO || "https://files.catbox.moe/792dok.jpg",
  TQTO_DEVELOPER_BIO: process.env.TQTO_DEVELOPER_BIO || "Creator & Lead Developer, ngoding bot ini dari nol sampai jadi.",

  TQTO_GIRLFRIEND: "Masih When Ya",
  TQTO_GIRLFRIEND_ROLE: "When Ya",
  TQTO_GIRLFRIEND_PHOTO: process.env.TQTO_GIRLFRIEND_PHOTO || "https://files.catbox.moe/792dok.jpg",
  TQTO_GIRLFRIEND_BIO: process.env.TQTO_GIRLFRIEND_BIO || "ga ada cewek gua bang",

  TQTO_SUPPORT: "VANNZScyutt",
  TQTO_SUPPORT_ROLE: "MY FRIEND",
  TQTO_SUPPORT_PHOTO: process.env.TQTO_SUPPORT_PHOTO || "https://files.catbox.moe/792dok.jpg",
  TQTO_SUPPORT_BIO: process.env.TQTO_SUPPORT_BIO || "Partner diskusi, testing, dan dukungan selama pengembangan bot.",

  // ─── MAINTENANCE CONFIG ──────────────────────────────────────────────────────
  MAINTENANCE_MESSAGE: process.env.MAINTENANCE_MESSAGE || "🛠️ Bot sedang dalam maintenance. Silakan coba lagi nanti.",
};