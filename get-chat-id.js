/**
 * Помогает найти свой Telegram chat_id для .env (TELEGRAM_ADMIN_CHAT_IDS).
 *
 * Как использовать:
 *   1) Напишите вашему боту любое сообщение в Telegram (например "привет")
 *   2) Запустите:  node get-chat-id.js ВАШ_ТОКЕН_БОТА
 *   3) Скрипт покажет chat_id всех, кто недавно писал боту
 */
require('dotenv').config();

const token = process.argv[2] || process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.log('Укажите токен: node get-chat-id.js ВАШ_ТОКЕН_БОТА');
  process.exit(1);
}

fetch(`https://api.telegram.org/bot${token}/getUpdates`)
  .then(r => r.json())
  .then(data => {
    if (!data.ok) {
      console.log('Ошибка Telegram API:', data.description);
      return;
    }
    if (data.result.length === 0) {
      console.log('Обновлений нет. Сначала напишите боту любое сообщение в Telegram, затем запустите скрипт снова.');
      return;
    }
    const seen = new Set();
    for (const update of data.result) {
      const msg = update.message || update.channel_post;
      if (!msg) continue;
      const chat = msg.chat;
      const key = chat.id + '';
      if (seen.has(key)) continue;
      seen.add(key);
      console.log(`chat_id: ${chat.id}   (${chat.type}, ${chat.title || chat.username || chat.first_name || ''})`);
    }
    console.log('\nСкопируйте нужный chat_id в .env -> TELEGRAM_ADMIN_CHAT_IDS');
  })
  .catch(e => console.error('Не удалось связаться с Telegram API:', e.message));
