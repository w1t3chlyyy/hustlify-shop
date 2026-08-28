/**
 * telegram.js — бот-уведомитель о заказах Hustlify
 * -------------------------------------------------
 * Это не отдельный процесс, а модуль, который server.js подключает и
 * вызывает напрямую. Ему не нужно "запускать" отдельно — он живёт внутри
 * основного сервера и шлёт сообщения через Telegram Bot API (метод
 * sendMessage), когда появляется новый заказ или когда заказ оплачен.
 *
 * Поддерживает ДВА независимых бота одновременно (у каждого свой токен
 * от BotFather) — уведомления уходят в оба, если оба настроены. Если
 * настроен только первый — второй просто молча пропускается.
 *
 * НАСТРОЙКА ОСНОВНОГО БОТА (займёт 2 минуты):
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
 * НАСТРОЙКА ВТОРОГО БОТА (те же 5 шагов, только для другого бота):
 * 1) У @BotFather → /newbot ещё раз → получите ВТОРОЙ токен.
 *    Впишите его в .env как TELEGRAM_BOT_TOKEN_2.
 * 2) Напишите этому второму боту любое сообщение.
 * 3) Узнайте chat_id тем же способом (через getUpdates, но с ВТОРЫМ
 *    токеном в URL).
 * 4) Впишите в .env как TELEGRAM_ADMIN_CHAT_IDS_2 (тоже можно несколько
 *    через запятую).
 * 5) Перезапустите сервер.
 *
 * Второй бот полностью необязателен: если TELEGRAM_BOT_TOKEN_2 не задан
 * в .env — уведомления просто продолжат уходить только в первый бот,
 * ничего не сломается.
 */

// Список "целей" отправки — каждая цель это пара (токен бота, список chat_id).
// Первая цель — основной бот (как было раньше), вторая — новый, доп. бот.
function getTargets() {
  const targets = [];

  const token1 = process.env.TELEGRAM_BOT_TOKEN;
  const chatIds1 = (process.env.TELEGRAM_ADMIN_CHAT_IDS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  if (token1 && chatIds1.length > 0) {
    targets.push({ token: token1, chatIds: chatIds1 });
  }

  const token2 = process.env.TELEGRAM_BOT_TOKEN_2;
  const chatIds2 = (process.env.TELEGRAM_ADMIN_CHAT_IDS_2 || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  if (token2 && chatIds2.length > 0) {
    targets.push({ token: token2, chatIds: chatIds2 });
  }

  return targets;
}

async function sendTelegramMessage(text) {
  const targets = getTargets();
  if (targets.length === 0) {
    return; // ни один бот не настроен в .env — молча пропускаем, сайт продолжает работать
  }

  for (const { token, chatIds } of targets) {
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
  const targets = getTargets();
  if (targets.length === 0) {
    return; // ни один бот не настроен в .env — молча пропускаем, сайт продолжает работать
  }

  for (const { token, chatIds } of targets) {
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

function formatOrderMessage(order, emoji, title) {
  const itemsList = order.items
    .map(i => `• ${i.name}${i.qty > 1 ? ' × ' + i.qty : ''} — ${i.price * i.qty} ₽`)
    .join('\n');
  const promoLine = order.promo_code
    ? `\n🎟 Промокод: <b>${order.promo_code}</b> (-${order.discount_percent}%)`
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

function notifyReceiptUploaded(order) {
  const caption = formatOrderMessage(order, '🧾', 'Загружен чек — заказ на модерации');
  // caption у sendDocument ограничен 1024 символами — на всякий случай подрежем
  return sendTelegramDocument(order.payment?.receiptUrl, caption.slice(0, 1000));
}

function notifySurveyCompleted(answers, promoCode) {
  const answersText = answers.map((a, i) => `${i + 1}. ${a}`).join('\n');
  const text =
    `📋 <b>Новый пройденный опрос</b>\n\n` +
    `🎟 Промокод: <code>${promoCode}</code> (-20%)\n\n` +
    `<b>Ответы:</b>\n${answersText}\n\n` +
    `🕐 Время: ${new Date().toLocaleString('ru-RU')}`;
  return sendTelegramMessage(text);
