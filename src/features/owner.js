// src/features/owner.js
// Fitur Owner - Broadcast, Block User, Block Build, Stop Build, Stop Broadcast, Credit Management, Maintenance

const fs = require('fs');
const path = require('path');

// ─── BROADCAST STATE ──────────────────────────────────────────────────────────
let activeBroadcast = {
    isRunning: false,
    chatId: null,
    userId: null,
    targetMessage: null,
    targetReply: null,
    totalUsers: 0,
    processed: 0,
    success: 0,
    failed: 0,
    stopped: false,
    paused: false,
};

let broadcastInterval = null;

// ─── BLOCKED USERS ────────────────────────────────────────────────────────────
function getBlockedUsers() {
    try {
        const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
        return data.filter(u => u.isBlocked === true).map(u => u.userId);
    } catch (_) {
        return [];
    }
}

function isUserBlocked(userId) {
    const blocked = getBlockedUsers();
    return blocked.includes(Number(userId));
}

function blockUser(userId) {
    const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    const index = data.findIndex(u => u.userId === Number(userId));
    if (index !== -1) {
        data[index].isBlocked = true;
    } else {
        data.push({ userId: Number(userId), isBlocked: true, joinedAt: new Date() });
    }
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    return true;
}

function unblockUser(userId) {
    const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    const index = data.findIndex(u => u.userId === Number(userId));
    if (index !== -1) {
        data[index].isBlocked = false;
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
        return true;
    }
    return false;
}

// ─── BLOCK BUILD ──────────────────────────────────────────────────────────────
let blockedBuildUsers = new Set();

function isBuildBlocked(userId) {
    return blockedBuildUsers.has(Number(userId));
}

function blockBuildUser(userId) {
    blockedBuildUsers.add(Number(userId));
}

function unblockBuildUser(userId) {
    blockedBuildUsers.delete(Number(userId));
}

// ─── MAINTENANCE MODE ─────────────────────────────────────────────────────────
let maintenanceMode = {
    enabled: false,
    message: "🛠️ Bot sedang dalam maintenance. Silakan coba lagi nanti.",
    startedAt: null,
};

function isMaintenanceEnabled() {
    return maintenanceMode.enabled;
}

function setMaintenanceMode(enabled, message = null) {
    maintenanceMode.enabled = enabled;
    maintenanceMode.startedAt = enabled ? new Date() : null;
    if (message) {
        maintenanceMode.message = message;
    }
    return maintenanceMode;
}

function getMaintenanceStatus() {
    return {
        enabled: maintenanceMode.enabled,
        message: maintenanceMode.message,
        startedAt: maintenanceMode.startedAt,
    };
}

function checkMaintenance() {
    return maintenanceMode.enabled;
}

function getMaintenanceMessage() {
    return maintenanceMode.message;
}

// ─── OWNER MENU ──────────────────────────────────────────────────────────────
async function handleOwnerMenu(chatId, userId, msgId = null) {
    console.log(`[DEBUG] handleOwnerMenu called by user ${userId}`);
    console.log(`[DEBUG] isAdmin? ${isAdmin(userId)}`);
    
    if (!isAdmin(userId)) {
        console.log(`[DEBUG] User ${userId} is NOT admin, rejecting...`);
        await send(chatId, '❌ **Akses Ditolak!**\n\nMenu ini khusus untuk owner/admin bot.', [[{ text: '🏠 Menu Utama', data: 'start' }]], msgId);
        return;
    }

    console.log(`[DEBUG] User ${userId} is admin, showing owner menu...`);

    const maintenanceStatus = getMaintenanceStatus();
    const maintenanceIcon = maintenanceStatus.enabled ? '🔴 ON' : '🟢 OFF';

    const text = 
        `👑 **OWNER PANEL**\n` +
        `────────────────────────────────\n\n` +
        `📊 **Statistik:**\n` +
        `• Total User: \`${db.getAllUsers().length}\`\n` +
        `• User Diblokir: \`${getBlockedUsers().length}\`\n` +
        `• Build Diblokir: \`${blockedBuildUsers.size}\`\n` +
        `• Broadcast Active: \`${activeBroadcast.isRunning ? '✅ Ya' : '❌ Tidak'}\`\n` +
        `• Maintenance: \`${maintenanceIcon}\`\n\n` +
        `📋 **Pilih Menu:**`;

    const buttons = [
        [{ text: "📢 Broadcast Message", data: "owner_broadcast" }],
        [{ text: "💳 Credit & Redeem", data: "owner_credit_info" }],
        [{ text: "🔒 Block/Unblock User", data: "owner_block_menu" }],
        [{ text: "🚫 Block/Unblock Build", data: "owner_build_block_menu" }],
        [{ text: "💳 Credit Management", data: "owner_credit_menu" }],
        [{ text: "🛠️ Maintenance Mode", data: "owner_maintenance_menu" }],
        [{ text: "🔥 Reaction Injector", data: "reaction_injector" }],
        [{ text: "🛑 Stop Broadcast", data: "owner_stop_broadcast" }],
        [{ text: "⏹️ Stop All Build", data: "owner_stop_all_build" }],
        [{ text: "📋 List Blocked Users", data: "owner_list_blocked" }],
        [{ text: "🏠 Menu Utama", data: "start" }],
    ];

    if (msgId) {
        await edit(chatId, msgId, text, buttons);
    } else {
        await send(chatId, text, buttons);
    }
}

// ─── BLOCK/UNBLOCK USER MENU ─────────────────────────────────────────────────
async function handleBlockMenu(chatId, userId, msgId = null) {
    if (!isAdmin(userId)) {
        await send(chatId, '❌ **Akses Ditolak!**', [[{ text: '🏠 Menu Utama', data: 'start' }]], msgId);
        return;
    }

    const text = 
        `🔒 **BLOCK/UNBLOCK USER**\n` +
        `────────────────────────────────\n\n` +
        `Pilih aksi di bawah ini:`;

    const buttons = [
        [{ text: "🔒 Block User", data: "owner_block_user" }],
        [{ text: "🔓 Unblock User", data: "owner_unblock_user" }],
        [{ text: "⬅️ Kembali", data: "owner_menu" }],
    ];

    if (msgId) {
        await edit(chatId, msgId, text, buttons);
    } else {
        await send(chatId, text, buttons);
    }
}

// ─── BLOCK/UNBLOCK BUILD MENU ────────────────────────────────────────────────
async function handleBuildBlockMenu(chatId, userId, msgId = null) {
    if (!isAdmin(userId)) {
        await send(chatId, '❌ **Akses Ditolak!**', [[{ text: '🏠 Menu Utama', data: 'start' }]], msgId);
        return;
    }

    const text = 
        `🚫 **BLOCK/UNBLOCK BUILD**\n` +
        `────────────────────────────────\n\n` +
        `Pilih aksi di bawah ini:`;

    const buttons = [
        [{ text: "🚫 Block Build", data: "owner_block_build" }],
        [{ text: "✅ Unblock Build", data: "owner_unblock_build" }],
        [{ text: "⬅️ Kembali", data: "owner_menu" }],
    ];

    if (msgId) {
        await edit(chatId, msgId, text, buttons);
    } else {
        await send(chatId, text, buttons);
    }
}

// ─── CREDIT MANAGEMENT ────────────────────────────────────────────────────────
async function handleCreditMenu(chatId, userId, msgId = null) {
    if (!isAdmin(userId)) {
        await send(chatId, '❌ **Akses Ditolak!**', [[{ text: '🏠 Menu Utama', data: 'start' }]], msgId);
        return;
    }

    const text = 
        `💳 **CREDIT MANAGEMENT**\n` +
        `────────────────────────────────\n\n` +
        `📊 **Statistik Credit:**\n` +
        `• Total User: \`${db.getAllUsers().length}\`\n` +
        `• Reseller: \`${db.getAllResellers().length}\`\n\n` +
        `Pilih aksi di bawah ini:`;

    const buttons = [
        [{ text: "➕ Add Credits ke User", data: "owner_add_credit" }],
        [{ text: "➖ Deduct Credits dari User", data: "owner_deduct_credit" }],
        [{ text: "✏️ Set Credits User", data: "owner_set_credit" }],
        [{ text: "📊 Lihat Credit User", data: "owner_view_credit" }],
        [{ text: "📋 List Semua Credit", data: "owner_list_all_credit" }],
        [{ text: "⬅️ Kembali", data: "owner_menu" }],
    ];

    if (msgId) {
        await edit(chatId, msgId, text, buttons);
    } else {
        await send(chatId, text, buttons);
    }
}

// ─── ADD CREDIT ──────────────────────────────────────────────────────────────
async function handleAddCredit(chatId, userId, msgId = null) {
    if (!isAdmin(userId)) {
        await send(chatId, '❌ **Akses Ditolak!**', [[{ text: '🏠 Menu Utama', data: 'start' }]], msgId);
        return;
    }

    userStates.set(userId, { step: 'OWNER_WAITING_ADD_CREDIT' });
    await send(
        chatId,
        `➕ **ADD CREDIT KE USER**\n` +
        `────────────────────────────────\n\n` +
        `Kirim dengan format:\n` +
        `\`USER_ID JUMLAH\`\n\n` +
        `📌 **Contoh:**\n` +
        `• \`123456789 10\` → Tambah 10 credit ke user ID 123456789\n` +
        `• \`@username 5\` → Tambah 5 credit ke user @username\n\n` +
        `💡 Ketik \`batal\` untuk membatalkan.`,
        [[{ text: "❌ Batalkan", data: "cancel" }]],
        msgId
    );
}

// ─── DEDUCT CREDIT ───────────────────────────────────────────────────────────
async function handleDeductCredit(chatId, userId, msgId = null) {
    if (!isAdmin(userId)) {
        await send(chatId, '❌ **Akses Ditolak!**', [[{ text: '🏠 Menu Utama', data: 'start' }]], msgId);
        return;
    }

    userStates.set(userId, { step: 'OWNER_WAITING_DEDUCT_CREDIT' });
    await send(
        chatId,
        `➖ **DEDUCT CREDIT DARI USER**\n` +
        `────────────────────────────────\n\n` +
        `Kirim dengan format:\n` +
        `\`USER_ID JUMLAH\`\n\n` +
        `📌 **Contoh:**\n` +
        `• \`123456789 5\` → Kurangi 5 credit dari user ID 123456789\n` +
        `• \`@username 3\` → Kurangi 3 credit dari user @username\n\n` +
        `💡 Ketik \`batal\` untuk membatalkan.`,
        [[{ text: "❌ Batalkan", data: "cancel" }]],
        msgId
    );
}

// ─── SET CREDIT ──────────────────────────────────────────────────────────────
async function handleSetCredit(chatId, userId, msgId = null) {
    if (!isAdmin(userId)) {
        await send(chatId, '❌ **Akses Ditolak!**', [[{ text: '🏠 Menu Utama', data: 'start' }]], msgId);
        return;
    }

    userStates.set(userId, { step: 'OWNER_WAITING_SET_CREDIT' });
    await send(
        chatId,
        `✏️ **SET CREDIT USER**\n` +
        `────────────────────────────────\n\n` +
        `Kirim dengan format:\n` +
        `\`USER_ID JUMLAH\`\n\n` +
        `📌 **Contoh:**\n` +
        `• \`123456789 50\` → Set credit user ID 123456789 menjadi 50\n` +
        `• \`@username 100\` → Set credit user @username menjadi 100\n\n` +
        `💡 Ketik \`batal\` untuk membatalkan.`,
        [[{ text: "❌ Batalkan", data: "cancel" }]],
        msgId
    );
}

// ─── VIEW CREDIT ─────────────────────────────────────────────────────────────
async function handleViewCredit(chatId, userId, msgId = null) {
    if (!isAdmin(userId)) {
        await send(chatId, '❌ **Akses Ditolak!**', [[{ text: '🏠 Menu Utama', data: 'start' }]], msgId);
        return;
    }

    userStates.set(userId, { step: 'OWNER_WAITING_VIEW_CREDIT' });
    await send(
        chatId,
        `📊 **LIHAT CREDIT USER**\n` +
        `────────────────────────────────\n\n` +
        `Kirim **User ID** atau **Username** (dengan @) yang ingin dilihat creditnya.\n\n` +
        `📌 **Contoh:**\n` +
        `• \`123456789\`\n` +
        `• \`@username\`\n\n` +
        `💡 Ketik \`list\` untuk melihat semua user dengan credit.`,
        [[{ text: "📋 Lihat Semua User", data: "owner_list_all_credit" }, { text: "❌ Batalkan", data: "cancel" }]],
        msgId
    );
}

// ─── LIST ALL CREDIT ─────────────────────────────────────────────────────────
async function handleListAllCredit(chatId, userId, msgId = null) {
    if (!isAdmin(userId)) {
        await send(chatId, '❌ **Akses Ditolak!**', [[{ text: '🏠 Menu Utama', data: 'start' }]], msgId);
        return;
    }

    const allUsers = db.getAllUsers();
    const sorted = allUsers.sort((a, b) => (b.credit || 0) - (a.credit || 0));
    
    let text = `📊 **DAFTAR CREDIT USER**\n────────────────────────────────\n\n`;
    
    if (sorted.length === 0) {
        text += `_Belum ada user terdaftar._`;
    } else {
        const topUsers = sorted.slice(0, 20);
        for (const user of topUsers) {
            const name = user.fullName || user.name || 'Unknown';
            const username = user.username ? `@${user.username.replace('@', '')}` : '';
            const credit = user.credit || 0;
            const isAdminUser = isAdmin(user.userId);
            const isResellerUser = db.isReseller(user.userId);
            const badge = isAdminUser ? '👑' : isResellerUser ? '🏪' : '👤';
            text += `${badge} \`${user.userId}\` - ${name} ${username}\n`;
            text += `   💳 Credit: \`${isAdminUser ? '∞' : credit}\`\n`;
        }
        
        if (sorted.length > 20) {
            text += `\n... dan ${sorted.length - 20} user lainnya`;
        }
        
        text += `\n\n📊 **Total User:** ${sorted.length}`;
    }

    await send(chatId, text, [[{ text: "⬅️ Kembali", data: "owner_credit_menu" }]], msgId);
}

// ─── HANDLE CREDIT TEXT INPUT ───────────────────────────────────────────────
async function handleCreditTextInput(event) {
    const chatId = event.chatId;
    const userId = Number(event.message.senderId);
    const text = event.message.text?.trim();
    const state = userStates.get(userId);

    if (!state) return false;
    if (!isAdmin(userId)) {
        userStates.delete(userId);
        return false;
    }

    const creditSteps = [
        'OWNER_WAITING_ADD_CREDIT',
        'OWNER_WAITING_DEDUCT_CREDIT',
        'OWNER_WAITING_SET_CREDIT',
        'OWNER_WAITING_VIEW_CREDIT'
    ];

    if (!creditSteps.includes(state.step)) return false;

    // ─── Batalkan ─────────────────────────────────────────────────────────────
    if (text?.toLowerCase() === 'batal' || text?.toLowerCase() === 'cancel') {
        userStates.delete(userId);
        await send(chatId, `✅ **Dibatalkan.**`, [[{ text: "💳 Credit Management", data: "owner_credit_menu" }]]);
        return true;
    }

    // ─── VIEW CREDIT ──────────────────────────────────────────────────────────
    if (state.step === 'OWNER_WAITING_VIEW_CREDIT') {
        if (text?.toLowerCase() === 'list') {
            return await handleListAllCredit(chatId, userId);
        }

        let targetUserId = null;
        let targetLabel = text;

        if (text.startsWith('@')) {
            try {
                const entity = await client.getEntity(text);
                targetUserId = Number(entity.id);
                targetLabel = text;
            } catch (_) {
                await send(chatId, `❌ **Username ${text} tidak ditemukan!**`);
                return true;
            }
        } else {
            targetUserId = Number(text);
            if (isNaN(targetUserId) || targetUserId < 1) {
                await send(chatId, `❌ **User ID tidak valid!**`);
                return true;
            }
        }

        const userData = db.getUser(targetUserId);
        const credit = db.getUserCredit(targetUserId);
        const name = userData?.fullName || userData?.name || 'Unknown';
        const username = userData?.username ? `@${userData.username.replace('@', '')}` : '';
        const isAdminUser = isAdmin(targetUserId);
        const isResellerUser = db.isReseller(targetUserId);

        const resultText = 
            `📊 **DETAIL CREDIT USER**\n` +
            `────────────────────────────────\n\n` +
            `👤 **Nama:** ${name}\n` +
            `🆔 **User ID:** \`${targetUserId}\`\n` +
            `🔗 **Username:** ${username || 'Tidak ada'}\n` +
            `👑 **Status:** ${isAdminUser ? 'Admin/Owner' : isResellerUser ? 'Reseller' : 'User'}\n` +
            `💳 **Credit:** \`${isAdminUser ? '∞ (Unlimited)' : credit}\`\n` +
            `────────────────────────────────`;

        userStates.delete(userId);
        await send(chatId, resultText, [[{ text: "⬅️ Kembali", data: "owner_credit_menu" }]]);
        return true;
    }

    // ─── ADD/DEDUCT/SET CREDIT ──────────────────────────────────────────────
    let targetUserId = null;
    let amount = 0;
    let targetLabel = text;

    const matchId = text?.match(/^(\d+)\s+(\d+)$/);
    const matchUsername = text?.match(/^@?(\w+)\s+(\d+)$/);

    if (matchId) {
        targetUserId = Number(matchId[1]);
        amount = Number(matchId[2]);
        targetLabel = `\`${targetUserId}\``;
    } else if (matchUsername) {
        const uname = matchUsername[1];
        amount = Number(matchUsername[2]);
        try {
            const entity = await client.getEntity(`@${uname}`);
            targetUserId = Number(entity.id);
            targetLabel = `@${uname} (\`${targetUserId}\`)`;
        } catch (_) {
            await send(chatId, `❌ **Username @${uname} tidak ditemukan!**\n\nPastikan username benar.`);
            return true;
        }
    } else {
        await send(chatId, `⚠️ **Format salah!**\n\nKirim dengan format: \`USER_ID JUMLAH\` atau \`@username JUMLAH\``);
        return true;
    }

    if (amount < 0) {
        await send(chatId, `⚠️ **Jumlah tidak valid!**\n\nJumlah harus lebih dari 0.`);
        return true;
    }

    if (isAdmin(targetUserId) && state.step !== 'OWNER_WAITING_VIEW_CREDIT') {
        await send(chatId, `❌ **Tidak bisa mengubah credit admin/owner!**`);
        userStates.delete(userId);
        return true;
    }

    let newCredit = 0;
    let actionText = '';

    switch (state.step) {
        case 'OWNER_WAITING_ADD_CREDIT':
            newCredit = db.addUserCredit(targetUserId, amount);
            actionText = 'ditambahkan';
            break;
        case 'OWNER_WAITING_DEDUCT_CREDIT':
            const currentCredit = db.getUserCredit(targetUserId);
            if (currentCredit < amount) {
                await send(chatId, `⚠️ **Credit tidak cukup!**\n\nUser hanya memiliki \`${currentCredit}\` credit.`);
                return true;
            }
            newCredit = db.addUserCredit(targetUserId, -amount);
            actionText = 'dikurangi';
            break;
        case 'OWNER_WAITING_SET_CREDIT':
            newCredit = db.setUserCredit(targetUserId, amount);
            actionText = 'diatur menjadi';
            break;
        default:
            return false;
    }

    userStates.delete(userId);

    const resultText = 
        `✅ **CREDIT BERHASIL ${actionText.toUpperCase()}**\n` +
        `────────────────────────────────\n\n` +
        `👤 **User:** ${targetLabel}\n` +
        `🔢 **Jumlah:** \`${amount}\`\n` +
        `💳 **Total Saat Ini:** \`${newCredit}\`\n` +
        `────────────────────────────────`;

    await send(chatId, resultText, [[{ text: "💳 Credit Management", data: "owner_credit_menu" }]]);

    try {
        await client.sendMessage(targetUserId, {
            message: `💳 **CREDIT KAMU DIPERBARUI**\n\n` +
                `Admin telah ${actionText} \`${amount}\` credit.\n` +
                `📊 **Total Saat Ini:** \`${newCredit}\``,
            parseMode: 'md',
        });
    } catch (_) {}

    return true;
}

// ─── MAINTENANCE MENU ─────────────────────────────────────────────────────────
async function handleMaintenanceMenu(chatId, userId, msgId = null) {
    if (!isAdmin(userId)) {
        await send(chatId, '❌ **Akses Ditolak!**', [[{ text: '🏠 Menu Utama', data: 'start' }]], msgId);
        return;
    }

    const status = getMaintenanceStatus();
    const statusIcon = status.enabled ? '🔴' : '🟢';
    const statusText = status.enabled ? 'ON' : 'OFF';
    const startedAt = status.startedAt ? status.startedAt.toLocaleString('id-ID') : '-';

    const text = 
        `🛠️ **MAINTENANCE MODE**\n` +
        `────────────────────────────────\n\n` +
        `📊 **Status:** ${statusIcon} \`${statusText}\`\n` +
        `📅 **Mulai:** ${startedAt}\n` +
        `📝 **Pesan:** ${status.message}\n\n` +
        `Pilih aksi di bawah ini:`;

    const buttons = [
        [{ text: status.enabled ? "🔴 Turn OFF Maintenance" : "🟢 Turn ON Maintenance", data: "owner_maintenance_toggle" }],
        [{ text: "✏️ Set Pesan Maintenance", data: "owner_maintenance_set_message" }],
        [{ text: "⬅️ Kembali", data: "owner_menu" }],
    ];

    if (msgId) {
        await edit(chatId, msgId, text, buttons);
    } else {
        await send(chatId, text, buttons);
    }
}

// ─── TOGGLE MAINTENANCE ──────────────────────────────────────────────────────
async function handleMaintenanceToggle(chatId, userId, msgId = null) {
    if (!isAdmin(userId)) {
        await send(chatId, '❌ **Akses Ditolak!**', [[{ text: '🏠 Menu Utama', data: 'start' }]], msgId);
        return;
    }

    const status = getMaintenanceStatus();
    const newStatus = !status.enabled;
    setMaintenanceMode(newStatus);

    const statusText = newStatus ? 'ON' : 'OFF';
    const icon = newStatus ? '🔴' : '🟢';

    await send(
        chatId,
        `✅ **Maintenance Mode ${statusText}**\n\n` +
        `🛠️ Status: ${icon} \`${statusText}\`\n` +
        `📝 Pesan: ${maintenanceMode.message}\n\n` +
        `Bot ${newStatus ? 'akan menolak semua perintah' : 'akan merespon normal'}.`,
        [[{ text: "🛠️ Maintenance Menu", data: "owner_maintenance_menu" }]],
        msgId
    );
}

// ─── SET MAINTENANCE MESSAGE ─────────────────────────────────────────────────
async function handleMaintenanceSetMessage(chatId, userId, msgId = null) {
    if (!isAdmin(userId)) {
        await send(chatId, '❌ **Akses Ditolak!**', [[{ text: '🏠 Menu Utama', data: 'start' }]], msgId);
        return;
    }

    userStates.set(userId, { step: 'OWNER_WAITING_MAINTENANCE_MESSAGE' });
    await send(
        chatId,
        `✏️ **SET PESAN MAINTENANCE**\n` +
        `────────────────────────────────\n\n` +
        `Kirim pesan maintenance yang akan ditampilkan ke user.\n\n` +
        `📌 **Contoh:**\n` +
        `\`🛠️ Bot sedang dalam perbaikan. Akan kembali dalam 1 jam.\`\n\n` +
        `💡 Ketik \`batal\` untuk membatalkan.`,
        [[{ text: "❌ Batalkan", data: "cancel" }]],
        msgId
    );
}

// ─── HANDLE MAINTENANCE MESSAGE INPUT ──────────────────────────────────────
async function handleMaintenanceMessageInput(event) {
    const chatId = event.chatId;
    const userId = Number(event.message.senderId);
    const text = event.message.text?.trim();
    const state = userStates.get(userId);

    if (!state || state.step !== 'OWNER_WAITING_MAINTENANCE_MESSAGE') return false;
    if (!isAdmin(userId)) {
        userStates.delete(userId);
        return false;
    }

    if (text?.toLowerCase() === 'batal' || text?.toLowerCase() === 'cancel') {
        userStates.delete(userId);
        await send(chatId, `✅ **Dibatalkan.**`, [[{ text: "🛠️ Maintenance Menu", data: "owner_maintenance_menu" }]]);
        return true;
    }

    if (!text || text.length < 3) {
        await send(chatId, `⚠️ **Pesan terlalu pendek!**\n\nMinimal 3 karakter.`);
        return true;
    }

    setMaintenanceMode(maintenanceMode.enabled, text);
    userStates.delete(userId);

    await send(
        chatId,
        `✅ **Pesan Maintenance Diperbarui!**\n\n` +
        `📝 **Pesan Baru:**\n${text}\n\n` +
        `🛠️ Status: ${maintenanceMode.enabled ? '🔴 ON' : '🟢 OFF'}`,
        [[{ text: "🛠️ Maintenance Menu", data: "owner_maintenance_menu" }]]
    );

    return true;
}

// ─── CREDIT INFO / REDEEM CODES ─────────────────────────────────────────────
function getActiveRedeemCodes() {
    try {
        if (!REDEEM_CODES_PATH || !fs.existsSync(REDEEM_CODES_PATH)) return [];
        const data = JSON.parse(fs.readFileSync(REDEEM_CODES_PATH, 'utf-8'));
        if (!Array.isArray(data)) return [];
        return data.filter(item => {
            const maxClaims = Number(item?.maxClaims || 0);
            const claimCount = Number(item?.claimCount || 0);
            const amount = Number(item?.amount || 0);
            return item?.code && maxClaims > claimCount && amount > 0;
        });
    } catch (err) {
        console.error('Gagal membaca redeem_codes.json:', err.message);
        return [];
    }
}

async function handleCreditInfo(chatId, userId, msgId = null) {
    if (!isAdmin(userId)) {
        await send(chatId, '❌ **Akses Ditolak!**', [[{ text: '🏠 Menu Utama', data: 'start' }]], msgId);
        return;
    }

    const activeCodes = getActiveRedeemCodes();
    let text =
        `💳 **CREDIT & REDEEM**\n` +
        `────────────────────────────────\n\n` +
        `📋 **COMMAND CREDIT:**\n` +
        `• \`/credeem {max claim}:{credit}:{kode}\` — buat kode redeem (Owner)\n` +
        `• \`/redeem <kode>\` — klaim credit dengan kode\n\n` +
        `📌 **Contoh:** \`/credeem 10:50:VIP2026\`\n` +
        `→ Maks. 10 user, +50 credit per claim.\n\n` +
        `🔥 **KODE REDEEM MASIH AKTIF (${activeCodes.length})**\n` +
        `────────────────────────────────\n`;

    if (activeCodes.length === 0) {
        text += `\n❌ Tidak ada kode redeem yang masih aktif.`;
    } else {
        for (const item of activeCodes) {
            const maxClaims = Number(item.maxClaims || 0);
            const claimCount = Number(item.claimCount || 0);
            const remaining = Math.max(0, maxClaims - claimCount);
            const safeCode = String(item.code).replace(/`/g, "'");
            text +=
                `\n🔑 \`${safeCode}\`\n` +
                `💳 +${Number(item.amount || 0)} credit / claim\n` +
                `👥 ${claimCount}/${maxClaims} claim • sisa ${remaining} claim\n`;
        }
    }

    text += `\n────────────────────────────────\n💡 Kode otomatis hilang dari daftar aktif setelah seluruh claim habis.`;

    await send(chatId, text, [
        [{ text: '📢 Broadcast', data: 'owner_broadcast' }],
        [{ text: '💳 Credit Management', data: 'owner_credit_menu' }],
        [{ text: '🔄 Refresh', data: 'owner_credit_info' }],
        [{ text: '⬅️ Owner Panel', data: 'owner_menu' }],
    ], msgId);
}

// ─── BROADCAST HANDLER ──────────────────────────────────────────────────────
async function handleBroadcast(chatId, userId, msgId = null) {
    if (!isAdmin(userId)) {
        await send(chatId, '❌ **Akses Ditolak!**', [[{ text: '🏠 Menu Utama', data: 'start' }]], msgId);
        return;
    }

    if (activeBroadcast.isRunning) {
        await send(
            chatId,
            `⚠️ **Broadcast Sedang Berjalan!**\n\n` +
            `📊 Progress: \`${activeBroadcast.processed}/${activeBroadcast.totalUsers}\`\n` +
            `✅ Sukses: \`${activeBroadcast.success}\`\n` +
            `❌ Gagal: \`${activeBroadcast.failed}\`\n\n` +
            `Gunakan **Stop Broadcast** untuk menghentikan.`,
            [[{ text: "🛑 Stop Broadcast", data: "owner_stop_broadcast" }]],
            msgId
        );
        return;
    }

    userStates.set(userId, { step: 'OWNER_WAITING_BROADCAST' });
    
    await send(
        chatId,
        `📢 **BROADCAST MESSAGE**\n` +
        `────────────────────────────────\n\n` +
        `Kirim pesan yang ingin di-broadcast ke semua user.\n\n` +
        `📌 **Cara:**\n` +
        `• Kirim teks biasa\n` +
        `• Kirim foto/video/dokumen dengan caption\n` +
        `• Reply pesan yang sudah ada\n\n` +
        `⚠️ Pesan akan dikirim ke SEMUA user terdaftar.\n` +
        `💡 Gunakan **/cancel** untuk membatalkan.`,
        [
            [{ text: "💳 Credit & Redeem", data: "owner_credit_info" }],
            [{ text: "❌ Batalkan", data: "cancel" }],
        ],
        msgId
    );
}

async function handleBroadcastMessage(event) {
    const chatId = event.chatId;
    const userId = Number(event.message.senderId);
    const msg = event.message;
    const state = userStates.get(userId);

    if (!state || state.step !== 'OWNER_WAITING_BROADCAST') return false;
    if (!isAdmin(userId)) {
        userStates.delete(userId);
        return false;
    }

    const users = db.getAllUsers();
    const blockedUsers = getBlockedUsers();
    const targetUsers = users.filter(u => !blockedUsers.includes(u.userId) && !isAdmin(u.userId));

    if (targetUsers.length === 0) {
        userStates.delete(userId);
        await send(chatId, `⚠️ **Tidak ada user yang bisa dikirim pesan!**\n\nSemua user dalam keadaan diblokir atau tidak ada user terdaftar.`);
        return true;
    }

    activeBroadcast = {
        isRunning: true,
        chatId,
        userId,
        targetMessage: msg,
        totalUsers: targetUsers.length,
        processed: 0,
        success: 0,
        failed: 0,
        stopped: false,
        paused: false,
    };

    userStates.delete(userId);

    await send(
        chatId,
        `🚀 **Broadcast Dimulai!**\n\n` +
        `📊 Total Target: \`${targetUsers.length}\` user\n` +
        `⏳ Memproses...\n\n` +
        `Gunakan tombol di bawah untuk menghentikan.`,
        [[{ text: "🛑 Stop Broadcast", data: "owner_stop_broadcast" }]]
    );

    runBroadcast(targetUsers, chatId).catch(err => {
        console.error('Broadcast error:', err);
    });

    return true;
}

async function runBroadcast(targetUsers, chatId) {
    let index = 0;
    const delay = 200;

    for (const user of targetUsers) {
        if (activeBroadcast.stopped) {
            await send(chatId, `🛑 **Broadcast Dihentikan!**\n\n✅ Sukses: \`${activeBroadcast.success}\`\n❌ Gagal: \`${activeBroadcast.failed}\`\n📊 Terproses: \`${activeBroadcast.processed}/${activeBroadcast.totalUsers}\``);
            activeBroadcast.isRunning = false;
            return;
        }

        try {
            const targetId = user.userId;
            const msg = activeBroadcast.targetMessage;

            // Copy the original Telegram message instead of rebuilding it as Markdown.
            // This keeps Telegram message entities and reply markup (links, blockquotes,
            // bold/italic, code, spoilers, mentions, custom emoji, inline buttons, media, etc.).
            await client.forwardMessages(targetId, {
                messages: [msg.id],
                fromPeer: chatId,
                dropAuthor: true,
            });
            activeBroadcast.success++;
        } catch (err) {
            activeBroadcast.failed++;
            console.error(`Gagal kirim ke ${user.userId}:`, err.message);
        }

        activeBroadcast.processed = ++index;

        if (index % 10 === 0 || index === activeBroadcast.totalUsers) {
            try {
                await client.sendMessage(chatId, {
                    message: `📊 **Progress Broadcast:** \`${index}/${activeBroadcast.totalUsers}\`\n✅ Sukses: \`${activeBroadcast.success}\`\n❌ Gagal: \`${activeBroadcast.failed}\``,
                    parseMode: 'md',
                });
            } catch (_) {}
        }

        await sleep(delay);
    }

    activeBroadcast.isRunning = false;
    await send(
        chatId,
        `✅ **Broadcast Selesai!**\n\n` +
        `📊 Total Target: \`${activeBroadcast.totalUsers}\`\n` +
        `✅ Sukses: \`${activeBroadcast.success}\`\n` +
        `❌ Gagal: \`${activeBroadcast.failed}\``,
        [[{ text: "👑 Owner Panel", data: "owner_menu" }]]
    );
}

async function handleStopBroadcast(chatId, userId, msgId = null) {
    if (!isAdmin(userId)) {
        await send(chatId, '❌ **Akses Ditolak!**', [[{ text: '🏠 Menu Utama', data: 'start' }]], msgId);
        return;
    }

    if (!activeBroadcast.isRunning) {
        await send(chatId, `ℹ️ **Tidak ada broadcast yang sedang berjalan.**`, [[{ text: "👑 Owner Panel", data: "owner_menu" }]], msgId);
        return;
    }

    activeBroadcast.stopped = true;
    await send(
        chatId,
        `🛑 **Menghentikan Broadcast...**\n\n` +
        `📊 Progress: \`${activeBroadcast.processed}/${activeBroadcast.totalUsers}\``,
        [[{ text: "👑 Owner Panel", data: "owner_menu" }]],
        msgId
    );
}

// ─── BLOCK/UNBLOCK USER ──────────────────────────────────────────────────────
async function handleBlockUser(chatId, userId, msgId = null) {
    if (!isAdmin(userId)) {
        await send(chatId, '❌ **Akses Ditolak!**', [[{ text: '🏠 Menu Utama', data: 'start' }]], msgId);
        return;
    }

    userStates.set(userId, { step: 'OWNER_WAITING_BLOCK_USER' });
    await send(
        chatId,
        `🔒 **BLOCK USER**\n` +
        `────────────────────────────────\n\n` +
        `Kirim **User ID** atau **Username** (dengan @) yang ingin diblokir.\n\n` +
        `📌 Contoh:\n` +
        `• \`123456789\`\n` +
        `• \`@username\`\n\n` +
        `User yang diblokir tidak bisa menggunakan bot sama sekali.`,
        [[{ text: "❌ Batalkan", data: "cancel" }]],
        msgId
    );
}

async function handleUnblockUser(chatId, userId, msgId = null) {
    if (!isAdmin(userId)) {
        await send(chatId, '❌ **Akses Ditolak!**', [[{ text: '🏠 Menu Utama', data: 'start' }]], msgId);
        return;
    }

    userStates.set(userId, { step: 'OWNER_WAITING_UNBLOCK_USER' });
    await send(
        chatId,
        `🔓 **UNBLOCK USER**\n` +
        `────────────────────────────────\n\n` +
        `Kirim **User ID** atau **Username** (dengan @) yang ingin dibuka blokirnya.\n\n` +
        `📌 Contoh:\n` +
        `• \`123456789\`\n` +
        `• \`@username\``,
        [[{ text: "❌ Batalkan", data: "cancel" }]],
        msgId
    );
}

async function handleBlockUnblockText(event) {
    const chatId = event.chatId;
    const userId = Number(event.message.senderId);
    const text = event.message.text?.trim();
    const state = userStates.get(userId);

    if (!state) return false;
    if (!isAdmin(userId)) {
        userStates.delete(userId);
        return false;
    }

    if (state.step === 'OWNER_WAITING_BLOCK_USER' || state.step === 'OWNER_WAITING_UNBLOCK_USER') {
        if (!text) {
            await send(chatId, `⚠️ **Input tidak valid!**\n\nKirim User ID atau Username.`);
            return true;
        }

        let targetUserId = null;
        let targetLabel = text;

        if (text.startsWith('@')) {
            try {
                const entity = await client.getEntity(text);
                targetUserId = Number(entity.id);
                targetLabel = text;
            } catch (_) {
                await send(chatId, `❌ **Username ${text} tidak ditemukan!**`);
                return true;
            }
        } else {
            targetUserId = Number(text);
            if (isNaN(targetUserId) || targetUserId < 1) {
                await send(chatId, `❌ **User ID tidak valid!**\n\nKirim angka ID yang valid.`);
                return true;
            }
        }

        if (isAdmin(targetUserId)) {
            await send(chatId, `❌ **Tidak bisa memblokir admin/owner!**`);
            userStates.delete(userId);
            return true;
        }

        if (state.step === 'OWNER_WAITING_BLOCK_USER') {
            if (isUserBlocked(targetUserId)) {
                await send(chatId, `ℹ️ **User ${targetLabel} sudah dalam status diblokir.**`);
            } else {
                blockUser(targetUserId);
                await send(chatId, `✅ **User ${targetLabel} (\`${targetUserId}\`) berhasil diblokir!**`);
                
                try {
                    await client.sendMessage(targetUserId, {
                        message: `🚫 **AKSES DIBLOKIR**\n\nAkun kamu telah diblokir oleh admin bot. Kamu tidak dapat menggunakan bot ini lagi.\n\nJika merasa ini kesalahan, hubungi admin.`,
                        parseMode: 'md',
                    });
                } catch (_) {}
            }
        } else {
            if (!isUserBlocked(targetUserId)) {
                await send(chatId, `ℹ️ **User ${targetLabel} tidak dalam status diblokir.**`);
            } else {
                unblockUser(targetUserId);
                await send(chatId, `✅ **User ${targetLabel} (\`${targetUserId}\`) berhasil dibuka blokirnya!**`);
                
                try {
                    await client.sendMessage(targetUserId, {
                        message: `✅ **AKSES DIKEMBALIKAN**\n\nAkses kamu ke bot telah dipulihkan. Silakan coba kembali.`,
                        parseMode: 'md',
                    });
                } catch (_) {}
            }
        }

        userStates.delete(userId);
        return true;
    }

    return false;
}

// ─── BLOCK/UNBLOCK BUILD ──────────────────────────────────────────────────────
async function handleBlockBuild(chatId, userId, msgId = null) {
    if (!isAdmin(userId)) {
        await send(chatId, '❌ **Akses Ditolak!**', [[{ text: '🏠 Menu Utama', data: 'start' }]], msgId);
        return;
    }

    userStates.set(userId, { step: 'OWNER_WAITING_BLOCK_BUILD' });
    await send(
        chatId,
        `🚫 **BLOCK BUILD**\n` +
        `────────────────────────────────\n\n` +
        `Kirim **User ID** atau **Username** (dengan @) yang build-nya ingin diblokir.\n\n` +
        `📌 Contoh:\n` +
        `• \`123456789\`\n` +
        `• \`@username\`\n\n` +
        `User yang build-nya diblokir tetap bisa menggunakan fitur lain, tapi tidak bisa build APK.`,
        [[{ text: "❌ Batalkan", data: "cancel" }]],
        msgId
    );
}

async function handleUnblockBuild(chatId, userId, msgId = null) {
    if (!isAdmin(userId)) {
        await send(chatId, '❌ **Akses Ditolak!**', [[{ text: '🏠 Menu Utama', data: 'start' }]], msgId);
        return;
    }

    userStates.set(userId, { step: 'OWNER_WAITING_UNBLOCK_BUILD' });
    await send(
        chatId,
        `✅ **UNBLOCK BUILD**\n` +
        `────────────────────────────────\n\n` +
        `Kirim **User ID** atau **Username** (dengan @) yang build-nya ingin dibuka.\n\n` +
        `📌 Contoh:\n` +
        `• \`123456789\`\n` +
        `• \`@username\``,
        [[{ text: "❌ Batalkan", data: "cancel" }]],
        msgId
    );
}

async function handleBlockBuildText(event) {
    const chatId = event.chatId;
    const userId = Number(event.message.senderId);
    const text = event.message.text?.trim();
    const state = userStates.get(userId);

    if (!state) return false;
    if (!isAdmin(userId)) {
        userStates.delete(userId);
        return false;
    }

    if (state.step === 'OWNER_WAITING_BLOCK_BUILD' || state.step === 'OWNER_WAITING_UNBLOCK_BUILD') {
        if (!text) {
            await send(chatId, `⚠️ **Input tidak valid!**\n\nKirim User ID atau Username.`);
            return true;
        }

        let targetUserId = null;
        let targetLabel = text;

        if (text.startsWith('@')) {
            try {
                const entity = await client.getEntity(text);
                targetUserId = Number(entity.id);
                targetLabel = text;
            } catch (_) {
                await send(chatId, `❌ **Username ${text} tidak ditemukan!**`);
                return true;
            }
        } else {
            targetUserId = Number(text);
            if (isNaN(targetUserId) || targetUserId < 1) {
                await send(chatId, `❌ **User ID tidak valid!**`);
                return true;
            }
        }

        if (state.step === 'OWNER_WAITING_BLOCK_BUILD') {
            if (isBuildBlocked(targetUserId)) {
                await send(chatId, `ℹ️ **Build user ${targetLabel} sudah dalam status diblokir.**`);
            } else {
                blockBuildUser(targetUserId);
                await send(chatId, `🚫 **Build user ${targetLabel} (\`${targetUserId}\`) berhasil diblokir!**`);
                
                try {
                    await client.sendMessage(targetUserId, {
                        message: `🚫 **BUILD DIBLOKIR**\n\nFitur build APK untuk akun kamu telah dinonaktifkan oleh admin.\n\nJika merasa ini kesalahan, hubungi admin.`,
                        parseMode: 'md',
                    });
                } catch (_) {}
            }
        } else {
            if (!isBuildBlocked(targetUserId)) {
                await send(chatId, `ℹ️ **Build user ${targetLabel} tidak dalam status diblokir.**`);
            } else {
                unblockBuildUser(targetUserId);
                await send(chatId, `✅ **Build user ${targetLabel} (\`${targetUserId}\`) berhasil dibuka!**`);
                
                try {
                    await client.sendMessage(targetUserId, {
                        message: `✅ **BUILD DIKEMBALIKAN**\n\nFitur build APK untuk akun kamu telah diaktifkan kembali.`,
                        parseMode: 'md',
                    });
                } catch (_) {}
            }
        }

        userStates.delete(userId);
        return true;
    }

    return false;
}

// ─── STOP ALL BUILD ──────────────────────────────────────────────────────────
async function handleStopAllBuild(chatId, userId, msgId = null) {
    if (!isAdmin(userId)) {
        await send(chatId, '❌ **Akses Ditolak!**', [[{ text: '🏠 Menu Utama', data: 'start' }]], msgId);
        return;
    }

    const activeJobs = getActiveJobs();
    if (activeJobs.length === 0) {
        await send(chatId, `ℹ️ **Tidak ada build yang sedang berjalan.**`, [[{ text: "👑 Owner Panel", data: "owner_menu" }]], msgId);
        return;
    }

    let stopped = 0;
    for (const job of activeJobs) {
        try {
            if (job.releaseId) {
                await deleteRelease(job.releaseId).catch(() => {});
            }
            if (job.iconReleaseId) {
                await deleteRelease(job.iconReleaseId).catch(() => {});
            }
            removeUserJob(job.userId);
            stopped++;
            
            try {
                await client.sendMessage(job.userId, {
                    message: `🛑 **BUILD DIHENTIKAN OLEH ADMIN**\n\nBuild kamu telah dihentikan paksa oleh admin bot.\n\nSilakan hubungi admin jika ada pertanyaan.`,
                    parseMode: 'md',
                });
            } catch (_) {}
        } catch (err) {
            console.error(`Gagal stop build user ${job.userId}:`, err.message);
        }
    }

    await send(
        chatId,
        `⏹️ **All Build Stopped!**\n\n` +
        `🛑 **${stopped}** build berhasil dihentikan.\n` +
        `📊 Total build aktif sebelumnya: \`${activeJobs.length}\``,
        [[{ text: "👑 Owner Panel", data: "owner_menu" }]],
        msgId
    );
}

// ─── LIST BLOCKED USERS ──────────────────────────────────────────────────────
async function handleListBlockedUsers(chatId, userId, msgId = null) {
    if (!isAdmin(userId)) {
        await send(chatId, '❌ **Akses Ditolak!**', [[{ text: '🏠 Menu Utama', data: 'start' }]], msgId);
        return;
    }

    const blockedUsers = getBlockedUsers();
    const buildBlocked = Array.from(blockedBuildUsers);

    let text = `📋 **DAFTAR USER DIBLOKIR**\n────────────────────────────────\n\n`;

    if (blockedUsers.length === 0) {
        text += `🔓 **Tidak ada user yang diblokir.**\n\n`;
    } else {
        text += `🔒 **User Diblokir (${blockedUsers.length}):**\n`;
        for (const id of blockedUsers) {
            const user = db.getUser(id);
            const name = user?.fullName || user?.name || 'Unknown';
            text += `• \`${id}\` - ${name}\n`;
        }
        text += `\n`;
    }

    if (buildBlocked.length === 0) {
        text += `✅ **Tidak ada user yang build-nya diblokir.**\n`;
    } else {
        text += `🚫 **Build Diblokir (${buildBlocked.length}):**\n`;
        for (const id of buildBlocked) {
            const user = db.getUser(id);
            const name = user?.fullName || user?.name || 'Unknown';
            text += `• \`${id}\` - ${name}\n`;
        }
    }

    text += `\n────────────────────────────────\n👑 Owner Panel`;

    await send(chatId, text, [[{ text: "👑 Owner Panel", data: "owner_menu" }]], msgId);
}

// ─── CALLBACK HANDLER ────────────────────────────────────────────────────────
async function handleOwnerCallback(event) {
    const data = event.data.toString();
    const chatId = event.chatId;
    const userId = Number(event.senderId);
    const msgId = event.messageId;

    console.log(`[DEBUG] Owner callback: ${data} from user ${userId}`);
    console.log(`[DEBUG] isAdmin? ${isAdmin(userId)}`);

    if (!isAdmin(userId)) {
        await event.answer({ message: "❌ Akses Ditolak!", alert: true });
        return;
    }

    // ─── Main Menu ────────────────────────────────────────────────────────────
    if (data === "owner_menu") {
        return await handleOwnerMenu(chatId, userId, msgId);
    }

    // ─── Block/Unblock User Menu ─────────────────────────────────────────────
    if (data === "owner_block_menu") {
        return await handleBlockMenu(chatId, userId, msgId);
    }

    // ─── Block/Unblock Build Menu ────────────────────────────────────────────
    if (data === "owner_build_block_menu") {
        return await handleBuildBlockMenu(chatId, userId, msgId);
    }

    // ─── Credit & Redeem Info ────────────────────────────────────────────────
    if (data === "owner_credit_info") {
        return await handleCreditInfo(chatId, userId, msgId);
    }

    // ─── Credit Management ────────────────────────────────────────────────────
    if (data === "owner_credit_menu") {
        return await handleCreditMenu(chatId, userId, msgId);
    }

    if (data === "owner_add_credit") {
        return await handleAddCredit(chatId, userId, msgId);
    }

    if (data === "owner_deduct_credit") {
        return await handleDeductCredit(chatId, userId, msgId);
    }

    if (data === "owner_set_credit") {
        return await handleSetCredit(chatId, userId, msgId);
    }

    if (data === "owner_view_credit") {
        return await handleViewCredit(chatId, userId, msgId);
    }

    if (data === "owner_list_all_credit") {
        return await handleListAllCredit(chatId, userId, msgId);
    }

    // ─── Maintenance ──────────────────────────────────────────────────────────
    if (data === "owner_maintenance_menu") {
        return await handleMaintenanceMenu(chatId, userId, msgId);
    }

    if (data === "owner_maintenance_toggle") {
        return await handleMaintenanceToggle(chatId, userId, msgId);
    }

    if (data === "owner_maintenance_set_message") {
        return await handleMaintenanceSetMessage(chatId, userId, msgId);
    }

    // ─── Broadcast ────────────────────────────────────────────────────────────
    if (data === "owner_broadcast") {
        return await handleBroadcast(chatId, userId, msgId);
    }

    if (data === "owner_stop_broadcast") {
        return await handleStopBroadcast(chatId, userId, msgId);
    }

    // ─── Block/Unblock User ──────────────────────────────────────────────────
    if (data === "owner_block_user") {
        return await handleBlockUser(chatId, userId, msgId);
    }

    if (data === "owner_unblock_user") {
        return await handleUnblockUser(chatId, userId, msgId);
    }

    // ─── Block/Unblock Build ─────────────────────────────────────────────────
    if (data === "owner_block_build") {
        return await handleBlockBuild(chatId, userId, msgId);
    }

    if (data === "owner_unblock_build") {
        return await handleUnblockBuild(chatId, userId, msgId);
    }

    // ─── Stop All Build ──────────────────────────────────────────────────────
    if (data === "owner_stop_all_build") {
        return await handleStopAllBuild(chatId, userId, msgId);
    }

    // ─── List Blocked Users ──────────────────────────────────────────────────
    if (data === "owner_list_blocked") {
        return await handleListBlockedUsers(chatId, userId, msgId);
    }
}

// ─── CHECK USER BLOCKED ──────────────────────────────────────────────────────
function checkUserBlocked(userId) {
    return isUserBlocked(userId) || isBuildBlocked(userId);
}

// ─── REGISTER FUNCTIONS ──────────────────────────────────────────────────────
Object.assign(globalThis, {
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
    handleCreditInfo,
    handleCreditMenu,
    handleAddCredit,
    handleDeductCredit,
    handleSetCredit,
    handleViewCredit,
    handleListAllCredit,
    handleMaintenanceMenu,
    handleMaintenanceToggle,
    handleMaintenanceSetMessage,
    handleBlockMenu,
    handleBuildBlockMenu,
    isUserBlocked,
    isBuildBlocked,
    blockUser,
    unblockUser,
    blockBuildUser,
    unblockBuildUser,
    getBlockedUsers,
    checkUserBlocked,
    activeBroadcast,
    maintenanceMode,
    isMaintenanceEnabled,
    getMaintenanceStatus,
    setMaintenanceMode,
    checkMaintenance,
    getMaintenanceMessage,
});

module.exports = {
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
    handleCreditInfo,
    handleCreditMenu,
    handleAddCredit,
    handleDeductCredit,
    handleSetCredit,
    handleViewCredit,
    handleListAllCredit,
    handleMaintenanceMenu,
    handleMaintenanceToggle,
    handleMaintenanceSetMessage,
    handleBlockMenu,
    handleBuildBlockMenu,
    isUserBlocked,
    isBuildBlocked,
    blockUser,
    unblockUser,
    blockBuildUser,
    unblockBuildUser,
    getBlockedUsers,
    checkUserBlocked,
    activeBroadcast,
    maintenanceMode,
    isMaintenanceEnabled,
    getMaintenanceStatus,
    setMaintenanceMode,
    checkMaintenance,
    getMaintenanceMessage,
};