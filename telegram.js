/**
 * telegram.js — бот-уведомитель о заказах Hustlify
 * -------------------------------------------------
 * Это не отдельный процесс, а модуль, который server.js подключает и
 * вызывает напрямую. Ему не нужно "запускать" отдельно — он живёт внутри
 * основного сервера и шлёт сообщения через Telegram Bot API (метод
 * sendMessage), когда появляется новый заказ или когда заказ оплачен.
 *
 * НАСТРОЙКА (займёт 2 минуты):
 * 1) В Telegram напишите @BotFather → команда /newbot → придумайте имя
 *    и username бота. BotFather пришлёт токен вида
 *    123456789:AAExxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 *    Впишите его в .env как TELEGRAM_BOT_TOKEN.
 * 2) Напишите своему новому боту любое сообщение (например "старт"),
 *    иначе он не сможет писать вам первым.
 * 3) Откройте в браузере (подставив свой токен):
 *    https://api.telegram.org/bot<TOKEN>/getUpdates
 *    В ответе найдите "chat":{"id": 123456789, ...} — это ваш chat_id.
 * 4) Впишите его в .env как TELEGRAM_ADMIN_CHAT_IDS
 *    (можно указать несколько через запятую — например, себе и партнёру).
 * 5) Перезапустите сервер — уведомления начнут приходить автоматически.
 *
 * Ничего дополнительно ставить не нужно: бот не принимает команды,
 * не требует long polling — он только отправляет сообщения.
 */

async function sendTelegramMessage(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatIds = (process.env.TELEGRAM_ADMIN_CHAT_IDS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  if (!token || chatIds.length === 0) {
    return; // бот не настроен в .env — молча пропускаем, сайт продолжает работать
  }

  for (const chatId of chatIds) {
    try {
      const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'HTML',
          disable_web_page_preview: true
        })
      });
      const data = await resp.json();
      if (!data.ok) {
        console.error('Telegram API отказал:', data.description);
      }
    } catch (e) {
      console.error('Не удалось отправить уведомление в Telegram:', e.message);
    }
  }
}

function formatOrderMessage(order, emoji, title) {
  const itemsList = order.items
    .map(i => `• ${i.name}${i.qty > 1 ? ' × ' + i.qty : ''} — ${i.price * i.qty} ₽`)
    .join('\n');
  const promoLine = order.promoCode
    ? `\n🎟 Промокод: <b>${order.promoCode}</b> (-${order.discountPercent}%)`
    : '';
  const contactLine = order.contact
    ? `\n👤 Контакт: <b>${order.contact}</b>`
    : '\n👤 Контакт: не указан';

  return (
    `${emoji} <b>${title}</b>\n` +
    `Заказ: <code>${order.id}</code>\n\n` +
    `${itemsList}\n\n` +
    `Сумма: <b>${order.total} ₽</b>${promoLine}${contactLine}\n` +
    `Оплата: ${order.payment?.provider || '—'}`
  );
}

function notifyNewOrder(order) {
  return sendTelegramMessage(formatOrderMessage(order, '🆕', 'Новый заказ (ожидает оплаты)'));
}

function notifyOrderPaid(order) {
  return sendTelegramMessage(formatOrderMessage(order, '✅', 'Заказ оплачен!'));
}

module.exports = { notifyNewOrder, notifyOrderPaid, sendTelegramMessage };
