/**
 * telegram.js — бот-уведомитель о заказах Hustlify
 * -------------------------------------------------
 * Это не отдельный процесс, а модуль, который server.js подключает и
 * вызывает напрямую. Ему не нужно "запускать" отдельно — он живёт внутри
 * основного сервера и шлёт сообщения через Telegram Bot API (метод
 * sendMessage), когда появляется новый заказ или когда заказ оплачен.
 *
 * ДВА БОТА
 * --------
 * Модуль умеет слать одно и то же сообщение сразу в двух ботов:
 *   - TELEGRAM_BOT_TOKEN    — основной бот (например, @HustlifyBot)
 *   - TELEGRAM_BOT_TOKEN_2  — второй бот (например, @HustlifySiteBot)
 * Оба используют один и тот же список получателей TELEGRAM_ADMIN_CHAT_IDS.
 * Если TELEGRAM_BOT_TOKEN_2 не задан — сообщения просто уходят только
 * в первого бота, как и раньше. Ничего ломать не нужно.
 *
 * НАСТРОЙКА (займёт 2 минуты):
 * 1) В Telegram напишите @BotFather → команда /newbot → придумайте имя
 *    и username бота. BotFather пришлёт токен вида
 *    123456789:AAExxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 *    Впишите его в .env как TELEGRAM_BOT_TOKEN (для первого бота)
 *    и/или TELEGRAM_BOT_TOKEN_2 (для второго бота).
 * 2) Напишите каждому из ботов любое сообщение (например "старт"),
 *    иначе они не смогут писать вам первыми.
 * 3) Откройте в браузере (подставив свой токен):
 *    https://api.telegram.org/bot<TOKEN>/getUpdates
 *    В ответе найдите "chat":{"id": 123456789, ...} — это ваш chat_id.
 * 4) Впишите его в .env как TELEGRAM_ADMIN_CHAT_IDS
 *    (можно указать несколько через запятую — например, себе и партнёру).
 * 5) Перезапустите сервер — уведомления начнут приходить автоматически.
 *
 * Ничего дополнительно ставить не нужно: боты не принимают команды,
 * не требуют long polling — они только отправляют сообщения.
 */

function getBotTokens() {
  return [process.env.TELEGRAM_BOT_TOKEN, process.env.TELEGRAM_BOT_TOKEN_2].filter(Boolean);
}

function getChatIds() {
  return (process.env.TELEGRAM_ADMIN_CHAT_IDS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

async function sendTelegramMessage(text) {
  const tokens = getBotTokens();
  const chatIds = getChatIds();

  if (tokens.length === 0 || chatIds.length === 0) {
    return; // ни один бот не настроен в .env — молча пропускаем, сайт продолжает работать
  }

  for (const token of tokens) {
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
}

async function sendTelegramDocument(documentUrl, caption) {
  const tokens = getBotTokens();
  const chatIds = getChatIds();

  if (tokens.length === 0 || chatIds.length === 0) {
    return; // ни один бот не настроен в .env — молча пропускаем, сайт продолжает работать
  }

  for (const token of tokens) {
    for (const chatId of chatIds) {
      try {
        const resp = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            document: documentUrl,
            caption,
            parse_mode: 'HTML'
          })
        });
        const data = await resp.json();
        if (!data.ok) {
          console.error('Telegram API отказал (документ):', data.description);
        }
      } catch (e) {
        console.error('Не удалось отправить чек в Telegram:', e.message);
      }
    }
  }
}

function formatOrderMessage(order, prefix, title) {
  const itemsList = order.items
    .map(i => {
      let line = `• ${i.name}${i.qty > 1 && !i.stars ? ' × ' + i.qty : ''} — ${i.price * (i.stars ? 1 : i.qty)} ₽`;
      if (i.target) {
        line += `\n  ├ Получатель: <code>${i.target}</code>`;
      } else if (i.details && i.details !== i.name) {
        line += `\n  ├ Детали: ${i.details}`;
      }
      return line;
    })
    .join('\n');
  const promoLine = order.promo_code
    ? `\nПромокод: <b>${order.promo_code}</b> (-${order.discount_percent}%)`
    : '';
  const contactLine = order.contact
    ? `\nКонтакт: <b>${order.contact}</b>`
    : '\nКонтакт: не указан';

  return (
    `[${prefix}] <b>${title}</b>\n` +
    `Заказ: <code>${order.id}</code>\n\n` +
    `${itemsList}\n\n` +
    `Сумма: <b>${order.total} ₽</b>${promoLine}${contactLine}\n` +
    `Оплата: ${order.payment?.provider || '—'}`
  );
}

function notifyNewOrder(order) {
  return sendTelegramMessage(formatOrderMessage(order, 'NEW', 'Новый заказ (ожидает оплаты)'));
}

function notifyOrderPaid(order) {
  return sendTelegramMessage(formatOrderMessage(order, 'PAID', 'Заказ оплачен!'));
}

function notifyReceiptUploaded(order) {
  const caption = formatOrderMessage(order, 'RECEIPT', 'Загружен чек — заказ на модерации');
  // caption у sendDocument ограничен 1024 символами — на всякий случай подрежем
  return sendTelegramDocument(order.payment?.receiptUrl, caption.slice(0, 1000));
}

function notifySurveyCompleted(answers, promoCode) {
  const answersText = answers.map((a, i) => `${i + 1}. ${a}`).join('\n');
  const text =
    `<b>[SURVEY] Новый пройденный опрос</b>\n\n` +
    `Промокод: <code>${promoCode}</code> (-20%)\n\n` +
    `<b>Ответы:</b>\n${answersText}\n\n` +
    `Время: ${new Date().toLocaleString('ru-RU')}`;
  return sendTelegramMessage(text);
}

module.exports = { notifyNewOrder, notifyOrderPaid, notifyReceiptUploaded, notifySurveyCompleted, sendTelegramMessage };
