// Auto-split from the original index.js. Logic preserved.

async function handleGantiAset(chatId, userId, deleteMsgId = null) {
  // ── Credit Check ──
  const creditCheckGA = checkCredit(userId);
  if (!creditCheckGA.ok) {
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
  await sendActionNotification(userId, 'Ganti Aset');

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
    status: "waiting_zip_asset",
    chatId,
    userId,
    username,
    fullName,
    type: "ganti_aset",
    updatedAt: Date.now(),
  });

  await send(
    chatId,
    `📁 **Ganti Aset**\n\n` +
    `Silakan kirim file **.zip** project Flutter kamu (yang berisi folder \`assets\`).`,
    [[{ text: "❌ Batalkan", data: "cancel" }]],
    deleteMsgId
  );
}

async function handleGantiAsetZipFile(event) {
  const chatId = event.chatId;
  const userId = Number(event.message.senderId);
  const msg = event.message;
  const job = getUserJob(userId);

  if (!job || job.status !== "waiting_zip_asset" || job.type !== "ganti_aset") return false;

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

  const statusMsg = await send(chatId, `📥 **Mengunduh ZIP...**\n\n📦 **File** ➜ \`${fileName}\`\n\n⏳ __Tunggu sebentar...__`);

  try {
    if (!fs.existsSync(CONFIG.TMP_DIR)) fs.mkdirSync(CONFIG.TMP_DIR, { recursive: true });

    const localZip = tmpPath(`asset_${userId}_${Date.now()}.zip`);
    await client.downloadMedia(msg, { outputFile: localZip });

    const zip = new AdmZip(localZip);
    const assetsBase = findAssetsBase(zip);

    if (!assetsBase) {
      if (fs.existsSync(localZip)) fs.unlinkSync(localZip);
      removeUserJob(userId);
      await edit(
        chatId,
        statusMsg.id,
        `⚠️ **FOLDER ASSETS TIDAK DITEMUKAN!**\n` +
        `────────────────────────────────\n\n` +
        `❌ Project zip kamu tidak memiliki folder \`assets/\`.\n\n` +
        `💡 __Pastikan struktur project memiliki folder bernama \`assets\` lalu coba lagi.__`,
        [[{ text: "🏠 Menu Utama", data: "start" }]]
      );
      return true;
    }

    setUserJob(userId, {
      ...job,
      zipPath: localZip,
      fileName,
      assetsBase,
      currentPath: assetsBase,
      changedCount: 0,
      updatedAt: Date.now(),
    });

    await renderAssetBrowser(chatId, userId, statusMsg.id);
  } catch (err) {
    removeUserJob(userId);
    await edit(
      chatId,
      statusMsg.id,
      `❌ **PROCESS FAILED**\n\n🛑 **Error:** \`${err.message}\``
    );
  }

  return true;
}

async function renderAssetBrowser(chatId, userId, msgId) {
  const job = getUserJob(userId);
  if (!job || job.type !== "ganti_aset" || !job.zipPath) return;

  let zip;
  try {
    zip = new AdmZip(job.zipPath);
  } catch (err) {
    await edit(chatId, msgId, `❌ **Gagal membaca ZIP!**\n\n\`${err.message}\``);
    return;
  }

  const entries = zip.getEntries();
  const currentPath = job.currentPath || job.assetsBase;

  const childrenMap = new Map();
  for (const entry of entries) {
    const normalized = entry.entryName.replace(/\\/g, "/");
    if (!normalized.startsWith(currentPath)) continue;
    const rest = normalized.slice(currentPath.length);
    if (!rest) continue;

    const slashIdx = rest.indexOf("/");
    if (slashIdx === -1) {
      if (!entry.isDirectory) {
        childrenMap.set(rest, { isDir: false, fullPath: currentPath + rest });
      }
    } else {
      const folderName = rest.slice(0, slashIdx);
      if (folderName) {
        childrenMap.set(folderName, { isDir: true, fullPath: currentPath + folderName + "/" });
      }
    }
  }

  const childrenArr = Array.from(childrenMap.entries()).sort((a, b) => {
    if (a[1].isDir !== b[1].isDir) return a[1].isDir ? -1 : 1;
    return a[0].localeCompare(b[0]);
  });

  const pathMap = {};
  const buttons = [];

  childrenArr.forEach(([name, info], i) => {
    const idx = String(i);
    pathMap[idx] = info.fullPath;
    const icon = assetIconFor(name, info.isDir);
    buttons.push([{ text: `${icon} ${name}`, data: info.isDir ? `ga_n_${idx}` : `ga_f_${idx}` }]);
  });

  const navRow = [];
  if (currentPath !== job.assetsBase) navRow.push({ text: "⬅️ Kembali", data: "ga_back" });
  navRow.push({ text: "✅ Selesai & Kirim ZIP", data: "ga_done" });
  buttons.push(navRow);
  buttons.push([{ text: "❌ Batalkan", data: "cancel" }]);

  setUserJob(userId, { ...job, status: "browsing", currentPath, pathMap, updatedAt: Date.now() });

  const displayPath = currentPath.startsWith(job.assetsBase)
    ? "assets/" + currentPath.slice(job.assetsBase.length)
    : currentPath;

  const changedNote = job.changedCount ? `\n🔄 **Sudah diganti:** \`${job.changedCount}\` aset\n` : "";

  const text =
    `✅ **Zip diterima!**\n\n` +
    `📁 **Ganti Aset**\n\n` +
    `📂 \`${displayPath || "assets/"}\`\n` +
    `${changedNote}\n` +
    `Pilih folder atau file yang ingin diganti.\n` +
    `📁 = folder   🖼️ = gambar   🎬 = video`;

  if (childrenArr.length === 0) {
    await edit(chatId, msgId, text + `\n\n_(Folder ini kosong)_`, buttons);
  } else {
    await edit(chatId, msgId, text, buttons);
  }
}

async function handleGantiAsetNewFile(event) {
  const chatId = event.chatId;
  const userId = Number(event.message.senderId);
  const msg = event.message;
  const job = getUserJob(userId);

  if (!job || job.status !== "waiting_new_file" || job.type !== "ganti_aset") return false;

  const media = msg.media;
  if (!media || (!media.photo && !media.document)) {
    await send(chatId, `⚠️ **Kirim file dalam bentuk Foto, Gambar, atau Video!**`);
    return true;
  }

  const statusMsg = await send(chatId, `⏳ **Mengganti aset...**\n\nMengunduh & memproses file baru...`);

  try {
    if (!fs.existsSync(CONFIG.TMP_DIR)) fs.mkdirSync(CONFIG.TMP_DIR, { recursive: true });

    const tmpNew = tmpPath(`newasset_${userId}_${Date.now()}`);
    await client.downloadMedia(msg, { outputFile: tmpNew });
    const newData = fs.readFileSync(tmpNew);
    if (fs.existsSync(tmpNew)) fs.unlinkSync(tmpNew);

    const zip = new AdmZip(job.zipPath);
    const entry = zip
      .getEntries()
      .find((e) => e.entryName.replace(/\\/g, "/") === job.selectedPath);

    if (!entry) {
      throw new Error("File asli sudah tidak ditemukan lagi di dalam ZIP.");
    }

    zip.updateFile(entry, newData);
    zip.writeZip(job.zipPath);

    const fileLabel = job.selectedPath.split("/").pop();

    setUserJob(userId, {
      ...job,
      status: "browsing",
      selectedPath: null,
      changedCount: (job.changedCount || 0) + 1,
      updatedAt: Date.now(),
    });

    await edit(chatId, statusMsg.id, `✅ **Berhasil mengganti** \`${fileLabel}\`!`);
    await renderAssetBrowser(chatId, userId, statusMsg.id);
  } catch (err) {
    await edit(chatId, statusMsg.id, `❌ **Gagal mengganti aset!**\n\n🛑 \`${err.message}\``);
  }

  return true;
}

function assetKindFor(name) {
  const ext = (name.split(".").pop() || "").toLowerCase();
  if (["png", "jpg", "jpeg", "webp", "bmp"].includes(ext)) return "photo";
  if (["mp4", "mov", "avi", "mkv", "webm", "3gp"].includes(ext)) return "video";
  return "document";
}

async function sendAssetFileToUser(chatId, replyTo, entry, fileLabel) {
  const data = entry.getData();
  const kind = assetKindFor(fileLabel);

  const opts = {
    file: data,
    attributes: [new Api.DocumentAttributeFilename({ fileName: fileLabel })],
    caption: `📦 \`${fileLabel}\``,
    parseMode: "md",
    forceDocument: kind === "document",
  };

  if (replyTo) opts.replyTo = replyTo;

  await client.sendFile(chatId, opts);
}

async function handleGetAset(chatId, userId, deleteMsgId = null) {
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
  await sendActionNotification(userId, 'Get Aset');

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
    status: "waiting_zip_get_aset",
    chatId,
    userId,
    username,
    fullName,
    type: "get_aset",
    sentCount: 0,
    updatedAt: Date.now(),
  });

  await send(
    chatId,
    `📥 **Get Aset (Foto/Video/Icon)**\n\n` +
    `Silakan kirim file **.zip** project Flutter kamu (yang berisi folder \`assets\`).\n\n` +
    `⚠️ __Bot tidak akan mengubah project kamu sama sekali, hanya mengambil & mengirim ulang file aset yang kamu pilih.__`,
    [[{ text: "❌ Batalkan", data: "cancel" }]],
    deleteMsgId
  );
}

async function handleGetAsetZipFile(event) {
  const chatId = event.chatId;
  const userId = Number(event.message.senderId);
  const msg = event.message;
  const job = getUserJob(userId);

  if (!job || job.status !== "waiting_zip_get_aset" || job.type !== "get_aset") return false;

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

  const statusMsg = await send(chatId, `📥 **Mengunduh ZIP...**\n\n📦 **File** ➜ \`${fileName}\`\n\n⏳ __Tunggu sebentar...__`);

  try {
    if (!fs.existsSync(CONFIG.TMP_DIR)) fs.mkdirSync(CONFIG.TMP_DIR, { recursive: true });

    const localZip = tmpPath(`getaset_${userId}_${Date.now()}.zip`);
    await client.downloadMedia(msg, { outputFile: localZip });

    const zip = new AdmZip(localZip);
    const assetsBase = findAssetsBase(zip);

    if (!assetsBase) {
      if (fs.existsSync(localZip)) fs.unlinkSync(localZip);
      removeUserJob(userId);
      await edit(
        chatId,
        statusMsg.id,
        `⚠️ **FOLDER ASSETS TIDAK DITEMUKAN!**\n` +
        `────────────────────────────────\n\n` +
        `❌ Project zip kamu tidak memiliki folder \`assets/\`.\n\n` +
        `💡 __Pastikan struktur project memiliki folder bernama \`assets\` lalu coba lagi.__`,
        [[{ text: "🏠 Menu Utama", data: "start" }]]
      );
      return true;
    }

    setUserJob(userId, {
      ...job,
      zipPath: localZip,
      fileName,
      assetsBase,
      currentPath: assetsBase,
      sentCount: 0,
      updatedAt: Date.now(),
    });

    await renderGetAssetBrowser(chatId, userId, statusMsg.id);
  } catch (err) {
    removeUserJob(userId);
    await edit(
      chatId,
      statusMsg.id,
      `❌ **PROCESS FAILED**\n\n🛑 **Error:** \`${err.message}\``
    );
  }

  return true;
}

async function renderGetAssetBrowser(chatId, userId, msgId) {
  const job = getUserJob(userId);
  if (!job || job.type !== "get_aset" || !job.zipPath) return;

  let zip;
  try {
    zip = new AdmZip(job.zipPath);
  } catch (err) {
    await edit(chatId, msgId, `❌ **Gagal membaca ZIP!**\n\n\`${err.message}\``);
    return;
  }

  const entries = zip.getEntries();
  const currentPath = job.currentPath || job.assetsBase;

  const childrenMap = new Map();
  for (const entry of entries) {
    const normalized = entry.entryName.replace(/\\/g, "/");
    if (!normalized.startsWith(currentPath)) continue;
    const rest = normalized.slice(currentPath.length);
    if (!rest) continue;

    const slashIdx = rest.indexOf("/");
    if (slashIdx === -1) {
      if (!entry.isDirectory) {
        childrenMap.set(rest, { isDir: false, fullPath: currentPath + rest });
      }
    } else {
      const folderName = rest.slice(0, slashIdx);
      if (folderName) {
        childrenMap.set(folderName, { isDir: true, fullPath: currentPath + folderName + "/" });
      }
    }
  }

  const childrenArr = Array.from(childrenMap.entries()).sort((a, b) => {
    if (a[1].isDir !== b[1].isDir) return a[1].isDir ? -1 : 1;
    return a[0].localeCompare(b[0]);
  });

  const pathMap = {};
  const buttons = [];

  childrenArr.forEach(([name, info], i) => {
    const idx = String(i);
    pathMap[idx] = info.fullPath;
    const icon = assetIconFor(name, info.isDir);
    buttons.push([{ text: `${icon} ${name}`, data: info.isDir ? `gt_n_${idx}` : `gt_f_${idx}` }]);
  });

  const navRow = [];
  if (currentPath !== job.assetsBase) navRow.push({ text: "⬅️ Kembali", data: "gt_back" });
  navRow.push({ text: "🏠 Selesai", data: "gt_close" });
  buttons.push(navRow);
  buttons.push([{ text: "❌ Batalkan", data: "cancel" }]);

  setUserJob(userId, { ...job, status: "browsing_get_aset", currentPath, pathMap, updatedAt: Date.now() });

  const displayPath = currentPath.startsWith(job.assetsBase)
    ? "assets/" + currentPath.slice(job.assetsBase.length)
    : currentPath;

  const sentNote = job.sentCount ? `\n📤 **Sudah dikirim:** \`${job.sentCount}\` aset\n` : "";

  const text =
    `✅ **Zip diterima!**\n\n` +
    `📥 **Get Aset (Foto/Video/Icon)**\n\n` +
    `📂 \`${displayPath || "assets/"}\`\n` +
    `${sentNote}\n` +
    `Pilih folder untuk menjelajah, atau pilih file untuk langsung diambil/dikirim.\n` +
    `📁 = folder   🖼️ = gambar   🎬 = video   📄 = lainnya/icon`;

  if (childrenArr.length === 0) {
    await edit(chatId, msgId, text + `\n\n_(Folder ini kosong)_`, buttons);
  } else {
    await edit(chatId, msgId, text, buttons);
  }
}

async function finalizeGetAset(chatId, userId, msgId) {
  const job = getUserJob(userId);
  if (!job || job.type !== "get_aset") return;

  if (job.zipPath && fs.existsSync(job.zipPath)) {
    try { fs.unlinkSync(job.zipPath); } catch (_) {}
  }
  removeUserJob(userId);

  await edit(
    chatId,
    msgId,
    `✅ **Get Aset Selesai!**\n\n📤 **Total aset dikirim:** \`${job.sentCount || 0}\`\n\nSemua file yang kamu pilih sudah dikirim di chat ini. 🎉`,
    [[{ text: "🏠 Menu Utama", data: "start" }]]
  );
}

async function finalizeGantiAset(chatId, userId, msgId) {
  const job = getUserJob(userId);
  if (!job || job.type !== "ganti_aset") return;

  if (!job.changedCount) {
    await renderAssetBrowser(chatId, userId, msgId);
    return;
  }

  await edit(
    chatId,
    msgId,
    `📤 **Mengunggah ZIP Hasil...**\n\n✅ **${job.changedCount}** aset berhasil diganti.`
  );

  try {
    const outFileName = job.fileName ? job.fileName.replace(/\.zip$/i, "_updated.zip") : "project_updated.zip";

    await client.sendFile(chatId, {
      file: job.zipPath,
      forceDocument: true,
      attributes: [new Api.DocumentAttributeFilename({ fileName: outFileName })],
      caption:
        `✅ **GANTI ASET SELESAI!** 🎉\n` +
        `────────────────────────────────\n\n` +
        `🔄 **Total Aset Diganti :** \`${job.changedCount}\`\n` +
        `────────────────────────────────\n\n` +
        `__Terima kasih telah menggunakan layanan ${CONFIG.BOT_NAME}!__`,
      parseMode: "md",
    });

    if (fs.existsSync(job.zipPath)) fs.unlinkSync(job.zipPath);
    removeUserJob(userId);

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
      `✅ **Ganti Aset Selesai!**\n\nBerkas ZIP hasil sudah dikirim ke chat di atas. 🎉`,
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

async function handleUserReportMessages(event) {
  const sender = await event.message.getSender();
  const userId = Number(sender?.id);
  const chatId = event.chatId;
  const messageText = event.message.text;

  const currentState = userStates.get(userId);
  if (!currentState) return false; 

  if (currentState.step === 'WAITING_FOR_REASON') {
    if (!messageText || messageText.length < 10) {
      await client.sendMessage(chatId, { 
        message: "⚠️ **Mohon berikan alasan yang lebih detail (minimal 10 karakter agar admin paham penjelasannya).**",
        buttons: buildButtons([[{ text: "❌ Batalkan Laporan", data: "cancel" }]]),
        parseMode: "md"
      });
      return true;
    }
    
    userStates.set(userId, { step: 'WAITING_FOR_SCREENSHOT', reason: messageText });
    await client.sendMessage(chatId, {
      message: `📸 **BUKTI SCREENSHOT**\n\n` +
               `Sekarang, silakan kirimkan **1 Foto/Screenshot** bukti pendukung kendala tersebut untuk mempermudah perbaikan.`,
      parseMode: "md",
      buttons: buildButtons([[{ text: "❌ Batalkan Laporan", data: "cancel" }]])
    });
    return true;
  }

  if (currentState.step === 'WAITING_FOR_SCREENSHOT') {
    if (!event.message.media || !(event.message.media instanceof Api.MessageMediaPhoto)) {
      await client.sendMessage(chatId, { 
        message: "⚠️ **Format salah! Silakan kirimkan bukti file berupa Gambar/Foto.**",
        buttons: buildButtons([[{ text: "❌ Batalkan Laporan", data: "cancel" }]]),
        parseMode: "md"
      });
      return true;
    }

    const username = sender?.username ? `@${sender.username}` : "Tidak ada username";
    const firstName = sender?.firstName || "User";
    const lastName = sender?.lastName ? `\u00A0${sender.lastName}` : "";
    const name = sender?.firstName || "User";
    const mention = `<a href="tg://user?id=${userId}">${firstName}${lastName}</a>`;
    
    const adminReportLog = 
  `🚨 <b>LAPORAN MASUK</b>\n\n` +
  `👤 <b>Pengirim:</b> ${mention}\n` +
  `🆔 <b>User ID:</b> <code>${userId}</code>\n` +
  `🌐 <b>Username:</b> <code>${username}</code>\n\n` +
  `📝 <b>Detail Alasan:</b>\n` +
  `<i>"${currentState.reason}"</i>\n\n` +
  `📌 <b>Tindakan Admin:</b>`;

    try {
      const reportIconPath = tmpPath(`report_${userId}_${Date.now()}.jpg`);
      await client.downloadMedia(event.message, { outputFile: reportIconPath });

      await client.sendMessage(CONFIG.CHANNEL_USERNAME, {
        message: adminReportLog,
        file: reportIconPath, 
        parseMode: "html",
        buttons: buildButtons([
          [{ text: "✅ Masalah Selesai", data: `adm_fix_${userId}` }],
          [
            { text: "🔒 Blokir", data: `adm_blk_${userId}` },
            { text: "🔓 Unblokir", data: `adm_unblk_${userId}` }
          ]
        ])
      });

      if (fs.existsSync(reportIconPath)) fs.unlinkSync(reportIconPath);

      await client.sendMessage(chatId, {
        message: `✅ **Laporan Sukses Dikirim**\n\nTerima kasih, laporan lengkap dan bukti screenshot kamu sudah berhasil masuk ke sistem penanganan admin. Kami akan segera mengeceknya.`,
        parseMode: "md"
      });

    } catch (e) {
      console.error("Gagal mengirim laporan:", e.message);
      await client.sendMessage(chatId, { message: "❌ Terjadi gangguan internal sistem, gagal mengirim laporan." });
    }

    userStates.delete(userId);
    return true;
  }
  return false;
}

async function handleAddResellerCommand(chatId, userId) {
  const isOwner = isAdmin(userId);

  const text =
    `🏪 **PANEL ${isOwner ? "OWNER" : "RESELLER"}**\n` +
    `────────────────────────────────\n\n` +
    `${isOwner
      ? `Sebagai **Owner**, kamu bisa:\n• ➕ Add Reseller baru\n• 💳 Add Credit ke user mana saja\n• ❌ Remove Reseller`
      : `Sebagai **Reseller**, kamu bisa:\n• 💳 Add Credit ke user pelanggan kamu`
    }\n\n` +
    `Pilih aksi di bawah 👇`;

  const buttons = isOwner
    ? [
        [{ text: "➕ Add Reseller Baru", data: "res_add_reseller" }],
        [{ text: "💳 Add Credit ke User", data: "res_add_credit" }],
        [{ text: "❌ Remove Reseller", data: "res_remove_reseller" }],
        [{ text: "📋 Daftar Reseller", data: "res_list" }],
        [{ text: "🏠 Menu Utama", data: "start" }],
      ]
    : [
        [{ text: "💳 Add Credit ke User", data: "res_add_credit" }],
        [{ text: "🏠 Menu Utama", data: "start" }],
      ];

  return send(chatId, text, buttons);
}

async function handleAdminCreditMessages(event) {
  const sender = await event.message.getSender();
  const userId = Number(sender?.id);
  const chatId = event.chatId;
  const messageText = event.message.text?.trim();

  const currentState = userStates.get(userId);
  if (!currentState) return false;

  const adminSteps = ["ADMIN_WAITING_SET_CREDIT", "ADMIN_WAITING_ADD_CREDIT"];
  const resellerSteps = ["RES_WAITING_ADD_CREDIT", "RES_WAITING_ADD_RESELLER", "RES_WAITING_REMOVE_RESELLER", "RES_WAITING_CREDIT_AMOUNT"];
  const allSteps = [...adminSteps, ...resellerSteps];

  if (!allSteps.includes(currentState.step)) return false;

  // ── Reseller: add credit to a user ──
  if (currentState.step === "RES_WAITING_ADD_CREDIT") {
    if (!isResellerOrAdmin(userId)) { userStates.delete(userId); return false; }

    const matchId = messageText?.match(/^(\d+)\s+(\d+)$/);
    const matchUsername = messageText?.match(/^@?(\w+)\s+(\d+)$/);

    let targetUserId = null;
    let targetLabel = null;
    let amount = 0;

    if (matchId) {
      targetUserId = Number(matchId[1]);
      amount = Number(matchId[2]);
      targetLabel = `\`${targetUserId}\``;
    } else if (matchUsername) {
      const uname = matchUsername[1];
      amount = Number(matchUsername[2]);
      const allUsers = db.getAllUsers();
      const found = allUsers.find(u =>
        u.username && u.username.replace("@", "").toLowerCase() === uname.toLowerCase()
      );
      if (found) {
        targetUserId = found.userId;
        targetLabel = `@${uname} (\`${targetUserId}\`)`;
      } else {
        try {
          const entity = await client.getEntity(`@${uname}`);
          targetUserId = Number(entity.id);
          targetLabel = `@${uname} (\`${targetUserId}\`)`;
        } catch (_) {
          await client.sendMessage(chatId, {
            message:
              `⚠️ **Username @${uname} tidak ditemukan!**\n\n` +
              `Pastikan username benar, atau gunakan **User ID** langsung.\n\n` +
              `Format: \`USER_ID JUMLAH\` atau \`@username JUMLAH\``,
            parseMode: "md",
            buttons: buildButtons([
              [{ text: "📋 Pilih dari Daftar User", data: "res_userlist_0" }],
              [{ text: "❌ Batalkan", data: "cancel" }],
            ]),
          });
          return true;
        }
      }
    } else {
      await client.sendMessage(chatId, {
        message:
          `⚠️ **Format salah!**\n\n` +
          `Kirim salah satu format berikut:\n` +
          `• \`USER_ID JUMLAH\` ➜ contoh: \`123456789 10\`\n` +
          `• \`@username JUMLAH\` ➜ contoh: \`@namauser 10\``,
        parseMode: "md",
        buttons: buildButtons([
          [{ text: "📋 Pilih dari Daftar User", data: "res_userlist_0" }],
          [{ text: "❌ Batalkan", data: "cancel" }],
        ]),
      });
      return true;
    }

    if (amount < 1) {
      await client.sendMessage(chatId, {
        message: `⚠️ **Jumlah credit harus minimal 1!**`,
        parseMode: "md",
        buttons: buildButtons([[{ text: "❌ Batalkan", data: "cancel" }]]),
      });
      return true;
    }

    const newCredit = db.addUserCredit(targetUserId, amount);
    userStates.delete(userId);

    await client.sendMessage(chatId, {
      message:
        `✅ **CREDIT BERHASIL DITAMBAHKAN**\n` +
        `────────────────────────────────\n\n` +
        `👤 **User           :** ${targetLabel}\n` +
        `➕ **Ditambah       :** \`${amount}\`\n` +
        `💳 **Total Saat Ini :** \`${newCredit}\`\n` +
        `────────────────────────────────`,
      parseMode: "md",
      buttons: buildButtons([[{ text: "🏪 Panel Reseller", data: "res_panel" }], [{ text: "🏠 Menu Utama", data: "start" }]]),
    });

    try {
      await client.sendMessage(targetUserId, {
        message: `💳 **CREDIT KAMU DIPERBARUI**\n\nReseller telah menambahkan credit kamu.\n📊 **Total Saat Ini:** \`${newCredit}\``,
        parseMode: "md",
      });
    } catch (_) {}

    return true;
  }

  // ── Reseller: waiting jumlah setelah pilih dari list ──
  if (currentState.step === "RES_WAITING_CREDIT_AMOUNT") {
    if (!isResellerOrAdmin(userId)) { userStates.delete(userId); return false; }

    const amount = Number(messageText?.trim());
    if (isNaN(amount) || amount < 1) {
      await client.sendMessage(chatId, {
        message: `⚠️ **Jumlah tidak valid!** Kirim angka, contoh: \`10\``,
        parseMode: "md",
        buttons: buildButtons([[{ text: "❌ Batalkan", data: "cancel" }]]),
      });
      return true;
    }

    const targetUserId = currentState.targetUserId;
    const targetLabel = currentState.targetLabel || `\`${targetUserId}\``;
    const newCredit = db.addUserCredit(targetUserId, amount);
    userStates.delete(userId);

    await client.sendMessage(chatId, {
      message:
        `✅ **CREDIT BERHASIL DITAMBAHKAN**\n` +
        `────────────────────────────────\n\n` +
        `👤 **User           :** ${targetLabel}\n` +
        `➕ **Ditambah       :** \`${amount}\`\n` +
        `💳 **Total Saat Ini :** \`${newCredit}\`\n` +
        `────────────────────────────────`,
      parseMode: "md",
      buttons: buildButtons([[{ text: "🏪 Panel Reseller", data: "res_panel" }], [{ text: "🏠 Menu Utama", data: "start" }]]),
    });

    try {
      await client.sendMessage(targetUserId, {
        message: `💳 **CREDIT KAMU DIPERBARUI**\n\nReseller telah menambahkan credit kamu.\n📊 **Total Saat Ini:** \`${newCredit}\``,
        parseMode: "md",
      });
    } catch (_) {}

    return true;
  }

  // ── Owner: add reseller ──
  if (currentState.step === "RES_WAITING_ADD_RESELLER") {
    if (!isAdmin(userId)) { userStates.delete(userId); return false; }

    const targetUserId = Number(messageText?.trim());
    if (isNaN(targetUserId) || targetUserId < 1) {
      await client.sendMessage(chatId, {
        message: `⚠️ **Format salah!**\n\nKirim ID Telegram user yang ingin dijadikan reseller.\nContoh: \`123456789\``,
        parseMode: "md",
        buttons: buildButtons([[{ text: "❌ Batalkan", data: "cancel" }]]),
      });
      return true;
    }

    db.setReseller(targetUserId, true);
    userStates.delete(userId);

    await client.sendMessage(chatId, {
      message:
        `✅ **RESELLER BERHASIL DITAMBAHKAN**\n` +
        `────────────────────────────────\n\n` +
        `🆔 **User ID :** \`${targetUserId}\`\n` +
        `🏪 **Status  :** Reseller Aktif\n` +
        `────────────────────────────────`,
      parseMode: "md",
      buttons: buildButtons([[{ text: "👑 Owner Panel", data: "adm_owner_menu" }]]),
    });

    try {
      await client.sendMessage(targetUserId, {
        message:
          `🏪 **KAMU TELAH DIANGKAT JADI RESELLER!**\n\n` +
          `Gunakan /addreseller untuk mengakses panel reseller kamu.\n` +
          `Kamu bisa menambahkan credit ke user pelanggan kamu.`,
        parseMode: "md",
      });
    } catch (_) {}

    return true;
  }

  // ── Owner: remove reseller ──
  if (currentState.step === "RES_WAITING_REMOVE_RESELLER") {
    if (!isAdmin(userId)) { userStates.delete(userId); return false; }

    const targetUserId = Number(messageText?.trim());
    if (isNaN(targetUserId) || targetUserId < 1) {
      await client.sendMessage(chatId, {
        message: `⚠️ Format salah! Kirim ID Telegram reseller yang ingin dihapus.`,
        parseMode: "md",
        buttons: buildButtons([[{ text: "❌ Batalkan", data: "cancel" }]]),
      });
      return true;
    }

    db.setReseller(targetUserId, false);
    userStates.delete(userId);

    await client.sendMessage(chatId, {
      message:
        `✅ **RESELLER BERHASIL DIHAPUS**\n\n` +
        `🆔 **User ID :** \`${targetUserId}\`\n` +
        `🏪 **Status  :** Tidak aktif sebagai reseller`,
      parseMode: "md",
      buttons: buildButtons([[{ text: "👑 Owner Panel", data: "adm_owner_menu" }]]),
    });
    return true;
  }

  // ── Admin: set/add credit ──
  if (!adminSteps.includes(currentState.step)) return false;
  if (!isAdmin(userId)) {
    userStates.delete(userId);
    return false;
  }

  const isSet = currentState.step === "ADMIN_WAITING_SET_CREDIT";
  const match = messageText?.match(/^(\d+)\s+(-?\d+)$/);

  if (!match) {
    await client.sendMessage(chatId, {
      message:
        `⚠️ **Format salah!**\n\n` +
        `Kirim dengan format: \`USER_ID JUMLAH\`\n` +
        `**Contoh:** \`123456789 50\``,
      parseMode: "md",
      buttons: buildButtons([[{ text: "❌ Batalkan", data: "cancel" }]]),
    });
    return true;
  }

  const targetUserId = Number(match[1]);
  const amount = Number(match[2]);
  const newCredit = isSet ? db.setUserCredit(targetUserId, amount) : db.addUserCredit(targetUserId, amount);

  userStates.delete(userId);

  await client.sendMessage(chatId, {
    message:
      `✅ **${isSet ? "LIMIT/CREDIT BERHASIL DIATUR" : "LIMIT/CREDIT BERHASIL DITAMBAHKAN"}**\n` +
      `────────────────────────────────\n\n` +
      `🆔 **User ID        :** \`${targetUserId}\`\n` +
      `${isSet ? "✏️" : "➕"} **${isSet ? "Diatur ke" : "Ditambah"}    :** \`${amount}\`\n` +
      `💳 **Total Saat Ini :** \`${newCredit}\`\n` +
      `────────────────────────────────`,
    parseMode: "md",
    buttons: buildButtons([[{ text: "👑 Owner Panel", data: "adm_owner_menu" }]]),
  });

  try {
    await client.sendMessage(targetUserId, {
      message:
        `💳 **LIMIT/CREDIT KAMU DIPERBARUI**\n\n` +
        `Admin telah ${isSet ? "mengatur" : "menambahkan"} limit/credit kamu.\n` +
        `📊 **Total Saat Ini:** \`${newCredit}\``,
      parseMode: "md",
    });
  } catch (_) {}

  return true;
}

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return false;
  const stats = fs.statSync(src);
  if (stats.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    const files = fs.readdirSync(src);
    for (const file of files) {
      copyRecursive(path.join(src, file), path.join(dest, file));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
  return true;
}

function rimraf(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const p = path.join(dir, file);
    const stat = fs.statSync(p);
    if (stat.isDirectory()) rimraf(p);
    else fs.unlinkSync(p);
  }
  fs.rmdirSync(dir);
}

async function showExtractedMenu(chatId, userId, msgId) {
  const job = getUserJob(userId);
  if (!job || job.status !== "extracted") return;

  const text =
    `📂 **Project Flutter Siap!**\n` +
    `────────────────────────────────\n\n` +
    `📦 **File:** \`${job.fileName}\`\n` +
    `📏 **Ukuran:** \`${job.fileSizeMB} MB\`\n` +
    `📁 **Lokasi:** \`${job.extractedFolderPath}\`\n\n` +
    `🔧 **Pilih Aksi:**`;

  const buttons = [
    [{ text: "🛠 Add Tools", data: "tools_menu" }, { text: "📂 Copy/Clone", data: "copy_clone" }],
    [{ text: "📦 Export ZIP", data: "export_zip" }, { text: "🚀 Build APK", data: "build_from_extracted" }],
    [{ text: "❌ Batal", data: "cancel" }]
  ];

  await edit(chatId, msgId, text, buttons);
}

Object.assign(globalThis, { handleGantiAset, handleGantiAsetZipFile, renderAssetBrowser, handleGantiAsetNewFile, assetKindFor, sendAssetFileToUser, handleGetAset, handleGetAsetZipFile, renderGetAssetBrowser, finalizeGetAset, finalizeGantiAset, handleUserReportMessages, handleAddResellerCommand, handleAdminCreditMessages, copyRecursive, rimraf, showExtractedMenu });

module.exports = { handleGantiAset, handleGantiAsetZipFile, renderAssetBrowser, handleGantiAsetNewFile, assetKindFor, sendAssetFileToUser, handleGetAset, handleGetAsetZipFile, renderGetAssetBrowser, finalizeGetAset, finalizeGantiAset, handleUserReportMessages, handleAddResellerCommand, handleAdminCreditMessages, copyRecursive, rimraf, showExtractedMenu };
