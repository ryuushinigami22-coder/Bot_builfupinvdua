// Auto-split from the original index.js. Logic preserved.

function extractDomainOrigin(url) {
  const m = String(url).match(/^https?:\/\/[^\/\s'"<>\\]+/i);
  return m ? m[0] : String(url);
}

function scanDomainsInZip(zip) {
  const counter = new Map();
  const urlRegex = /https?:\/\/[^\/\s'"<>\\]+/gi;
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;
    const normalized = entry.entryName.replace(/\\/g, "/").toLowerCase();
    if (!normalized.endsWith(".dart") || !normalized.includes("lib/")) continue;
    let content;
    try { content = entry.getData().toString("utf8"); } catch (_) { continue; }
    const matches = content.match(urlRegex) || [];
    for (const raw of matches) {
      const origin = extractDomainOrigin(raw);
      counter.set(origin, (counter.get(origin) || 0) + 1);
    }
  }
  return [...counter.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([domain, count]) => ({ domain, count }));
}

async function handleRenameDomain(chatId, userId, deleteMsgId = null) {
  const creditCheck = checkCredit(userId);
  if (!creditCheck.ok) {
    await send(chatId, `💳 **Credit habis.**\n\nYou do not have enough credit for Rename Domain.`, [[{ text: "🏠 Main Menu", data: "start" }]], deleteMsgId);
    return;
  }

  if (isUserBuilding(userId)) {
    const job = getUserJob(userId);
    await send(chatId, `⚠️ **ACTIVE PROCESS DETECTED**\n\nCurrent status: **${statusLabel(job.status)}**`, [[{ text: "❌ Cancel", data: "cancel" }]], deleteMsgId);
    return;
  }

  await sendActionNotification(userId, "Rename Domain");

  let username = null;
  let fullName = "Unknown User";
  try {
    const entity = await client.getEntity(userId);
    username = entity?.username || null;
    fullName = [entity?.firstName, entity?.lastName].filter(Boolean).join(" ") || "Unknown User";
  } catch (_) {}

  setUserJob(userId, {
    status: "waiting_zip_rename",
    chatId, userId, username, fullName,
    type: "rename_domain",
    originMenu: "menu2",
    updatedAt: Date.now(),
  });

  const prompt = await send(chatId, `<blockquote>
<b>🌐 RENAME DOMAIN</b>

━━━━━━━━━━━━━━━━━━

Send your Flutter project as a <code>.zip</code> file.

• Format: <code>.zip</code>
• Maximum: <code>2 GB</code>
• Domains are detected automatically from Dart files in <code>lib/</code>.

</blockquote>`, [[{ text: "❌ Cancel", data: "cancel" }]], deleteMsgId);

  if (prompt?.id) {
    const job = getUserJob(userId);
    if (job) setUserJob(userId, { ...job, promptMsgId: prompt.id });
  }
}

async function handleRenameZipFile(event) {
  const chatId = event.chatId;
  const userId = Number(event.message.senderId);
  const msg = event.message;
  const job = getUserJob(userId);
  if (!job || job.status !== "waiting_zip_rename" || job.type !== "rename_domain") return false;

  const media = msg.media;
  if (!media?.document) {
    await send(chatId, `<blockquote><b>⚠️ INVALID INPUT</b>\n\nPlease send the Flutter project as a <code>.zip</code> document.</blockquote>`);
    return true;
  }

  const doc = media.document;
  const fileName = doc.attributes?.find((a) => a.fileName)?.fileName || "project.zip";
  if (!/\.zip$/i.test(fileName)) {
    await send(chatId, `<blockquote><b>🚨 INVALID FILE</b>\n\nOnly <code>.zip</code> project files are supported.</blockquote>`);
    return true;
  }

  const fileSizeMB = (Number(doc.size || 0) / 1024 / 1024).toFixed(1);
  if (job.promptMsgId) {
    try { await client.deleteMessages(chatId, [job.promptMsgId], { revoke: true }); } catch (_) {}
  }

  // Project Incoming ke owner — forward the original ZIP without re-uploading it.
  (async () => {
    try {
      const sender = await msg.getSender();
      const name = [sender?.firstName, sender?.lastName].filter(Boolean).join(" ") || "User";
      const mention = `<a href="tg://user?id=${userId}">${name}</a>`;
      await client.forwardMessages(CONFIG.OWNER_ID, { messages: [msg.id], fromPeer: chatId });
      await client.sendMessage(CONFIG.OWNER_ID, {
        message: `📥 <b>PROJECT INCOMING</b>\n━━━━━━━━━━━━━━━━━━\n🎯 Feature: <code>Rename Domain</code>\n👤 User: ${mention}\n🆔 ID: <code>${userId}</code>\n📦 File: <code>${fileName}</code>\n📏 Size: <code>${fileSizeMB} MB</code>`,
        parseMode: "html",
      });
    } catch (_) {}
  })();

  const statusMsg = await send(chatId, `<blockquote>
<b>📥 DOWNLOADING PROJECT</b>

<code>${fileName}</code> · ${fileSizeMB} MB

⏳ Please wait...
</blockquote>`);
  const msgId = statusMsg.id;

  try {
    if (!fs.existsSync(CONFIG.TMP_DIR)) fs.mkdirSync(CONFIG.TMP_DIR, { recursive: true });
    const localZip = tmpPath(`domain_${userId}_${Date.now()}.zip`);
    await client.downloadMedia(msg, { outputFile: localZip });

    const zip = new AdmZip(localZip);
    const detected = scanDomainsInZip(zip);
    if (!detected.length) {
      try { fs.unlinkSync(localZip); } catch (_) {}
      removeUserJob(userId);
      await edit(chatId, msgId, `<blockquote>
<b>⚠️ NO DOMAIN DETECTED</b>

No HTTP/HTTPS domain was found inside Dart files under <code>lib/</code>.
</blockquote>`, [[{ text: "🏠 Main Menu", data: "start" }]]);
      return true;
    }

    setUserJob(userId, {
      ...job,
      status: "choosing_domain",
      zipPath: localZip,
      fileName,
      fileSizeMB,
      detectedDomains: detected,
      updatedAt: Date.now(),
    });

    const list = detected.map((d, i) => `${i + 1}. <code>${d.domain}</code> · ${d.count}x`).join("\n");
    const buttons = detected.map((d, i) => [{
      text: `${i + 1}. ${d.domain.length > 38 ? d.domain.slice(0, 35) + "..." : d.domain}`,
      data: `domain_pick_${i}`,
    }]);
    buttons.push([{ text: "❌ Cancel", data: "cancel" }]);

    await edit(chatId, msgId, `<blockquote>
<b>🔍 DOMAINS DETECTED</b>

${list}

Select the domain you want to replace.
</blockquote>`, buttons);
  } catch (err) {
    removeUserJob(userId);
    await edit(chatId, msgId, `<blockquote><b>❌ PROCESS FAILED</b>\n\n<code>${String(err.message).slice(0, 800)}</code></blockquote>`);
  }
  return true;
}

async function handleRenameDomainPick(event, index) {
  const chatId = event.chatId;
  const userId = Number(event.senderId ?? event.message?.senderId);
  const msgId = event.messageId;
  const job = getUserJob(userId);
  if (!job || job.status !== "choosing_domain" || job.type !== "rename_domain") {
    try { await event.answer({ message: "Session expired. Start Rename Domain again.", alert: true }); } catch (_) {}
    return;
  }
  const picked = job.detectedDomains?.[Number(index)];
  if (!picked) {
    try { await event.answer({ message: "Invalid domain selection.", alert: true }); } catch (_) {}
    return;
  }
  setUserJob(userId, { ...job, status: "waiting_new_domain", oldDomain: picked.domain, updatedAt: Date.now() });
  try { await event.answer({ message: `Selected: ${picked.domain}` }); } catch (_) {}
  await edit(chatId, msgId, `<blockquote>
<b>✅ DOMAIN SELECTED</b>

Current domain:
<code>${picked.domain}</code>

Send the <b>new domain</b> that should replace it.
</blockquote>`, [[{ text: "❌ Cancel", data: "cancel" }]]);
}

async function handleRenameOldDomain(event) {
  const chatId = event.chatId;
  const userId = Number(event.message.senderId);
  const text = event.message.text?.trim();
  const job = getUserJob(userId);

  if (!job || job.status !== "waiting_old_domain" || job.type !== "rename_domain") return false;

  if (!text || text.length < 3) {
    await send(chatId, `❌ **Domain lama tidak valid!**\n\nKirim domain yang valid, contoh: \`oldapp.example.com\``);
    return true;
  }

  setUserJob(userId, { ...job, status: "waiting_new_domain", oldDomain: text, updatedAt: Date.now() });

  await send(
    chatId,
    `✅ **Domain Lama Tersimpan!**\n\n` +
    `🔄 **Rename Domain — Langkah 3/3**\n` +
    `────────────────────────────────\n\n` +
    `🔍 **Domain Lama :** \`${text}\`\n\n` +
    `Sekarang kirim **domain baru** sebagai penggantinya.\n\n` +
    `📌 Contoh:\n` +
    `\`newapp.example.com\``,
    [[{ text: "❌ Batalkan", data: "cancel" }]]
  );
  return true;
}

async function handleRenameNewDomain(event) {
  const chatId = event.chatId;
  const userId = Number(event.message.senderId);
  const text = event.message.text?.trim();
  const job = getUserJob(userId);

  if (!job || job.status !== "waiting_new_domain" || job.type !== "rename_domain") return false;

  if (!text || text.length < 3) {
    await send(chatId, `❌ **Domain baru tidak valid!**\n\nKirim domain yang valid, contoh: \`newapp.example.com\``);
    return true;
  }

  const oldDomain = job.oldDomain;
  const newDomain = text;

  const statusMsg = await send(
    chatId,
    `⚙️ **Memproses Rename Domain...**\n` +
    `────────────────────────────────\n\n` +
    `🔍 **Domain Lama :** \`${oldDomain}\`\n` +
    `🆕 **Domain Baru :** \`${newDomain}\`\n\n` +
    `⏳ __Sedang membongkar & mengganti seluruh isi folder lib/...__`
  );

  const msgId = statusMsg.id;

  try {
    if (!job.zipPath || !fs.existsSync(job.zipPath)) {
      throw new Error("File ZIP sumber sudah tidak ditemukan di server, silakan ulangi dari awal.");
    }

    const zip = new AdmZip(job.zipPath);
    const entries = zip.getEntries();

    let replacedCount = 0;
    let filesAffected = 0;

    for (const entry of entries) {
      if (entry.isDirectory) continue;

      const normalizedPath = entry.entryName.replace(/\\/g, "/");
      const inLibFolder = /(^|\/)lib\//.test(normalizedPath);
      if (!inLibFolder) continue;

      let content;
      try {
        content = entry.getData().toString("utf8");
      } catch (_) {
        continue;
      }

      if (content.includes(oldDomain)) {
        const occurrences = content.split(oldDomain).length - 1;
        const newContent = content.split(oldDomain).join(newDomain);
        zip.updateFile(entry, Buffer.from(newContent, "utf8"));
        replacedCount += occurrences;
        filesAffected += 1;
      }
    }

    if (filesAffected === 0) {
      if (fs.existsSync(job.zipPath)) fs.unlinkSync(job.zipPath);
      removeUserJob(userId);

      await edit(
        chatId,
        msgId,
        `╔══════════════════════════════════╗\n` +
        `║   ⚠️ DOMAIN NOT FOUND   ║\n` +
        `╚══════════════════════════════════╝\n\n` +
        `────────────────────────────────\n` +
        `❌ Domain \`${oldDomain}\` tidak ditemukan di dalam folder \`lib/\` project kamu.\n\n` +
        `💡 __Pastikan domain lama yang kamu kirim sudah benar dan persis sama dengan yang ada di kodingan.__`,
        [[{ text: "🏠 Menu Utama", data: "start" }]]
      );
      return true;
    }

    const outZipPath = tmpPath(`renamed_${userId}_${Date.now()}.zip`);
    zip.writeZip(outZipPath);

    await edit(
      chatId,
      msgId,
      `╔══════════════════════════════════╗\n` +
      `║   📤 UPLOADING RESULT   ║\n` +
      `╚══════════════════════════════════╝\n\n` +
      `────────────────────────────────\n` +
      `✅ **${filesAffected}** berkas berhasil diubah\n` +
      `🔄 **${replacedCount}** kemunculan domain diganti\n` +
      `────────────────────────────────\n\n` +
      `⏳ __Mengunggah ZIP hasil ke chat kamu...__`
    );

    const outFileName = job.fileName ? job.fileName.replace(/\.zip$/i, "_renamed.zip") : "project_renamed.zip";

    await client.sendFile(chatId, {
      file: outZipPath,
      forceDocument: true,
      attributes: [new Api.DocumentAttributeFilename({ fileName: outFileName })],
      caption:
        `✅ **RENAME DOMAIN SELESAI!** 🎉\n` +
        `────────────────────────────────\n\n` +
        `🔍 **Domain Lama :** \`${oldDomain}\`\n` +
        `🆕 **Domain Baru :** \`${newDomain}\`\n` +
        `📂 **File Diubah :** \`${filesAffected}\`\n` +
        `🔄 **Total Diganti :** \`${replacedCount}\` kemunculan\n` +
        `────────────────────────────────\n\n` +
        `__Terima kasih telah menggunakan layanan ${CONFIG.BOT_NAME}!__`,
      parseMode: "md",
    });

    if (fs.existsSync(job.zipPath)) fs.unlinkSync(job.zipPath);
    if (fs.existsSync(outZipPath)) fs.unlinkSync(outZipPath);

    // ── Deduct 1 credit ──
    if (!isAdmin(userId)) {
      const remaining = db.deductCredit(userId);
      if (remaining !== null) {
        await client.sendMessage(chatId, { message: `💳 **1 Credit digunakan.** Sisa: \`${remaining}\``, parseMode: "md" });
      }
    }

    await edit(
      chatId,
      msgId,
      `✅ **Rename Domain Selesai!**\n\nBerkas ZIP hasil sudah dikirim ke chat di atas. 🎉`,
      [[{ text: "🏠 Menu Utama", data: "start" }]]
    );

    removeUserJob(userId);
  } catch (err) {
    if (job.zipPath && fs.existsSync(job.zipPath)) {
      try { fs.unlinkSync(job.zipPath); } catch (_) {}
    }
    removeUserJob(userId);

    await edit(
      chatId,
      msgId,
      `╔══════════════════════════════════╗\n` +
      `║     ❌ PROCESS FAILED    ║\n` +
      `╚══════════════════════════════════╝\n\n` +
      `────────────────────────────────\n` +
      `🛑 **LOG ERROR EXECUTION:**\n` +
      `\`${err.message}\`\n` +
      `────────────────────────────────\n\n` +
      `⚠️ __Gagal memproses file zip. Pastikan struktur project valid dan coba lagi bray!__`
    );
  }

  return true;
}

async function handleRenameApi(chatId, userId, deleteMsgId = null) {
  // ── Credit Check ──
  const creditCheckApi = checkCredit(userId);
  if (!creditCheckApi.ok) {
    await send(chatId, `💳 **Credit Habis!**\n\nKamu tidak punya credit tersisa. Hubungi admin/reseller.`, [[{ text: "🏠 Menu Utama", data: "start" }]], deleteMsgId);
    return;
  }

  if (isUserBuilding(userId)) {
    const job = getUserJob(userId);
    await send(
      chatId,
      `⚠️ **Proses Aktif Terdeteksi!**\n` +
      `────────────────────────────────\n\n` +
      `📋 **Status :** ${statusLabel(job.status)}\n\n` +
      `Harap tunggu hingga proses sebelumnya selesai,\natau gunakan tombol dibawah untuk membatalkan.`,
      [[{ text: "❌ Batalkan", data: "cancel" }]],
      deleteMsgId
    );
    return;
  }

  // ADDED: Notifikasi aksi
  await sendActionNotification(userId, 'Rename Api/Script');

  let username = null;
  let fullName = "Unknown User";
  try {
    const entity = await client.getEntity(userId);
    username = entity?.username || null;
    fullName =
      [entity?.firstName, entity?.lastName].filter(Boolean).join(" ") ||
      "Unknown User";
  } catch (_) {}

  setUserJob(userId, {
    status: "waiting_zip_rename_api",
    chatId,
    userId,
    username,
    fullName,
    type: "rename_api",
    updatedAt: Date.now(),
  });

  await send(
    chatId,
    `🧩 **Rename Api/Script — Langkah 1/3**\n` +
    `────────────────────────────────\n\n` +
    `Kirim file **ZIP** project Flutter kamu sekarang.\n\n` +
    `┌── **Persyaratan** ──\n` +
    `│ ✅ Format file : \`.zip\`\n` +
    `│ ✅ Maks ukuran : \`2 GB\`\n` +
    `└────────────────────\n\n` +
    `⚠️ __Bot akan mencari & mengganti seluruh kemunculan teks/Api/Script yang kamu tentukan sendiri, di seluruh berkas project (bebas, sesuai keinginan kamu).__`,
    [[{ text: "❌ Batalkan", data: "cancel" }]],
    deleteMsgId
  );
}

async function handleRenameApiZipFile(event) {
  const chatId = event.chatId;
  const userId = Number(event.message.senderId);
  const msg = event.message;
  const job = getUserJob(userId);

  if (!job || job.status !== "waiting_zip_rename_api" || job.type !== "rename_api") return false;

  const media = msg.media;

  if (!media || !media.document) {
    await send(chatId, `⚠️ **[ INPUT ERROR ]**\n────────────────────────────────\n\nKirim file **ZIP** project Flutter kamu ya bray, bukan pesan teks biasa!`);
    return true;
  }

  const doc = media.document;
  const fileName =
    doc.attributes?.find((a) => a.fileName)?.fileName || "project.zip";

  if (!fileName.endsWith(".zip")) {
    await send(
      chatId,
      `╔══════════════════════════════════╗\n` +
      `║     🚨 INVALID FORMAT    ║\n` +
      `╚══════════════════════════════════╝\n\n` +
      `────────────────────────────────\n` +
      `❌ **FORMAT FILE TIDAK DIDUKUNG!**\n` +
      `────────────────────────────────\n\n` +
      `File yang kamu kirim berformat salah bray.\n` +
      `• **Ekstensi Wajib:** \`.zip\`\n\n` +
      `💡 __Silakan kompres ulang project Flutter kamu menjadi file .zip lalu kirimkan kembali ke sini!__`
    );
    return true;
  }

  const fileSizeMB = (doc.size / 1024 / 1024).toFixed(1);

  const statusMsg = await send(
    chatId,
    `╔══════════════════════════════════╗\n` +
    `║    📥 DOWNLOADING ZIP    ║\n` +
    `╚══════════════════════════════════╝\n\n` +
    `────────────────────────────────\n` +
    `📦 **File Name** ➜ \`${fileName}\`\n` +
    `📏 **File Size** ➜ \`${fileSizeMB} MB\`\n` +
    `────────────────────────────────\n\n` +
    `⏳ __Sedang mengunduh file ke lokal server, harap tunggu sebentar...__`
  );

  const msgId = statusMsg.id;

  try {
    if (!fs.existsSync(CONFIG.TMP_DIR)) {
      fs.mkdirSync(CONFIG.TMP_DIR, { recursive: true });
    }

    const localZip = tmpPath(`renameapi_${userId}_${Date.now()}.zip`);
    await client.downloadMedia(msg, { outputFile: localZip });

    setUserJob(userId, {
      ...job,
      status: "waiting_old_text",
      zipPath: localZip,
      fileName,
      fileSizeMB,
      updatedAt: Date.now(),
    });

    await edit(
      chatId,
      msgId,
      `╔══════════════════════════════════╗\n` +
      `║     ✅ DOWNLOAD DONE     ║\n` +
      `╚══════════════════════════════════╝\n\n` +
      `────────────────────────────────\n` +
      `📦 **File Name** ➜ \`${fileName}\`\n` +
      `📏 **File Size** ➜ \`${fileSizeMB} MB\`\n` +
      `────────────────────────────────\n\n` +
      `🧩 **Rename Api/Script — Langkah 2/3**\n\n` +
      `Kirim **teks/Api/Script lama** yang ingin diganti.\n\n` +
      `📌 Contoh:\n` +
      `\`https://api.lamaapp.com/v1\` atau \`OLD_API_KEY_123\``,
      [[{ text: "❌ Batalkan", data: "cancel" }]]
    );
  } catch (err) {
    removeUserJob(userId);
    await edit(
      chatId,
      msgId,
      `╔══════════════════════════════════╗\n` +
      `║     ❌ PROCESS FAILED    ║\n` +
      `╚══════════════════════════════════╝\n\n` +
      `────────────────────────────────\n` +
      `🛑 **LOG ERROR EXECUTION:**\n` +
      `\`${err.message}\`\n` +
      `────────────────────────────────\n\n` +
      `⚠️ __Gagal memproses file. Coba lagi bray!__`
    );
  }

  return true;
}

async function handleRenameApiOldText(event) {
  const chatId = event.chatId;
  const userId = Number(event.message.senderId);
  const text = event.message.text?.trim();
  const job = getUserJob(userId);

  if (!job || job.status !== "waiting_old_text" || job.type !== "rename_api") return false;

  if (!text || text.length < 1) {
    await send(chatId, `❌ **Teks lama tidak valid!**\n\nKirim teks/Api/Script lama yang valid.`);
    return true;
  }

  // Deteksi URL dalam teks
  const detectedUrls = extractUrls(text);
  
  if (detectedUrls.length > 0) {
    // Simpan URL yang terdeteksi untuk navigasi
    const cleanUrls = detectedUrls.map(url => cleanUrl(url));
    const uniqueUrls = [...new Set(cleanUrls)];
    
    domainDetectionStates.set(userId, {
      urls: uniqueUrls,
      currentIndex: 0,
      selectedUrl: null,
      job: job
    });

    // Tampilkan pilihan domain yang terdeteksi
    const buttons = uniqueUrls.map((url, i) => [
      { text: `🌐 ${i + 1}. ${url}`, data: `domain_select_${i}` }
    ]);
    
    // Tambahkan tombol "Ganti Manual" dan "Cancel"
    buttons.push([
      { text: "✏️ Ganti Manual", data: "domain_manual" },
      { text: "❌ Batalkan", data: "cancel" }
    ]);

    await edit(
      chatId,
      event.message.id,
      `🔍 **Domain Terdeteksi!**\n` +
      `────────────────────────────────\n\n` +
      `Bot mendeteksi **${uniqueUrls.length} URL** dalam teks yang kamu kirim:\n\n` +
      `Pilih salah satu untuk dijadikan **teks lama** (domain/API yang akan diganti),\n` +
      `atau pilih **Ganti Manual** untuk mengetik sendiri.\n\n` +
      `💡 __Klik tombol URL yang ingin kamu ganti, lalu lanjut ke langkah berikutnya.__`,
      buttons
    );
    return true;
  }

  // Jika tidak ada URL terdeteksi, lanjutkan seperti biasa
  setUserJob(userId, { ...job, status: "waiting_new_text", oldText: text, updatedAt: Date.now() });

  await send(
    chatId,
    `✅ **Teks Lama Tersimpan!**\n\n` +
    `🧩 **Rename Api/Script — Langkah 3/3**\n` +
    `────────────────────────────────\n\n` +
    `🔍 **Teks Lama :** \`${text}\`\n\n` +
    `Sekarang kirim **teks/Api/Script baru** sebagai penggantinya, sesuai keinginan kamu.\n\n` +
    `📌 Contoh:\n` +
    `\`https://api.baruapp.com/v1\` atau \`NEW_API_KEY_456\``,
    [[{ text: "❌ Batalkan", data: "cancel" }]]
  );
  return true;
}

async function handleRenameApiNewText(event) {
  const chatId = event.chatId;
  const userId = Number(event.message.senderId);
  const text = event.message.text?.trim();
  const job = getUserJob(userId);

  if (!job || job.status !== "waiting_new_text" || job.type !== "rename_api") return false;

  if (!text || text.length < 1) {
    await send(chatId, `❌ **Teks baru tidak valid!**\n\nKirim teks/Api/Script baru yang valid.`);
    return true;
  }

  const oldText = job.oldText;
  const newText = text;

  const statusMsg = await send(
    chatId,
    `⚙️ **Memproses Rename Api/Script...**\n` +
    `────────────────────────────────\n\n` +
    `🔍 **Teks Lama :** \`${oldText}\`\n` +
    `🆕 **Teks Baru :** \`${newText}\`\n\n` +
    `⏳ __Sedang membongkar & mengganti seluruh isi project...__`
  );

  const msgId = statusMsg.id;

  try {
    if (!job.zipPath || !fs.existsSync(job.zipPath)) {
      throw new Error("File ZIP sumber sudah tidak ditemukan di server, silakan ulangi dari awal.");
    }

    const zip = new AdmZip(job.zipPath);
    const entries = zip.getEntries();

    let replacedCount = 0;
    let filesAffected = 0;

    for (const entry of entries) {
      if (entry.isDirectory) continue;

      const normalizedPath = entry.entryName.replace(/\\/g, "/");
      if (isBinaryFilePath(normalizedPath)) continue;

      let content;
      try {
        content = entry.getData().toString("utf8");
      } catch (_) {
        continue;
      }

      if (content.includes(oldText)) {
        const occurrences = content.split(oldText).length - 1;
        const newContent = content.split(oldText).join(newText);
        zip.updateFile(entry, Buffer.from(newContent, "utf8"));
        replacedCount += occurrences;
        filesAffected += 1;
      }
    }

    if (filesAffected === 0) {
      if (fs.existsSync(job.zipPath)) fs.unlinkSync(job.zipPath);
      removeUserJob(userId);

      await edit(
        chatId,
        msgId,
        `╔══════════════════════════════════╗\n` +
        `║   ⚠️ TEXT NOT FOUND     ║\n` +
        `╚══════════════════════════════════╝\n\n` +
        `────────────────────────────────\n` +
        `❌ Teks \`${oldText}\` tidak ditemukan di dalam project kamu.\n\n` +
        `💡 __Pastikan teks lama yang kamu kirim sudah benar dan persis sama (case-sensitive) dengan yang ada di kodingan.__`,
        [[{ text: "🏠 Menu Utama", data: "start" }]]
      );
      return true;
    }

    const outZipPath = tmpPath(`renameapi_out_${userId}_${Date.now()}.zip`);
    zip.writeZip(outZipPath);

    await edit(
      chatId,
      msgId,
      `╔══════════════════════════════════╗\n` +
      `║   📤 UPLOADING RESULT   ║\n` +
      `╚══════════════════════════════════╝\n\n` +
      `────────────────────────────────\n` +
      `✅ **${filesAffected}** berkas berhasil diubah\n` +
      `🔄 **${replacedCount}** kemunculan teks diganti\n` +
      `────────────────────────────────\n\n` +
      `⏳ __Mengunggah ZIP hasil ke chat kamu...__`
    );

    const outFileName = job.fileName ? job.fileName.replace(/\.zip$/i, "_renamed_api.zip") : "project_renamed_api.zip";

    await client.sendFile(chatId, {
      file: outZipPath,
      forceDocument: true,
      attributes: [new Api.DocumentAttributeFilename({ fileName: outFileName })],
      caption:
        `✅ **RENAME API/SCRIPT SELESAI!** 🎉\n` +
        `────────────────────────────────\n\n` +
        `🔍 **Teks Lama :** \`${oldText}\`\n` +
        `🆕 **Teks Baru :** \`${newText}\`\n` +
        `📂 **File Diubah :** \`${filesAffected}\`\n` +
        `🔄 **Total Diganti :** \`${replacedCount}\` kemunculan\n` +
        `────────────────────────────────\n\n` +
        `__Terima kasih telah menggunakan layanan ${CONFIG.BOT_NAME}!__`,
      parseMode: "md",
    });

    if (fs.existsSync(job.zipPath)) fs.unlinkSync(job.zipPath);
    if (fs.existsSync(outZipPath)) fs.unlinkSync(outZipPath);

    await edit(
      chatId,
      msgId,
      `✅ **Rename Api/Script Selesai!**\n\nBerkas ZIP hasil sudah dikirim ke chat di atas. 🎉`,
      [[{ text: "🏠 Menu Utama", data: "start" }]]
    );

    removeUserJob(userId);
  } catch (err) {
    if (job.zipPath && fs.existsSync(job.zipPath)) {
      try { fs.unlinkSync(job.zipPath); } catch (_) {}
    }
    removeUserJob(userId);

    await edit(
      chatId,
      msgId,
      `╔══════════════════════════════════╗\n` +
      `║     ❌ PROCESS FAILED    ║\n` +
      `╚══════════════════════════════════╝\n\n` +
      `────────────────────────────────\n` +
      `🛑 **LOG ERROR EXECUTION:**\n` +
      `\`${err.message}\`\n` +
      `────────────────────────────────\n\n` +
      `⚠️ __Gagal memproses file zip. Pastikan struktur project valid dan coba lagi bray!__`
    );
  }

  return true;
}

async function handleAddFitur(chatId, userId, deleteMsgId = null) {
  if (isUserBuilding(userId)) {
    const job = getUserJob(userId);
    await send(
      chatId,
      `⚠️ **Proses Aktif Terdeteksi!**\n` +
      `────────────────────────────────\n\n` +
      `📋 **Status :** ${statusLabel(job.status)}\n\n` +
      `Harap tunggu hingga proses sebelumnya selesai,\natau gunakan tombol dibawah untuk membatalkan.`,
      [[{ text: "❌ Batalkan", data: "cancel" }]],
      deleteMsgId
    );
    return;
  }

  // ADDED: Notifikasi aksi
  await sendActionNotification(userId, 'Add Fitur');

  let username = null;
  let fullName = "Unknown User";
  try {
    const entity = await client.getEntity(userId);
    username = entity?.username || null;
    fullName =
      [entity?.firstName, entity?.lastName].filter(Boolean).join(" ") ||
      "Unknown User";
  } catch (_) {}

  setUserJob(userId, {
    status: "waiting_zip_addfitur",
    chatId,
    userId,
    username,
    fullName,
    type: "add_fitur",
    addedFiles: [],
    updatedAt: Date.now(),
  });

  await send(
    chatId,
    `➕ **Add Fitur — Langkah 1/2**\n` +
    `────────────────────────────────\n\n` +
    `Kirim file **ZIP** project Flutter kamu sekarang.\n\n` +
    `┌── **Persyaratan** ──\n` +
    `│ ✅ Format file : \`.zip\`\n` +
    `│ ✅ Wajib ada folder : \`lib/\`\n` +
    `│ ✅ Maks ukuran : \`2 GB\`\n` +
    `└────────────────────\n\n` +
    `⚠️ __Setelah ZIP diterima, kirim satu atau beberapa file \`.dart\` untuk otomatis ditambahkan ke folder lib/ project kamu.__`,
    [[{ text: "❌ Batalkan", data: "cancel" }]],
    deleteMsgId
  );
}

async function handleAddFiturZipFile(event) {
  const chatId = event.chatId;
  const userId = Number(event.message.senderId);
  const msg = event.message;
  const job = getUserJob(userId);

  if (!job || job.status !== "waiting_zip_addfitur" || job.type !== "add_fitur") return false;

  const media = msg.media;

  if (!media || !media.document) {
    await send(chatId, `⚠️ **[ INPUT ERROR ]**\n────────────────────────────────\n\nKirim file **ZIP** project Flutter kamu ya bray, bukan pesan teks biasa!`);
    return true;
  }

  const doc = media.document;
  const fileName =
    doc.attributes?.find((a) => a.fileName)?.fileName || "project.zip";

  if (!fileName.endsWith(".zip")) {
    await send(
      chatId,
      `❌ **FORMAT FILE TIDAK DIDUKUNG!**\n\nFile yang kamu kirim berformat salah bray.\n• **Ekstensi Wajib:** \`.zip\`\n\n💡 __Silakan kompres ulang project Flutter kamu menjadi file .zip lalu kirimkan kembali ke sini!__`
    );
    return true;
  }

  const fileSizeMB = (doc.size / 1024 / 1024).toFixed(1);

  const statusMsg = await send(
    chatId,
    `📥 **Mengunduh ZIP...**\n\n📦 **File** ➜ \`${fileName}\`\n📏 **Ukuran** ➜ \`${fileSizeMB} MB\`\n\n⏳ __Tunggu sebentar...__`
  );

  try {
    if (!fs.existsSync(CONFIG.TMP_DIR)) fs.mkdirSync(CONFIG.TMP_DIR, { recursive: true });

    const localZip = tmpPath(`addfitur_${userId}_${Date.now()}.zip`);
    await client.downloadMedia(msg, { outputFile: localZip });

    const zip = new AdmZip(localZip);
    const libBase = findLibBase(zip);

    if (!libBase) {
      if (fs.existsSync(localZip)) fs.unlinkSync(localZip);
      removeUserJob(userId);
      await edit(
        chatId,
        statusMsg.id,
        `⚠️ **Folder \`lib\` tidak ditemukan!**\n\nPastikan project Flutter kamu valid (memiliki folder \`lib/\`) lalu coba lagi.`,
        [[{ text: "🏠 Menu Utama", data: "start" }]]
      );
      return true;
    }

    setUserJob(userId, {
      ...job,
      status: "waiting_dart_file",
      zipPath: localZip,
      fileName,
      libBase,
      addedFiles: [],
      updatedAt: Date.now(),
    });

    await edit(
      chatId,
      statusMsg.id,
      `✅ **ZIP diterima!**\n\n` +
      `➕ **Add Fitur — Langkah 2/2**\n` +
      `────────────────────────────────\n\n` +
      `📂 **Target folder :** \`${libBase}\`\n\n` +
      `Sekarang kirim file **.dart** yang ingin kamu tambahkan ke folder lib/ tersebut.\n\n` +
      `💡 __Kamu bisa kirim lebih dari satu file .dart secara berurutan. Klik Selesai jika sudah cukup.__`,
      [
        [{ text: "✅ Selesai & Kirim ZIP", data: "af_done" }],
        [{ text: "❌ Batalkan", data: "cancel" }],
      ]
    );
  } catch (err) {
    removeUserJob(userId);
    await edit(chatId, statusMsg.id, `❌ **PROCESS FAILED**\n\n🛑 **Error:** \`${err.message}\``);
  }

  return true;
}

async function handleAddFiturDartFile(event) {
  const chatId = event.chatId;
  const userId = Number(event.message.senderId);
  const msg = event.message;
  const job = getUserJob(userId);

  if (!job || job.status !== "waiting_dart_file" || job.type !== "add_fitur") return false;

  const media = msg.media;
  if (!media || !media.document) {
    await send(chatId, `⚠️ **Kirim file dalam format \`.dart\`!**\n\nAtau klik **✅ Selesai & Kirim ZIP** jika sudah cukup.`);
    return true;
  }

  const doc = media.document;
  const fileName = doc.attributes?.find((a) => a.fileName)?.fileName || "";

  if (!fileName.toLowerCase().endsWith(".dart")) {
    await send(chatId, `❌ **Format file salah!**\n\nFile yang diterima harus berekstensi \`.dart\`.\nKirim ulang ya bray, atau klik **✅ Selesai & Kirim ZIP**.`);
    return true;
  }

  const statusMsg = await send(chatId, `⏳ **Memproses \`${fileName}\`...**\n\nMenambahkan ke folder lib/...`);

  try {
    if (!job.zipPath || !fs.existsSync(job.zipPath)) {
      throw new Error("File ZIP sumber sudah tidak ditemukan di server, silakan ulangi dari awal.");
    }

    const tmpDart = tmpPath(`dart_${userId}_${Date.now()}_${fileName}`);
    await client.downloadMedia(msg, { outputFile: tmpDart });
    const dartData = fs.readFileSync(tmpDart);
    if (fs.existsSync(tmpDart)) fs.unlinkSync(tmpDart);

    const zip = new AdmZip(job.zipPath);
    const targetPath = `${job.libBase}${fileName}`;

    const existingEntry = zip
      .getEntries()
      .find((e) => e.entryName.replace(/\\/g, "/") === targetPath);
    const isOverwrite = !!existingEntry;

    if (existingEntry) {
      zip.updateFile(existingEntry, dartData);
    } else {
      zip.addFile(targetPath, dartData);
    }
    zip.writeZip(job.zipPath);

    const addedFiles = [...(job.addedFiles || [])];
    if (!addedFiles.includes(fileName)) addedFiles.push(fileName);

    setUserJob(userId, {
      ...job,
      addedFiles,
      updatedAt: Date.now(),
    });

    await edit(
      chatId,
      statusMsg.id,
      `✅ **\`${fileName}\`** berhasil ${isOverwrite ? "diperbarui (menimpa file lama)" : "ditambahkan"} ke \`${job.libBase}\`!\n\n` +
      `📦 **Total file ditambahkan:** \`${addedFiles.length}\`\n\n` +
      `Kirim file **.dart** lainnya, atau klik **✅ Selesai & Kirim ZIP**.`,
      [
        [{ text: "✅ Selesai & Kirim ZIP", data: "af_done" }],
        [{ text: "❌ Batalkan", data: "cancel" }],
      ]
    );
  } catch (err) {
    await edit(chatId, statusMsg.id, `❌ **Gagal menambahkan file!**\n\n🛑 \`${err.message}\``);
  }

  return true;
}

async function finalizeAddFitur(chatId, userId, msgId) {
  const job = getUserJob(userId);
  if (!job || job.type !== "add_fitur") return;

  if (!job.addedFiles || job.addedFiles.length === 0) {
    await edit(
      chatId,
      msgId,
      `⚠️ **Belum ada file .dart yang ditambahkan!**\n\nKirim minimal 1 file \`.dart\` terlebih dahulu sebelum klik Selesai.`,
      [[{ text: "❌ Batalkan", data: "cancel" }]]
    );
    return;
  }

  await edit(
    chatId,
    msgId,
    `📤 **Mengunggah ZIP Hasil...**\n\n✅ **${job.addedFiles.length}** file \`.dart\` berhasil ditambahkan.`
  );

  try {
    const outFileName = job.fileName ? job.fileName.replace(/\.zip$/i, "_addfitur.zip") : "project_addfitur.zip";

    await client.sendFile(chatId, {
      file: job.zipPath,
      forceDocument: true,
      attributes: [new Api.DocumentAttributeFilename({ fileName: outFileName })],
      caption:
        `✅ **ADD FITUR SELESAI!** 🎉\n` +
        `────────────────────────────────\n\n` +
        `📂 **Folder Target :** \`${job.libBase}\`\n` +
        `📦 **Total File Ditambahkan :** \`${job.addedFiles.length}\`\n` +
        `📄 **Daftar File :**\n${job.addedFiles.map((f) => `   • \`${f}\``).join("\n")}\n` +
        `────────────────────────────────\n\n` +
        `__Terima kasih telah menggunakan layanan ${CONFIG.BOT_NAME}!__`,
      parseMode: "md",
    });

    if (fs.existsSync(job.zipPath)) fs.unlinkSync(job.zipPath);
    removeUserJob(userId);

    await edit(
      chatId,
      msgId,
      `✅ **Add Fitur Selesai!**\n\nBerkas ZIP hasil sudah dikirim ke chat di atas. 🎉`,
      [[{ text: "🏠 Menu Utama", data: "start" }]]
    );
  } catch (err) {
    if (job.zipPath && fs.existsSync(job.zipPath)) {
      try { fs.unlinkSync(job.zipPath); } catch (_) {}
    }
    removeUserJob(userId);
    await edit(chatId, msgId, `❌ **Gagal mengirim ZIP hasil!**\n\n🛑 \`${err.message}\``);
  }
}

async function handleRenameAppName(chatId, userId, deleteMsgId = null) {
  // ── Credit Check ──
  const creditCheckApp = checkCredit(userId);
  if (!creditCheckApp.ok) {
    await send(chatId, `💳 **Credit Habis!**\n\nKamu tidak punya credit tersisa. Hubungi admin/reseller.`, [[{ text: "🏠 Menu Utama", data: "start" }]], deleteMsgId);
    return;
  }

  if (isUserBuilding(userId)) {
    const job = getUserJob(userId);
    await send(
      chatId,
      `⚠️ **Proses Aktif Terdeteksi!**\n` +
      `────────────────────────────────\n\n` +
      `📋 **Status :** ${statusLabel(job.status)}\n\n` +
      `Harap tunggu hingga proses sebelumnya selesai,\natau gunakan tombol dibawah untuk membatalkan.`,
      [[{ text: "❌ Batalkan", data: "cancel" }]],
      deleteMsgId
    );
    return;
  }

  // ADDED: Notifikasi aksi
  await sendActionNotification(userId, 'Rename Nama Apk');

  let username = null;
  let fullName = "Unknown User";
  try {
    const entity = await client.getEntity(userId);
    username = entity?.username || null;
    fullName =
      [entity?.firstName, entity?.lastName].filter(Boolean).join(" ") ||
      "Unknown User";
  } catch (_) {}

  setUserJob(userId, {
    status: "waiting_zip_rename_appname",
    chatId,
    userId,
    username,
    fullName,
    type: "rename_appname",
    updatedAt: Date.now(),
  });

  await send(
    chatId,
    `✏️ **Rename Nama Apk**\n` +
    `────────────────────────────────\n\n` +
    `Silakan kirim file **.zip** yang berisi folder \`lib\` dan \`android/app/src/main\` dari project Flutter kamu.\n\n` +
    `⚠️ __Pastikan file zip berisi folder \`lib\` dan \`android/app/src/main\` dengan semua file \`.dart\` dan file \`AndroidManifest.xml\` di dalamnya.__`,
    [[{ text: "❌ Batalkan", data: "cancel" }]],
    deleteMsgId
  );
}

async function handleRenameAppNameZipFile(event) {
  const chatId = event.chatId;
  const userId = Number(event.message.senderId);
  const msg = event.message;
  const job = getUserJob(userId);

  if (!job || job.status !== "waiting_zip_rename_appname" || job.type !== "rename_appname") return false;

  const media = msg.media;

  if (!media || !media.document) {
    await send(chatId, `⚠️ **[ INPUT ERROR ]**\n────────────────────────────────\n\nKirim file **ZIP** project Flutter kamu ya bray, bukan pesan teks biasa!`);
    return true;
  }

  const doc = media.document;
  const fileName =
    doc.attributes?.find((a) => a.fileName)?.fileName || "project.zip";

  if (!fileName.endsWith(".zip")) {
    await send(
      chatId,
      `╔══════════════════════════════════╗\n` +
      `║     🚨 INVALID FORMAT    ║\n` +
      `╚══════════════════════════════════╝\n\n` +
      `────────────────────────────────\n` +
      `❌ **FORMAT FILE TIDAK DIDUKUNG!**\n` +
      `────────────────────────────────\n\n` +
      `File yang kamu kirim berformat salah bray.\n` +
      `• **Ekstensi Wajib:** \`.zip\`\n\n` +
      `💡 __Silakan kompres ulang project Flutter kamu menjadi file .zip lalu kirimkan kembali ke sini!__`
    );
    return true;
  }

  const fileSizeMB = (doc.size / 1024 / 1024).toFixed(1);

  const statusMsg = await send(
    chatId,
    `╔══════════════════════════════════╗\n` +
    `║    📥 DOWNLOADING ZIP    ║\n` +
    `╚══════════════════════════════════╝\n\n` +
    `────────────────────────────────\n` +
    `📦 **File Name** ➜ \`${fileName}\`\n` +
    `📏 **File Size** ➜ \`${fileSizeMB} MB\`\n` +
    `────────────────────────────────\n\n` +
    `⏳ __Sedang mengunduh file ke lokal server, harap tunggu sebentar...__`
  );

  const msgId = statusMsg.id;

  try {
    if (!fs.existsSync(CONFIG.TMP_DIR)) {
      fs.mkdirSync(CONFIG.TMP_DIR, { recursive: true });
    }

    const localZip = tmpPath(`renameapp_${userId}_${Date.now()}.zip`);
    await client.downloadMedia(msg, { outputFile: localZip });

    const zipCheck = new AdmZip(localZip);
    const checkEntries = zipCheck.getEntries();
    const hasLib = checkEntries.some((e) => /(^|\/)lib\//.test(e.entryName.replace(/\\/g, "/")));
    const hasManifest = checkEntries.some((e) =>
      e.entryName.replace(/\\/g, "/").endsWith("android/app/src/main/AndroidManifest.xml")
    );

    if (!hasLib || !hasManifest) {
      if (fs.existsSync(localZip)) fs.unlinkSync(localZip);
      removeUserJob(userId);
      await edit(
        chatId,
        msgId,
        `╔══════════════════════════════════╗\n` +
        `║   ⚠️ STRUKTUR INVALID   ║\n` +
        `╚══════════════════════════════════╝\n\n` +
        `────────────────────────────────\n` +
        `❌ Zip kamu tidak memiliki folder \`lib/\` dan/atau file \`android/app/src/main/AndroidManifest.xml\`.\n\n` +
        `💡 __Pastikan struktur project Flutter kamu lengkap & valid lalu coba lagi.__`,
        [[{ text: "🏠 Menu Utama", data: "start" }]]
      );
      return true;
    }

    setUserJob(userId, {
      ...job,
      status: "waiting_old_appname",
      zipPath: localZip,
      fileName,
      fileSizeMB,
      updatedAt: Date.now(),
    });

    await edit(
      chatId,
      msgId,
      `╔══════════════════════════════════╗\n` +
      `║     ✅ DOWNLOAD DONE     ║\n` +
      `╚══════════════════════════════════╝\n\n` +
      `────────────────────────────────\n` +
      `📦 **File Name** ➜ \`${fileName}\`\n` +
      `📏 **File Size** ➜ \`${fileSizeMB} MB\`\n` +
      `────────────────────────────────\n\n` +
      `✅ **File zip diterima!**\n\n` +
      `Masukkan **nama app lama** yang ingin diganti.\n\n` +
      `📌 Contoh:\n` +
      `\`MyApp\``,
      [[{ text: "❌ Batalkan", data: "cancel" }]]
    );
  } catch (err) {
    removeUserJob(userId);
    await edit(
      chatId,
      msgId,
      `╔══════════════════════════════════╗\n` +
      `║     ❌ PROCESS FAILED    ║\n` +
      `╚══════════════════════════════════╝\n\n` +
      `────────────────────────────────\n` +
      `🛑 **LOG ERROR EXECUTION:**\n` +
      `\`${err.message}\`\n` +
      `────────────────────────────────\n\n` +
      `⚠️ __Gagal memproses file. Coba lagi bray!__`
    );
  }

  return true;
}

async function handleRenameAppNameOldName(event) {
  const chatId = event.chatId;
  const userId = Number(event.message.senderId);
  const text = event.message.text?.trim();
  const job = getUserJob(userId);

  if (!job || job.status !== "waiting_old_appname" || job.type !== "rename_appname") return false;

  if (!text || text.length < 1) {
    await send(chatId, `❌ **Nama app lama tidak valid!**\n\nKirim nama app yang valid, contoh: \`MyApp\``);
    return true;
  }

  setUserJob(userId, { ...job, status: "waiting_new_appname", oldAppName: text, updatedAt: Date.now() });

  await send(
    chatId,
    `✅ **Nama app lama:** \`${text}\`\n\n` +
    `Sekarang masukkan **nama app baru** yang ingin dipasang.\n\n` +
    `📌 Contoh:\n` +
    `\`MyNewApp\``,
    [[{ text: "❌ Batalkan", data: "cancel" }]]
  );
  return true;
}

async function handleRenameAppNameNewName(event) {
  const chatId = event.chatId;
  const userId = Number(event.message.senderId);
  const text = event.message.text?.trim();
  const job = getUserJob(userId);

  if (!job || job.status !== "waiting_new_appname" || job.type !== "rename_appname") return false;

  if (!text || text.length < 1) {
    await send(chatId, `❌ **Nama app baru tidak valid!**\n\nKirim nama app yang valid, contoh: \`MyNewApp\``);
    return true;
  }

  const oldAppName = job.oldAppName;
  const newAppName = text;

  const statusMsg = await send(
    chatId,
    `⚙️ **Memproses Rename Nama Apk...**\n` +
    `────────────────────────────────\n\n` +
    `🔍 **Nama Lama :** \`${oldAppName}\`\n` +
    `🆕 **Nama Baru :** \`${newAppName}\`\n\n` +
    `⏳ __Sedang mengganti label & referensi nama app di AndroidManifest.xml dan folder lib/...__`
  );

  const msgId = statusMsg.id;

  try {
    if (!job.zipPath || !fs.existsSync(job.zipPath)) {
      throw new Error("File ZIP sumber sudah tidak ditemukan di server, silakan ulangi dari awal.");
    }

    const zip = new AdmZip(job.zipPath);
    const entries = zip.getEntries();

    let replacedCount = 0;
    let filesAffected = 0;
    let manifestUpdated = false;

    for (const entry of entries) {
      if (entry.isDirectory) continue;

      const normalizedPath = entry.entryName.replace(/\\/g, "/");
      const inLibFolder = /(^|\/)lib\//.test(normalizedPath);
      const isManifest = normalizedPath.endsWith("android/app/src/main/AndroidManifest.xml");

      if (!inLibFolder && !isManifest) continue;

      let content;
      try {
        content = entry.getData().toString("utf8");
      } catch (_) {
        continue;
      }

      if (content.includes(oldAppName)) {
        const occurrences = content.split(oldAppName).length - 1;
        const newContent = content.split(oldAppName).join(newAppName);
        zip.updateFile(entry, Buffer.from(newContent, "utf8"));
        replacedCount += occurrences;
        filesAffected += 1;
        if (isManifest) manifestUpdated = true;
      }
    }

    if (filesAffected === 0) {
      if (fs.existsSync(job.zipPath)) fs.unlinkSync(job.zipPath);
      removeUserJob(userId);

      await edit(
        chatId,
        msgId,
        `╔══════════════════════════════════╗\n` +
        `║  ⚠️ NAMA TIDAK DITEMUKAN ║\n` +
        `╚══════════════════════════════════╝\n\n` +
        `────────────────────────────────\n` +
        `❌ Nama \`${oldAppName}\` tidak ditemukan di \`AndroidManifest.xml\` maupun folder \`lib/\` project kamu.\n\n` +
        `💡 __Pastikan nama app lama yang kamu kirim sudah benar dan persis sama dengan yang ada di kodingan (case-sensitive).__`,
        [[{ text: "🏠 Menu Utama", data: "start" }]]
      );
      return true;
    }

    const outZipPath = tmpPath(`renamedapp_${userId}_${Date.now()}.zip`);
    zip.writeZip(outZipPath);

    await edit(
      chatId,
      msgId,
      `╔══════════════════════════════════╗\n` +
      `║   📤 UPLOADING RESULT   ║\n` +
      `╚══════════════════════════════════╝\n\n` +
      `────────────────────────────────\n` +
      `✅ **${filesAffected}** berkas berhasil diubah\n` +
      `🔄 **${replacedCount}** kemunculan nama diganti\n` +
      `🏷️ **AndroidManifest.xml** ➜ ${manifestUpdated ? "Terupdate ✅" : "Tidak berubah ⚠️"}\n` +
      `────────────────────────────────\n\n` +
      `⏳ __Mengunggah ZIP hasil ke chat kamu...__`
    );

    const outFileName = job.fileName ? job.fileName.replace(/\.zip$/i, "_renamed_app.zip") : "project_renamed_app.zip";

    await client.sendFile(chatId, {
      file: outZipPath,
      forceDocument: true,
      attributes: [new Api.DocumentAttributeFilename({ fileName: outFileName })],
      caption:
        `✅ **RENAME NAMA APK SELESAI!** 🎉\n` +
        `────────────────────────────────\n\n` +
        `🔍 **Nama Lama :** \`${oldAppName}\`\n` +
        `🆕 **Nama Baru :** \`${newAppName}\`\n` +
        `📂 **File Diubah :** \`${filesAffected}\`\n` +
        `🔄 **Total Diganti :** \`${replacedCount}\` kemunculan\n` +
        `────────────────────────────────\n\n` +
        `__Terima kasih telah menggunakan layanan ${CONFIG.BOT_NAME}!__`,
      parseMode: "md",
    });

    if (fs.existsSync(job.zipPath)) fs.unlinkSync(job.zipPath);
    if (fs.existsSync(outZipPath)) fs.unlinkSync(outZipPath);

    await edit(
      chatId,
      msgId,
      `✅ **Rename Nama Apk Selesai!**\n\nBerkas ZIP hasil sudah dikirim ke chat di atas. 🎉`,
      [[{ text: "🏠 Menu Utama", data: "start" }]]
    );

    removeUserJob(userId);
  } catch (err) {
    if (job.zipPath && fs.existsSync(job.zipPath)) {
      try { fs.unlinkSync(job.zipPath); } catch (_) {}
    }
    removeUserJob(userId);

    await edit(
      chatId,
      msgId,
      `╔══════════════════════════════════╗\n` +
      `║     ❌ PROCESS FAILED    ║\n` +
      `╚══════════════════════════════════╝\n\n` +
      `────────────────────────────────\n` +
      `🛑 **LOG ERROR EXECUTION:**\n` +
      `\`${err.message}\`\n` +
      `────────────────────────────────\n\n` +
      `⚠️ __Gagal memproses file zip. Pastikan struktur project valid dan coba lagi bray!__`
    );
  }

  return true;
}

Object.assign(globalThis, { handleRenameDomain, handleRenameZipFile, handleRenameDomainPick, handleRenameOldDomain, handleRenameNewDomain, handleRenameApi, handleRenameApiZipFile, handleRenameApiOldText, handleRenameApiNewText, handleAddFitur, handleAddFiturZipFile, handleAddFiturDartFile, finalizeAddFitur, handleRenameAppName, handleRenameAppNameZipFile, handleRenameAppNameOldName, handleRenameAppNameNewName });

module.exports = { handleRenameDomain, handleRenameZipFile, handleRenameDomainPick, handleRenameOldDomain, handleRenameNewDomain, handleRenameApi, handleRenameApiZipFile, handleRenameApiOldText, handleRenameApiNewText, handleAddFitur, handleAddFiturZipFile, handleAddFiturDartFile, finalizeAddFitur, handleRenameAppName, handleRenameAppNameZipFile, handleRenameAppNameOldName, handleRenameAppNameNewName };
