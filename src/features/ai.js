// Auto-split from the original index.js. Logic preserved.

async function handleAiThemeChanger(chatId, userId, msgId) {
  const job = getUserJob(userId);
  if (!job) return;
  await sendActionNotification(userId, 'AI Theme Changer');
  setUserJob(userId, { ...job, status: "ai_waiting_theme_color", updatedAt: Date.now() });
  await edit(
    chatId,
    msgId,
    `🎨 **Theme Changer**\n` +
      `────────────────────────────────\n\n` +
      `Kirim **kode warna HEX** untuk warna utama aplikasi.\n` +
      `Contoh: \`#6750A4\` atau \`6750A4\`\n\n` +
      `Bot akan mencari & mengganti \`primaryColor\`, \`seedColor\`, dan \`primarySwatch\` di seluruh file \`.dart\` pada folder \`lib\`.`,
    [[{ text: "❌ Batalkan", data: "cancel" }]]
  );
}

function applyThemeColor(libPath, hex) {
  const files = listDartFiles(libPath);
  let changedFiles = 0;
  const colorLiteral = `Color(0xFF${hex})`;

  for (const file of files) {
    let content = fs.readFileSync(file, "utf-8");
    const original = content;

    content = content.replace(/primaryColor:\s*Color\(0x[0-9A-Fa-f]{8}\)/g, `primaryColor: ${colorLiteral}`);
    content = content.replace(/seedColor:\s*Color\(0x[0-9A-Fa-f]{8}\)/g, `seedColor: ${colorLiteral}`);
    content = content.replace(/primarySwatch:\s*Colors\.\w+/g, `primaryColor: ${colorLiteral}`);

    if (content !== original) {
      fs.writeFileSync(file, content, "utf-8");
      changedFiles++;
    }
  }
  return changedFiles;
}

async function handleAiFontChanger(chatId, userId, msgId) {
  const job = getUserJob(userId);
  if (!job) return;
  await sendActionNotification(userId, 'AI Font Changer');
  setUserJob(userId, { ...job, status: "ai_waiting_font_name", updatedAt: Date.now() });
  await edit(
    chatId,
    msgId,
    `🔤 **Font Changer**\n` +
      `────────────────────────────────\n\n` +
      `Kirim **nama font** (disarankan nama Google Font, contoh: \`Poppins\`, \`Montserrat\`, \`Inter\`).\n\n` +
      `Bot akan:\n` +
      `• Menambahkan dependency \`google_fonts\` ke \`pubspec.yaml\`\n` +
      `• Mengatur \`fontFamily\` di \`ThemeData\` pada file \`.dart\``,
    [[{ text: "❌ Batalkan", data: "cancel" }]]
  );
}

function applyFontChange(extractedFolderPath, fontName) {
  const result = { pubspecUpdated: false, dartFilesUpdated: 0 };

  const pubspecPath = path.join(extractedFolderPath, "pubspec.yaml");
  if (fs.existsSync(pubspecPath)) {
    let pubspec = fs.readFileSync(pubspecPath, "utf-8");
    if (!/google_fonts\s*:/.test(pubspec) && /dependencies:\s*\n/.test(pubspec)) {
      pubspec = pubspec.replace(/dependencies:\s*\n/, (m) => `${m}  google_fonts: ^6.2.1\n`);
      fs.writeFileSync(pubspecPath, pubspec, "utf-8");
      result.pubspecUpdated = true;
    }
  }

  const libPath = path.join(extractedFolderPath, "lib");
  const files = listDartFiles(libPath);
  for (const file of files) {
    let content = fs.readFileSync(file, "utf-8");
    const original = content;

    if (/fontFamily:\s*['"][^'"]*['"]/.test(content)) {
      content = content.replace(/fontFamily:\s*['"][^'"]*['"]/g, `fontFamily: '${fontName}'`);
    } else if (/ThemeData\(/.test(content)) {
      content = content.replace(/ThemeData\(/, `ThemeData(\n    fontFamily: '${fontName}',`);
    }

    if (content !== original) {
      fs.writeFileSync(file, content, "utf-8");
      result.dartFilesUpdated++;
    }
  }
  return result;
}

async function handleAiIconPack(chatId, userId, msgId) {
  const job = getUserJob(userId);
  if (!job) return;
  await sendActionNotification(userId, 'AI Icon Pack Installer');
  const text = `🖼 **Icon Pack Installer**\n` + `────────────────────────────────\n\n` + `Pilih satu set icon untuk diterapkan ke project:`;
  const buttons = [
    [{ text: "Material (bawaan)", data: "ai_icon_set_material" }],
    [{ text: "Cupertino (bawaan)", data: "ai_icon_set_cupertino" }],
    [{ text: "Font Awesome", data: "ai_icon_set_fontawesome" }],
    [{ text: "Feather Icons", data: "ai_icon_set_feather" }],
    [{ text: "⬅️ Kembali", data: "ai_tools_menu" }],
  ];
  await edit(chatId, msgId, text, buttons);
}

async function handleAiIconPackSelect(chatId, userId, msgId, packKey) {
  const job = getUserJob(userId);
  if (!job) return;
  const pack = ICON_PACKS[packKey];
  if (!pack) return;

  let depAdded = false;
  if (pack.dep) {
    const pubspecPath = path.join(job.extractedFolderPath, "pubspec.yaml");
    if (fs.existsSync(pubspecPath)) {
      let pubspec = fs.readFileSync(pubspecPath, "utf-8");
      const depName = pack.dep.split(":")[0].trim();
      if (!new RegExp(`${depName}\\s*:`).test(pubspec) && /dependencies:\s*\n/.test(pubspec)) {
        pubspec = pubspec.replace(/dependencies:\s*\n/, (m) => `${m}  ${pack.dep}\n`);
        fs.writeFileSync(pubspecPath, pubspec, "utf-8");
        depAdded = true;
      }
    }
  }

  setUserJob(userId, { ...job, status: "ai_tools_menu", updatedAt: Date.now() });

  const depName = pack.dep ? pack.dep.split(":")[0].trim() : null;
  await edit(
    chatId,
    msgId,
    `✅ **Icon Pack Installer selesai!**\n\n` +
      `🖼 Pack dipilih: \`${pack.label}\`\n` +
      (pack.dep
        ? `📦 \`pubspec.yaml\`: ${depAdded ? "✅ dependency ditambahkan" : "ℹ️ sudah ada"}\n\n` +
          `⚠️ _Import \`package:${depName}/${depName}.dart\` lalu ganti pemanggilan \`Icon(Icons.xxx)\` sesuai nama icon di pack ini. Gunakan **AI Rombak Project** untuk bantuan lebih lanjut._`
        : `ℹ️ Icon set ini sudah bawaan Flutter, tidak perlu dependency tambahan.`),
    [[{ text: "⬅️ Kembali ke AI Tools", data: "ai_tools_menu" }]]
  );
}

async function handleAiDarkMode(chatId, userId, msgId) {
  const job = getUserJob(userId);
  if (!job) return;
  await sendActionNotification(userId, 'AI Dark Mode Generator');

  const mainDartPath = path.join(job.extractedFolderPath, "lib", "main.dart");
  if (!fs.existsSync(mainDartPath)) {
    await edit(chatId, msgId, `⚠️ **\`lib/main.dart\` tidak ditemukan!**`, [[{ text: "⬅️ Kembali", data: "ai_tools_menu" }]]);
    return;
  }

  const content = fs.readFileSync(mainDartPath, "utf-8");

  if (/darkTheme\s*:/.test(content)) {
    await edit(
      chatId,
      msgId,
      `ℹ️ **Dark Mode sudah ada!**\n\n\`main.dart\` sudah memiliki properti \`darkTheme\`. Tidak ada perubahan dilakukan.`,
      [[{ text: "⬅️ Kembali", data: "ai_tools_menu" }]]
    );
    return;
  }

  const themeIdx = content.indexOf("theme:");
  if (themeIdx === -1) {
    await edit(
      chatId,
      msgId,
      `⚠️ **Properti \`theme:\` tidak ditemukan di \`MaterialApp\`!**\n\nGunakan Live Code Editor untuk menambahkan dark mode secara manual.`,
      [[{ text: "⬅️ Kembali", data: "ai_tools_menu" }]]
    );
    return;
  }

  const parenIdx = content.indexOf("(", themeIdx);
  const closeIdx = findClosingParenIndex(content, parenIdx);
  if (closeIdx === -1) {
    await edit(chatId, msgId, `⚠️ **Gagal mem-parsing struktur \`theme:\`.**`, [[{ text: "⬅️ Kembali", data: "ai_tools_menu" }]]);
    return;
  }

  const insertText = `,\n      darkTheme: ThemeData.dark(useMaterial3: true),\n      themeMode: ThemeMode.system`;
  const newContent = content.slice(0, closeIdx + 1) + insertText + content.slice(closeIdx + 1);
  fs.writeFileSync(mainDartPath, newContent, "utf-8");

  setUserJob(userId, { ...job, status: "ai_tools_menu", updatedAt: Date.now() });

  await edit(
    chatId,
    msgId,
    `✅ **Dark Mode Generator selesai!**\n\n` +
      `🌙 \`darkTheme\` & \`themeMode: ThemeMode.system\` ditambahkan ke \`lib/main.dart\`.\n\n` +
      `ℹ️ _App sekarang otomatis ikut tema sistem (terang/gelap)._`,
    [[{ text: "⬅️ Kembali ke AI Tools", data: "ai_tools_menu" }]]
  );
}

async function handleAiRombakProject(chatId, userId, msgId) {
  const job = getUserJob(userId);
  if (!job) return;
  setUserJob(userId, { ...job, status: "ai_waiting_rombak_instruction", updatedAt: Date.now() });
  await edit(
    chatId,
    msgId,
    `🤖 **AI Rombak Project**\n` +
      `────────────────────────────────\n\n` +
      `Kirim instruksi perubahan yang kamu mau, boleh beberapa sekaligus.\n\n` +
      `**Contoh:**\n` +
      `\`Buat tema dark, tambah login Google, tambah bottom navigation\`\n\n` +
      `🧠 AI akan menganalisis struktur project lalu menyusun **rencana perubahan** (penerapan otomatis ke file menyusul di update berikutnya).`,
    [[{ text: "❌ Batalkan", data: "cancel" }]]
  );
}

async function renderLiveEditorBrowser(chatId, userId, msgId, dirPath = null) {
  const job = getUserJob(userId);
  if (!job) return;
  const root = job.extractedFolderPath;
  const current = dirPath || root;

  const items = fs
    .readdirSync(current)
    .filter((name) => name !== ".backup" && name !== ".git" && name !== "node_modules" && name !== "build" && name !== ".dart_tool");
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
    const stat = fs.statSync(full);
    const isDir = stat.isDirectory();
    const ext = (name.split(".").pop() || "").toLowerCase();
    if (!isDir && !LIVE_EDIT_EXTENSIONS.has(ext)) return;
    const icon = isDir ? "📁" : "📄";
    const data = isDir ? `le_cd_${i}` : `le_file_${i}`;
    pathMap[i] = { full, isDir };
    buttons.push([{ text: `${icon} ${name}`, data }]);
  });

  const parent = path.dirname(current);
  const navRow = [];
  if (current !== root) {
    navRow.push({ text: "⬅️ Naik", data: "le_up" });
  }
  navRow.push({ text: "🏠 AI Tools", data: "ai_tools_menu" });
  buttons.push(navRow);

  setUserJob(userId, { ...job, status: "ai_live_editor_browse", pathMap, currentPath: current, updatedAt: Date.now() });

  const displayPath = path.relative(root, current) || "root";
  const text =
    `📝 **Live Code Editor**\n` +
    `────────────────────────────────\n\n` +
    `📂 \`${displayPath}\`\n\n` +
    `Mendukung: \`.js\` \`.dart\` \`.xml\` \`.json\` \`.java\`\n` +
    `Pilih file untuk diedit.`;

  await edit(chatId, msgId, text, buttons);
}

async function handleLiveEditorFileSelect(chatId, userId, msgId, idx) {
  const job = getUserJob(userId);
  if (!job || !job.pathMap) return;
  const entry = job.pathMap[idx];
  if (!entry || entry.isDir) return;

  let content;
  try {
    content = fs.readFileSync(entry.full, "utf-8");
  } catch (err) {
    await edit(chatId, msgId, `❌ Gagal membaca file: \`${err.message}\``, [[{ text: "⬅️ Kembali", data: "ai_tools_menu" }]]);
    return;
  }

  setUserJob(userId, { ...job, status: "ai_live_editor_waiting_content", liveEditTarget: entry.full, updatedAt: Date.now() });

  const relName = path.relative(job.extractedFolderPath, entry.full);
  const preview = content.length > 3000 ? content.slice(0, 3000) + "\n... (terpotong, tetap akan tertimpa penuh)" : content;

  await edit(
    chatId,
    msgId,
    `📝 **Edit: \`${relName}\`**\n` +
      `────────────────────────────────\n` +
      `\`\`\`\n${preview}\n\`\`\`\n\n` +
      `✏️ Kirim **isi file baru** secara lengkap sebagai pesan teks untuk menimpa file ini.`,
    [[{ text: "❌ Batalkan", data: "cancel" }]]
  );
}

async function handleLiveEditorNav(event) {
  const data = event.data.toString();
  const chatId = event.chatId;
  const userId = Number(event.senderId);
  const msgId = event.messageId;
  const job = getUserJob(userId);
  if (!job) return;

  if (data === "le_up") {
    const parent = path.dirname(job.currentPath);
    if (parent === job.extractedFolderPath || parent.startsWith(job.extractedFolderPath)) {
      await renderLiveEditorBrowser(chatId, userId, msgId, parent);
    }
    return;
  }

  if (data.startsWith("le_cd_")) {
    const idx = data.replace("le_cd_", "");
    const entry = job.pathMap[idx];
    if (entry && entry.isDir) {
      await renderLiveEditorBrowser(chatId, userId, msgId, entry.full);
    }
    return;
  }

  if (data.startsWith("le_file_")) {
    const idx = data.replace("le_file_", "");
    await handleLiveEditorFileSelect(chatId, userId, msgId, idx);
    return;
  }
}

async function handleAiAutoFix(chatId, userId, msgId) {
  const job = getUserJob(userId);
  if (!job) return;
  await sendActionNotification(userId, 'AI Auto Fix Error');
  setUserJob(userId, { ...job, status: "ai_waiting_error_log", updatedAt: Date.now() });
  await edit(
    chatId,
    msgId,
    `🔧 **Auto Fix Error**\n` +
      `────────────────────────────────\n\n` +
      `Tempel/kirim **log error build** kamu (boleh potongan, fokus ke bagian error).\n\n` +
      `🧠 AI akan menganalisis log dan memberi saran perbaikan.`,
    [[{ text: "❌ Batalkan", data: "cancel" }]]
  );
}

async function renderMultiInjectMenu(chatId, userId, msgId) {
  const job = getUserJob(userId);
  if (!job) return;
  const selected = new Set(job.multiSelected || []);
  setUserJob(userId, { ...job, status: "ai_multi_inject", multiSelected: [...selected], updatedAt: Date.now() });

  const buttons = Object.entries(MULTI_INJECT_TOOLS).map(([key, tool]) => {
    const prefix = selected.has(key) ? "✅ " : "⬜ ";
    return [{ text: `${prefix}${tool.label}`, data: `mi_toggle_${key}` }];
  });
  buttons.push([{ text: "🚀 Terapkan Semua yang Dipilih", data: "mi_apply" }]);
  buttons.push([{ text: "⬅️ Kembali", data: "ai_tools_menu" }]);

  const text =
    `🧩 **Multi Tools Injection**\n` +
    `────────────────────────────────\n\n` +
    `Pilih beberapa tools sekaligus (dijalankan dengan setelan default), lalu klik **Terapkan**.`;

  await edit(chatId, msgId, text, buttons);
}

async function handleMultiInjectToggle(chatId, userId, msgId, key) {
  const job = getUserJob(userId);
  if (!job || !MULTI_INJECT_TOOLS[key]) return;
  const selected = new Set(job.multiSelected || []);
  if (selected.has(key)) selected.delete(key);
  else selected.add(key);
  setUserJob(userId, { ...job, multiSelected: [...selected], updatedAt: Date.now() });
  await renderMultiInjectMenu(chatId, userId, msgId);
}

async function handleMultiInjectApply(chatId, userId, msgId) {
  const job = getUserJob(userId);
  if (!job) return;
  const selected = job.multiSelected || [];

  if (selected.length === 0) {
    await edit(chatId, msgId, `⚠️ **Belum ada tools yang dipilih!**\n\nCentang minimal 1 tools terlebih dahulu.`, [
      ...Object.entries(MULTI_INJECT_TOOLS).map(([key, tool]) => [{ text: `⬜ ${tool.label}`, data: `mi_toggle_${key}` }]),
      [{ text: "🚀 Terapkan Semua yang Dipilih", data: "mi_apply" }],
      [{ text: "⬅️ Kembali", data: "ai_tools_menu" }],
    ]);
    return;
  }

  await edit(chatId, msgId, `⏳ **Menjalankan ${selected.length} tools...**`);

  const results = [];
  for (const key of selected) {
    const tool = MULTI_INJECT_TOOLS[key];
    try {
      const res = await tool.run(job);
      results.push(`${tool.label}\n${res}`);
    } catch (err) {
      results.push(`${tool.label}\n❌ Error: ${err.message}`);
    }
  }

  setUserJob(userId, { ...job, status: "ai_tools_menu", multiSelected: [], updatedAt: Date.now() });

  await edit(
    chatId,
    msgId,
    `✅ **Multi Tools Injection selesai!**\n` + `────────────────────────────────\n\n` + results.join("\n\n"),
    [[{ text: "⬅️ Kembali ke AI Tools", data: "ai_tools_menu" }]]
  );
}

async function handleAiToolsText(event) {
  const chatId = event.chatId;
  const userId = Number(event.message.senderId);
  const text = event.message.text?.trim();
  const job = getUserJob(userId);
  if (!job) return false;

  // ── Theme Changer ──
  if (job.status === "ai_waiting_theme_color") {
    const hexRaw = (text || "").replace("#", "").trim();
    if (!/^[0-9A-Fa-f]{6}$/.test(hexRaw)) {
      await send(chatId, `❌ **Format warna tidak valid!**\n\nKirim kode HEX 6 digit, contoh: \`#6750A4\``);
      return true;
    }
    const hex = hexRaw.toUpperCase();
    const libPath = path.join(job.extractedFolderPath, "lib");
    const changed = applyThemeColor(libPath, hex);
    setUserJob(userId, { ...job, status: "ai_tools_menu", updatedAt: Date.now() });
    await send(
      chatId,
      `✅ **Theme Changer selesai!**\n\n` +
        `🎨 Warna baru: \`#${hex}\`\n` +
        `📄 File diubah: \`${changed}\`` +
        (changed === 0 ? `\n\nℹ️ _Tidak ditemukan properti warna yang cocok otomatis. Gunakan Live Code Editor untuk atur manual._` : ``)
    );
    const msg = await send(chatId, `🔄 Kembali ke menu...`);
    await renderAiToolsMenu(chatId, userId, msg.id);
    return true;
  }

  // ── Font Changer ──
  if (job.status === "ai_waiting_font_name") {
    if (!text || text.length > 40) {
      await send(chatId, `❌ **Nama font tidak valid!**\n\nContoh: \`Poppins\``);
      return true;
    }
    const result = applyFontChange(job.extractedFolderPath, text);
    setUserJob(userId, { ...job, status: "ai_tools_menu", updatedAt: Date.now() });
    await send(
      chatId,
      `✅ **Font Changer selesai!**\n\n` +
        `🔤 Font baru: \`${text}\`\n` +
        `📦 \`pubspec.yaml\`: ${result.pubspecUpdated ? "✅ dependency ditambahkan" : "ℹ️ sudah ada/tidak diubah"}\n` +
        `📄 File .dart diubah: \`${result.dartFilesUpdated}\`\n\n` +
        `⚠️ _Untuk hasil paling akurat, import \`package:google_fonts/google_fonts.dart\` dan gunakan \`GoogleFonts.${text.replace(/\s+/g, "")}TextTheme()\` secara manual via Live Code Editor._`
    );
    const msg = await send(chatId, `🔄 Kembali ke menu...`);
    await renderAiToolsMenu(chatId, userId, msg.id);
    return true;
  }

  // ── AI Rombak Project ──
  if (job.status === "ai_waiting_rombak_instruction") {
    if (!text) {
      await send(chatId, `❌ Instruksi tidak boleh kosong.`);
      return true;
    }
    await sendActionNotification(userId, 'AI Rombak Project', text.slice(0, 50));

    const thinkingMsg = await send(chatId, `🧠 **AI sedang menganalisis project...**\n\n⏳ Mohon tunggu sebentar.`);
    try {
      const libPath = path.join(job.extractedFolderPath, "lib");
      const dartFiles = listDartFiles(libPath).map((f) => path.relative(job.extractedFolderPath, f));

      const prompt =
        `Kamu adalah AI asisten developer Flutter. Berikut daftar file .dart pada project:\n` +
        dartFiles.slice(0, 200).join("\n") +
        `\n\nInstruksi dari user:\n"""${text}"""\n\n` +
        `Susun rencana perubahan singkat dalam Bahasa Indonesia. Untuk setiap permintaan, sebutkan file mana yang perlu dibuat/diubah dan jelaskan singkat apa yang perlu dilakukan. Jawab ringkas dalam format list bernomor, maksimal 300 kata.`;

      const aiResponse = await callGeminiAI(
        prompt,
        "Kamu adalah asisten teknis untuk pengembangan aplikasi Flutter. Jawab ringkas, praktis, dan terstruktur."
      );

      setUserJob(userId, { ...job, status: "ai_tools_menu", updatedAt: Date.now() });
      await edit(
        chatId,
        thinkingMsg.id,
        `🤖 **Rencana Perubahan dari AI**\n` +
          `────────────────────────────────\n\n` +
          `${aiResponse.slice(0, 3500)}\n\n` +
          `────────────────────────────────\n` +
          `🚧 _Penerapan otomatis ke file menyusul di update berikutnya. Untuk sekarang, terapkan rencana ini lewat **Live Code Editor**._`,
        [[{ text: "📝 Buka Live Code Editor", data: "ai_live_editor" }], [{ text: "⬅️ Kembali", data: "ai_tools_menu" }]]
      );
    } catch (err) {
      setUserJob(userId, { ...job, status: "ai_tools_menu", updatedAt: Date.now() });
      await edit(chatId, thinkingMsg.id, `❌ **Gagal memproses dengan AI**\n\n🛑 \`${err.message}\``, [
        [{ text: "⬅️ Kembali", data: "ai_tools_menu" }],
      ]);
    }
    return true;
  }

  // ── Live Code Editor: simpan konten baru ──
  if (job.status === "ai_live_editor_waiting_content") {
    if (!text) {
      await send(chatId, `❌ Isi file tidak boleh kosong.`);
      return true;
    }
    try {
      fs.writeFileSync(job.liveEditTarget, text, "utf-8");
      const relName = path.relative(job.extractedFolderPath, job.liveEditTarget);
      setUserJob(userId, { ...job, status: "ai_tools_menu", updatedAt: Date.now() });
      await send(chatId, `✅ **File \`${relName}\` berhasil disimpan!**`);
      const msg = await send(chatId, `🔄 Kembali ke menu...`);
      await renderAiToolsMenu(chatId, userId, msg.id);
    } catch (err) {
      await send(chatId, `❌ Gagal menyimpan file: \`${err.message}\``);
    }
    return true;
  }

  // ── Auto Fix Error ──
  if (job.status === "ai_waiting_error_log") {
    if (!text) {
      await send(chatId, `❌ Log error tidak boleh kosong.`);
      return true;
    }
    const thinkingMsg = await send(chatId, `🧠 **AI sedang menganalisis log error...**`);
    try {
      const prompt =
        `Berikut log error build aplikasi Flutter/Android:\n\n${text.slice(0, 6000)}\n\n` +
        `Identifikasi kemungkinan penyebab error ini dan berikan langkah perbaikan yang konkret dan praktis dalam Bahasa Indonesia, maksimal 300 kata.`;

      const aiResponse = await callGeminiAI(prompt, "Kamu adalah expert debugging Flutter, Dart, Gradle, dan Android build.");

      setUserJob(userId, { ...job, status: "ai_tools_menu", updatedAt: Date.now() });
      await edit(
        chatId,
        thinkingMsg.id,
        `🔧 **Saran Perbaikan dari AI**\n` + `────────────────────────────────\n\n` + `${aiResponse.slice(0, 3500)}`,
        [[{ text: "📝 Buka Live Code Editor", data: "ai_live_editor" }], [{ text: "⬅️ Kembali", data: "ai_tools_menu" }]]
      );
    } catch (err) {
      setUserJob(userId, { ...job, status: "ai_tools_menu", updatedAt: Date.now() });
      await edit(chatId, thinkingMsg.id, `❌ **Gagal menganalisis dengan AI**\n\n🛑 \`${err.message}\``, [
        [{ text: "⬅️ Kembali", data: "ai_tools_menu" }],
      ]);
    }
    return true;
  }

  return false;
}

async function handleCopyClone(chatId, userId, msgId) {
  const job = getUserJob(userId);
  if (!job) return;
  setUserJob(userId, { ...job, status: "copy_clone_source", selectedItems: [], updatedAt: Date.now() });
  await renderCopyCloneSource(chatId, userId, msgId);
}

async function renderCopyCloneSource(chatId, userId, msgId, dirPath = null) {
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
  const selected = new Set(job.selectedItems || []);

  items.forEach((name, i) => {
    const full = path.join(current, name);
    const relative = path.relative(root, full);
    const stat = fs.statSync(full);
    const isDir = stat.isDirectory();
    const icon = assetIconFor(name, isDir);
    const isSelected = selected.has(relative);
    const prefix = isSelected ? "✅ " : "";
    const data = `cc_src_toggle_${i}`;
    pathMap[i] = { full, relative, isDir };
    buttons.push([{ text: `${prefix}${icon} ${name}`, data }]);
  });

  const actionRow = [];
  if (selected.size > 0) {
    actionRow.push({ text: "📋 Lanjutkan Pilih Tujuan", data: "cc_src_done" });
  }
  actionRow.push({ text: "📂 Pilih Semua", data: "cc_src_select_all" });
  actionRow.push({ text: "❌ Hapus Pilihan", data: "cc_src_clear" });

  const navRow = [];
  const parent = path.dirname(current);
  if (parent !== current && parent.startsWith(root)) {
    navRow.push({ text: "⬅️ Kembali", data: "cc_src_back" });
  }
  navRow.push({ text: "❌ Batalkan", data: "cancel" });

  buttons.push(actionRow);
  buttons.push(navRow);

  setUserJob(userId, { ...job, pathMap, currentPath: current, updatedAt: Date.now() });

  const displayPath = path.relative(root, current) || "root";
  const text =
    `📂 **Copy/Clone — Pilih Sumber**\n` +
    `────────────────────────────────\n\n` +
    `📂 \`${displayPath}\`\n\n` +
    `Klik item untuk pilih/lepaskan.\n` +
    `Terpilih: **${selected.size}** item.`;

  await edit(chatId, msgId, text, buttons);
}

async function handleCopyCloneToggle(event) {
  const data = event.data.toString();
  const chatId = event.chatId;
  const userId = Number(event.senderId);
  const msgId = event.messageId;
  const job = getUserJob(userId);
  if (!job || !job.pathMap) return;

  if (data === "cc_src_back") {
    const parent = path.dirname(job.currentPath);
    if (parent.startsWith(job.extractedFolderPath)) {
      await renderCopyCloneSource(chatId, userId, msgId, parent);
    }
    return;
  }

  if (data === "cc_src_clear") {
    setUserJob(userId, { ...job, selectedItems: [], updatedAt: Date.now() });
    await renderCopyCloneSource(chatId, userId, msgId, job.currentPath);
    return;
  }

  if (data === "cc_src_select_all") {
    const root = job.extractedFolderPath;
    const current = job.currentPath;
    const items = fs.readdirSync(current).filter(name => name !== ".backup" && name !== ".git" && name !== "node_modules");
    const all = items.map(name => path.relative(root, path.join(current, name)));
    const selected = new Set([...(job.selectedItems || []), ...all]);
    setUserJob(userId, { ...job, selectedItems: Array.from(selected), updatedAt: Date.now() });
    await renderCopyCloneSource(chatId, userId, msgId, current);
    return;
  }

  if (data === "cc_src_done") {
    if (!job.selectedItems || job.selectedItems.length === 0) {
      await event.answer({ message: "Pilih setidaknya satu item!", alert: true });
      return;
    }
    setUserJob(userId, { ...job, status: "copy_clone_dest", updatedAt: Date.now() });
    const text =
      `✅ **Sumber dipilih:** ${job.selectedItems.length} item\n\n` +
      `Sekarang pilih **folder tujuan**.`;
    await showDestPicker(chatId, userId, msgId, text);
    return;
  }

  if (data.startsWith("cc_src_toggle_")) {
    const idx = data.replace("cc_src_toggle_", "");
    const entry = job.pathMap[idx];
    if (!entry) return;
    const root = job.extractedFolderPath;
    const selected = new Set(job.selectedItems || []);
    const rel = entry.relative;
    if (selected.has(rel)) selected.delete(rel);
    else selected.add(rel);
    setUserJob(userId, { ...job, selectedItems: Array.from(selected), updatedAt: Date.now() });
    await renderCopyCloneSource(chatId, userId, msgId, job.currentPath);
  }
}

async function handleExportZip(chatId, userId, msgId) {
  const job = getUserJob(userId);
  if (!job || !job.extractedFolderPath) {
    await edit(chatId, msgId, `❌ **Tidak ada project yang diekspor.**`);
    return;
  }

  await edit(chatId, msgId, `📦 **Membuat ZIP...**`);

  try {
    const outZipPath = tmpPath(`export_${userId}_${Date.now()}.zip`);
    const zip = new AdmZip();
    zip.addLocalFolder(job.extractedFolderPath);
    zip.writeZip(outZipPath);

    const stat = fs.statSync(outZipPath);
    const sizeMB = (stat.size / 1024 / 1024).toFixed(2);

    await client.sendFile(chatId, {
      file: outZipPath,
      forceDocument: true,
      attributes: [new Api.DocumentAttributeFilename({ fileName: `project_${Date.now()}.zip` })],
      caption:
        `📦 **Project ZIP**\n` +
        `────────────────────────────────\n\n` +
        `💾 **Ukuran:** \`${sizeMB} MB\``,
      parseMode: "md",
    });

    fs.unlinkSync(outZipPath);
    await edit(chatId, msgId, `✅ **ZIP berhasil diekspor!**\n\nFile sudah dikirim di atas.`, [[{ text: "🏠 Menu Utama", data: "start" }]]);
  } catch (err) {
    await edit(chatId, msgId, `❌ **Gagal membuat ZIP:** \`${err.message}\``);
  }
}

async function handleBuildFromExtracted(chatId, userId, msgId) {
  const job = getUserJob(userId);
  if (!job || !job.extractedFolderPath) {
    await edit(chatId, msgId, `❌ **Tidak ada project untuk dibuild.**`);
    return;
  }

  setUserJob(userId, { ...job, status: "uploading", updatedAt: Date.now() });
  await edit(chatId, msgId, `⏳ **Menyiapkan project untuk build...**`);

  try {
    const zipPath = tmpPath(`build_${userId}_${Date.now()}.zip`);
    const zip = new AdmZip();
    zip.addLocalFolder(job.extractedFolderPath);
    zip.writeZip(zipPath);

    const tag = genTag(userId);
    const fileName = job.fileName || "project.zip";
    const { releaseId, browserUrl } = await uploadZipToRelease(zipPath, fileName, tag);
    fs.unlinkSync(zipPath);

    const runId = await triggerWorkflow(browserUrl, tag, job.buildType || "release");

    setUserJob(userId, {
      ...job,
      status: "building",
      releaseId,
      tag,
      runId,
      msgId,
      buildStart: Date.now(),
      updatedAt: Date.now(),
    });

    await edit(chatId, msgId, `⚙️ **Build dimulai!**\n🆔 Run ID: \`${runId}\``);

    if (!isAdmin(userId)) {
      const remaining = db.deductCredit(userId);
      if (remaining !== null) {
        await client.sendMessage(chatId, {
          message: `💳 **1 Credit digunakan.** Sisa: \`${remaining}\``,
          parseMode: "md",
        });
      }
    }

    monitorBuild(userId, chatId, msgId, runId, releaseId).catch(async (err) => {
      removeUserJob(userId);
      await edit(chatId, msgId, `❌ **Error build:** \`${err.message}\``);
    });
  } catch (err) {
    removeUserJob(userId);
    await edit(chatId, msgId, `❌ **Gagal memulai build:** \`${err.message}\``);
  }
}

Object.assign(globalThis, { handleAiThemeChanger, applyThemeColor, handleAiFontChanger, applyFontChange, handleAiIconPack, handleAiIconPackSelect, handleAiDarkMode, handleAiRombakProject, renderLiveEditorBrowser, handleLiveEditorFileSelect, handleLiveEditorNav, handleAiAutoFix, renderMultiInjectMenu, handleMultiInjectToggle, handleMultiInjectApply, handleAiToolsText, handleCopyClone, renderCopyCloneSource, handleCopyCloneToggle, handleExportZip, handleBuildFromExtracted });

module.exports = { handleAiThemeChanger, applyThemeColor, handleAiFontChanger, applyFontChange, handleAiIconPack, handleAiIconPackSelect, handleAiDarkMode, handleAiRombakProject, renderLiveEditorBrowser, handleLiveEditorFileSelect, handleLiveEditorNav, handleAiAutoFix, renderMultiInjectMenu, handleMultiInjectToggle, handleMultiInjectApply, handleAiToolsText, handleCopyClone, renderCopyCloneSource, handleCopyCloneToggle, handleExportZip, handleBuildFromExtracted };
