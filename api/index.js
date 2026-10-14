/* =====================================================================
 * Vercel Serverless entrypoint (hustlify.site)
 * ---------------------------------------------------------------------
 * Домен hustlify.site обслуживается Vercel (в public/ лежит vercel.json).
 * Если в проекте нет обработчика для /api/* и при этом настроена
 * Edge-функция/роутинг, которая падает, Vercel отдаёт
 * 500 FUNCTION_INVOCATION_FAILED на ВСЕХ страницах сайта.
 *
 * Этот файл перехватывает весь трафик и пробрасывает его в то же самое
 * Express-приложение, что запускается локально через `npm start`
 * (static + API + промокоды + админка работают как раньше).
 * ===================================================================== */
const { app } = require('../index.js');

module.exports = async (req, res) => {
  // На serverless raw-body может прийти base64/строкой — парсим сами,
  // чтобы express.json() внутри приложения не зависел от stream-состояния.
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    try {
      let raw = req.body || '';
      if (req.isBase64) raw = Buffer.from(raw, 'base64').toString('utf8');
      if (typeof raw === 'string' && raw.length) {
        const ct = (req.headers['content-type'] || '').toLowerCase();
        if (ct.includes('application/json')) {
          try { req.body = JSON.parse(raw); } catch (e) { /* пусть сам разберёт */ }
        }
      } else if (raw && typeof raw === 'object') {
        req.body = raw;
      }
    } catch (e) {
      console.error('serverless body parse error:', e && e.message);
    }
  }
  return app(req, res);
};
