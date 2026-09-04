// src/features/cards.js
// Kartu foto bergaya TERMINAL/CLI — background hitam pekat, chrome window
// ala macOS Terminal (3 dot merah/kuning/hijau), font monospace, teks hijau
// neon ala hacker console. Ini SENGAJA dibuat beda total dari kartu BOT_BUILD
// (yang gaya gradient card premium) — dipakai buat log channel, antrian, dan
// status server, biar keliatan khas "server/CLI" sesuai identitas bot ini.
const { createCanvas, loadImage } = require("canvas");
const axios = require("axios");

const MONO = '"DejaVu Sans Mono", monospace';
const NEON_GREEN = "#39ff88";
const DIM_GREEN = "#1f7a4a";
const AMBER = "#ffb454";
const RED = "#ff5f56";
const CYAN = "#5fd7ff";

function drawGrid(ctx, width, height) {
  ctx.save();
  ctx.strokeStyle = "rgba(57,255,136,0.035)";
  ctx.lineWidth = 1;
  for (let x = 0; x < width; x += 26) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
  }
  for (let y = 0; y < height; y += 26) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
  }
  ctx.restore();
}

// Bikin window terminal kosong (chrome bar + body hitam), balikin y awal
// buat mulai nulis baris-baris konten.
function drawTerminalWindow(ctx, width, height, titleText, accent = NEON_GREEN) {
  // background luar (sedikit lebih gelap dari body, kasih efek "desktop")
  ctx.fillStyle = "#050705";
  ctx.fillRect(0, 0, width, height);

  const pad = 24;
  const winX = pad, winY = pad, winW = width - pad * 2, winH = height - pad * 2;
  const barH = 42;

  // body window
  ctx.fillStyle = "#0a0f0b";
  roundRectPath(ctx, winX, winY, winW, winH, 14);
  ctx.fill();

  // border tipis neon
  ctx.strokeStyle = `${accent}55`;
  ctx.lineWidth = 1.5;
  roundRectPath(ctx, winX, winY, winW, winH, 14);
  ctx.stroke();

  // chrome bar atas
  ctx.save();
  roundRectPath(ctx, winX, winY, winW, barH, 14);
  ctx.clip();
  ctx.fillStyle = "#111a13";
  ctx.fillRect(winX, winY, winW, barH);
  ctx.restore();
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.beginPath(); ctx.moveTo(winX, winY + barH); ctx.lineTo(winX + winW, winY + barH); ctx.stroke();

  // 3 dot ala macOS
  const dotY = winY + barH / 2;
  [RED, AMBER, NEON_GREEN].forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(winX + 26 + i * 22, dotY, 6, 0, Math.PI * 2);
    ctx.fill();
  });

  // judul window
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = `13px ${MONO}`;
  ctx.textAlign = "center";
  ctx.fillText(titleText, winX + winW / 2, dotY + 4);

  // grid halus di body
  ctx.save();
  ctx.beginPath();
  roundRectPath(ctx, winX, winY + barH, winW, winH - barH, 14);
  ctx.clip();
  drawGrid(ctx, width, height);
  ctx.restore();

  ctx.textAlign = "left";
  return { contentX: winX + 30, contentY: winY + barH + 34, contentW: winW - 60, winX, winY, winW, winH, barH };
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Satu baris ala terminal: "prompt$ label" di baris pertama redup,
// value di baris kedua terang (biar mirip output command beneran).
function drawKV(ctx, x, y, label, value, accent = NEON_GREEN, maxWidth = 900) {
  ctx.font = `12px ${MONO}`;
  ctx.fillStyle = DIM_GREEN;
  ctx.fillText(`$ ${label}`, x, y);

  ctx.font = `bold 16px ${MONO}`;
  ctx.fillStyle = accent;
  let text = String(value ?? "-");
  while (ctx.measureText(text).width > maxWidth && text.length > 3) {
    text = text.slice(0, -1);
  }
  if (text !== String(value ?? "-")) text = text.slice(0, -1) + "…";
  ctx.fillText(text, x, y + 22);

  return y + 50;
}

function drawSectionLabel(ctx, x, y, text, accent = CYAN) {
  ctx.font = `bold 13px ${MONO}`;
  ctx.fillStyle = accent;
  ctx.fillText(`// ${text}`, x, y);
  return y + 26;
}

function drawFooter(ctx, contentX, contentW, bottomY, leftText, rightText) {
  ctx.strokeStyle = "rgba(57,255,136,0.15)";
  ctx.beginPath();
  ctx.moveTo(contentX, bottomY - 20);
  ctx.lineTo(contentX + contentW, bottomY - 20);
  ctx.stroke();

  ctx.font = `11px ${MONO}`;
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.textAlign = "left";
  ctx.fillText(leftText, contentX, bottomY);
  ctx.textAlign = "right";
  ctx.fillStyle = NEON_GREEN;
  ctx.fillText(rightText, contentX + contentW, bottomY);
  ctx.textAlign = "left";
}

// ═══════════════════════════════════════════════════════════════════════════
// KARTU 1: LOG USER BARU (dikirim ke channel — SATU pesan aja, gak dobel lagi)
// ═══════════════════════════════════════════════════════════════════════════
async function generateUserLogCard(data = {}) {
  // Premium new-user card: profile photo + identity + membership metadata.
  // Every value is sanitized/fallbacked so a missing Telegram field never
  // breaks card generation.
  const width = 1200, height = 700;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, "#070b18");
  bg.addColorStop(0.52, "#111522");
  bg.addColorStop(1, "#4b3d25");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // soft glow
  const glow = ctx.createRadialGradient(930, 190, 10, 930, 190, 520);
  glow.addColorStop(0, "rgba(212,170,80,0.18)");
  glow.addColorStop(1, "rgba(212,170,80,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  const pad = 22;
  ctx.strokeStyle = "rgba(220,178,91,0.55)";
  ctx.lineWidth = 2;
  roundRectPath(ctx, pad, pad, width - pad * 2, height - pad * 2, 26);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.07)";
  ctx.lineWidth = 1;
  roundRectPath(ctx, pad + 8, pad + 8, width - (pad + 8) * 2, height - (pad + 8) * 2, 20);
  ctx.stroke();

  const safe = (v, fallback = "—") => {
    const text = String(v ?? "").trim();
    return text || fallback;
  };
  const fullName = safe(data.fullName, "New User");
  const username = data.username && String(data.username).replace(/^@/, "")
    ? `@${String(data.username).replace(/^@/, "")}` : "No username";
  const userId = safe(data.userId);
  const memberNo = safe(data.memberNo, "—");
  const referredBy = safe(data.referredBy, "—");
  const timeLabel = safe(data.timeLabel, "—");
  const premium = data.isPremium ? "Premium" : "Regular";
  const status = safe(data.onlineStatus, "Unknown");
  const language = safe(data.languageCode, "Unknown");

  // Header
  ctx.textAlign = "left";
  ctx.fillStyle = "#d9b45d";
  ctx.font = "bold 21px DejaVu Sans";
  ctx.fillText("NEW MEMBER • BUILD CLOUD", 62, 72);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 42px DejaVu Sans";
  ctx.fillText("WELCOME ABOARD", 62, 120);

  // Profile circle
  const cx = 180, cy = 330, r = 116;
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r + 9, 0, Math.PI * 2); ctx.closePath();
  ctx.fillStyle = "#080d1c"; ctx.fill();
  ctx.strokeStyle = "rgba(217,180,93,0.7)"; ctx.lineWidth = 4; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
  try {
    if (data.photoBuffer) {
      const img = await loadImage(data.photoBuffer);
      const scale = Math.max((r * 2) / img.width, (r * 2) / img.height);
      const iw = img.width * scale, ih = img.height * scale;
      ctx.drawImage(img, cx - iw / 2, cy - ih / 2, iw, ih);
    } else {
      ctx.fillStyle = "#263047"; ctx.fillRect(cx-r, cy-r, r*2, r*2);
      ctx.fillStyle = "#d9b45d"; ctx.font = "bold 72px DejaVu Sans"; ctx.textAlign = "center";
      ctx.fillText(fullName.charAt(0).toUpperCase(), cx, cy + 24);
      ctx.textAlign = "left";
    }
  } catch (_) {
    ctx.fillStyle = "#263047"; ctx.fillRect(cx-r, cy-r, r*2, r*2);
  }
  ctx.restore();

  // Name / username
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 31px DejaVu Sans";
  ctx.fillText(fullName.slice(0, 30), 380, 225);
  ctx.fillStyle = "#d9b45d";
  ctx.font = "20px DejaVu Sans";
  ctx.fillText(username.slice(0, 36), 380, 260);

  const drawField = (x, y, label, value, max = 34) => {
    ctx.fillStyle = "#d9b45d";
    ctx.font = "bold 15px DejaVu Sans";
    ctx.fillText(label.toUpperCase(), x, y);
    ctx.fillStyle = "#f2f2f2";
    ctx.font = "19px DejaVu Sans";
    let val = String(value);
    while (ctx.measureText(val).width > max && val.length > 4) val = val.slice(0, -1);
    if (val !== String(value)) val = val.slice(0, -1) + "…";
    ctx.fillText(val, x, y + 28);
  };

  drawField(380, 320, "USER ID", userId);
  drawField(380, 395, "REFERRAL FROM", referredBy);
  drawField(760, 320, "MEMBER", `#${memberNo}`);
  drawField(760, 395, "TIME", timeLabel);
  drawField(380, 470, "STATUS", status);
  drawField(760, 470, "PLAN", premium);
  drawField(380, 545, "LANGUAGE", language);
  drawField(760, 545, "SYSTEM", "BUILD READY");

  // Bottom status bar
  ctx.fillStyle = "rgba(160,125,55,0.25)";
  roundRectPath(ctx, 380, 590, 740, 62, 16); ctx.fill();
  ctx.fillStyle = "#f1d37d";
  ctx.font = "bold 18px DejaVu Sans";
  ctx.fillText("✓ ACCOUNT REGISTERED • READY TO BUILD", 410, 628);

  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.font = "14px DejaVu Sans";
  ctx.textAlign = "right";
  ctx.fillText(`${safe(data.botName, "BUILD CLOUD")} • v${safe(data.botVersion, "3.0.0")}`, 1135, 675);
  ctx.textAlign = "left";

  return canvas.toBuffer("image/jpeg", { quality: 0.95 });
}

// ═══════════════════════════════════════════════════════════════════════════
// KARTU 2: ANTRIAN (/queue)
// ═══════════════════════════════════════════════════════════════════════════
async function generateQueueCard(data = {}) {
  const jobs = data.jobs || [];
  const height = Math.max(560, 320 + jobs.length * 74);
  const width = 1000;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  const { contentX, contentY, contentW, winY, winH } = drawTerminalWindow(
    ctx, width, height, "queue_status --watch", CYAN
  );

  let y = contentY;
  ctx.font = `bold 20px ${MONO}`;
  ctx.fillStyle = CYAN;
  ctx.fillText("$ queue status", contentX, y);
  y += 36;

  const half = contentW / 3 - 16;
  let x0 = contentX, x1 = contentX + half + 24, x2 = contentX + (half + 24) * 2;
  const rowY = y;
  drawKV(ctx, x0, rowY, "waiting", data.waiting, AMBER, half);
  drawKV(ctx, x1, rowY, "uploading", data.uploading, CYAN, half);
  drawKV(ctx, x2, rowY, "building", data.building, NEON_GREEN, half);
  y = rowY + 60;

  y = drawSectionLabel(ctx, contentX, y, `active_jobs (${jobs.length})`, CYAN);

  if (!jobs.length) {
    ctx.font = `14px ${MONO}`;
    ctx.fillStyle = DIM_GREEN;
    ctx.fillText("$ server idle — no active jobs", contentX, y + 10);
    y += 36;
  } else {
    jobs.forEach((j, i) => {
      ctx.font = `bold 15px ${MONO}`;
      ctx.fillStyle = NEON_GREEN;
      ctx.fillText(`[${i + 1}] ${j.user}`, contentX, y);
      ctx.font = `12px ${MONO}`;
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.fillText(`      mode:${j.mode}  status:${j.status}  elapsed:${j.duration}`, contentX, y + 20);
      y += 46;
    });
  }

  y += 10;
  y = drawSectionLabel(ctx, contentX, y, "compile_stats", CYAN);
  const halfStats = contentW / 2 - 20;
  let yL = y, yR = y;
  yL = drawKV(ctx, contentX, yL, "success", data.success, NEON_GREEN, halfStats);
  yR = drawKV(ctx, contentX + halfStats + 40, yR, "failed", data.failed, RED, halfStats);

  drawFooter(ctx, contentX, contentW, winY + winH - 26, data.timeLabel || "", "server: online");

  return canvas.toBuffer("image/jpeg", { quality: 0.95 });
}

// ═══════════════════════════════════════════════════════════════════════════
// KARTU 3: STATUS SERVER (/status)
// ═══════════════════════════════════════════════════════════════════════════
async function generateStatusCard(data = {}) {
  const width = 1000, height = 760;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  const { contentX, contentY, contentW, winY, winH } = drawTerminalWindow(
    ctx, width, height, "sysinfo --full", AMBER
  );

  let y = contentY;
  ctx.font = `bold 20px ${MONO}`;
  ctx.fillStyle = AMBER;
  ctx.fillText("$ sysinfo", contentX, y);
  y += 34;

  const half = contentW / 2 - 20;

  y = drawSectionLabel(ctx, contentX, y, "bot", CYAN);
  let yL = y, yR = y;
  yL = drawKV(ctx, contentX, yL, "name", `${data.botName} v${data.botVersion}`, NEON_GREEN, half);
  yL = drawKV(ctx, contentX, yL, "uptime", data.uptime, NEON_GREEN, half);
  yR = drawKV(ctx, contentX + half + 40, yR, "users_total", data.totalUsers, AMBER, half);
  yR = drawKV(ctx, contentX + half + 40, yR, "status", "online", NEON_GREEN, half);
  y = Math.max(yL, yR);

  y = drawSectionLabel(ctx, contentX, y + 4, "host", CYAN);
  yL = y; yR = y;
  yL = drawKV(ctx, contentX, yL, "provider", data.cloudProvider, CYAN, half);
  yL = drawKV(ctx, contentX, yL, "ping_github", data.githubPing, CYAN, half);
  yR = drawKV(ctx, contentX + half + 40, yR, "kernel", data.kernel, "rgba(255,255,255,0.7)", half);
  yR = drawKV(ctx, contentX + half + 40, yR, "local_ip", data.localIp, "rgba(255,255,255,0.7)", half);
  y = Math.max(yL, yR);

  y = drawSectionLabel(ctx, contentX, y + 4, "cpu", CYAN);
  yL = y; yR = y;
  yL = drawKV(ctx, contentX, yL, "model", data.cpuModel, "rgba(255,255,255,0.7)", half);
  yL = drawKV(ctx, contentX, yL, "cores", data.cpuCores, "rgba(255,255,255,0.7)", half);
  yR = drawKV(ctx, contentX + half + 40, yR, "load_avg", `${data.cpuLoad}%`, data.cpuLoad > 80 ? RED : NEON_GREEN, half);
  yR = drawKV(ctx, contentX + half + 40, yR, "speed", data.cpuSpeed, "rgba(255,255,255,0.7)", half);
  y = Math.max(yL, yR);

  y = drawSectionLabel(ctx, contentX, y + 4, "memory / disk", CYAN);
  yL = y; yR = y;
  yL = drawKV(ctx, contentX, yL, "ram_used", `${data.usedRam}GB / ${data.totalRam}GB (${data.ramPercentage}%)`, data.ramPercentage > 85 ? RED : AMBER, half);
  yR = drawKV(ctx, contentX + half + 40, yR, "disk_used", `${data.diskUsed} / ${data.diskTotal} (${data.diskPercentage})`, AMBER, half);
  y = Math.max(yL, yR);

  drawFooter(ctx, contentX, contentW, winY + winH - 26, data.timeLabel || "", "exit_code: 0");

  return canvas.toBuffer("image/jpeg", { quality: 0.95 });
}


// ═══════════════════════════════════════════════════════════════════════════
// BUILD RESULT CARD — premium ID card for channel success / failure logs
// ═══════════════════════════════════════════════════════════════════════════
function fitText(ctx, text, maxWidth, maxChars = 80) {
  let value = String(text ?? "—");
  if (value.length > maxChars) value = value.slice(0, maxChars - 1) + "…";
  while (ctx.measureText(value).width > maxWidth && value.length > 4) {
    value = value.slice(0, -2) + "…";
  }
  return value;
}

function drawResultField(ctx, x, y, label, value, accent, maxWidth = 500) {
  ctx.fillStyle = "rgba(255,255,255,0.42)";
  ctx.font = "16px DejaVu Sans";
  ctx.fillText(String(label).toUpperCase(), x, y);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 27px DejaVu Sans";
  ctx.fillText(fitText(ctx, value, maxWidth, 46), x, y + 35);
  ctx.fillStyle = accent;
  ctx.fillRect(x, y + 48, Math.min(110, maxWidth), 3);
}

function generateBuildResultCard(data = {}) {
  const success = data.status === "success";
  const width = 1536, height = 864;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  const accent = success ? "#25d366" : "#ff4d5f";
  const accentSoft = success ? "rgba(37,211,102,0.16)" : "rgba(255,77,95,0.16)";
  const accentLine = success ? "rgba(37,211,102,0.65)" : "rgba(255,77,95,0.65)";

  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, "#070b18");
  bg.addColorStop(0.48, "#111827");
  bg.addColorStop(1, success ? "#173b2d" : "#421d28");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(1260, 190, 10, 1260, 190, 500);
  glow.addColorStop(0, success ? "rgba(37,211,102,0.18)" : "rgba(255,77,95,0.18)");
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  // outer card border
  const pad = 20;
  ctx.strokeStyle = accentLine;
  ctx.lineWidth = 2;
  roundRectPath(ctx, pad, pad, width - pad * 2, height - pad * 2, 28);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  roundRectPath(ctx, pad + 10, pad + 10, width - (pad + 10) * 2, height - (pad + 10) * 2, 20);
  ctx.stroke();

  // Header
  ctx.fillStyle = accent;
  ctx.font = "bold 23px DejaVu Sans";
  ctx.fillText(success ? "BUILD CLOUD • RESULT READY" : "BUILD CLOUD • BUILD ERROR", 78, 86);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 45px DejaVu Sans";
  ctx.fillText(success ? "BUILD SUCCESS" : "BUILD FAILED", 78, 132);

  // Status icon
  const iconX = 1340, iconY = 112, iconR = 48;
  ctx.fillStyle = accentSoft;
  ctx.beginPath(); ctx.arc(iconX, iconY, 65, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = accentLine;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(iconX, iconY, 65, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = accent;
  ctx.beginPath(); ctx.arc(iconX, iconY, iconR, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  if (success) {
    ctx.beginPath(); ctx.moveTo(iconX - 22, iconY); ctx.lineTo(iconX - 5, iconY + 18); ctx.lineTo(iconX + 27, iconY - 21); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.moveTo(iconX - 20, iconY - 20); ctx.lineTo(iconX + 20, iconY + 20); ctx.moveTo(iconX + 20, iconY - 20); ctx.lineTo(iconX - 20, iconY + 20); ctx.stroke();
  }
  ctx.lineCap = "butt";

  // horizontal accent bar
  ctx.fillStyle = accentSoft;
  roundRectPath(ctx, 84, 188, width - 168, 28, 14); ctx.fill();
  ctx.fillStyle = accent;
  roundRectPath(ctx, 84, 188, success ? width - 168 : Math.max(220, Math.min(width - 168, 420)), 28, 14); ctx.fill();

  const leftX = 92, rightX = 825;
  drawResultField(ctx, leftX, 270, "Developer", data.developer || "Unknown", accent, 580);
  drawResultField(ctx, rightX, 270, "User ID", data.userId || "—", accent, 560);
  drawResultField(ctx, leftX, 385, "Project", data.project || "Flutter Project", accent, 580);
  drawResultField(ctx, rightX, 385, "Mode", data.mode || "Release Build", accent, 560);
  drawResultField(ctx, leftX, 500, success ? "APK Size" : "Failed Step", success ? (data.apkSize || "—") : (data.failedStep || "Compilation"), accent, 580);
  drawResultField(ctx, rightX, 500, "Duration", data.duration || "—", accent, 560);
  drawResultField(ctx, leftX, 615, "Run ID", data.runId || "—", accent, 580);
  drawResultField(ctx, rightX, 615, "Tag", data.tag || "—", accent, 560);

  // Bottom status panel
  ctx.fillStyle = accentSoft;
  roundRectPath(ctx, 84, 754, width - 168, 72, 18); ctx.fill();
  ctx.strokeStyle = accentLine;
  ctx.lineWidth = 1;
  roundRectPath(ctx, 84, 754, width - 168, 72, 18); ctx.stroke();
  ctx.fillStyle = accent;
  ctx.font = "bold 22px DejaVu Sans";
  ctx.textAlign = "center";
  ctx.fillText(
    success ? "✓ BUILD VALIDATED • READY TO DOWNLOAD" : "✕ BUILD TERMINATED • ERROR LOG AVAILABLE",
    width / 2, 799
  );

  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.font = "15px DejaVu Sans";
  ctx.fillText(String(data.timeLabel || ""), 78, 850);
  ctx.textAlign = "right";
  ctx.fillStyle = accent;
  ctx.font = "bold 17px DejaVu Sans";
  ctx.fillText(String(data.botName || "BUILD CLOUD"), width - 78, 850);
  ctx.textAlign = "left";

  return canvas.toBuffer("image/jpeg", { quality: 0.95 });
}

// ─── Helpers khusus TQTO ID CARD ────────────────────────────────────────────
async function fetchImageBuffer(url) {
    if (!url) return null;
    try {
        const res = await axios.get(url, { responseType: "arraybuffer", timeout: 10000 });
        return Buffer.from(res.data);
    } catch (_) {
        return null;
    }
}

function wrapTextLines(ctx, text, maxWidth, maxLines = 4) {
    const words = String(text || "").split(/\s+/).filter(Boolean);
    const lines = [];
    let current = "";
    for (const word of words) {
        const test = current ? `${current} ${word}` : word;
        if (ctx.measureText(test).width > maxWidth && current) {
            lines.push(current);
            current = word;
        } else {
            current = test;
        }
    }
    if (current) lines.push(current);

    if (lines.length > maxLines) {
        let last = lines[maxLines - 1];
        while (ctx.measureText(last + "…").width > maxWidth && last.length > 1) {
            last = last.slice(0, -1);
        }
        lines[maxLines - 1] = last.replace(/\s+$/, "") + "…";
        lines.length = maxLines;
    }
    return lines;
}

// ═══════════════════════════════════════════════════════════════════════════
// KARTU 4: TQTO CARD — 3 ID Card premium (foto profil bulat + nama + bio)
// ═══════════════════════════════════════════════════════════════════════════
async function generateTqtoCard(data = {}) {
    const width = 1200, height = 760;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // ─── Background ──────────────────────────────────────────────────────────
    const bg = ctx.createLinearGradient(0, 0, width, height);
    bg.addColorStop(0, "#070b18");
    bg.addColorStop(0.5, "#10121f");
    bg.addColorStop(1, "#1a1628");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    const glow = ctx.createRadialGradient(600, 60, 10, 600, 60, 640);
    glow.addColorStop(0, "rgba(217,180,93,0.14)");
    glow.addColorStop(1, "rgba(217,180,93,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    // ─── Outer frame ────────────────────────────────────────────────────────
    const pad = 26;
    ctx.strokeStyle = "rgba(220,178,91,0.5)";
    ctx.lineWidth = 2;
    roundRectPath(ctx, pad, pad, width - pad * 2, height - pad * 2, 26);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    roundRectPath(ctx, pad + 8, pad + 8, width - (pad + 8) * 2, height - (pad + 8) * 2, 20);
    ctx.stroke();

    // ─── Header ─────────────────────────────────────────────────────────────
    ctx.textAlign = "center";
    ctx.fillStyle = "#d9b45d";
    ctx.font = `bold 18px ${MONO}`;
    ctx.fillText((data.botName || "BUILD CLOUD").toUpperCase() + " • CREDITS", width / 2, 76);

    ctx.fillStyle = "#ffffff";
    ctx.font = `bold 36px "DejaVu Sans", sans-serif`;
    ctx.fillText("🙏 TERIMA KASIH KEPADA", width / 2, 118);

    ctx.fillStyle = "rgba(255,255,255,0.30)";
    ctx.font = `13px ${MONO}`;
    ctx.fillText("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", width / 2, 142);

    // ─── 3 ID Card panels ───────────────────────────────────────────────────
    const people = (Array.isArray(data.people) ? data.people : []).slice(0, 3);
    const panelW = 336, panelGap = 24, panelH = 528, panelY = 176;
    const totalW = people.length * panelW + Math.max(0, people.length - 1) * panelGap;
    const startX = (width - totalW) / 2;

    for (let i = 0; i < people.length; i++) {
        const p = people[i] || {};
        const px = startX + i * (panelW + panelGap);
        const accent = p.accent || "#d9b45d";

        // panel drop shadow
        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,0.55)";
        ctx.shadowBlur = 22;
        ctx.shadowOffsetY = 10;
        roundRectPath(ctx, px, panelY, panelW, panelH, 20);
        ctx.fillStyle = "rgba(10,12,20,0.001)";
        ctx.fill();
        ctx.restore();

        // panel background: richer glass gradient (top brighter, fading down)
        const panelBg = ctx.createLinearGradient(px, panelY, px, panelY + panelH);
        panelBg.addColorStop(0, "rgba(255,255,255,0.09)");
        panelBg.addColorStop(0.35, "rgba(255,255,255,0.045)");
        panelBg.addColorStop(1, "rgba(255,255,255,0.02)");
        roundRectPath(ctx, px, panelY, panelW, panelH, 20);
        ctx.fillStyle = panelBg;
        ctx.fill();

        // subtle accent wash at top of panel
        const topWash = ctx.createLinearGradient(px, panelY, px, panelY + 140);
        topWash.addColorStop(0, `${accent}22`);
        topWash.addColorStop(1, `${accent}00`);
        ctx.save();
        roundRectPath(ctx, px, panelY, panelW, panelH, 20);
        ctx.clip();
        ctx.fillStyle = topWash;
        ctx.fillRect(px, panelY, panelW, 140);
        ctx.restore();

        // crisp premium border (double line: bright accent outer, soft inner glow)
        roundRectPath(ctx, px, panelY, panelW, panelH, 20);
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2;
        ctx.stroke();
        roundRectPath(ctx, px + 4, panelY + 4, panelW - 8, panelH - 8, 16);
        ctx.strokeStyle = "rgba(255,255,255,0.14)";
        ctx.lineWidth = 1;
        ctx.stroke();

        // top hairline shine
        ctx.save();
        roundRectPath(ctx, px, panelY, panelW, panelH, 20);
        ctx.clip();
        ctx.strokeStyle = "rgba(255,255,255,0.35)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px + 20, panelY + 1.5);
        ctx.lineTo(px + panelW - 20, panelY + 1.5);
        ctx.stroke();
        ctx.restore();

        // role pill
        const pillText = String(p.label || "").toUpperCase();
        ctx.font = `bold 13px ${MONO}`;
        const pillW = Math.max(130, ctx.measureText(pillText).width + 44);
        const pillX = px + panelW / 2 - pillW / 2;
        const pillY = panelY + 24;
        roundRectPath(ctx, pillX, pillY, pillW, 30, 15);
        ctx.fillStyle = `${accent}33`;
        ctx.fill();
        roundRectPath(ctx, pillX, pillY, pillW, 30, 15);
        ctx.strokeStyle = accent;
        ctx.lineWidth = 1.25;
        ctx.stroke();
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.fillText(pillText, px + panelW / 2, pillY + 20);

        // circular profile photo (foto profil dari config, fallback inisial)
        const r = 78;
        const cx = px + panelW / 2, cy = pillY + 30 + 22 + r;
        ctx.save();
        ctx.shadowColor = `${accent}88`;
        ctx.shadowBlur = 18;
        ctx.beginPath(); ctx.arc(cx, cy, r + 7, 0, Math.PI * 2); ctx.closePath();
        ctx.fillStyle = "#0a0f0d"; ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = accent; ctx.lineWidth = 4; ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.closePath(); ctx.clip();

        let img = null;
        if (p.photo) {
            try {
                const buf = await fetchImageBuffer(p.photo);
                if (buf) img = await loadImage(buf);
            } catch (_) { img = null; }
        }
        if (img) {
            const scale = Math.max((r * 2) / img.width, (r * 2) / img.height);
            const iw = img.width * scale, ih = img.height * scale;
            ctx.drawImage(img, cx - iw / 2, cy - ih / 2, iw, ih);
        } else {
            ctx.fillStyle = "#1c2333"; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
            ctx.fillStyle = accent;
            ctx.font = `bold 56px "DejaVu Sans", sans-serif`;
            ctx.textAlign = "center";
            ctx.fillText(String(p.name || "?").charAt(0).toUpperCase(), cx, cy + 20);
        }
        ctx.restore();

        // nama
        let y = cy + r + 42;
        ctx.textAlign = "center";
        ctx.fillStyle = "#ffffff";
        ctx.font = `bold 23px "DejaVu Sans", sans-serif`;
        ctx.fillText(String(p.name || "").slice(0, 24), px + panelW / 2, y);

        // garis pemisah premium (gradient accent, bukan flat pudar)
        y += 20;
        const sep = ctx.createLinearGradient(px + 40, 0, px + panelW - 40, 0);
        sep.addColorStop(0, `${accent}00`);
        sep.addColorStop(0.5, accent);
        sep.addColorStop(1, `${accent}00`);
        ctx.fillStyle = sep;
        ctx.fillRect(px + 40, y, panelW - 80, 1.5);

        // bio (wrap otomatis dari config) — dipertegas, tidak burem lagi
        y += 28;
        ctx.font = `13px "DejaVu Sans", sans-serif`;
        ctx.fillStyle = "rgba(255,255,255,0.92)";
        const bioLines = wrapTextLines(ctx, p.bio || "", panelW - 64, 4);
        for (const line of bioLines) {
            ctx.fillText(line, px + panelW / 2, y);
            y += 19;
        }

        // footer tag ID
        ctx.font = `bold 11px ${MONO}`;
        ctx.fillStyle = accent;
        ctx.fillText(`ID • 0${i + 1}`, px + panelW / 2, panelY + panelH - 22);
        ctx.textAlign = "left";
    }

    // ─── Bottom bar ─────────────────────────────────────────────────────────
    ctx.textAlign = "left";
    ctx.font = `12px ${MONO}`;
    ctx.fillStyle = "rgba(255,255,255,0.30)";
    ctx.fillText(`${data.timeLabel || new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}`, pad + 24, height - pad - 14);

    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(217,180,93,0.5)";
    ctx.fillText(`${data.botName || "BUILD CLOUD"} • v${data.botVersion || "3.0.0"}`, width - pad - 24, height - pad - 14);
    ctx.textAlign = "left";

    return canvas.toBuffer("image/jpeg", { quality: 0.95 });
}

// ═══════════════════════════════════════════════════════════════════════════
// KARTU 5: TQTO DETAIL CARD
// ═══════════════════════════════════════════════════════════════════════════
async function generateTqtoDetailCard(data = {}) {
    const width = 800, height = 520;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    const accent = data.accentColor || "#5fd7ff";

    // ─── Background ──────────────────────────────────────────────────────────
    const bg = ctx.createLinearGradient(0, 0, width, height);
    bg.addColorStop(0, "#070b18");
    bg.addColorStop(0.50, "#0f1422");
    bg.addColorStop(1, "#1a1628");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // glow
    const glow = ctx.createRadialGradient(400, 120, 10, 400, 120, 400);
    glow.addColorStop(0, `rgba(217,180,93,0.08)`);
    glow.addColorStop(1, "rgba(217,180,93,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    // ─── Terminal Window ─────────────────────────────────────────────────────
    const pad = 18;
    const winX = pad, winY = pad, winW = width - pad * 2, winH = height - pad * 2;
    const barH = 40;

    ctx.fillStyle = "#0a0f0d";
    roundRectPath(ctx, winX, winY, winW, winH, 14);
    ctx.fill();

    ctx.strokeStyle = `rgba(217,180,93,0.45)`;
    ctx.lineWidth = 1.5;
    roundRectPath(ctx, winX, winY, winW, winH, 14);
    ctx.stroke();

    // chrome bar
    ctx.save();
    roundRectPath(ctx, winX, winY, winW, barH, 14);
    ctx.clip();
    ctx.fillStyle = "#151a1a";
    ctx.fillRect(winX, winY, winW, barH);
    ctx.restore();
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.beginPath();
    ctx.moveTo(winX, winY + barH);
    ctx.lineTo(winX + winW, winY + barH);
    ctx.stroke();

    // dot
    const dotY = winY + barH / 2;
    ["#ff5f56", "#ffb454", "#39ff88"].forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(winX + 24 + i * 20, dotY, 5, 0, Math.PI * 2);
        ctx.fill();
    });

    ctx.fillStyle = "rgba(255,255,255,0.40)";
    ctx.font = `12px "DejaVu Sans Mono", monospace`;
    ctx.textAlign = "center";
    ctx.fillText("tqto --detail", winX + winW / 2, dotY + 3);

    // grid
    ctx.save();
    ctx.beginPath();
    roundRectPath(ctx, winX, winY + barH, winW, winH - barH, 14);
    ctx.clip();
    drawGrid(ctx, width, height);
    ctx.restore();

    const contentX = winX + 30;
    let y = winY + barH + 32;
    ctx.textAlign = "left";

    // ─── Title ───────────────────────────────────────────────────────────────
    ctx.font = `24px "DejaVu Sans", sans-serif`;
    ctx.fillStyle = accent;
    ctx.fillText(data.title || "TQTO", contentX, y);
    y += 34;

    ctx.font = `13px "DejaVu Sans Mono", monospace`;
    ctx.fillStyle = "rgba(255,255,255,0.20)";
    ctx.fillText("━━━━━━━━━━━━━━━━━━━━━━", contentX, y);
    y += 26;

    // ─── Name ────────────────────────────────────────────────────────────────
    ctx.font = `bold 32px "DejaVu Sans", sans-serif`;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(data.name || "—", contentX, y);
    y += 34;

    // ─── Role ────────────────────────────────────────────────────────────────
    ctx.font = `18px "DejaVu Sans", sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fillText(`📌  ${data.role || "—"}`, contentX, y);
    y += 30;

    // ─── Project ─────────────────────────────────────────────────────────────
    ctx.font = `14px "DejaVu Sans Mono", monospace`;
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.fillText(`📦  ${data.botName || "BUILD CLOUD"}`, contentX, y);
    y += 30;

    // ─── Description ────────────────────────────────────────────────────────
    ctx.font = `15px "DejaVu Sans", sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.40)";
    ctx.fillText(`"${data.desc || "—"}"`, contentX, y);

    // ─── Bottom ──────────────────────────────────────────────────────────────
    const bottomY = winY + winH - 18;
    ctx.fillStyle = "rgba(217,180,93,0.06)";
    roundRectPath(ctx, contentX - 8, bottomY - 22, winW - 60, 20, 6);
    ctx.fill();

    ctx.font = `10px "DejaVu Sans Mono", monospace`;
    ctx.fillStyle = "rgba(255,255,255,0.20)";
    ctx.textAlign = "left";
    ctx.fillText(`v${data.botVersion || "3.0.0"}`, contentX, bottomY - 4);

    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(217,180,93,0.25)";
    ctx.fillText(data.timeLabel || "", contentX + winW - 68, bottomY - 4);
    ctx.textAlign = "left";

    return canvas.toBuffer("image/jpeg", { quality: 0.95 });
}

// ─── UPDATE EXPORT ─────────────────────────────────────────────────────────────
Object.assign(globalThis, {
  generateUserLogCard,
  generateQueueCard,
  generateStatusCard,
  generateBuildResultCard,
  generateTqtoCard,
  generateTqtoDetailCard,
});

module.exports = {
  generateUserLogCard,
  generateQueueCard,
  generateStatusCard,
  generateBuildResultCard,
  generateTqtoCard,
  generateTqtoDetailCard,
};