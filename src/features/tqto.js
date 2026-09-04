// src/features/tqto.js
// Fitur TQTO - Terima Kasih Kepada

async function handleTqto(chatId, userId, msgId = null) {
    // ─── Build card data ────────────────────────────────────────────────────
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
            second: "2-digit"
        }) + " WIB",
    });

    const cardPath = tmpPath(`tqto_${userId}_${Date.now()}.jpg`);
    fs.writeFileSync(cardPath, cardBuffer);

    // ─── Caption ─────────────────────────────────────────────────────────────
    const caption = 
        `🙏 <b>TERIMA KASIH KEPADA</b>\n` +
        `─────────────────────────────\n\n` +
        `👨‍💻 <b>DEVELOPER:</b>\n` +
        `   <b>IpinXD</b>\n\n` +
        `💕 <b>MY GIRLFRIEND:</b>\n` +
        `   <b>When Ya</b>\n\n` +
        `🤝 <b>MY SUPPORT/FREND:</b>\n` +
        `   <b>VANZZScyutt</b>\n\n` +
        `─────────────────────────────\n` +
        `<i>Terima kasih atas dukungan dan kontribusinya dalam pengembangan bot ini.</i> 🚀`;

    try {
        if (msgId) {
            try {
                await client.deleteMessages(chatId, [msgId], { revoke: true });
            } catch (_) {}
        }

        // Kirim image card TANPA button
        await client.sendFile(chatId, {
            file: cardPath,
            caption: caption,
            parseMode: "html",
            forceDocument: false,
        });

        if (fs.existsSync(cardPath)) fs.unlinkSync(cardPath);
    } catch (err) {
        // Fallback ke foto biasa jika card gagal
        if (fs.existsSync(cardPath)) fs.unlinkSync(cardPath);
        try {
            await client.sendFile(chatId, {
                file: CONFIG.TQTO_PHOTO || "https://files.catbox.moe/7qvcxz.png",
                caption,
                parseMode: "html",
            });
        } catch (_) {
            await send(chatId, caption, null, msgId);
        }
    }
}

async function handleTqtoDetail(chatId, userId, msgId, type) {
    let title = '';
    let name = '';
    let role = '';
    let desc = '';
    let accentColor = '#ffffff';

    switch (type) {
        case 'dev':
            title = '👨‍💻 DEVELOPER';
            name = 'IpinXD';
            role = 'Creator & Lead Developer';
            desc = 'Pengembang utama yang membuat bot ini dari nol.';
            accentColor = '#5fd7ff';
            break;

        case 'girl':
            title = '💕 MY GIRLFRIEND';
            name = 'When Ya';
            role = 'Inspiration & Motivation';
            desc = 'masih when yah.';
            accentColor = '#ff7b89';
            break;

        case 'support':
            title = '🤝 MY SUPPORT/FREND';
            name = 'VANZZScyutt';
            role = 'Support & Testing Partner';
            desc = 'Terima kasih atas dukungan, saran, dan kerjasamanya selama ini.';
            accentColor = '#39ff88';
            break;

        default:
            return await handleTqto(chatId, userId, msgId);
    }

    // ─── Build detail card ──────────────────────────────────────────────────
    const cardBuffer = await generateTqtoDetailCard({
        title,
        name,
        role,
        desc,
        accentColor,
        botName: CONFIG.BOT_NAME,
        botVersion: CONFIG.BOT_VERSION,
        timeLabel: new Date().toLocaleString("id-ID", { 
            timeZone: "Asia/Jakarta",
            day: "2-digit", 
            month: "2-digit", 
            year: "numeric",
            hour: "2-digit", 
            minute: "2-digit", 
            second: "2-digit"
        }) + " WIB",
    });

    const cardPath = tmpPath(`tqto_detail_${userId}_${Date.now()}.jpg`);
    fs.writeFileSync(cardPath, cardBuffer);

    try {
        if (msgId) {
            try {
                await client.deleteMessages(chatId, [msgId], { revoke: true });
            } catch (_) {}
        }

        // Kirim image card detail TANPA button
        await client.sendFile(chatId, {
            file: cardPath,
            caption: `<b>${title}</b>\n\n${desc}`,
            parseMode: "html",
            forceDocument: false,
        });

        if (fs.existsSync(cardPath)) fs.unlinkSync(cardPath);
    } catch (err) {
        if (fs.existsSync(cardPath)) fs.unlinkSync(cardPath);
        // Fallback ke teks biasa
        const fallbackCaption = 
            `${title}\n` +
            `─────────────────────────────\n\n` +
            `🧑 <b>Nama :</b> ${name}\n` +
            `🆔 <b>Role :</b> ${role}\n` +
            `📅 <b>Project :</b> ${CONFIG.BOT_NAME}\n\n` +
            `─────────────────────────────\n` +
            `<i>${desc}</i> 🚀`;
        
        await send(chatId, fallbackCaption, null, msgId);
    }
}

// ─── REGISTER FUNCTIONS ───────────────────────────────────────────────────────
Object.assign(globalThis, {
    handleTqto,
    handleTqtoDetail,
});

module.exports = {
    handleTqto,
    handleTqtoDetail,
};