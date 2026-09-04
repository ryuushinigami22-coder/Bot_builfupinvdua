// src/features/main.js
// Auto-split from the original index.js. Logic preserved.

function escapeHtml(value) { return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;'); }

// --- IMPORTS RENAME ALL ---
const {
    handleRenameAll,
    handleRenameAllZipFile,
    handleRenameAllText,
    handleRenameAllMedia,
    handleRenameAllSkip,
} = require('./renameall');

// --- IMPORTS RECOLOUR ---
const {
    handleRecolourManual,
    handleRecolourAI,
    handleRecolourZipFile,
    handleRecolourText,
    handleRecolourCallback,
} = require('./recolour');

// --- IMPORTS CEK ERROR ---
const {
    handleCekError,
    handleCekErrorText,
    handleCekErrorCallback,
} = require('./cekerror');

// --- IMPORTS LAINNYA ---
const {
    handleGantiAset,
    handleGantiAsetZipFile,
    renderAssetBrowser,
    handleGantiAsetNewFile,
    assetKindFor,
    sendAssetFileToUser,
    handleGetAset,
    handleGetAsetZipFile,
    renderGetAssetBrowser,
    finalizeGetAset,
    finalizeGantiAset,
    handleUserReportMessages,
    handleAddResellerCommand,
    handleAdminCreditMessages,
    copyRecursive,
    rimraf,
    showExtractedMenu,
} = require('./assets');

// --- IMPORTS DART PREVIEW ---
const {
    handleDartPreview,
    handleDartPreviewFile,
    handleDartPreviewCallback,
} = require('./dartpreview');

// --- IMPORTS OWNER ---
const {
    handleOwnerMenu,
    handleBroadcast,
    handleBroadcastMessage,
    handleStopBroadcast,
    handleBlockUser,
    handleUnblockUser,
    handleBlockBuild,
    handleUnblockBuild,
    handleStopAllBuild,
    handleListBlockedUsers,
    handleOwnerCallback,
    handleBlockUnblockText,
    handleBlockBuildText,
    handleCreditTextInput,
    handleMaintenanceMessageInput,
    isUserBlocked,
    isBuildBlocked,
    checkMaintenance,
    getMaintenanceMessage,
    activeBroadcast,
} = require('./owner');

// --- IMPORTS VIRUS SCANNER ---
const {
    scanZipForVirus,
    formatScanResults,
    scanAndReportZip,
} = require('./virusscanner');

// --- IMPORTS GANTI FUNCTION ---
const {
    handleGantiFunction,
    handleGantiFunctionZipFile,
    handleFunctionPick,
    handleFunctionListAll,
    handleFunctionBack,
    handleFunctionContinue,
    handleFunctionContinueConfirm,
    handleFunctionNewName,
    handleFunctionCallback,
} = require('./functionchanger');

// --- IMPORTS AI FIXER ---
const {
    handleAIFixApiScript,
    handleAIFixApiScriptZip,
    handleAIFixType,
    handleAIFixDownload,
    handleAIFixFunctionError,
    handleAIFixerCallback,
} = require('./aifixer');

// --- IMPORTS AI ROMBAK ---
const {
    handleAIRombakApp,
    handleAIRombakZip,
    handleAIRombakInstruction,
    handleAIRombakCallback,
} = require('./airombak');

// --- IMPORTS REACTION INJECTOR ---
const {
    handleReactionInjector,
    handleReactionChannelInput,
    handleReactionLimitInput,
    handleReactionEmojiInput,
    handleReactionCallback,
    handleReactCommand,
} = require('./reaction');

// --- IMPORTS AI TOOLS EXTRA ---
const {
    handleAIToolsExtra,
    handleAIExtraCallback,
} = require('./ai_tools_extra');

// --- IMPORTS AI VISUAL COPY ---
const {
    handleAIVisualCopy,
    handleVisualCopyInput,
    handleVisualCopyCallback,
} = require('./ai_visual_copy');

// --- IMPORTS HTML TO DART ---
const {
    handleHtmlToDart,
    handleHtmlToDartInput,
    handleHtmlToDartCallback,
    handleHtmlExample,
} = require('./html_to_dart');

const {
    handleStart,
    buildStartMenuPages,
    handleBuild,
    handleZipFile,
    monitorBuild,
    statusLabel,
    handleQueue,
    handleStatus,
    handleHelp,
    handleWeb2Apk,
    handleWeb2ApkUrl,
    handleWeb2ApkName,
    handleWeb2ApkIcon,
} = require('./build');

const {
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
    renderAiToolsMenu,
} = require('./tools');

const {
    handleRenameDomain,
    handleRenameZipFile,
    handleRenameDomainPick,
    handleRenameOldDomain,
    handleRenameNewDomain,
    handleRenameApi,
    handleRenameApiZipFile,
    handleRenameApiOldText,
    handleRenameApiNewText,
    handleAddFitur,
    handleAddFiturZipFile,
    handleAddFiturDartFile,
    finalizeAddFitur,
    handleRenameAppName,
    handleRenameAppNameZipFile,
    handleRenameAppNameOldName,
    handleRenameAppNameNewName,
} = require('./project');

const {
    handleEncMenu,
    handleEncFile,
    handleEncModel,
    handleEncCancel,
} = require('./enc');

const {
    handleAiToolsText,
    handleAiThemeChanger,
    handleAiFontChanger,
    handleAiIconPack,
    handleAiIconPackSelect,
    handleAiDarkMode,
    handleAiRombakProject,
    renderLiveEditorBrowser,
    handleLiveEditorNav,
    handleAiAutoFix,
    renderMultiInjectMenu,
    handleMultiInjectToggle,
    handleMultiInjectApply,
    applyThemeColor,
    applyFontChange,
    handleExportZip,
    handleBuildFromExtracted,
    handleCopyClone,
} = require('./ai');

// ─── TQTO FUNCTIONS ──────────────────────────────────────────────────────────
async function handleTqto(chatId, userId, msgId = null) {
    if (msgId) {
        try {
            await client.deleteMessages(chatId, [msgId], { revoke: true });
        } catch (_) {}
    }

    const people = [
        {
            label: CONFIG.TQTO_DEVELOPER_ROLE || "DEVELOPER",
            name: CONFIG.TQTO_DEVELOPER || "AKSAKA",
            bio: CONFIG.TQTO_DEVELOPER_BIO || "",
            photo: CONFIG.TQTO_DEVELOPER_PHOTO || CONFIG.TQTO_PHOTO,
            accent: "#5fd7ff",
        },
        {
            label: CONFIG.TQTO_GIRLFRIEND_ROLE || "MY LOVE",
            name: CONFIG.TQTO_GIRLFRIEND || "AYU MAULIDA",
            bio: CONFIG.TQTO_GIRLFRIEND_BIO || "",
            photo: CONFIG.TQTO_GIRLFRIEND_PHOTO || CONFIG.TQTO_PHOTO,
            accent: "#ff7b89",
        },
        {
            label: CONFIG.TQTO_SUPPORT_ROLE || "MY FRIEND",
            name: CONFIG.TQTO_SUPPORT || "ZHAHER",
            bio: CONFIG.TQTO_SUPPORT_BIO || "",
            photo: CONFIG.TQTO_SUPPORT_PHOTO || CONFIG.TQTO_PHOTO,
            accent: "#39ff88",
        },
    ];

    const caption =
        `🙏 <b>TERIMA KASIH KEPADA</b>\n` +
        `─────────────────────────────\n\n` +
        `<i>Orang-orang di balik ${CONFIG.BOT_NAME}. Terima kasih atas dukungan dan kontribusinya dalam pengembangan bot ini.</i> 🚀`;

    const buttons = [[{ text: "🏠 Menu Utama", data: "start" }]];

    let cardPath = null;
    try {
        const cardBuffer = await generateTqtoCard({
            botName: CONFIG.BOT_NAME,
            botVersion: CONFIG.BOT_VERSION,
            timeLabel: new Date().toLocaleString("id-ID", {
                timeZone: "Asia/Jakarta",
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
            }) + " WIB",
            people,
        });

        cardPath = tmpPath(`tqto_${userId}_${Date.now()}.jpg`);
        fs.writeFileSync(cardPath, cardBuffer);

        await client.sendFile(chatId, {
            file: cardPath,
            caption,
            parseMode: "html",
            buttons: buildButtons(buttons),
        });
    } catch (err) {
        console.error("Gagal generate TQTO card:", err.message);
        try {
            await client.sendFile(chatId, {
                file: CONFIG.TQTO_PHOTO || "https://files.catbox.moe/7qvcxz.png",
                caption,
                parseMode: "html",
                buttons: buildButtons(buttons),
            });
        } catch (_) {
            await send(chatId, caption, buttons, null);
        }
    } finally {
        if (cardPath && fs.existsSync(cardPath)) {
            try { fs.unlinkSync(cardPath); } catch (_) {}
        }
    }
}

async function handleTqtoDetail(chatId, userId, msgId, type) {
    let caption = '';
    let photo = CONFIG.TQTO_PHOTO || "https://files.catbox.moe/7qvcxz.png";

    switch (type) {
        case 'dev':
            caption = 
                `👨‍💻 <b>DEVELOPER</b>\n` +
                `─────────────────────────────\n\n` +
                `🧑‍💻 <b>Nama :</b> AKSAKA\n` +
                `🆔 <b>Role :</b> Creator & Developer\n` +
                `💻 <b>Keahlian :</b> Node.js, Python, Flutter\n` +
                `🤖 <b>Project :</b> ${CONFIG.BOT_NAME}\n` +
                `📅 <b>Bergabung :</b> Sejak awal project\n\n` +
                `─────────────────────────────\n` +
                `<i>Pengembang utama yang membuat bot ini dari nol.</i> 🚀`;
            break;

        case 'girl':
            caption = 
                `💕 <b>MY GIRLFRIEND</b>\n` +
                `─────────────────────────────\n\n` +
                `👩 <b>Nama :</b> AYU MAULIDA\n` +
                `💖 <b>Status :</b> My Love ❤️\n` +
                `🌟 <b>Peran :</b> Inspirasi & Motivasi\n` +
                `📅 <b>Bersama :</b> Sejak 2024\n\n` +
                `─────────────────────────────\n` +
                `<i>Terima kasih atas dukungan, cinta, dan semangat yang selalu diberikan.</i> 💕`;
            break;

        case 'support':
            caption = 
                `🤝 <b>MY SUPPORT/FREND</b>\n` +
                `─────────────────────────────\n\n` +
                `🧑 <b>Nama :</b> ZHAHERR\n` +
                `💪 <b>Peran :</b> Support & Frend\n` +
                `🔥 <b>Kontribusi :</b> Ide, Testing, Dukungan\n` +
                `📅 <b>Bergabung :</b> Sejak awal project\n\n` +
                `─────────────────────────────\n` +
                `<i>Terima kasih atas dukungan, saran, dan kerjasamanya selama ini.</i> 🤝`;
            break;

        default:
            return await handleTqto(chatId, userId, msgId);
    }

    const buttons = [
        [{ text: "⬅️ Kembali ke TQTO", data: "tqto" }],
        [{ text: "🏠 Menu Utama", data: "start" }],
    ];

    try {
        await client.sendFile(chatId, {
            file: photo,
            caption,
            parseMode: "html",
            buttons: buildButtons(buttons),
        });

        if (msgId) {
            try {
                await client.deleteMessages(chatId, [msgId], { revoke: true });
            } catch (_) {}
        }
    } catch (err) {
        await send(chatId, caption, buttons, msgId);
    }
}

// ─── HANDLE SCAN VIRUS ──────────────────────────────────────────────────────
async function handleScanVirus(chatId, userId, msgId = null) {
    const creditCheck = checkCredit(userId);
    if (!creditCheck.ok) {
        await send(
            chatId,
            `💳 **Credit Habis!**\n\nKamu tidak punya credit tersisa. Hubungi admin/reseller.`,
            [[{ text: "🏠 Menu Utama", data: "start" }]],
            msgId
        );
        return;
    }

    if (isUserBuilding(userId)) {
        const job = getUserJob(userId);
        await send(
            chatId,
            `⚠️ **Proses Aktif Terdeteksi!**\n\n` +
            `📋 **Status :** ${statusLabel(job.status)}\n\n` +
            `Harap tunggu hingga proses sebelumnya selesai, atau batalkan dulu.`,
            [[{ text: "❌ Batalkan", data: "cancel" }]],
            msgId
        );
        return;
    }

    await sendActionNotification(userId, 'Scan Virus');

    let username = null;
    let fullName = "Unknown User";
    try {
        const entity = await client.getEntity(userId);
        username = entity?.username || null;
        fullName = [entity?.firstName, entity?.lastName].filter(Boolean).join(" ") || "Unknown User";
    } catch (_) {}

    setUserJob(userId, {
        status: "waiting_zip_scan",
        chatId,
        userId,
        username,
        fullName,
        type: "scan_virus",
        updatedAt: Date.now(),
    });

    await send(
        chatId,
        `🛡️ **SCAN VIRUS**\n` +
        `────────────────────────────────\n\n` +
        `Fitur ini akan memeriksa file ZIP untuk:\n` +
        `• 🔴 File berbahaya (exe, scr, com, dll, dll)\n` +
        `• 🟡 File mencurigakan (double extension, hidden files)\n` +
        `• ⚠️ Konten berbahaya (injection, eval, system call)\n` +
        `• 💣 ZIP Bomb (file terlalu banyak/besar)\n` +
        `• 🔓 Path traversal (Zip Slip attack)\n\n` +
        `Kirim file **ZIP** yang ingin diperiksa.\n\n` +
        `📌 **Batasan:**\n` +
        `• Maks ukuran: \`500 MB\`\n` +
        `• Maks file: \`10000 file\`\n\n` +
        `⚠️ __File yang terdeteksi berbahaya akan otomatis dihapus!__`,
        [[{ text: "❌ Batalkan", data: "cancel" }]],
        msgId
    );
}

async function handleScanVirusFile(event) {
    const chatId = event.chatId;
    const userId = Number(event.message.senderId);
    const msg = event.message;
    const job = getUserJob(userId);

    if (!job || job.type !== "scan_virus" || job.status !== "waiting_zip_scan") return false;

    const media = msg.media;
    if (!media || !media.document) {
        await send(chatId, `⚠️ Kirim file **ZIP** yang ingin diperiksa!`);
        return true;
    }

    const doc = media.document;
    const fileName = doc.attributes?.find((a) => a.fileName)?.fileName || "file.zip";

    if (!fileName.endsWith(".zip")) {
        await send(chatId, `❌ **Format file tidak didukung!**\n\nHanya file \`.zip\` yang bisa discan.`);
        return true;
    }

    const fileSizeMB = (doc.size / 1024 / 1024).toFixed(1);
    if (doc.size > 500 * 1024 * 1024) {
        await send(chatId, `❌ **Ukuran file terlalu besar!**\n\nMaksimal 500 MB.`);
        return true;
    }

    const statusMsg = await send(
        chatId,
        `📥 **Mengunduh file...**\n\n📦 \`${fileName}\` (${fileSizeMB} MB)\n\n⏳ __Sedang mengunduh...__`
    );

    try {
        const localZip = tmpPath(`scan_${userId}_${Date.now()}.zip`);
        await client.downloadMedia(msg, { outputFile: localZip });

        await edit(
            chatId,
            statusMsg.id,
            `🛡️ **Scanning Virus...**\n\n⏳ __Menganalisis file ZIP...__`
        );

        const scanResult = await scanZipForVirus(localZip);
        const formattedResult = formatScanResults(scanResult);

        if (fs.existsSync(localZip)) fs.unlinkSync(localZip);
        removeUserJob(userId);

        await edit(
            chatId,
            statusMsg.id,
            formattedResult,
            scanResult.isSafe ? 
                [[{ text: "🏠 Menu Utama", data: "start" }]] :
                [[{ text: "🚫 Laporkan ke Admin", data: "user_start_lapor" }, { text: "🏠 Menu Utama", data: "start" }]]
        );

        if (!scanResult.isSafe) {
            await sendActionNotification(
                userId,
                'VIRUS TERDETEKSI!',
                `File: ${fileName}\nAncaman: ${scanResult.threats.length} ancaman ditemukan`
            );

            try {
                await client.sendMessage(CONFIG.OWNER_ID, {
                    message: `🚨 **VIRUS ALERT!**\n\n` +
                        `👤 User: \`${userId}\`\n` +
                        `📦 File: \`${fileName}\`\n` +
                        `📊 Ancaman: ${scanResult.threats.length}\n\n` +
                        `${formattedResult.slice(0, 1500)}`,
                    parseMode: "md",
                });
            } catch (_) {}

            if (!isAdmin(userId)) {
                const remaining = db.deductCredit(userId);
                if (remaining !== null) {
                    await client.sendMessage(chatId, {
                        message: `💳 **1 Credit digunakan.** Sisa: \`${remaining}\``,
                        parseMode: "md",
                    });
                }
            }
        } else {
            if (!isAdmin(userId)) {
                const remaining = db.deductCredit(userId);
                if (remaining !== null) {
                    await client.sendMessage(chatId, {
                        message: `💳 **1 Credit digunakan.** Sisa: \`${remaining}\``,
                        parseMode: "md",
                    });
                }
            }
        }

    } catch (err) {
        removeUserJob(userId);
        await edit(
            chatId,
            statusMsg.id,
            `❌ **Gagal Scan Virus!**\n\n` +
            `🛑 Error: \`${err.message}\``,
            [[{ text: "🏠 Menu Utama", data: "start" }]]
        );
    }

    return true;
}

// ─── HANDLE CALLBACK ──────────────────────────────────────────────────────────
async function handleCallback(event) {
    try {
        const data = event.data.toString();
        const chatId = event.chatId;
        const userId = Number(event.senderId);
        const msgId = event.messageId;

        // ─── DEBUG ────────────────────────────────────────────────────────────────
        console.log(`[DEBUG] Callback: ${data} from user ${userId}`);
        console.log(`[DEBUG] isAdmin? ${isAdmin(userId)}`);

        // ─── OWNER CALLBACKS ──────────────────────────────────────────────────
        const isOwnerAction = 
            data === "owner_menu" ||
            data === "owner_broadcast" ||
            data === "owner_credit_info" ||
            data === "owner_stop_broadcast" ||
            data === "owner_block_user" ||
            data === "owner_unblock_user" ||
            data === "owner_block_build" ||
            data === "owner_unblock_build" ||
            data === "owner_stop_all_build" ||
            data === "owner_list_blocked" ||
            data === "owner_block_menu" ||
            data === "owner_build_block_menu" ||
            data === "owner_credit_menu" ||
            data === "owner_add_credit" ||
            data === "owner_deduct_credit" ||
            data === "owner_set_credit" ||
            data === "owner_view_credit" ||
            data === "owner_list_all_credit" ||
            data === "owner_maintenance_menu" ||
            data === "owner_maintenance_toggle" ||
            data === "owner_maintenance_set_message";

        if (isOwnerAction) {
            return await handleOwnerCallback(event);
        }

        // ─── REACTION INJECTOR ──────────────────────────────────────────────────
        if (data === "reaction_injector") {
            return await handleReactionInjector(chatId, userId, msgId);
        }

        // ─── SCAN VIRUS ──────────────────────────────────────────────────────
        if (data === "scan_virus") {
            return await handleScanVirus(chatId, userId, msgId);
        }

        // ─── TQTO CALLBACKS ────────────────────────────────────────────────────
        if (data === "tqto") {
            return await handleTqto(chatId, userId, msgId);
        }

        if (data === "tqto_dev") {
            return await handleTqtoDetail(chatId, userId, msgId, 'dev');
        }

        if (data === "tqto_girl") {
            return await handleTqtoDetail(chatId, userId, msgId, 'girl');
        }

        if (data === "tqto_support") {
            return await handleTqtoDetail(chatId, userId, msgId, 'support');
        }

        // ─── CEK ERROR CALLBACKS ────────────────────────────────────────────────
        if (data === "cekerror") {
            return await handleCekError(chatId, userId, msgId);
        }

        if (data === "cekerror_autofix") {
            return await handleCekErrorCallback(event);
        }

        // ─── RECOLOUR CALLBACKS ────────────────────────────────────────────────
        if (data === "recolour_manual") {
            return await handleRecolourManual(chatId, userId, msgId);
        }

        if (data === "recolour_ai") {
            return await handleRecolourAI(chatId, userId, msgId);
        }

        if (data === "recolour_list" || data === "recolour_back") {
            return await handleRecolourCallback(event);
        }

        // ─── RENAME ALL SKIP CALLBACKS ──────────────────────────────────────
        if (data === "renameall_skip_img") {
            return await handleRenameAllSkip(chatId, userId, msgId, 'img');
        }

        if (data === "renameall_skip_vid") {
            return await handleRenameAllSkip(chatId, userId, msgId, 'vid');
        }

        // ─── RENAME ALL START ────────────────────────────────────────────────
        if (data === "rename_all") {
            return await handleRenameAll(chatId, userId, msgId);
        }

        // ─── GANTI FUNCTION ──────────────────────────────────────────────────
        if (data === "ganti_function") {
            return await handleGantiFunction(chatId, userId, msgId);
        }

        if (data === "function_upload" || data.startsWith("func_pick_") || 
            data === "func_list_all" || data === "func_back" || 
            data === "func_continue" || data === "func_continue_confirm") {
            return await handleFunctionCallback(event);
        }

        // ─── AI FIXER ──────────────────────────────────────────────────────────
        if (data === "aifixer" || data === "fixfunction") {
            return await handleAIFixFunctionError(chatId, userId, msgId);
        }

        if (data.startsWith("aifixer_") || data.startsWith("fixfunction_")) {
            return await handleAIFixerCallback(event);
        }

        // ─── AI ROMBAK ──────────────────────────────────────────────────────────
        if (data === "airombak") {
            return await handleAIRombakApp(chatId, userId, msgId);
        }

        if (data === "airombak_upload") {
            return await handleAIRombakCallback(event);
        }

        // ─── AI TOOLS EXTRA ──────────────────────────────────────────────────
        if (data === "ai_tools_extra") {
            return await handleAIToolsExtra(chatId, userId, msgId);
        }

        if (data.startsWith('ai_extra_')) {
            return await handleAIExtraCallback(event);
        }

        // ─── AI VISUAL COPY ──────────────────────────────────────────────────
        if (data === "ai_visual_copy") {
            return await handleAIVisualCopy(chatId, userId, msgId);
        }

        if (data.startsWith('vc_')) {
            return await handleVisualCopyCallback(event);
        }

        // ─── HTML TO DART ──────────────────────────────────────────────────────
        if (data === "html_to_dart") {
            return await handleHtmlToDart(chatId, userId, msgId);
        }

        if (data === "html_example") {
            return await handleHtmlExample(chatId, userId, msgId);
        }

        // ─── BUY CREDITS ──────────────────────────────────────────────────────
        if (data === "buy_credits") {
            return await handleBuyCredits(chatId, userId, msgId);
        }

        if (data === "cancel_buy") {
            return await handleCancelBuy(chatId, userId, msgId);
        }

        if (data.startsWith("buy_send_to_admin_")) {
            return await handleBuySendToAdmin(event);
        }

        // ─── REFERRAL ──────────────────────────────────────────────────────────
        if (data === "referral") {
            return await handleReferralSystem(chatId, userId, msgId);
        }

        if (data === "referral_claim_weekly") {
            return await handleReferralClaimWeekly(chatId, userId, msgId);
        }

        if (data === "referral_share") {
            return await handleReferralShare(chatId, userId, msgId);
        }

        if (data === "referral_copy") {
            return await handleReferralCopy(chatId, userId, msgId);
        }

        // ─── DART PREVIEW CALLBACKS ────────────────────────────────────────────
        if (data === "dart_preview") {
            return await handleDartPreview(chatId, userId, msgId);
        }

        // ─── Report / Admin actions ──────────────────────────────────────────
        if (data === "user_start_lapor") {
            if (db.isReportBlocked(userId)) {
                return event.answer({
                    message: "❌ Akses Ditolak! Kamu telah diblokir dari fitur laporan karena terindikasi mengirimkan laporan palsu.",
                    alert: true
                });
            }

            userStates.set(userId, { step: 'WAITING_FOR_REASON' });
            await client.editMessage(chatId, {
                message: msgId,
                text: `📝 **MENU LAPORAN**\n\n` +
                      `Silakan ketik **Alasan & Detail Laporan** kamu dengan jelas, lalu kirimkan lewat chat di bawah ini.\n\n` +
                      `⚠️ __Laporan asal-asalan/palsu akan mengakibatkan akun kamu diblokir dari fitur bot.__`,
                parseMode: "md",
                buttons: buildButtons([[{ text: "❌ Batalkan Laporan", data: "cancel" }]])
            });
            return await event.answer();
        }

        const isAdminAction = data.startsWith("adm_fix_") || data.startsWith("adm_blk_") || data.startsWith("adm_unblk_");
        if (isAdminAction) {
            if (chatId !== CONFIG.ADMIN_GROUP_ID && !isAdmin(userId)) {
                return await event.answer({ message: "❌ Kamu tidak memiliki akses admin!", alert: true });
            }

            let originalMsgText = "Laporan User";
            try {
                const fullMsg = await client.getMessages(chatId, { ids: [msgId] });
                originalMsgText = fullMsg[0]?.message || fullMsg[0]?.caption || "Laporan User";
            } catch (err) {
                console.error("Gagal get original message:", err);
            }

            if (data.startsWith("adm_fix_")) {
                const targetUserId = Number(data.replace("adm_fix_", ""));
                try {
                    await client.sendMessage(targetUserId, {
                        message: `🎉 **LAPORAN SELESAI DIPROSES**\n\n` +
                                 `Halo, kendala/bug yang kamu laporkan sebelumnya **telah berhasil diperbaiki** oleh tim admin.\n\n` +
                                 `Terima kasih banyak atas kontribusi dan laporan kamu! Silakan dicoba kembali fiturnya.`,
                        parseMode: "md"
                    });
                    await event.answer({ message: "✅ Berhasil memberi tahu user!", alert: false });
                } catch (err) {
                    await event.answer({ message: "⚠️ Gagal kirim DM (User memblokir bot)", alert: true });
                }

                await client.editMessage(chatId, {
                    message: msgId,
                    text: originalMsgText + `\n\n` + `🟢 **STATUS:** Selesai diperbaiki & user telah diberitahu.`,
                    parseMode: "md",
                    buttons: buildButtons([[{ text: "🔒 Blokir User", data: `adm_blk_${targetUserId}` }]])
                });
                return;
            }

            if (data.startsWith("adm_blk_")) {
                const targetUserId = Number(data.replace("adm_blk_", ""));
                if (db.isReportBlocked(targetUserId)) {
                    return await event.answer({ message: "ℹ️ User ini sudah berstatus diblokir.", alert: true });
                }
                db.blockReportUser(targetUserId);
                await event.answer({ message: `🔒 ID ${targetUserId} Berhasil Diblokir`, alert: false });

                const cleanedMessage = originalMsgText.replace(`\n\n🟢 **STATUS:** Selesai diperbaiki & user telah diberitahu.`, "");
                await client.editMessage(chatId, {
                    message: msgId,
                    text: cleanedMessage + `\n\n` + `🔴 **STATUS:** User telah diblokir oleh admin karena laporan palsu.`,
                    parseMode: "md",
                    buttons: buildButtons([[{ text: "🔓 Unblokir User", data: `adm_unblk_${targetUserId}` }]])
                });

                try {
                    await client.sendMessage(targetUserId, {
                        message: `⚠️ **AKSES DIBLOKIR**\n\nFitur laporan kamu telah dinonaktifkan oleh tim admin karena terindikasi mengirimkan laporan palsu/spam.`,
                        parseMode: "md"
                    });
                } catch (err) {}
                return;
            }

            if (data.startsWith("adm_unblk_")) {
                const targetUserId = Number(data.replace("adm_unblk_", ""));
                if (!db.isReportBlocked(targetUserId)) {
                    return await event.answer({ message: "ℹ️ User tidak sedang dalam pemblokiran.", alert: true });
                }
                db.unblockReportUser(targetUserId);
                await event.answer({ message: `🔓 Blokir ID ${targetUserId} Telah Dibuka`, alert: false });

                const cleanedMessage = originalMsgText.replace(`\n\n🔴 **STATUS:** User telah diblokir oleh admin karena laporan palsu.`, "");
                await client.editMessage(chatId, {
                    message: msgId,
                    text: cleanedMessage + `\n\n` + `⚪ **STATUS:** Akses laporan dikembangkan normal.`,
                    parseMode: "md",
                    buttons: buildButtons([
                        [{ text: "✅ Masalah Selesai", data: `adm_fix_${targetUserId}` }],
                        [
                            { text: "🔒 Blokir", data: `adm_blk_${targetUserId}` },
                            { text: "🔓 Unblokir", data: `adm_unblk_${targetUserId}` }
                        ]
                    ])
                });

                try {
                    await client.sendMessage(targetUserId, {
                        message: `✅ **AKSES DIKEMBALIKAN**\n\nFitur laporan kamu telah diaktifkan kembali. Mohon gunakan fasilitas ini dengan bijak.`,
                        parseMode: "md"
                    });
                } catch (err) {}
                return;
            }
        }

        // ─── Admin/Owner: Ambil Base File ──────────────────────────────────
        if (data.startsWith("adm_getbase_")) {
            if (!isAdmin(userId)) {
                return await event.answer({ message: "❌ Fitur ini khusus owner/admin!", alert: true });
            }

            const targetUserId = Number(data.replace("adm_getbase_", ""));
            const baseFile = userBaseFiles.get(targetUserId);

            if (!baseFile || !fs.existsSync(baseFile.path)) {
                return await event.answer({
                    message: "⚠️ Base file tidak ditemukan (mungkin sudah kedaluwarsa/terhapus).",
                    alert: true,
                });
            }

            await event.answer({ message: "📥 Mengirim base file ke DM kamu...", alert: false });

            try {
                const ownerLabel = formatUser(targetUserId, baseFile.username, baseFile.fullName);
                await client.sendFile(userId, {
                    file: baseFile.path,
                    forceDocument: true,
                    caption:
                        `📦 **BASE FILE PROJECT**\n` +
                        `────────────────────────────────\n\n` +
                        `👤 **Pemilik   :** ${ownerLabel}\n` +
                        `🆔 **User ID   :** \`${targetUserId}\`\n` +
                        `📄 **Nama File :** \`${baseFile.fileName}\`\n` +
                        `📏 **Ukuran    :** \`${baseFile.fileSizeMB} MB\`\n` +
                        `────────────────────────────────\n\n` +
                        `🔒 __Berkas ini hanya bisa diakses oleh owner/admin bot.__`,
                    parseMode: "md",
                });
            } catch (err) {
                console.error("Gagal kirim base file ke admin:", err.message);
                try {
                    await client.sendMessage(userId, {
                        message: `⚠️ Gagal mengirim base file: \`${err.message}\``,
                        parseMode: "md",
                    });
                } catch (_) {}
            }
            return;
        }

        // ─── Owner Panel & Limit/Credit User ──────────────────────────────────
        const isOwnerCreditAction =
            data === "adm_owner_menu" ||
            data === "adm_credit_menu" ||
            data === "adm_credit_set" ||
            data === "adm_credit_add" ||
            data === "adm_reseller_menu" ||
            data === "adm_add_reseller" ||
            data === "adm_res_add_credit" ||
            data === "adm_remove_reseller" ||
            data === "adm_reset_weekly_credit" ||
            data === "adm_reset_weekly_credit_confirm";

        if (isOwnerCreditAction) {
            if (!isAdmin(userId)) {
                return await event.answer({ message: "❌ Fitur ini khusus owner/admin!", alert: true });
            }

            if (data === "adm_owner_menu") {
                return await handleOwnerMenu(chatId, msgId);
            }

            if (data === "adm_credit_menu") {
                return await handleCreditMenu(chatId, msgId);
            }

            if (data === "adm_reseller_menu") {
                return await handleResellerMenu(chatId, msgId);
            }

            if (data === "adm_add_reseller") {
                userStates.set(userId, { step: "RES_WAITING_ADD_RESELLER" });
                return await edit(
                    chatId, msgId,
                    `➕ **ADD RESELLER**\n────────────────────────────────\n\nKirim **Telegram ID** user yang ingin dijadikan reseller.\n\nContoh: \`123456789\``,
                    [[{ text: "❌ Batalkan", data: "cancel" }]]
                );
            }

            if (data === "adm_res_add_credit") {
                userStates.set(userId, { step: "RES_WAITING_ADD_CREDIT" });
                return await edit(
                    chatId, msgId,
                    `💳 **ADD CREDIT (Owner)**\n` +
                    `────────────────────────────────\n\n` +
                    `Kirim salah satu format:\n` +
                    `• \`USER_ID JUMLAH\` ➜ contoh: \`123456789 20\`\n` +
                    `• \`@username JUMLAH\` ➜ contoh: \`@namauser 20\`\n\n` +
                    `Atau klik tombol di bawah untuk pilih dari daftar user:`,
                    [
                        [{ text: "📋 Pilih dari Daftar User", data: "res_userlist_0" }],
                        [{ text: "❌ Batalkan", data: "cancel" }],
                    ]
                );
            }

            if (data === "adm_remove_reseller") {
                userStates.set(userId, { step: "RES_WAITING_REMOVE_RESELLER" });
                return await edit(
                    chatId, msgId,
                    `❌ **REMOVE RESELLER**\n────────────────────────────────\n\nKirim **Telegram ID** reseller yang ingin dihapus.\n\nContoh: \`123456789\``,
                    [[{ text: "❌ Batalkan", data: "cancel" }]]
                );
            }

            if (data === "adm_credit_set" || data === "adm_credit_add") {
                const isSet = data === "adm_credit_set";
                userStates.set(userId, {
                    step: isSet ? "ADMIN_WAITING_SET_CREDIT" : "ADMIN_WAITING_ADD_CREDIT",
                });

                return await edit(
                    chatId,
                    msgId,
                    `${isSet ? "✏️ **SET LIMIT/CREDIT USER**" : "➕ **TAMBAH LIMIT/CREDIT USER**"}\n` +
                        `────────────────────────────────\n\n` +
                        `Kirimkan pesan dengan format:\n` +
                        `\`USER_ID JUMLAH\`\n\n` +
                        `**Contoh:** \`123456789 50\`\n\n` +
                        (isSet
                            ? `ℹ️ Nilai limit/credit user akan **diganti langsung** menjadi jumlah yang kamu kirim.`
                            : `ℹ️ Jumlah yang kamu kirim akan **ditambahkan** ke limit/credit user yang sudah ada.`),
                    [[{ text: "❌ Batalkan", data: "cancel" }]]
                );
            }

            if (data === "adm_reset_weekly_credit") {
                const allUsers = db.getAllUsers();
                const regularCount = allUsers.filter(
                    (u) => !isAdmin(u.userId) && u.isReseller !== true
                ).length;
                const lastReset = getLastWeeklyCreditResetAt();

                return await edit(
                    chatId, msgId,
                    `🔄 **RESET CREDIT MINGGUAN (MANUAL)**\n` +
                    `────────────────────────────────\n\n` +
                    `Aksi ini akan menambahkan **+${WEEKLY_RESET_AMOUNT} credit** ke **${regularCount} user biasa** ` +
                    `(admin & reseller tidak terpengaruh).\n\n` +
                    `📅 **Reset terakhir :** ${lastReset ? lastReset.toLocaleString("id-ID") : "_(belum pernah)"}\n\n` +
                    `Yakin ingin menjalankan reset sekarang?`,
                    [
                        [{ text: "✅ Ya, Reset Sekarang", data: "adm_reset_weekly_credit_confirm" }],
                        [{ text: "❌ Batalkan", data: "adm_owner_menu" }],
                    ]
                );
            }

            if (data === "adm_reset_weekly_credit_confirm") {
                await edit(chatId, msgId, `⏳ __Menjalankan reset credit mingguan...__`, null);
                const result = await runWeeklyCreditReset("manual");

                return await edit(
                    chatId, msgId,
                    `✅ **RESET CREDIT MINGGUAN BERHASIL**\n` +
                    `────────────────────────────────\n\n` +
                    `💳 **${result.affected}** user biasa mendapat tambahan \`+${result.amount}\` credit.\n` +
                    `🕐 **Waktu :** ${new Date().toLocaleString("id-ID")}`,
                    [[{ text: "⬅️ Kembali ke Owner Panel", data: "adm_owner_menu" }]]
                );
            }
        }

        // ─── Reseller Panel callbacks ──────────────────────────────────────────
        const isResellerAction =
            data === "res_panel" ||
            data === "res_add_credit" ||
            data === "res_add_reseller" ||
            data === "res_remove_reseller" ||
            data === "res_list";

        if (isResellerAction) {
            if (!isResellerOrAdmin(userId)) {
                return await event.answer({ message: "❌ Fitur ini khusus reseller/owner!", alert: true });
            }

            if (data === "res_panel") {
                return await handleAddResellerCommand(chatId, userId);
            }

            if (data === "res_add_credit") {
                userStates.set(userId, { step: "RES_WAITING_ADD_CREDIT" });
                return await edit(
                    chatId, msgId,
                    `💳 **ADD CREDIT KE USER**\n` +
                    `────────────────────────────────\n\n` +
                    `Kirim salah satu format:\n` +
                    `• \`USER_ID JUMLAH\` ➜ contoh: \`123456789 10\`\n` +
                    `• \`@username JUMLAH\` ➜ contoh: \`@namauser 10\`\n\n` +
                    `Atau klik tombol di bawah untuk pilih dari daftar user:`,
                    [
                        [{ text: "📋 Pilih dari Daftar User", data: "res_userlist_0" }],
                        [{ text: "❌ Batalkan", data: "cancel" }],
                    ]
                );
            }

            if (data === "res_add_reseller" && isAdmin(userId)) {
                userStates.set(userId, { step: "RES_WAITING_ADD_RESELLER" });
                return await edit(
                    chatId, msgId,
                    `➕ **ADD RESELLER**\n────────────────────────────────\n\nKirim **Telegram ID** user yang ingin dijadikan reseller.\n\nContoh: \`123456789\``,
                    [[{ text: "❌ Batalkan", data: "cancel" }]]
                );
            }

            if (data === "res_remove_reseller" && isAdmin(userId)) {
                userStates.set(userId, { step: "RES_WAITING_REMOVE_RESELLER" });
                return await edit(
                    chatId, msgId,
                    `❌ **REMOVE RESELLER**\n────────────────────────────────\n\nKirim **Telegram ID** reseller yang ingin dihapus.`,
                    [[{ text: "❌ Batalkan", data: "cancel" }]]
                );
            }

            if (data === "res_list" && isAdmin(userId)) {
                const resellers = db.getAllResellers();
                const list = resellers.length === 0
                    ? `_(Belum ada reseller)_`
                    : resellers.map((r, i) => `${i + 1}. \`${r.userId}\` — 💳 \`${r.credit ?? 0}\``).join("\n");
                return await edit(
                    chatId, msgId,
                    `📋 **DAFTAR RESELLER (${resellers.length})**\n────────────────────────────────\n\n${list}`,
                    [[{ text: "⬅️ Kembali", data: "adm_reseller_menu" }]]
                );
            }
        }

        // ─── Reseller: User List Picker ────────────────────────────────────────
        if (data.startsWith("res_userlist_") || data.startsWith("res_pick_")) {
            if (!isResellerOrAdmin(userId)) {
                return await event.answer({ message: "❌ Akses ditolak!", alert: true });
            }

            if (data.startsWith("res_userlist_")) {
                const page = parseInt(data.replace("res_userlist_", "")) || 0;
                const allUsers = db.getAllUsers();
                const perPage = 10;
                const start = page * perPage;
                const slice = allUsers.slice(start, start + perPage);
                const totalPages = Math.ceil(allUsers.length / perPage);

                if (slice.length === 0) {
                    return await event.answer({ message: "Tidak ada user terdaftar.", alert: true });
                }

                const buttons = slice.map((u, i) => {
                    const label = u.username
                        ? `${u.name || "User"} (@${u.username.replace("@", "")})`
                        : `${u.name || "User"} [${u.userId}]`;
                    return [{ text: label, data: `res_pick_${u.userId}` }];
                });

                const navRow = [];
                if (page > 0) navRow.push({ text: "⬅️ Prev", data: `res_userlist_${page - 1}` });
                if (page < totalPages - 1) navRow.push({ text: "Next ➡️", data: `res_userlist_${page + 1}` });
                if (navRow.length > 0) buttons.push(navRow);
                buttons.push([{ text: "❌ Batalkan", data: "cancel" }]);

                return await edit(
                    chatId, msgId,
                    `📋 **PILIH USER** (${start + 1}–${Math.min(start + perPage, allUsers.length)} dari ${allUsers.length})\n` +
                    `────────────────────────────────\n\n` +
                    `Tap nama user untuk add credit ke dia:`,
                    buttons
                );
            }

            if (data.startsWith("res_pick_")) {
                const targetUserId = Number(data.replace("res_pick_", ""));
                const allUsers = db.getAllUsers();
                const found = allUsers.find(u => u.userId === targetUserId);
                const targetLabel = found?.username
                    ? `@${found.username.replace("@", "")} (\`${targetUserId}\`)`
                    : `\`${targetUserId}\``;
                const currentCredit = db.getUserCredit(targetUserId);

                userStates.set(userId, {
                    step: "RES_WAITING_CREDIT_AMOUNT",
                    targetUserId,
                    targetLabel,
                });

                return await edit(
                    chatId, msgId,
                    `👤 **User dipilih:** ${targetLabel}\n` +
                    `💳 **Credit saat ini:** \`${currentCredit}\`\n\n` +
                    `────────────────────────────────\n` +
                    `Sekarang kirim **jumlah credit** yang ingin ditambahkan.\n\n` +
                    `Contoh: \`10\``,
                    [[{ text: "⬅️ Kembali ke Daftar", data: "res_userlist_0" }], [{ text: "❌ Batalkan", data: "cancel" }]]
                );
            }
        }

        // ─── Standard actions ──────────────────────────────────────────────────
        if (data === "check_join") {
            const joined = await isJoinedChannel(userId);

            if (!joined) {
                return event.answer({
                    message: "❌ Kamu belum join semua channel!",
                    alert: true,
                });
            }

            await event.answer({ message: "✅ Verifikasi berhasil!" });

            const userRecord = db.getAllUsers().find(u => u.userId === userId);
            if (userRecord && !userRecord.isVerified) {
                const referredBy = userRecord.referredBy;
                if (referredBy) {
                    const creditAmount = getReferralCredit();
                    db.addUserCredit(referredBy, creditAmount);
                    db.incrementReferralCount(referredBy);
                    try {
                        await client.sendMessage(referredBy, {
                            message: `🎉 **Selamat!**\nUser baru (${userId}) telah verifikasi dan kamu mendapat +${creditAmount} credit referral!`,
                            parseMode: 'md'
                        });
                    } catch (_) {}
                    db.setUserVerified(userId);
                } else {
                    db.setUserVerified(userId);
                }
            }

            let firstName = "User";
            try {
                const entity = await client.getEntity(userId);
                firstName = entity?.firstName || "User";
            } catch (_) {}

            return handleStart(
                {
                    chatId,
                    message: {
                        getSender: async () => ({
                            id: userId,
                            firstName,
                            username: null,
                        }),
                    },
                },
                msgId
            );
        }

        // ─── Domain Detection Callbacks ────────────────────────────────────────
        if (data.startsWith("domain_select_")) {
            const idx = parseInt(data.replace("domain_select_", ""));
            const state = domainDetectionStates.get(userId);
            
            if (!state || idx >= state.urls.length) {
                return event.answer({ message: "Data tidak valid!", alert: true });
            }
            
            const selectedUrl = state.urls[idx];
            const job = state.job;
            
            setUserJob(userId, { ...job, status: "waiting_new_text", oldText: selectedUrl, updatedAt: Date.now() });
            
            domainDetectionStates.delete(userId);
            
            await edit(
                chatId,
                msgId,
                `✅ **Domain Dipilih!**\n\n` +
                `🔍 **Teks Lama :** \`${selectedUrl}\`\n\n` +
                `🧩 **Rename Api/Script — Langkah 3/3**\n` +
                `────────────────────────────────\n\n` +
                `Sekarang kirim **teks/Api/Script baru** sebagai penggantinya.\n\n` +
                `📌 Contoh:\n` +
                `\`https://api.baruapp.com/v1\` atau \`NEW_API_KEY_456\``,
                [[{ text: "❌ Batalkan", data: "cancel" }]]
            );
            return;
        }

        if (data === "domain_manual") {
            const state = domainDetectionStates.get(userId);
            domainDetectionStates.delete(userId);
            
            await edit(
                chatId,
                msgId,
                `🧩 **Rename Api/Script — Langkah 2/3 (Manual)**\n` +
                `────────────────────────────────\n\n` +
                `Kirim **teks/Api/Script lama** yang ingin diganti.\n\n` +
                `📌 Contoh:\n` +
                `\`https://api.lamaapp.com/v1\` atau \`OLD_API_KEY_123\``,
                [[{ text: "❌ Batalkan", data: "cancel" }]]
            );
            return;
        }

        // ─── Extracted menu ────────────────────────────────────────────────────
        if (data === "extracted_menu") {
            const job = getUserJob(userId);
            if (job && job.status && job.status.startsWith("tools")) {
                setUserJob(userId, { ...job, status: "extracted", updatedAt: Date.now() });
            }
            await showExtractedMenu(chatId, userId, msgId);
            return;
        }

        if (data === "tools_menu") {
            await handleToolsMenu(chatId, userId, msgId);
            return;
        }

        if (data === "export_zip") {
            await handleExportZip(chatId, userId, msgId);
            return;
        }

        if (data === "build_from_extracted") {
            await handleBuildFromExtracted(chatId, userId, msgId);
            return;
        }

        if (data === "copy_clone") {
            await handleCopyClone(chatId, userId, msgId);
            return;
        }

        // ─── AI TOOLS CALLBACKS ──────────────────────────────────────────────────
        if (data === "ai_tools_menu") {
            await renderAiToolsMenu(chatId, userId, msgId);
            return;
        }

        if (data === "ai_theme_changer") {
            await handleAiThemeChanger(chatId, userId, msgId);
            return;
        }

        if (data === "ai_font_changer") {
            await handleAiFontChanger(chatId, userId, msgId);
            return;
        }

        if (data === "ai_icon_pack") {
            await handleAiIconPack(chatId, userId, msgId);
            return;
        }

        if (data.startsWith("ai_icon_set_")) {
            const packKey = data.replace("ai_icon_set_", "");
            await handleAiIconPackSelect(chatId, userId, msgId, packKey);
            return;
        }

        if (data === "ai_dark_mode") {
            await handleAiDarkMode(chatId, userId, msgId);
            return;
        }

        if (data === "ai_rombak_project") {
            await handleAiRombakProject(chatId, userId, msgId);
            return;
        }

        if (data === "ai_live_editor") {
            await renderLiveEditorBrowser(chatId, userId, msgId);
            return;
        }

        if (data === "le_up" || data.startsWith("le_cd_") || data.startsWith("le_file_")) {
            await handleLiveEditorNav(event);
            return;
        }

        if (data === "ai_auto_fix") {
            await handleAiAutoFix(chatId, userId, msgId);
            return;
        }

        if (data === "ai_multi_inject") {
            await renderMultiInjectMenu(chatId, userId, msgId);
            return;
        }

        if (data.startsWith("mi_toggle_")) {
            const key = data.replace("mi_toggle_", "");
            await handleMultiInjectToggle(chatId, userId, msgId, key);
            return;
        }

        if (data === "mi_apply") {
            await handleMultiInjectApply(chatId, userId, msgId);
            return;
        }

        // ─── Klik file di tools menu ──────────────────────────────────────────
        if (data.startsWith("tl_file_")) {
            const idx = data.replace("tl_file_", "");
            const job = getUserJob(userId);
            if (job && job.pathMap) {
                const entry = job.pathMap[idx];
                if (entry && !entry.isDir) {
                    setUserJob(userId, {
                        ...job,
                        status: "tools_clone_dest",
                        cloneType: "file",
                        sourceItems: [entry.full],
                        updatedAt: Date.now()
                    });
                    const text =
                        `✅ **Sumber dipilih:** \`${path.relative(job.extractedFolderPath, entry.full)}\`\n\n` +
                        `Sekarang pilih **folder tujuan**.`;
                    await showDestPicker(chatId, userId, msgId, text);
                }
            }
            return;
        }

        // ─── Tools navigation ──────────────────────────────────────────────────
        if (data.startsWith("tl_cd_")) {
            const idx = data.replace("tl_cd_", "");
            await handleToolsCd(chatId, userId, msgId, idx);
            return;
        }

        if (data === "tl_create_file") {
            await handleCreateFile(chatId, userId, msgId);
            return;
        }

        if (data === "tl_create_folder") {
            await handleCreateFolder(chatId, userId, msgId);
            return;
        }

        if (data === "tl_clone_file") {
            await handleCloneFile(chatId, userId, msgId);
            return;
        }

        if (data === "tl_clone_folder") {
            await handleCloneFolder(chatId, userId, msgId);
            return;
        }

        if (data === "tl_clone_all") {
            await handleCloneAll(chatId, userId, msgId);
            return;
        }

        // ─── Clone source navigation ──────────────────────────────────────────
        if (data.startsWith("cl_src_") || data.startsWith("cl_dest_")) {
            if (data.startsWith("cl_src_")) {
                await handleCloneSrcNav(event);
                return;
            }
            if (data.startsWith("cl_dest_")) {
                await handleCloneDestNav(event);
                return;
            }
        }

        // ─── Copy/Clone source toggles ────────────────────────────────────────
        if (data.startsWith("cc_src_")) {
            await handleCopyCloneToggle(event);
            return;
        }

        // ─── Clone confirm ─────────────────────────────────────────────────────
        if (data === "cl_confirm_yes") {
            await handleCloneConfirm(event);
            return;
        }

        // ─── Existing actions ──────────────────────────────────────────────────
        await event.answer();

        if (data === "start_next_menu" || data === "start_prev_menu") {
            let mentionName = "User";
            try {
                const entity = await client.getEntity(userId);
                mentionName = entity?.firstName || "User";
            } catch (_) {}
            const pages = buildStartMenuPages(userId, `<a href="tg://user?id=${userId}">${mentionName}</a>`);
            const target = data === "start_next_menu" ? pages.page2 : pages.page1;
            try {
                await client.editMessage(chatId, {
                    message: msgId,
                    text: target.caption,
                    parseMode: "html",
                    buttons: buildButtons(target.buttons),
                });
            } catch (err) {
                console.error("Gagal ganti halaman menu start:", err.message);
            }
            return;
        }

        if (data === "start") {
            return await handleStart(
                {
                    chatId,
                    message: {
                        getSender: async () => {
                            try {
                                const entity = await client.getEntity(userId);
                                return {
                                    id: userId,
                                    firstName: entity?.firstName || "User",
                                    username: entity?.username || null,
                                };
                            } catch (_) {
                                return { id: userId, firstName: "User" };
                            }
                        },
                    },
                },
                msgId
            );
        }

        if (data === "enc_menu") return await handleEncMenu(chatId, userId, msgId);
        if (data === "enc_hard" || data === "enc_strong" || data === "enc_medium" || data === "enc_easy") return await handleEncModel(chatId, userId, msgId, data);
        if (data === "enc_cancel") return await handleEncCancel(chatId, userId, msgId);
        if (data === "build") return await handleBuild(chatId, userId, null, msgId);
        if (data === "build_debug") return await handleBuild(chatId, userId, "debug", msgId);
        if (data === "build_release") return await handleBuild(chatId, userId, "release", msgId);
        if (data === "web2apk") return await handleWeb2Apk(chatId, userId, msgId);
        if (data === "rename_domain") return await handleRenameDomain(chatId, userId, msgId);
        if (data.startsWith("domain_pick_")) return await handleRenameDomainPick(event, Number(data.replace("domain_pick_", "")));
        if (data === "rename_appname") return await handleRenameAppName(chatId, userId, msgId);
        if (data === "rename_api") return await handleRenameApi(chatId, userId, msgId);
        if (data === "ganti_aset") return await handleGantiAset(chatId, userId, msgId);
        if (data === "add_fitur") return await handleAddFitur(chatId, userId, msgId);

        if (data === "af_done") {
            const job = getUserJob(userId);
            if (job?.type === "add_fitur") {
                await finalizeAddFitur(chatId, userId, msgId);
            }
            return;
        }

        if (data === "ga_back") {
            const job = getUserJob(userId);
            if (job?.type === "ganti_aset") {
                let cp = job.currentPath || job.assetsBase;
                if (cp !== job.assetsBase) {
                    const trimmed = cp.replace(/\/$/, "");
                    const lastSlash = trimmed.lastIndexOf("/");
                    cp = lastSlash === -1 ? job.assetsBase : trimmed.slice(0, lastSlash + 1);
                    if (cp.length < job.assetsBase.length) cp = job.assetsBase;
                }
                setUserJob(userId, { ...job, currentPath: cp });
                await renderAssetBrowser(chatId, userId, msgId);
            }
            return;
        }

        if (data.startsWith("ga_n_")) {
            const job = getUserJob(userId);
            if (job?.type === "ganti_aset" && job.pathMap) {
                const idx = data.replace("ga_n_", "");
                const target = job.pathMap[idx];
                if (target) {
                    setUserJob(userId, { ...job, currentPath: target });
                    await renderAssetBrowser(chatId, userId, msgId);
                }
            }
            return;
        }

        if (data.startsWith("ga_f_")) {
            const job = getUserJob(userId);
            if (job?.type === "ganti_aset" && job.pathMap) {
                const idx = data.replace("ga_f_", "");
                const target = job.pathMap[idx];
                if (target) {
                    const fileLabel = target.split("/").pop();
                    const ext = (fileLabel.split(".").pop() || "").toLowerCase();
                    const isVideo = ["mp4", "mov", "avi", "mkv", "webm", "3gp"].includes(ext);

                    setUserJob(userId, { ...job, status: "waiting_new_file", selectedPath: target, updatedAt: Date.now() });

                    await edit(
                        chatId,
                        msgId,
                        `🔄 **Ganti Aset**\n\n` +
                        `📄 **File dipilih:** \`${fileLabel}\`\n\n` +
                        `Silakan kirim ${isVideo ? "**video**" : "**gambar**"} baru sebagai pengganti.`,
                        [
                            [{ text: "⬅️ Batal, Kembali ke Daftar", data: "ga_cancel_select" }],
                            [{ text: "❌ Batalkan", data: "cancel" }],
                        ]
                    );
                }
            }
            return;
        }

        if (data === "ga_cancel_select") {
            const job = getUserJob(userId);
            if (job?.type === "ganti_aset") {
                setUserJob(userId, { ...job, status: "browsing", selectedPath: null, updatedAt: Date.now() });
                await renderAssetBrowser(chatId, userId, msgId);
            }
            return;
        }

        if (data === "ga_done") {
            const job = getUserJob(userId);
            if (job?.type === "ganti_aset") {
                await finalizeGantiAset(chatId, userId, msgId);
            }
            return;
        }

        if (data === "get_aset") return await handleGetAset(chatId, userId, msgId);

        if (data === "gt_back") {
            const job = getUserJob(userId);
            if (job?.type === "get_aset") {
                let cp = job.currentPath || job.assetsBase;
                if (cp !== job.assetsBase) {
                    const trimmed = cp.replace(/\/$/, "");
                    const lastSlash = trimmed.lastIndexOf("/");
                    cp = lastSlash === -1 ? job.assetsBase : trimmed.slice(0, lastSlash + 1);
                    if (cp.length < job.assetsBase.length) cp = job.assetsBase;
                }
                setUserJob(userId, { ...job, currentPath: cp });
                await renderGetAssetBrowser(chatId, userId, msgId);
            }
            return;
        }

        if (data.startsWith("gt_n_")) {
            const job = getUserJob(userId);
            if (job?.type === "get_aset" && job.pathMap) {
                const idx = data.replace("gt_n_", "");
                const target = job.pathMap[idx];
                if (target) {
                    setUserJob(userId, { ...job, currentPath: target });
                    await renderGetAssetBrowser(chatId, userId, msgId);
                }
            }
            return;
        }

        if (data.startsWith("gt_f_")) {
            const job = getUserJob(userId);
            if (job?.type === "get_aset" && job.pathMap) {
                const idx = data.replace("gt_f_", "");
                const target = job.pathMap[idx];
                if (target) {
                    const fileLabel = target.split("/").pop();

                    try {
                        const zip = new AdmZip(job.zipPath);
                        const entry = zip.getEntries().find((e) => e.entryName.replace(/\\/g, "/") === target);

                        if (!entry) {
                            await client.sendMessage(chatId, { message: `⚠️ File \`${fileLabel}\` sudah tidak ditemukan lagi di dalam ZIP.`, parseMode: "md" });
                        } else {
                            await sendAssetFileToUser(chatId, null, entry, fileLabel);
                            setUserJob(userId, { ...job, sentCount: (job.sentCount || 0) + 1, updatedAt: Date.now() });
                        }
                    } catch (err) {
                        await client.sendMessage(chatId, { message: `❌ Gagal mengirim \`${fileLabel}\`.\n\n🛑 \`${err.message}\``, parseMode: "md" });
                    }

                    await renderGetAssetBrowser(chatId, userId, msgId);
                }
            }
            return;
        }

        if (data === "gt_close") {
            const job = getUserJob(userId);
            if (job?.type === "get_aset") {
                await finalizeGetAset(chatId, userId, msgId);
            }
            return;
        }

        if (data === "queue") return await handleQueue(chatId, msgId);
        if (data === "help") return await handleHelp(chatId, msgId);
        if (data === "status") return await handleStatus(chatId, userId, msgId);

        if (data === "cancel") {
            const cancelledJob = getUserJob(userId);
            if (cancelledJob?.zipPath && fs.existsSync(cancelledJob.zipPath)) {
                try { fs.unlinkSync(cancelledJob.zipPath); } catch (_) {}
            }
            if (cancelledJob?.extractedFolderPath && fs.existsSync(cancelledJob.extractedFolderPath)) {
                try { rimraf(cancelledJob.extractedFolderPath); } catch (_) {}
            }
            removeUserJob(userId);
            userStates.delete(userId);
            domainDetectionStates.delete(userId);
            buyCreditStates.delete(userId);
            return await send(
                chatId,
                `✅ **Dibatalkan.**\n\n` +
                `__Ketik /start atau klik tombol di bawah untuk kembali ke menu utama.__`,
                [[{ text: "🏠 Menu Utama", data: "start" }]],
                msgId
            );
        }
    } catch (err) {
        console.error("handleCallback error:", err);
    }
}

// ─── MAIN FUNCTION ──────────────────────────────────────────────────────────
async function main() {
    console.log(`🚀 Starting ${CONFIG.BOT_NAME}...`);

    if (!fs.existsSync(CONFIG.TMP_DIR)) fs.mkdirSync(CONFIG.TMP_DIR, { recursive: true });
    
    await client.start({
        botAuthToken: CONFIG.BOT_TOKEN,
        onError: (err) => console.error("Client error:", err),
    });

    fs.writeFileSync(SESSION_FILE, client.session.save());
    console.log("✅ Bot connected & session saved!");

    startWeeklyCreditResetScheduler();
    startGitHubBackupScheduler();
    console.log("✅ Scheduler reset credit mingguan aktif (cek tiap 1 jam, jalan tiap 7 hari).");

    client.addEventHandler(async (event) => {
        try {
            const msg = event.message;
            const text = msg?.text?.trim();
            const chatId = event.chatId;
            const userId = Number(msg.senderId);

            // ─── DEBUG ──────────────────────────────────────────────────────────
            console.log(`[DEBUG] Command: "${text}" from user ${userId}`);
            console.log(`[DEBUG] isAdmin? ${isAdmin(userId)}`);

            // ─── CEK MAINTENANCE MODE ──────────────────────────────────────────
            if (checkMaintenance() && !isAdmin(userId) && text !== '/start') {
                const maintenanceMsg = getMaintenanceMessage();
                await send(chatId, `🛠️ ${maintenanceMsg}`);
                return;
            }

            // ─── CEK USER DIBLOKIR ────────────────────────────────────────────
            if (isUserBlocked(userId) && !isAdmin(userId)) {
                try {
                    await client.sendMessage(chatId, {
                        message: `🚫 **AKSES DIBLOKIR**\n\nAkun kamu telah diblokir oleh admin bot. Kamu tidak dapat menggunakan bot ini lagi.\n\nJika merasa ini kesalahan, hubungi admin.`,
                        parseMode: 'md',
                    });
                } catch (_) {}
                return;
            }

            // ─── COMMANDS ──────────────────────────────────────────────────────
            if (text === "/start") return handleStart(event);
            if (text === "/help") return handleHelp(chatId);

            // ─── REACT COMMAND ──────────────────────────────────────────────────
            if (text?.startsWith('/react ')) {
                const reactHandled = await handleReactCommand(event);
                if (reactHandled) return;
            }

            // ─── DEBUG: WHOAMI ─────────────────────────────────────────────────
            if (text === "/whoami") {
                const adminStatus = isAdmin(userId) ? "✅ ADMIN" : "❌ BUKAN ADMIN";
                const message = 
                    `📋 **INFO USER**\n` +
                    `────────────────────────────────\n\n` +
                    `🆔 **User ID:** \`${userId}\`\n` +
                    `👑 **Status:** ${adminStatus}\n` +
                    `📋 **ADMIN_IDS:** \`${JSON.stringify(CONFIG.ADMIN_IDS)}\`\n\n` +
                    `Jika seharusnya admin tapi tidak, tambahkan ID ini ke \`ADMIN_IDS\` di config.js\n\n` +
                    `💡 **Cara fix:**\n` +
                    `1. Buka config.js\n` +
                    `2. Cari ADMIN_IDS\n` +
                    `3. Tambahkan ID kamu: \`"${userId}"\`\n` +
                    `4. Restart bot`;
                
                return send(chatId, message);
            }

            // ─── OWNER COMMAND ──────────────────────────────────────────────────
            if (text === "/owner") {
                console.log(`[DEBUG] /owner command from user ${userId}`);
                if (isAdmin(userId)) {
                    return handleOwnerMenu(chatId, userId);
                } else {
                    return send(chatId, '❌ **Akses Ditolak!**\n\nMenu ini khusus untuk owner/admin bot.', [[{ text: '🏠 Menu Utama', data: 'start' }]]);
                }
            }

            // ─── OWNER BROADCAST ───────────────────────────────────────────────
            if (text === "/broadcast" && isAdmin(userId)) {
                return handleBroadcast(chatId, userId);
            }

            // ─── OWNER BLOCK/UNBLOCK ───────────────────────────────────────────
            if (text === "/block" && isAdmin(userId)) {
                return handleBlockUser(chatId, userId);
            }

            if (text === "/unblock" && isAdmin(userId)) {
                return handleUnblockUser(chatId, userId);
            }

            // ─── OWNER BLOCK/UNBLOCK BUILD ─────────────────────────────────────
            if (text === "/blockbuild" && isAdmin(userId)) {
                return handleBlockBuild(chatId, userId);
            }

            if (text === "/unblockbuild" && isAdmin(userId)) {
                return handleUnblockBuild(chatId, userId);
            }

            // ─── OWNER STOP BUILD ──────────────────────────────────────────────
            if (text === "/stopbuild" && isAdmin(userId)) {
                return handleStopAllBuild(chatId, userId);
            }

            // ─── OWNER STOP BROADCAST ──────────────────────────────────────────
            if (text === "/stopbroadcast" && isAdmin(userId)) {
                return handleStopBroadcast(chatId, userId);
            }

            // ─── OWNER LIST BLOCKED ────────────────────────────────────────────
            if (text === "/listblocked" && isAdmin(userId)) {
                return handleListBlockedUsers(chatId, userId);
            }

            if (text === "/addreseller") {
                if (!isResellerOrAdmin(userId)) return;
                return handleAddResellerCommand(chatId, userId);
            }

            if (text === "/addcredit") {
                if (!isResellerOrAdmin(userId)) return;
                userStates.set(userId, { step: "RES_WAITING_ADD_CREDIT" });
                return send(
                    chatId,
                    `💳 **ADD CREDIT KE USER**\n` +
                    `────────────────────────────────\n\n` +
                    `Kirim salah satu format:\n` +
                    `• \`USER_ID JUMLAH\` ➜ contoh: \`123456789 10\`\n` +
                    `• \`@username JUMLAH\` ➜ contoh: \`@namauser 10\`\n\n` +
                    `Atau klik tombol di bawah untuk pilih dari daftar user:`,
                    [
                        [{ text: "📋 Pilih dari Daftar User", data: "res_userlist_0" }],
                        [{ text: "❌ Batalkan", data: "cancel" }],
                    ]
                );
            }

            if (text === '/referral') {
                return handleReferralSystem(chatId, userId);
            }

            // ─── REDEEM CREDIT ───────────────────────────────────────────────
            if (/^\/redeem(?:\s|$)/.test(text || '')) {
                const code = text.slice('/redeem'.length).trim();
                if (!code) return send(chatId, '⚠️ Format: /redeem <kode>');

                const joined = await isJoinedChannel(userId);
                if (!joined) {
                    return send(
                        chatId,
                        `🔒 Akses Terbatas!\n\nKamu harus join semua channel terlebih dahulu sebelum menggunakan redeem.`,
                        [
                            [{ text: '📢 Join Channel 1', url: `https://t.me/${CONFIG.CHANNEL_USERNAME.replace('@', '')}` }],
                            [{ text: '📢 Join Channel 2', url: `https://t.me/${CONFIG.CHANNEL_USERNAME2.replace('@', '')}` }],
                            [{ text: '📢 Join Channel 3', url: `https://t.me/${CONFIG.CHANNEL_USERNAME3.replace('@', '')}` }],
                            [{ text: '✅ Sudah Join Semua', data: 'check_join' }],
                        ]
                    );
                }

                const result = db.redeemCode(userId, code);
                if (!result.ok) {
                    const messages = {
                        invalid: '❌ Kode redeem tidak ditemukan.',
                        used: '⚠️ Kode redeem sudah pernah digunakan.',
                        already_claimed: '⚠️ Kamu sudah pernah claim kode redeem ini.',
                        limit: '⚠️ Batas claim kode redeem ini sudah habis.',
                    };
                    return send(chatId, messages[result.reason] || '❌ Kode redeem tidak dapat digunakan.');
                }

                // Detail user untuk testimoni. getEntity dipakai agar username/nama aktual ikut terkirim.
                let claimUsername = null;
                let claimName = 'Unknown User';
                try {
                    const entity = await client.getEntity(userId);
                    claimUsername = entity?.username || null;
                    claimName = [entity?.firstName, entity?.lastName].filter(Boolean).join(' ') || 'Unknown User';
                } catch (_) {}

                let botUsername = 'bot';
                try {
                    const me = await client.getMe();
                    botUsername = me?.username || botUsername;
                } catch (_) {}

                const testimoniCaption =
                    `🎉 <b>REDEEM BERHASIL!</b>\n` +
                    `─────────────────────────────\n` +
                    `👤 <b>User:</b> ${claimUsername ? `@${claimUsername}` : claimName}\n` +
                    `🆔 <b>ID:</b> <code>${userId}</code>\n` +
                    `💳 <b>Credit:</b> +${result.amount}\n` +
                    `💰 <b>Total Credit:</b> ${result.newCredit}\n` +
                    `🔑 <b>Kode:</b> <code>${escapeHtml(result.code)}</code>\n` +
                    `📊 <b>Claim:</b> ${result.claimCount}/${result.maxClaims}`;

                const testimoniButtons = [
                    [{ text: '🚀 Gas cobain', url: `https://t.me/${botUsername}?start=redeem` }]
                ];

                try {
                    await client.sendFile(CONFIG.REDEEM_TESTIMONI_CHANNEL || '@heheomupin', {
                        file: CONFIG.WELCOME_PHOTO,
                        caption: testimoniCaption,
                        parseMode: 'html',
                        buttons: buildButtons(testimoniButtons),
                    });
                } catch (_) {}

                return send(chatId,
                    `🎉 REDEEM BERHASIL!\n\n` +
                    `💳 Credit masuk: +${result.amount}\n` +
                    `💰 Total credit: ${result.newCredit}`
                );
            }

            // ─── CREATE REDEEM CODE (OWNER) ──────────────────────────────────
            if (/^\/credeem(?:\s|$)/.test(text || '')) {
                if (!isAdmin(userId)) return send(chatId, '❌ Command ini khusus owner/admin.');

                // Format wajib: /credeem {max claim}:{jumlah credit}:{kode redeem}
                // Contoh: /credeem 100:50:VIP@2026#_X!
                const args = text.slice('/credeem'.length).trim();
                const first = args.indexOf(':');
                const second = first === -1 ? -1 : args.indexOf(':', first + 1);
                if (first <= 0 || second <= first + 1 || !args.slice(second + 1).trim()) {
                    return send(chatId, '⚠️ Format: /credeem {max claim}:{jumlah credit max 1000}:{kode redeem}\n\nContoh: /credeem 100:50:VIP@2026#_X!');
                }

                const maxClaims = args.slice(0, first).trim();
                const amount = args.slice(first + 1, second).trim();
                const code = args.slice(second + 1).trim();

                if (!/^\d+$/.test(maxClaims) || !/^\d+$/.test(amount) || Number(maxClaims) < 1 || Number(amount) < 1 || Number(amount) > 1000 || !code) {
                    return send(chatId, '❌ Data tidak valid. Max claim minimal 1 dan credit harus 1-1000.');
                }

                const result = db.createRedeemCode(code, Number(maxClaims), Number(amount));
                if (!result.ok) {
                    return send(chatId, result.reason === 'exists'
                        ? '⚠️ Kode redeem tersebut sudah ada.'
                        : '⚠️ Kode redeem tidak valid.');
                }

                let botUsername = 'bot';
                try {
                    const me = await client.getMe();
                    botUsername = me?.username || botUsername;
                } catch (_) {}

                const createdCaption =
                    `🆕 <b>REDEEM CODE BARU</b>\n` +
                    `─────────────────────────────\n` +
                    `🔑 <b>Kode:</b> <code>${escapeHtml(result.code)}</code>\n` +
                    `👥 <b>Max Claim:</b> ${result.maxClaims} user\n` +
                    `💳 <b>Credit / Claim:</b> +${result.amount}\n` +
                    `📊 <b>Status:</b> 0/${result.maxClaims} claim\n` +
                    `👑 <b>Dibuat oleh:</b> <code>${userId}</code>\n\n` +
                    `🔥 <b>Buruan redeem di bot @${botUsername}</b>\n` +
                    `📋 <code>/redeem ${escapeHtml(result.code)}</code>`;

                const createdButtons = [
                    [{ text: '🚀 Gas cobain', url: `https://t.me/${botUsername}?start=redeem` }]
                ];

                try {
                    await client.sendFile(CONFIG.REDEEM_TESTIMONI_CHANNEL || '@heheomupin', {
                        file: CONFIG.WELCOME_PHOTO,
                        caption: createdCaption,
                        parseMode: 'html',
                        buttons: buildButtons(createdButtons),
                    });
                } catch (_) {}

                try {
                    await client.sendFile(CONFIG.OWNER_ID, {
                        file: CONFIG.WELCOME_PHOTO,
                        caption: createdCaption,
                        parseMode: 'html',
                        buttons: buildButtons(createdButtons),
                    });
                } catch (_) {}

                return send(chatId,
                    `✅ REDEEM CODE DIBUAT\n\n` +
                    `🔑 Kode: ${result.code}\n` +
                    `👥 Max claim: ${result.maxClaims} user\n` +
                    `💳 Credit / claim: +${result.amount}\n` +
                    `📊 Status: 0/${result.maxClaims} claim`
                );
            }

            if (text === '/buycredits' || text === '/buy') {
                return handleBuyCredits(chatId, userId);
            }

            if (text?.startsWith('/setrefcredit') && isAdmin(userId)) {
                const parts = text.split(' ');
                if (parts.length < 2 || isNaN(parts[1]) || Number(parts[1]) < 0) {
                    return send(chatId, '⚠️ Format: /setrefcredit <jumlah>');
                }
                const amount = Number(parts[1]);
                setReferralCredit(amount);
                return send(chatId, `✅ Credit referral diatur ke ${amount}`);
            }

            // ─── Report handler ──────────────────────────────────────────────────
            const isReportIntercepted = await handleUserReportMessages(event);
            if (isReportIntercepted) return;

            // ─── Admin: limit/credit text input ─────────────────────────────────
            const isCreditIntercepted = await handleAdminCreditMessages(event);
            if (isCreditIntercepted) return;

            // ─── OWNER CREDIT TEXT INPUT ─────────────────────────────────────────
            const creditHandled = await handleCreditTextInput(event);
            if (creditHandled) return;

            // ─── OWNER MAINTENANCE MESSAGE INPUT ─────────────────────────────────
            const maintenanceHandled = await handleMaintenanceMessageInput(event);
            if (maintenanceHandled) return;

            // ─── Tools text input ────────────────────────────────────────────────
            const toolsHandled = await handleToolsCreateText(event);
            if (toolsHandled) return;

            // ─── AI Tools text input ─────────────────────────────────────────────
            const aiToolsHandled = await handleAiToolsText(event);
            if (aiToolsHandled) return;

            // ─── BUY CREDITS AMOUNT ─────────────────────────────────────────────
            const buyHandled = await handleBuyCreditAmount(event);
            if (buyHandled) return;

            // ─── AI ROMBAK INSTRUCTION ──────────────────────────────────────────
            const aiRombakHandled = await handleAIRombakInstruction(event);
            if (aiRombakHandled) return;

            // ─── REACTION INJECTOR CHANNEL INPUT ────────────────────────────────
            const reactionHandled = await handleReactionChannelInput(event);
            if (reactionHandled) return;

            const reactionLimitHandled = await handleReactionLimitInput(event);
            if (reactionLimitHandled) return;

            const reactionEmojiHandled = await handleReactionEmojiInput(event);
            if (reactionEmojiHandled) return;

            // ─── AI VISUAL COPY INPUT ──────────────────────────────────────────
            const visualCopyHandled = await handleVisualCopyInput(event);
            if (visualCopyHandled) return;

            // ─── HTML TO DART INPUT ────────────────────────────────────────────
            const htmlToDartHandled = await handleHtmlToDartInput(event);
            if (htmlToDartHandled) return;

            // ─── ENC JS file intake ──────────────────────────────────────────────
            const encState = userStates.get(userId);
            if (encState?.step === "ENC_WAITING_FILE" && msg.media) {
                const encHandled = await handleEncFile(event);
                if (encHandled) return;
            }

            // ─── RENAME ALL TEXT ──────────────────────────────────────────────────
            const renameAllTextHandled = await handleRenameAllText(event);
            if (renameAllTextHandled) return;

            // ─── RECOLOUR TEXT ────────────────────────────────────────────────────
            const recolourTextHandled = await handleRecolourText(event);
            if (recolourTextHandled) return;

            // ─── CEK ERROR TEXT ────────────────────────────────────────────────────
            const cekErrorTextHandled = await handleCekErrorText(event);
            if (cekErrorTextHandled) return;

            // ─── DART PREVIEW FILE ────────────────────────────────────────────────
            const dartPreviewHandled = await handleDartPreviewFile(event);
            if (dartPreviewHandled) return;

            // ─── OWNER BLOCK/UNBLOCK TEXT INPUT ─────────────────────────────────
            const ownerBlockHandled = await handleBlockUnblockText(event);
            if (ownerBlockHandled) return;

            const ownerBuildBlockHandled = await handleBlockBuildText(event);
            if (ownerBuildBlockHandled) return;

            // ─── OWNER BROADCAST MESSAGE ─────────────────────────────────────────
            const broadcastHandled = await handleBroadcastMessage(event);
            if (broadcastHandled) return;

            // ─── SCAN VIRUS ZIP ──────────────────────────────────────────────────
            const job = getUserJob(userId);
            if (job?.type === "scan_virus" && job.status === "waiting_zip_scan" && msg.media) {
                return await handleScanVirusFile(event);
            }

            // ─── GANTI FUNCTION ZIP ─────────────────────────────────────────────
            const functionZipHandled = await handleGantiFunctionZipFile(event);
            if (functionZipHandled) return;

            // ─── GANTI FUNCTION NEW NAME ────────────────────────────────────────
            const functionNameHandled = await handleFunctionNewName(event);
            if (functionNameHandled) return;

            // ─── AI FIXER ZIP ─────────────────────────────────────────────────────
            const aiFixerHandled = await handleAIFixApiScriptZip(event);
            if (aiFixerHandled) return;

            // ─── AI ROMBAK ZIP ─────────────────────────────────────────────────────
            const aiRombakHandledZip = await handleAIRombakZip(event);
            if (aiRombakHandledZip) return;

            // ─── Existing job states ─────────────────────────────────────────────
            if (job?.type === "web2apk") {
                if (job.status === "waiting_url" && text?.startsWith("http"))
                    return handleWeb2ApkUrl(event);
                if (job.status === "waiting_appname" && text)
                    return handleWeb2ApkName(event);
                if (job.status === "waiting_icon" && msg.media)
                    return handleWeb2ApkIcon(event);
            }

            if (job?.type === "rename_domain") {
                if (job.status === "waiting_old_domain" && text)
                    return handleRenameOldDomain(event);
                if (job.status === "waiting_new_domain" && text)
                    return handleRenameNewDomain(event);
            }

            if (job?.type === "rename_appname") {
                if (job.status === "waiting_old_appname" && text)
                    return handleRenameAppNameOldName(event);
                if (job.status === "waiting_new_appname" && text)
                    return handleRenameAppNameNewName(event);
            }

            if (job?.type === "rename_api") {
                if (job.status === "waiting_old_text" && text)
                    return handleRenameApiOldText(event);
                if (job.status === "waiting_new_text" && text)
                    return handleRenameApiNewText(event);
            }

            if (job?.type === "ganti_aset") {
                if (job.status === "waiting_new_file" && msg.media)
                    return handleGantiAsetNewFile(event);
            }

            // ─── MEDIA HANDLERS ──────────────────────────────────────────────────
            if (msg.media) {
                const recolourZipHandled = await handleRecolourZipFile(event);
                if (recolourZipHandled) return;

                const renameAllMediaHandled = await handleRenameAllMedia(event);
                if (renameAllMediaHandled) return;

                const renameHandled = await handleRenameZipFile(event);
                if (renameHandled) return;

                const renameAppHandled = await handleRenameAppNameZipFile(event);
                if (renameAppHandled) return;

                const renameApiHandled = await handleRenameApiZipFile(event);
                if (renameApiHandled) return;

                const assetZipHandled = await handleGantiAsetZipFile(event);
                if (assetZipHandled) return;

                const getAssetZipHandled = await handleGetAsetZipFile(event);
                if (getAssetZipHandled) return;

                const addFiturZipHandled = await handleAddFiturZipFile(event);
                if (addFiturZipHandled) return;

                const addFiturDartHandled = await handleAddFiturDartFile(event);
                if (addFiturDartHandled) return;

                await handleZipFile(event);
            }
        } catch (err) {
            console.error("Handler error:", err);
        }
    }, new NewMessage({}));

    client.addEventHandler(async (event) => {
        try {
            await handleCallback(event);
        } catch (err) {
            console.error("Callback error:", err);
        }
    }, new CallbackQuery({}));

    console.log(`🤖 ${CONFIG.BOT_NAME} v${CONFIG.BOT_VERSION} siap!`);
    await new Promise(() => {});
}

// ─── REGISTER GLOBAL ──────────────────────────────────────────────────────────
Object.assign(globalThis, {
    handleCallback,
    main,
    handleTqto,
    handleTqtoDetail,
    handleScanVirus,
    handleScanVirusFile,
});

module.exports = {
    handleCallback,
    main,
    handleTqto,
    handleTqtoDetail,
    handleScanVirus,
    handleScanVirusFile,
};