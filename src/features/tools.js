// src/features/tools.js
// Auto-split from the original index.js. Logic preserved.

async function handleToolsMenu(chatId, userId, msgId) {
  const job = getUserJob(userId);
  if (!job || !job.extractedFolderPath) return;

  const libPath = path.join(job.extractedFolderPath, "lib");
  if (!fs.existsSync(libPath)) {
    await edit(chatId, msgId, `⚠️ **Folder \`lib\` tidak ditemukan!**\n\nPastikan project Flutter valid.`, [[{ text: "⬅️ Kembali", data: "extracted_menu" }]]);
    return;
  }

  setUserJob(userId, { ...job, status: "tools_menu", currentPath: libPath, selectedItems: [], updatedAt: Date.now() });

  await renderToolsLib(chatId, userId, msgId, libPath);
}

async function renderToolsLib(chatId, userId, msgId, dirPath) {
  const job = getUserJob(userId);
  if (!job) return;

  const items = fs.readdirSync(dirPath).filter(name => name !== ".backup" && name !== ".git" && name !== "node_modules");
  items.sort((a, b) => {
    const statA = fs.statSync(path.join(dirPath, a));
    const statB = fs.statSync(path.join(dirPath, b));
    if (statA.isDirectory() && !statB.isDirectory()) return -1;
    if (!statA.isDirectory() && statB.isDirectory()) return 1;
    return a.localeCompare(b);
  });

  const pathMap = {};
  const buttons = [];
  items.forEach((name, i) => {
    const full = path.join(dirPath, name);
    const relative = path.relative(job.extractedFolderPath, full);
    const stat = fs.statSync(full);
    const isDir = stat.isDirectory();
    const icon = assetIconFor(name, isDir);
    const data = isDir ? `tl_cd_${i}` : `tl_file_${i}`;
    pathMap[i] = { full, relative, isDir };
    buttons.push([{ text: `${icon} ${name}`, data }]);
  });

  const actionRow = [
    { text: "📄 Buat File Dart", data: "tl_create_file" },
    { text: "📁 Buat Folder", data: "tl_create_folder" },
  ];
  const cloneRow = [
    { text: "📋 Clone File", data: "tl_clone_file" },
    { text: "📂 Clone Folder", data: "tl_clone_folder" },
    { text: "📦 Clone Semua File", data: "tl_clone_all" },
  ];
  const aiToolsRow = [{ text: "🤖 AI Tools", data: "ai_tools_menu" }];
  const backRow = [{ text: "⬅️ Kembali", data: "extracted_menu" }];

  buttons.push(actionRow);
  buttons.push(cloneRow);
  buttons.push(aiToolsRow);
  buttons.push(backRow);
  buttons.push([{ text: "❌ Batalkan", data: "cancel" }]);

  setUserJob(userId, { ...job, pathMap, currentPath: dirPath });

  const displayPath = path.relative(job.extractedFolderPath, dirPath) || "lib";
  const text =
    `🛠 **Add Tools — Folder lib**\n` +
    `────────────────────────────────\n\n` +
    `📂 \`${displayPath}\`\n\n` +
    `Pilih file/folder untuk aksi, atau gunakan tombol di bawah.`;

  await edit(chatId, msgId, text, buttons);
}

async function handleToolsCd(chatId, userId, msgId, idx) {
  const job = getUserJob(userId);
  if (!job || !job.pathMap) return;
  const entry = job.pathMap[idx];
  if (!entry || !entry.isDir) return;
  const newPath = entry.full;
  if (fs.existsSync(newPath) && fs.statSync(newPath).isDirectory()) {
    await renderToolsLib(chatId, userId, msgId, newPath);
  }
}

async function handleCreateFile(chatId, userId, msgId) {
  const job = getUserJob(userId);
  if (!job) return;

  setUserJob(userId, { ...job, status: "tools_create_file", updatedAt: Date.now() });

  await edit(
    chatId,
    msgId,
    `📄 **Buat File Dart**\n\n` +
    `Kirim **nama file** baru (tanpa ekstensi).\n` +
    `Contoh: \`dashboard\`\n\n` +
    `File akan dibuat di: \`${path.relative(job.extractedFolderPath, job.currentPath)}\``,
    [[{ text: "❌ Batalkan", data: "cancel" }]]
  );
}

async function handleCreateFolder(chatId, userId, msgId) {
  const job = getUserJob(userId);
  if (!job) return;

  setUserJob(userId, { ...job, status: "tools_create_folder", updatedAt: Date.now() });

  await edit(
    chatId,
    msgId,
    `📁 **Buat Folder**\n\n` +
    `Kirim **nama folder** baru.\n` +
    `Contoh: \`models\`\n\n` +
    `Folder akan dibuat di: \`${path.relative(job.extractedFolderPath, job.currentPath)}\``,
    [[{ text: "❌ Batalkan", data: "cancel" }]]
  );
}

async function handleToolsCreateText(event) {
  const chatId = event.chatId;
  const userId = Number(event.message.senderId);
  const text = event.message.text?.trim();
  const job = getUserJob(userId);
  if (!job) return false;

  if (job.status === "tools_create_file") {
    if (!text || !/^[a-zA-Z0-9_\-]+$/.test(text)) {
      await send(chatId, `❌ **Nama file tidak valid!**\n\nGunakan huruf, angka, underscore, atau dash. Contoh: \`dashboard\``);
      return true;
    }
    const fileName = `${text}.dart`;
    const targetDir = job.currentPath || path.join(job.extractedFolderPath, "lib");
    const targetFile = path.join(targetDir, fileName);
    if (fs.existsSync(targetFile)) {
      await send(chatId, `⚠️ **File \`${fileName}\` sudah ada!**`);
      return true;
    }
    const content = `// File: ${fileName}\n// Created by ${CONFIG.BOT_NAME}\n\nclass ${text} {\n  // TODO: Implement\n}\n`;
    fs.writeFileSync(targetFile, content);
    setUserJob(userId, { ...job, status: "tools_menu", updatedAt: Date.now() });
    await send(chatId, `✅ **File \`${fileName}\` berhasil dibuat!**`);
    const msg = await send(chatId, `🔄 Kembali ke menu...`);
    await renderToolsLib(chatId, userId, msg.id, job.currentPath);
    return true;
  }

  if (job.status === "tools_create_folder") {
    if (!text || !/^[a-zA-Z0-9_\-]+$/.test(text)) {
      await send(chatId, `❌ **Nama folder tidak valid!**\n\nGunakan huruf, angka, underscore, atau dash. Contoh: \`models\``);
      return true;
    }
    const targetDir = job.currentPath || path.join(job.extractedFolderPath, "lib");
    const newFolder = path.join(targetDir, text);
    if (fs.existsSync(newFolder)) {
      await send(chatId, `⚠️ **Folder \`${text}\` sudah ada!**`);
      return true;
    }
    fs.mkdirSync(newFolder, { recursive: true });
    setUserJob(userId, { ...job, status: "tools_menu", updatedAt: Date.now() });
    await send(chatId, `✅ **Folder \`${text}\` berhasil dibuat!**`);
    const msg = await send(chatId, `🔄 Kembali ke menu...`);
    await renderToolsLib(chatId, userId, msg.id, job.currentPath);
    return true;
  }
  return false;
}

async function handleCloneFile(chatId, userId, msgId) {
  const job = getUserJob(userId);
  if (!job) return;
  setUserJob(userId, { ...job, status: "tools_clone_source", cloneType: "file", updatedAt: Date.now() });
  await showCloneSourcePicker(chatId, userId, msgId);
}

async function handleCloneFolder(chatId, userId, msgId) {
  const job = getUserJob(userId);
  if (!job) return;
  setUserJob(userId, { ...job, status: "tools_clone_source", cloneType: "folder", updatedAt: Date.now() });
  await showCloneSourcePicker(chatId, userId, msgId);
}

async function handleCloneAll(chatId, userId, msgId) {
  const job = getUserJob(userId);
  if (!job) return;
  const libPath = path.join(job.extractedFolderPath, "lib");
  if (!fs.existsSync(libPath)) {
    await edit(chatId, msgId, `⚠️ Folder lib tidak ditemukan.`);
    return;
  }
  const allFiles = [];
  function walk(dir, base) {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const full = path.join(dir, item);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        walk(full, path.join(base, item));
      } else {
        allFiles.push(path.join(base, item));
      }
    }
  }
  walk(libPath, "");
  if (allFiles.length === 0) {
    await edit(chatId, msgId, `⚠️ Tidak ada file di folder lib.`);
    return;
  }
  setUserJob(userId, {
    ...job,
    status: "tools_confirm",
    cloneType: "all",
    sourceItems: allFiles,
    destPath: null,
    updatedAt: Date.now()
  });

  const text =
    `📦 **Clone Semua File**\n\n` +
    `📄 **${allFiles.length} file** akan di-clone dari folder \`lib\`.\n\n` +
    `Pilih **folder tujuan** untuk menyimpan salinan.`;
  await showDestPicker(chatId, userId, msgId, text);
}

async function showCloneSourcePicker(chatId, userId, msgId, dirPath = null) {
  const job = getUserJob(userId);
  if (!job) return;
  const root = job.extractedFolderPath;
  const current = dirPath || job.currentPath || root;
  const items = fs.readdirSync(current).filter(name => name !== ".backup" && name !== ".git" && name !== "node_modules");
  items.sort((a, b) => {
    const statA = fs.statSync(path.join(current, a));
    const statB = fs.statSync(path.join(current, b));
    if (statA.isDirectory() && !statB.isDirectory()) return -1;
    if (!statA.isDirectory() && statB.isDirectory()) return 1;
    return a.localeCompare(b);
  });

  const pathMap = {};
  const buttons = [];
  items.forEach((name, i) => {
    const full = path.join(current, name);
    const relative = path.relative(root, full);
    const stat = fs.statSync(full);
    const isDir = stat.isDirectory();
    const icon = assetIconFor(name, isDir);
    const data = isDir ? `cl_src_cd_${i}` : `cl_src_file_${i}`;
    pathMap[i] = { full, relative, isDir };
    buttons.push([{ text: `${icon} ${name}`, data }]);
  });

  const parent = path.dirname(current);
  const backButton = [];
  if (parent !== current && parent.startsWith(root)) {
    backButton.push({ text: "⬅️ Kembali", data: "cl_src_back" });
  }
  backButton.push({ text: "❌ Batalkan", data: "cancel" });
  buttons.push(backButton);

  setUserJob(userId, { ...job, pathMap, currentPath: current, updatedAt: Date.now() });

  const displayPath = path.relative(root, current) || "root";
  const text =
    `📋 **Pilih Sumber Clone** (${job.cloneType === "file" ? "file .dart" : "folder"})\n` +
    `────────────────────────────────\n\n` +
    `📂 \`${displayPath}\``;

  await edit(chatId, msgId, text, buttons);
}

async function handleCloneSrcNav(event) {
  const data = event.data.toString();
  const chatId = event.chatId;
  const userId = Number(event.senderId);
  const msgId = event.messageId;
  const job = getUserJob(userId);
  if (!job) return;

  if (data === "cl_src_back") {
    const parent = path.dirname(job.currentPath);
    if (parent.startsWith(job.extractedFolderPath)) {
      await showCloneSourcePicker(chatId, userId, msgId, parent);
    }
    return;
  }

  if (data.startsWith("cl_src_cd_")) {
    const idx = data.replace("cl_src_cd_", "");
    const entry = job.pathMap[idx];
    if (entry && entry.isDir) {
      await showCloneSourcePicker(chatId, userId, msgId, entry.full);
    }
    return;
  }

  if (data.startsWith("cl_src_file_") || data.startsWith("cl_src_folder_")) {
    const idx = data.replace(/cl_src_(file|folder)_/, "");
    const entry = job.pathMap[idx];
    if (!entry) return;
    if (job.cloneType === "file" && entry.isDir) {
      await event.answer({ message: "⚠️ Pilih file .dart, bukan folder!", alert: true });
      return;
    }
    if (job.cloneType === "folder" && !entry.isDir) {
      await event.answer({ message: "⚠️ Pilih folder!", alert: true });
      return;
    }
    const sourceItems = [entry.full];
    setUserJob(userId, { ...job, status: "tools_clone_dest", sourceItems, updatedAt: Date.now() });
    const text =
      `✅ **Sumber dipilih:** \`${path.relative(job.extractedFolderPath, entry.full)}\`\n\n` +
      `Sekarang pilih **folder tujuan**.`;
    await showDestPicker(chatId, userId, msgId, text);
  }
}

async function showDestPicker(chatId, userId, msgId, customText = null, dirPath = null) {
  const job = getUserJob(userId);
  if (!job) return;
  const root = job.extractedFolderPath;
  const current = dirPath || job.currentPath || root;

  const items = fs.readdirSync(current).filter(name => name !== ".backup" && name !== ".git" && name !== "node_modules");
  items.sort();
  const buttons = [];
  const folders = [];
  for (const name of items) {
    const full = path.join(current, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      folders.push(name);
    }
  }
  folders.forEach((name, i) => {
    buttons.push([{ text: `📁 ${name}`, data: `cl_dest_cd_${i}` }]);
  });
  if (current !== root) {
    buttons.push([{ text: "✅ Pilih Folder Ini", data: "cl_dest_confirm" }]);
  }
  const parent = path.dirname(current);
  if (parent !== current && parent.startsWith(root)) {
    buttons.push([{ text: "⬅️ Kembali", data: "cl_dest_back" }]);
  }
  buttons.push([{ text: "❌ Batalkan", data: "cancel" }]);

  const pathMap = {};
  folders.forEach((name, i) => {
    pathMap[i] = { full: path.join(current, name), isDir: true };
  });
  setUserJob(userId, { ...job, pathMap, currentPath: current, updatedAt: Date.now() });

  const displayPath = path.relative(root, current) || "root";
  const text = customText || `📂 **Pilih Folder Tujuan**\n\n📂 \`${displayPath}\``;

  await edit(chatId, msgId, text, buttons);
}

async function handleCloneDestNav(event) {
  const data = event.data.toString();
  const chatId = event.chatId;
  const userId = Number(event.senderId);
  const msgId = event.messageId;
  const job = getUserJob(userId);
  if (!job) return;

  if (data === "cl_dest_back") {
    const parent = path.dirname(job.currentPath);
    if (parent.startsWith(job.extractedFolderPath)) {
      await showDestPicker(chatId, userId, msgId, null, parent);
    }
    return;
  }

  if (data.startsWith("cl_dest_cd_")) {
    const idx = data.replace("cl_dest_cd_", "");
    const entry = job.pathMap[idx];
    if (entry) {
      await showDestPicker(chatId, userId, msgId, null, entry.full);
    }
    return;
  }

  if (data === "cl_dest_confirm") {
    const destPath = job.currentPath;
    if (!destPath) return;
    setUserJob(userId, { ...job, destPath, status: "tools_confirm", updatedAt: Date.now() });
    const sourceItems = job.sourceItems;
    let totalFiles = 0;
    let totalSize = 0;
    for (const src of sourceItems) {
      const stat = fs.statSync(src);
      if (stat.isFile()) {
        totalFiles++;
        totalSize += stat.size;
      } else {
        const files = getAllFiles(src);
        totalFiles += files.length;
        for (const f of files) totalSize += fs.statSync(f).size;
      }
    }
    const sizeMB = (totalSize / 1024 / 1024).toFixed(2);

    const sourceNames = sourceItems.map(s => path.basename(s)).join(", ");
    const destName = path.relative(job.extractedFolderPath, destPath) || "root";

    const preview =
      `📋 **Preview Clone**\n` +
      `────────────────────────────────\n\n` +
      `📂 **Sumber:** \`${sourceNames}\`\n` +
      `📁 **Tujuan:** \`${destName}\`\n` +
      `📄 **Total File:** \`${totalFiles}\`\n` +
      `💾 **Ukuran:** \`${sizeMB} MB\`\n\n` +
      `⚠️ _Akan melakukan copy, tidak menghapus asli._\n\n` +
      `Konfirmasi?`;

    const buttons = [
      [{ text: "✅ Konfirmasi", data: "cl_confirm_yes" }],
      [{ text: "❌ Batal", data: "cancel" }]
    ];
    await edit(chatId, msgId, preview, buttons);
  }
}

async function handleCloneConfirm(event) {
  const data = event.data.toString();
  const chatId = event.chatId;
  const userId = Number(event.senderId);
  const msgId = event.messageId;
  const job = getUserJob(userId);
  if (!job || data !== "cl_confirm_yes") return;

  const srcItems = job.sourceItems;
  const destDir = job.destPath;
  if (!srcItems || !destDir) return;

  await edit(chatId, msgId, `⏳ **Melakukan clone...**`);

  let success = 0, failed = 0, totalFiles = 0;

  for (const src of srcItems) {
    try {
      const stat = fs.statSync(src);
      const baseName = path.basename(src);
      const destFull = path.join(destDir, baseName);
      if (stat.isDirectory()) {
        if (!fs.existsSync(destFull)) fs.mkdirSync(destFull, { recursive: true });
        const files = getAllFiles(src);
        for (const file of files) {
          const rel = path.relative(src, file);
          const target = path.join(destFull, rel);
          const targetDir = path.dirname(target);
          if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
          fs.copyFileSync(file, target);
          totalFiles++;
        }
      } else {
        if (!fs.existsSync(destFull)) {
          fs.copyFileSync(src, destFull);
          totalFiles++;
        } else {
          fs.copyFileSync(src, destFull);
          totalFiles++;
        }
      }
      success++;
    } catch (err) {
      failed++;
      console.error("Clone error:", err);
    }
  }

  setUserJob(userId, { ...job, status: "tools_menu", updatedAt: Date.now() });
  await edit(chatId, msgId, `✅ **Clone selesai!**\n\n📄 **Total File:** ${totalFiles}\n✅ **Sukses:** ${success}\n❌ **Gagal:** ${failed}`);
  const newMsg = await send(chatId, `🔄 Kembali ke menu...`);
  await renderToolsLib(chatId, userId, newMsg.id, job.currentPath);
}

function getAllFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      results = results.concat(getAllFiles(full));
    } else {
      results.push(full);
    }
  }
  return results;
}

function listDartFiles(libPath) {
  if (!fs.existsSync(libPath)) return [];
  return getAllFiles(libPath).filter((f) => f.endsWith(".dart"));
}

function findClosingParenIndex(content, fromIdx) {
  let depth = 0;
  let started = false;
  for (let i = fromIdx; i < content.length; i++) {
    const ch = content[i];
    if (ch === "(") {
      depth++;
      started = true;
    } else if (ch === ")") {
      depth--;
      if (started && depth === 0) return i;
    }
  }
  return -1;
}

async function renderAiToolsMenu(chatId, userId, msgId) {
  const job = getUserJob(userId);
  if (!job || !job.extractedFolderPath) return;

  setUserJob(userId, { ...job, status: "ai_tools_menu", updatedAt: Date.now() });

  const text =
    `🤖 **AI Tools**\n` +
    `────────────────────────────────\n\n` +
    `Pilih fitur otomatisasi project di bawah ini:\n\n` +
    AI_TOOLS_INFO.map((t) => `${t.title}\n_${t.desc}_`).join("\n\n");

  const buttons = [
    [{ text: "🎨 Theme Changer", data: "ai_theme_changer" }, { text: "🔤 Font Changer", data: "ai_font_changer" }],
    [{ text: "🖼 Icon Pack Installer", data: "ai_icon_pack" }, { text: "🌙 Dark Mode Generator", data: "ai_dark_mode" }],
    [{ text: "🤖 AI Rombak Project", data: "ai_rombak_project" }],
    [{ text: "📝 Live Code Editor", data: "ai_live_editor" }, { text: "🔧 Auto Fix Error", data: "ai_auto_fix" }],
    [{ text: "🧩 Multi Tools Injection", data: "ai_multi_inject" }],
    [{ text: "🤖 10 AI Tools Extra", data: "ai_tools_extra" }],
    [{ text: "🎨 AI Visual Copy", data: "ai_visual_copy" }],
    [{ text: "⬅️ Kembali", data: "tools_menu" }],
  ];

  await edit(chatId, msgId, text, buttons);
}

Object.assign(globalThis, { 
  handleToolsMenu, 
  renderToolsLib, 
  handleToolsCd, 
  handleCreateFile, 
  handleCreateFolder, 
  handleToolsCreateText, 
  handleCloneFile, 
  handleCloneFolder, 
  handleCloneAll, 
  showCloneSourcePicker, 
  handleCloneSrcNav, 
  showDestPicker, 
  handleCloneDestNav, 
  handleCloneConfirm, 
  getAllFiles, 
  listDartFiles, 
  findClosingParenIndex, 
  renderAiToolsMenu 
});

module.exports = { 
  handleToolsMenu, 
  renderToolsLib, 
  handleToolsCd, 
  handleCreateFile, 
  handleCreateFolder, 
  handleToolsCreateText, 
  handleCloneFile, 
  handleCloneFolder, 
  handleCloneAll, 
  showCloneSourcePicker, 
  handleCloneSrcNav, 
  showDestPicker, 
  handleCloneDestNav, 
  handleCloneConfirm, 
  getAllFiles, 
  listDartFiles, 
  findClosingParenIndex, 
  renderAiToolsMenu 
};