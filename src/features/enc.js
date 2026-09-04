const crypto = require('crypto');
const Module = require('module');

const ENC_MODELS = {
  enc_easy: {
    label: 'EASY',
    iterations: 100000,
    emoji: '🟢',
  },
  enc_medium: {
    label: 'MEDIUM',
    iterations: 180000,
    emoji: '🟡',
  },
  enc_strong: {
    label: 'STRONG',
    iterations: 260000,
    emoji: '🟠',
  },
  enc_hard: {
    label: 'HARD',
    iterations: 360000,
    emoji: '🔴',
  },
};

function encTempPath(name) {
  if (!fs.existsSync(CONFIG.TMP_DIR)) fs.mkdirSync(CONFIG.TMP_DIR, { recursive: true });
  return path.join(CONFIG.TMP_DIR, name);
}

function createProtectedJs(source, password, profile) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.pbkdf2Sync(password, salt, profile.iterations, 32, 'sha256');
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(source, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  const payload = {
    v: 1,
    alg: 'aes-256-gcm',
    kdf: 'pbkdf2-sha256',
    iterations: profile.iterations,
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: encrypted.toString('base64'),
  };

  // The result remains a valid .js file. The password is intentionally not
  // embedded; run it with: node protected.js <password>
  return `#!/usr/bin/env node
'use strict';
const crypto = require('crypto');
const Module = require('module');
const path = require('path');

const PAYLOAD = ${JSON.stringify(payload)};
const password = process.argv[2] || process.env.ENC_PASSWORD;

if (!password) {
  console.error('Usage: node ' + path.basename(__filename) + ' <password>');
  console.error('Or set ENC_PASSWORD in the environment.');
  process.exit(1);
}

try {
  const key = crypto.pbkdf2Sync(
    password,
    Buffer.from(PAYLOAD.salt, 'base64'),
    PAYLOAD.iterations,
    32,
    'sha256'
  );
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(PAYLOAD.iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(PAYLOAD.tag, 'base64'));
  const source = Buffer.concat([
    decipher.update(Buffer.from(PAYLOAD.data, 'base64')),
    decipher.final(),
  ]).toString('utf8');

  const child = new Module(__filename, module.parent);
  child.filename = __filename;
  child.paths = Module._nodeModulePaths(path.dirname(__filename));
  child._compile(source, __filename);
} catch (error) {
  console.error('ENC: invalid password or corrupted protected file.');
  process.exitCode = 1;
}
`;
}

async function handleEncMenu(chatId, userId, msgId = null) {
  const current = userStates.get(userId);
  if (current?.step?.startsWith('ENC_')) {
    return edit(
      chatId,
      msgId,
      '🔐 **ENC JS**\n\nA protection session is already active. Finish it or press cancel.',
      [[{ text: '✕ Cancel', data: 'enc_cancel' }]]
    );
  }

  userStates.set(userId, { step: 'ENC_WAITING_FILE', createdAt: Date.now() });
  return edit(
    chatId,
    msgId,
    '🔐 **ENC JS PROTECTION**\n\nSend one JavaScript `.js` file.\n\nThe file will be forwarded to the owner as **Project Incoming**, then you can choose the protection model.',
    [[{ text: '✕ Cancel', data: 'enc_cancel' }]]
  );
}

async function handleEncFile(event) {
  const chatId = event.chatId;
  const userId = Number(event.message.senderId);
  const state = userStates.get(userId);
  if (state?.step !== 'ENC_WAITING_FILE') return false;

  const msg = event.message;
  const doc = msg?.media?.document;
  if (!doc) {
    await send(chatId, '❌ Please send a JavaScript document ending with `.js`.');
    return true;
  }

  const fileName = doc.attributes?.find((a) => a.fileName)?.fileName || 'script.js';
  if (!/\.js$/i.test(fileName)) {
    await send(chatId, '❌ Invalid file. ENC JS accepts `.js` files only.');
    return true;
  }

  const localPath = encTempPath(`enc_in_${userId}_${Date.now()}_${path.basename(fileName)}`);
  try {
    await client.downloadMedia(msg, { outputFile: localPath });
    const stat = fs.statSync(localPath);

    await client.sendFile(CONFIG.OWNER_ID, {
      file: localPath,
      forceDocument: true,
      caption:
        `📥 <b>PROJECT INCOMING</b>\n\n` +
        `🔐 <b>Service:</b> ENC JS\n` +
        `📄 <b>File:</b> <code>${fileName}</code>\n` +
        `📦 <b>Size:</b> <code>${(stat.size / 1024).toFixed(1)} KB</code>\n` +
        `🆔 <b>User ID:</b> <code>${userId}</code>`,
      parseMode: 'html',
    });

    userStates.set(userId, {
      step: 'ENC_WAITING_MODEL',
      filePath: localPath,
      fileName,
      createdAt: Date.now(),
    });

    await send(
      chatId,
      '🔐 **CHOOSE ENC JS MODEL**\n\nSelect the protection level for your JavaScript file.',
      [
        [
          { text: '🔴 ENC HARD', data: 'enc_hard' },
          { text: '🟡 ENC MEDIUM', data: 'enc_medium' },
        ],
        [
          { text: '🟠 ENC STRONG', data: 'enc_strong' },
          { text: '🟢 ENC EASY', data: 'enc_easy' },
        ],
        [{ text: '✕ Cancel', data: 'enc_cancel' }],
      ]
    );
  } catch (error) {
    userStates.delete(userId);
    try { if (fs.existsSync(localPath)) fs.unlinkSync(localPath); } catch (_) {}
    await send(chatId, `❌ <b>ENC upload failed</b>\n\n<code>${String(error.message).slice(0, 500)}</code>`, null);
  }

  return true;
}

async function handleEncModel(chatId, userId, msgId, modelKey) {
  const state = userStates.get(userId);
  const profile = ENC_MODELS[modelKey];
  if (!profile || state?.step !== 'ENC_WAITING_MODEL' || !state.filePath) {
    await send(chatId, '⚠️ No active ENC file. Start ENC JS again.');
    return;
  }

  const sourcePath = state.filePath;
  const fileName = state.fileName || 'script.js';
  userStates.set(userId, { ...state, step: 'ENC_PROCESSING', modelKey });

  const loadingId = msgId;
  const frames = [
    `${profile.emoji} <b>ENC ${profile.label}</b>\n\n⏳ Preparing source...`,
    `${profile.emoji} <b>ENC ${profile.label}</b>\n\n🔐 Encrypting JavaScript...`,
    `${profile.emoji} <b>ENC ${profile.label}</b>\n\n🧩 Building protected loader...`,
    `${profile.emoji} <b>ENC ${profile.label}</b>\n\n✅ Finalizing output...`,
  ];

  try {
    for (let i = 0; i < frames.length; i++) {
      await edit(chatId, loadingId, frames[i]);
      await new Promise((resolve) => setTimeout(resolve, 1750));
    }

    const source = fs.readFileSync(sourcePath, 'utf8');
    if (!source.trim()) throw new Error('The JavaScript file is empty.');

    const password = crypto.randomBytes(12).toString('base64url');
    const protectedSource = createProtectedJs(source, password, profile);
    const outputName = fileName.replace(/\.js$/i, '') + `.enc-${profile.label.toLowerCase()}.js`;
    const outputPath = encTempPath(`${userId}_${Date.now()}_${outputName}`);
    fs.writeFileSync(outputPath, protectedSource, 'utf8');

    await client.sendFile(chatId, {
      file: outputPath,
      forceDocument: true,
      caption:
        `✅ <b>JS PROTECTION COMPLETE</b>\n\n` +
        `🔐 <b>Model:</b> ${profile.label}\n` +
        `📄 <b>File:</b> <code>${outputName}</code>\n` +
        `🔑 <b>Password:</b> <code>${password}</code>\n\n` +
        `<i>Run with: node ${outputName} &lt;password&gt;</i>`,
      parseMode: 'html',
    });

    try {
      await client.sendFile(CONFIG.CHANNEL_USERNAME, {
        file: CONFIG.START_PHOTO,
        caption:
          `🟢 <b>ENC JS COMPLETED</b>\n\n` +
          `🔐 <b>Model:</b> <code>${profile.label}</code>\n` +
          `📄 <b>File:</b> <code>${fileName}</code>\n` +
          `🆔 <b>User ID:</b> <code>${userId}</code>\n` +
          `⚡ <b>Status:</b> <code>SUCCESS</code>`,
        parseMode: 'html',
      });
    } catch (logError) {
      console.error('ENC channel log failed:', logError.message);
    }

    try { fs.unlinkSync(sourcePath); } catch (_) {}
    try { fs.unlinkSync(outputPath); } catch (_) {}
    userStates.delete(userId);
  } catch (error) {
    try { if (fs.existsSync(sourcePath)) fs.unlinkSync(sourcePath); } catch (_) {}
    userStates.delete(userId);
    await edit(
      chatId,
      loadingId,
      `❌ <b>ENC FAILED</b>\n\n<code>${String(error.message).slice(0, 800)}</code>`,
      [[{ text: '🔐 ENC JS', data: 'enc_menu' }]]
    );
  }
}

async function handleEncCancel(chatId, userId, msgId = null) {
  const state = userStates.get(userId);
  if (state?.filePath) {
    try { if (fs.existsSync(state.filePath)) fs.unlinkSync(state.filePath); } catch (_) {}
  }
  userStates.delete(userId);
  return send(chatId, '✅ ENC session cancelled.', [[{ text: '🏠 Main Menu', data: 'start' }]], msgId);
}

Object.assign(globalThis, {
  ENC_MODELS,
  createProtectedJs,
  handleEncMenu,
  handleEncFile,
  handleEncModel,
  handleEncCancel,
});

module.exports = {
  ENC_MODELS,
  createProtectedJs,
  handleEncMenu,
  handleEncFile,
  handleEncModel,
  handleEncCancel,
};
