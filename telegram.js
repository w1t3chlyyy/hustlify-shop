/**
 * telegram.js — бот-уведомитель о заказах Hustlify
 */

async function sendTelegramMessage(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatIds = (process.env.TELEGRAM_ADMIN_CHAT_IDS || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

  if (!token || chatIds.length === 0) return;

  for (const chatId of chatIds) {
    try {
      const resp = await fetch(
        `https://api.telegram.org/bot${token}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: "HTML",
            disable_web_page_preview: true,
          }),
        }
      );

      const data = await resp.json();
      if (!data.ok) {
        console.error("Telegram API отказал:", data.description);
      }
    } catch (e) {
      console.error("Не удалось отправить уведомление:", e.message);
    }
  }
}

async function sendTelegramDocument(documentUrl, caption) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatIds = (process.env.TELEGRAM_ADMIN_CHAT_IDS || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

  if (!token || chatIds.length === 0) return;

  for (const chatId of chatIds) {
    try {
      const resp = await fetch(
        `https://api.telegram.org/bot${token}/sendDocument`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            document: documentUrl,
            caption,
            parse_mode: "HTML",
          }),
        }
      );

      const data = await resp.json();
      if (!data.ok) {
        console.error("Telegram API отказал (документ):", data.description);
      }
    } catch (e) {
      console.error("Не удалось отправить чек:", e.message);
    }
  }
}

function formatOrderMessage(order, emoji, title) {
  const itemsList = order.items
    .map(
      i =>
        `• ${i.name}${i.qty > 1 ? ` × ${i.qty}` : ""} — ${i.price * i.qty} ₽`
    )
    .join("\n");

  const promoLine = order.promo_code
    ? `\n🎟 Промокод: <b>${order.promo_code}</b> (-${order.discount_percent}%)`
    : "";

  const contactLine = order.contact
    ? `\n👤 Контакт: <b>${order.contact}</b>`
    : "\n👤 Контакт: не указан";

  return (
    `${emoji} <b>${title}</b>\n` +
    `Заказ: <code>${order.id}</code>\n\n` +
    `${itemsList}\n\n` +
    `💰 Сумма: <b>${order.total} ₽</b>` +
    promoLine +
    contactLine +
    `\n💳 Оплата: ${order.payment?.provider || "—"}`
  );
}

function notifyNewOrder(order) {
  return sendTelegramMessage(
    formatOrderMessage(order, "🆕", "Новый заказ (ожидает оплаты)")
  );
}

function notifyOrderPaid(order) {
  return sendTelegramMessage(
    formatOrderMessage(order, "✅", "Заказ оплачен!")
  );
}

function notifyReceiptUploaded(order) {
  const caption = formatOrderMessage(
    order,
    "🧾",
    "Загружен чек — заказ на модерации"
  );

  return sendTelegramDocument(
    order.payment?.receiptUrl,
    caption.slice(0, 1000)
  );
}

function notifySurveyCompleted(answers, promoCode) {
  const answersText = answers
    .map((a, i) => `${i + 1}. ${a}`)
    .join("\n");

  const text =
    `📋 <b>Новый пройденный опрос</b>\n\n` +
    `🎟 Промокод: <code>${promoCode}</code> (-20%)\n\n` +
    `<b>Ответы:</b>\n${answersText}\n\n` +
    `🕐 Время: ${new Date().toLocaleString("ru-RU")}`;

  return sendTelegramMessage(text);
}

module.exports = {
  notifyNewOrder,
  notifyOrderPaid,
  notifyReceiptUploaded,
  notifySurveyCompleted,
  sendTelegramMessage,
};
