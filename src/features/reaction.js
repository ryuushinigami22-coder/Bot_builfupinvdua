// src/features/reaction.js
// Fitur Suntik Reaction ke Channel/Group Telegram

const { Api } = require("telegram");

// ─── DAFTAR REACTION YANG DIDUKUNG ──────────────────────────────────────────
const SUPPORTED_REACTIONS = [
    '👍', '👎', '❤️', '🔥', '🥰', '👏', '😁', '🤔', '🤯', '😱',
    '🤬', '😢', '🎉', '🤩', '🤮', '💩', '🙏', '👌', '🕊️', '🤡',
    '🥱', '🥴', '😍', '🐳', '❤️‍🔥', '🌚', '🌭', '💯', '🤣', '⚡',
    '🍌', '🏆', '💔', '🤨', '😐', '🍓', '🍾', '💋', '🖕', '😈',
    '😴', '😭', '🤓', '👻', '🙈', '🤫', '🤭', '😎', '🥺', '🤗'
];

// ─── STATE ──────────────────────────────────────────────────────────────────
const reactionStates = new Map();

// ─── REACTION INJECTOR ──────────────────────────────────────────────────────

/**
 * Inject reaction ke pesan tertentu
 */
async function injectReaction(chatId, msgId, reaction) {
    try {
        const result = await client.invoke(new Api.messages.SendReaction({
            peer: chatId,
            msgId: msgId,
            reaction: [reaction],
            big: false,
            addToRecent: false,
        }));
        return { success: true, result };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

/**
 * Inject reaction ke multiple pesan di channel
 * Menggunakan messages.GetMessages untuk mengambil pesan berdasarkan ID
 */
async function injectToMultipleMessages(chatId, msgIds, reaction) {
    const results = [];
    for (const msgId of msgIds) {
        const result = await injectReaction(chatId, msgId, reaction);
        results.push({ msgId, ...result });
        await sleep(500); // Delay 500ms agar tidak kena rate limit
    }
    return results;
}

// ─── SCAN & INJECT KE SEMUA PESAN ──────────────────────────────────────────

/**
 * Scan channel/group dan inject reaction ke semua pesan
 * Menggunakan messages.getMessages untuk bot agar tidak error
 */
async function scanAndInject(chatId, reaction, limit = 10) {
    try {
        // ─── AMBIL PESAN TERAKHIR DENGAN messages.getMessages ──────────────
        // Untuk bot, kita perlu menggunakan pendekatan berbeda
        // Kita akan menggunakan messages.getMessages dengan ID pesan yang diketahui
        
        // Coba ambil history dengan messages.GetHistory
        // Jika gagal, gunakan pendekatan alternatif
        let msgIds = [];
        
        try {
            // Coba method GetHistory (mungkin gagal untuk bot di channel)
            const history = await client.invoke(new Api.messages.GetHistory({
                peer: chatId,
                limit: Math.min(limit, 100),
                addOffset: 0,
                offsetId: 0,
                offsetDate: 0,
                minId: 0,
                maxId: 0,
            }));

            if (history.messages && history.messages.length > 0) {
                for (const msg of history.messages) {
                    if (msg.id) {
                        msgIds.push(msg.id);
                    }
                }
            }
        } catch (err) {
            console.log("[REACTION] GetHistory error, trying alternative method:", err.message);
            
            // ─── PENDEKATAN ALTERNATIF ──────────────────────────────────────
            // Coba dapatkan pesan dari forward/mention
            try {
                // Kirim pesan test ke channel, lalu ambil ID-nya
                const testMsg = await client.sendMessage(chatId, {
                    message: "🔍 Reaction Injector - Scanning messages...",
                });
                
                if (testMsg && testMsg.id) {
                    // Ambil beberapa pesan sebelumnya dengan getMessages
                    const msgIdsToCheck = [];
                    for (let i = 1; i <= Math.min(limit, 10); i++) {
                        msgIdsToCheck.push(testMsg.id - i);
                    }
                    
                    const getMsgResult = await client.invoke(new Api.messages.GetMessages({
                        id: msgIdsToCheck,
                    }));
                    
                    if (getMsgResult.messages) {
                        for (const msg of getMsgResult.messages) {
                            if (msg.id && msg.id !== testMsg.id) {
                                msgIds.push(msg.id);
                            }
                        }
                    }
                    
                    // Hapus pesan test
                    try {
                        await client.deleteMessages(chatId, [testMsg.id], { revoke: true });
                    } catch (_) {}
                }
            } catch (err2) {
                console.log("[REACTION] Alternative method also failed:", err2.message);
                
                // ─── PENDEKATAN KEDUA: Manual dengan ID pesan yang diketahui ──
                // User harus memberikan ID pesan secara manual
                return { 
                    success: false, 
                    error: 'Bot tidak bisa mengambil history pesan. Pastikan bot adalah admin di channel/group, atau gunakan ID pesan manual.' 
                };
            }
        }

        if (msgIds.length === 0) {
            return { 
                success: false, 
                message: 'Tidak ada pesan ditemukan di channel/group ini. Pastikan bot adalah admin.' 
            };
        }

        // ─── INJECT REACTION ────────────────────────────────────────────────
        const results = await injectToMultipleMessages(chatId, msgIds, reaction);
        const successCount = results.filter(r => r.success).length;
        const failedCount = results.filter(r => !r.success).length;

        return {
            success: true,
            total: msgIds.length,
            successCount,
            failedCount,
            results,
            message: `✅ ${successCount} reaksi berhasil disuntik, ${failedCount} gagal.`
        };

    } catch (err) {
        return { 
            success: false, 
            error: err.message 
        };
    }
}

// ─── SCAN DENGAN FORWARD MESSAGE ───────────────────────────────────────────

/**
 * Scan channel dengan mengirim pesan dan forward ke bot
 * Ini adalah workaround untuk bot yang tidak bisa get history
 */
async function scanWithForward(chatId, reaction, count = 5) {
    try {
        const msgIds = [];
        
        // Kirim beberapa pesan test ke channel
        const testMessages = [];
        for (let i = 0; i < Math.min(count, 5); i++) {
            try {
                const msg = await client.sendMessage(chatId, {
                    message: `🔍 Test ${i+1} - ${Date.now()}`,
                });
                if (msg && msg.id) {
                    testMessages.push(msg.id);
                    msgIds.push(msg.id);
                }
                await sleep(300);
            } catch (_) {}
        }
        
        // Hapus pesan test setelah mendapatkan ID
        for (const id of testMessages) {
            try {
                await client.deleteMessages(chatId, [id], { revoke: true });
            } catch (_) {}
            await sleep(200);
        }
        
        if (msgIds.length === 0) {
            return {
                success: false,
                message: 'Gagal mengirim pesan test ke channel. Pastikan bot bisa mengirim pesan.'
            };
        }
        
        // Inject reaction ke pesan test (yang sudah dihapus) - skip
        // Coba dapatkan pesan lain di channel
        return {
            success: false,
            message: 'Metode ini tidak berhasil. Silakan gunakan metode manual dengan ID pesan.'
        };
        
    } catch (err) {
        return {
            success: false,
            error: err.message
        };
    }
}

// ─── INJECT KE PESAN DENGAN ID MANUAL ──────────────────────────────────────

/**
 * Inject reaction ke pesan dengan ID yang diberikan manual
 */
async function injectToMessageIds(chatId, msgIds, reaction) {
    if (!msgIds || msgIds.length === 0) {
        return { success: false, error: 'Tidak ada ID pesan yang diberikan.' };
    }
    
    const results = [];
    for (const msgId of msgIds) {
        const result = await injectReaction(chatId, msgId, reaction);
        results.push({ msgId, ...result });
        await sleep(500);
    }
    
    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;
    
    return {
        success: true,
        total: msgIds.length,
        successCount,
        failedCount,
        results,
        message: `✅ ${successCount} reaksi berhasil disuntik, ${failedCount} gagal.`
    };
}

// ─── HANDLER UTAMA ──────────────────────────────────────────────────────────

async function handleReactionInjector(chatId, userId, deleteMsgId = null) {
    // ── Cek Admin ──
    if (!isAdmin(userId)) {
        await send(
            chatId,
            `❌ **Akses Ditolak!**\n\nFitur ini khusus untuk owner/admin bot.`,
            [[{ text: "🏠 Menu Utama", data: "start" }]],
            deleteMsgId
        );
        return;
    }

    reactionStates.set(userId, { step: 'waiting_channel', chatId });

    await send(
        chatId,
        `🔥 **REACTION INJECTOR**\n` +
        `────────────────────────────────\n\n` +
        `Fitur ini menyuntikkan reaksi ke pesan di channel/group Telegram.\n\n` +
        `📌 **Cara Kerja:**\n` +
        `1️⃣ Kirim **ID atau username** channel/group\n` +
        `2️⃣ Pilih jumlah pesan terakhir yang akan diberi reaksi\n` +
        `3️⃣ Pilih reaksi yang ingin disuntik\n\n` +
        `📌 **Contoh Channel:**\n` +
        `• ID: \`-1001234567890\`\n` +
        `• Username: \`@channelname\`\n\n` +
        `⚠️ **Pastikan bot adalah ADMIN di channel/group!**\n` +
        `💡 __Ketik \`batal\` untuk membatalkan.__`,
        [[{ text: "❌ Batalkan", data: "cancel" }]],
        deleteMsgId
    );
}

async function handleReactionChannelInput(event) {
    const chatId = event.chatId;
    const userId = Number(event.message.senderId);
    const text = event.message.text?.trim();
    const state = reactionStates.get(userId);

    if (!state || state.step !== 'waiting_channel') return false;
    if (!isAdmin(userId)) {
        reactionStates.delete(userId);
        return false;
    }

    if (text?.toLowerCase() === 'batal' || text?.toLowerCase() === 'cancel') {
        reactionStates.delete(userId);
        await send(chatId, `✅ **Dibatalkan.**`, [[{ text: "👑 Owner Panel", data: "owner_menu" }]]);
        return true;
    }

    // Parse channel ID atau username
    let channelId = text;
    let channelName = text;
    
    try {
        // Coba resolve entity
        const entity = await client.getEntity(text);
        channelId = entity.id;
        channelName = entity.username || text;
        
        // Cek apakah bot admin di channel
        try {
            // Coba kirim pesan test untuk verifikasi akses
            const testMsg = await client.sendMessage(channelId, {
                message: "🔍 Reaction Injector - Testing access...",
            });
            
            // Hapus pesan test
            try {
                await client.deleteMessages(channelId, [testMsg.id], { revoke: true });
            } catch (_) {}
            
        } catch (err) {
            await send(
                chatId,
                `⚠️ **Bot tidak bisa mengirim pesan ke channel!**\n\n` +
                `Pastikan bot adalah **ADMIN** di channel/group tersebut.\n\n` +
                `Error: \`${err.message}\``,
                [[{ text: "❌ Batalkan", data: "cancel" }]]
            );
            return true;
        }
        
    } catch (err) {
        await send(
            chatId,
            `❌ **Channel/Group tidak ditemukan!**\n\n` +
            `Pastikan ID atau username benar.\n` +
            `Contoh: \`-1001234567890\` atau \`@channelname\`\n\n` +
            `Error: \`${err.message}\``,
            [[{ text: "❌ Batalkan", data: "cancel" }]]
        );
        return true;
    }

    reactionStates.set(userId, {
        ...state,
        step: 'waiting_limit',
        channelId: channelId,
        channelText: channelName,
    });

    await send(
        chatId,
        `✅ **Channel ditemukan!**\n\n` +
        `📌 **Channel:** \`${channelName}\`\n` +
        `🆔 **ID:** \`${channelId}\`\n\n` +
        `🔹 **Langkah 2 — Jumlah Pesan**\n` +
        `Kirim jumlah pesan terakhir yang ingin diberi reaksi.\n\n` +
        `📌 Contoh: \`5\` (maks 50)\n\n` +
        `💡 __Ketik \`batal\` untuk membatalkan.__`,
        [[{ text: "❌ Batalkan", data: "cancel" }]]
    );
    return true;
}

async function handleReactionLimitInput(event) {
    const chatId = event.chatId;
    const userId = Number(event.message.senderId);
    const text = event.message.text?.trim();
    const state = reactionStates.get(userId);

    if (!state || state.step !== 'waiting_limit') return false;
    if (!isAdmin(userId)) {
        reactionStates.delete(userId);
        return false;
    }

    if (text?.toLowerCase() === 'batal' || text?.toLowerCase() === 'cancel') {
        reactionStates.delete(userId);
        await send(chatId, `✅ **Dibatalkan.**`, [[{ text: "👑 Owner Panel", data: "owner_menu" }]]);
        return true;
    }

    const limit = parseInt(text);
    if (isNaN(limit) || limit < 1 || limit > 50) {
        await send(
            chatId,
            `❌ **Jumlah tidak valid!**\n\nKirim angka antara 1-50.`,
            [[{ text: "❌ Batalkan", data: "cancel" }]]
        );
        return true;
    }

    // Tampilkan daftar reaksi yang tersedia
    const reactionsList = SUPPORTED_REACTIONS.map((r, i) => `${i+1}. ${r}`).join('  ');
    
    reactionStates.set(userId, {
        ...state,
        step: 'waiting_reaction',
        limit: limit,
    });

    await send(
        chatId,
        `✅ **Jumlah pesan:** \`${limit}\`\n\n` +
        `🔹 **Langkah 3 — Pilih Reaksi**\n` +
        `Kirim emoji reaksi yang ingin disuntikkan.\n\n` +
        `📌 **Reaksi yang tersedia:**\n${reactionsList}\n\n` +
        `📌 Contoh: \`🔥\` atau \`❤️\`\n\n` +
        `💡 __Ketik \`batal\` untuk membatalkan.__`,
        [[{ text: "❌ Batalkan", data: "cancel" }]]
    );
    return true;
}

async function handleReactionEmojiInput(event) {
    const chatId = event.chatId;
    const userId = Number(event.message.senderId);
    const text = event.message.text?.trim();
    const state = reactionStates.get(userId);

    if (!state || state.step !== 'waiting_reaction') return false;
    if (!isAdmin(userId)) {
        reactionStates.delete(userId);
        return false;
    }

    if (text?.toLowerCase() === 'batal' || text?.toLowerCase() === 'cancel') {
        reactionStates.delete(userId);
        await send(chatId, `✅ **Dibatalkan.**`, [[{ text: "👑 Owner Panel", data: "owner_menu" }]]);
        return true;
    }

    // Cek apakah reaksi valid
    if (!SUPPORTED_REACTIONS.includes(text)) {
        await send(
            chatId,
            `❌ **Reaksi tidak valid!**\n\n` +
            `Kirim emoji yang valid dari daftar:\n` +
            SUPPORTED_REACTIONS.slice(0, 20).join('  ') + `\n\n` +
            `💡 __Ketik \`batal\` untuk membatalkan.__`,
            [[{ text: "❌ Batalkan", data: "cancel" }]]
        );
        return true;
    }

    // ─── EKSEKUSI ──────────────────────────────────────────────────────────
    const channelId = state.channelId;
    const limit = state.limit;
    const reaction = text;

    const statusMsg = await send(
        chatId,
        `🔥 **INJECTING REACTIONS...**\n\n` +
        `📌 **Channel:** \`${state.channelText}\`\n` +
        `📊 **Pesan:** ${limit} terakhir\n` +
        `❤️ **Reaksi:** ${reaction}\n\n` +
        `⏳ __Sedang memproses...__`
    );
    const msgId = statusMsg.id;

    try {
        const result = await scanAndInject(channelId, reaction, limit);

        reactionStates.delete(userId);

        if (result.success) {
            await edit(
                chatId,
                msgId,
                `✅ **REACTION INJECTOR SELESAI!** 🎉\n` +
                `────────────────────────────────\n\n` +
                `📌 **Channel:** \`${state.channelText}\`\n` +
                `❤️ **Reaksi:** ${reaction}\n` +
                `📊 **Total Pesan:** \`${result.total}\`\n` +
                `✅ **Berhasil:** \`${result.successCount}\`\n` +
                `❌ **Gagal:** \`${result.failedCount}\`\n` +
                `────────────────────────────────\n\n` +
                `__Reaksi berhasil disuntikkan!__`,
                [[{ text: "👑 Owner Panel", data: "owner_menu" }]]
            );
        } else {
            await edit(
                chatId,
                msgId,
                `❌ **GAGAL INJECT REACTION!**\n\n` +
                `🛑 Error: \`${result.error || result.message || 'Unknown error'}\`\n\n` +
                `💡 **Solusi:**\n` +
                `• Pastikan bot adalah **ADMIN** di channel/group\n` +
                `• Coba gunakan **ID channel** (contoh: \`-1001234567890\`)\n` +
                `• Pastikan bot sudah di-add sebagai admin dengan izin:\n` +
                `  ✅ Kirim Pesan\n` +
                `  ✅ Hapus Pesan\n` +
                `  ✅ Kelola Channel\n\n` +
                `📌 **Jika masih gagal**, gunakan metode manual:\n` +
                `1. Dapatkan ID pesan dari channel\n` +
                `2. Kirim format: \`react ID_PESAN EMOJI\``,
                [[{ text: "👑 Owner Panel", data: "owner_menu" }]]
            );
        }

    } catch (err) {
        reactionStates.delete(userId);
        await edit(
            chatId,
            msgId,
            `❌ **GAGAL INJECT REACTION!**\n\n` +
            `🛑 Error: \`${err.message}\`\n\n` +
            `💡 **Solusi:**\n` +
            `• Pastikan bot adalah **ADMIN** di channel/group\n` +
            `• Coba gunakan **ID channel** (contoh: \`-1001234567890\`)\n` +
            `• Pastikan bot memiliki izin:\n` +
            `  ✅ Kirim Pesan\n` +
            `  ✅ Hapus Pesan\n` +
            `  ✅ Kelola Channel\n\n` +
            `📌 **Metode Manual:**\n` +
            `Ketik \`react ID_PESAN EMOJI\` untuk inject ke pesan tertentu.`,
            [[{ text: "👑 Owner Panel", data: "owner_menu" }]]
        );
    }

    return true;
}

// ─── COMMAND: REACT KE PESAN TERTENTU ──────────────────────────────────────

async function handleReactCommand(event) {
    const chatId = event.chatId;
    const userId = Number(event.message.senderId);
    const text = event.message.text?.trim();
    
    if (!text || !text.startsWith('/react ')) return false;
    
    if (!isAdmin(userId)) {
        await send(chatId, `❌ **Akses Ditolak!**\n\nFitur ini khusus untuk admin.`);
        return true;
    }
    
    const parts = text.replace('/react ', '').trim().split(' ');
    if (parts.length < 2) {
        await send(chatId, 
            `📌 **Format:** \`/react ID_PESAN EMOJI\`\n\n` +
            `Contoh: \`/react 123 🔥\``
        );
        return true;
    }
    
    const msgId = parseInt(parts[0]);
    const emoji = parts.slice(1).join(' ');
    
    if (isNaN(msgId) || msgId < 1) {
        await send(chatId, `❌ **ID Pesan tidak valid!**`);
        return true;
    }
    
    if (!SUPPORTED_REACTIONS.includes(emoji)) {
        await send(chatId, 
            `❌ **Reaksi tidak valid!**\n\n` +
            `Reaksi yang didukung:\n${SUPPORTED_REACTIONS.slice(0, 20).join('  ')}`
        );
        return true;
    }
    
    const statusMsg = await send(
        chatId,
        `⏳ **Mengirim reaksi ${emoji} ke pesan ${msgId}...**`
    );
    
    try {
        const result = await injectReaction(chatId, msgId, emoji);
        
        if (result.success) {
            await edit(
                chatId,
                statusMsg.id,
                `✅ **Reaksi ${emoji} berhasil dikirim ke pesan ${msgId}!**`
            );
        } else {
            await edit(
                chatId,
                statusMsg.id,
                `❌ **Gagal mengirim reaksi!**\n\n` +
                `Error: \`${result.error}\``
            );
        }
    } catch (err) {
        await edit(
            chatId,
            statusMsg.id,
            `❌ **Gagal mengirim reaksi!**\n\n` +
            `Error: \`${err.message}\``
        );
    }
    
    return true;
}

// ─── CALLBACK HANDLER ──────────────────────────────────────────────────────

async function handleReactionCallback(event) {
    const data = event.data.toString();
    const chatId = event.chatId;
    const userId = Number(event.senderId);
    const msgId = event.messageId;

    if (data === "reaction_injector") {
        return await handleReactionInjector(chatId, userId, msgId);
    }
}

// ─── REGISTER FUNCTIONS ────────────────────────────────────────────────────

Object.assign(globalThis, {
    handleReactionInjector,
    handleReactionChannelInput,
    handleReactionLimitInput,
    handleReactionEmojiInput,
    handleReactionCallback,
    handleReactCommand,
    injectReaction,
    injectToMultipleMessages,
    scanAndInject,
    injectToMessageIds,
    SUPPORTED_REACTIONS,
    reactionStates,
});

module.exports = {
    handleReactionInjector,
    handleReactionChannelInput,
    handleReactionLimitInput,
    handleReactionEmojiInput,
    handleReactionCallback,
    handleReactCommand,
    injectReaction,
    injectToMultipleMessages,
    scanAndInject,
    injectToMessageIds,
    SUPPORTED_REACTIONS,
    reactionStates,
};