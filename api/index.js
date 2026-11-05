/* Vercel serverless entrypoint: пробрасывает запросы в Express-приложение.
  Тело читаем сами, чтобы сохранить исходные байты для проверки подписи вебхука Prodamus. */
const { app } = require('../index.js');
const qs = require('qs');

function readRaw(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
function setBody(req, value) {
  Object.defineProperty(req, 'body', { value, writable: true, configurable: true, enumerable: true });
  req._body = true; // body-parser внутри Express пропустит повторное чтение потока
}

module.exports = async (req, res) => {
  const ct = String(req.headers['content-type'] || '').toLowerCase();
  const isJson = ct.includes('application/json');
  const isForm = ct.includes('application/x-www-form-urlencoded');
  if (req.method !== 'GET' && req.method !== 'HEAD' && (isJson || isForm)) {
    try {
      let raw;
      if (req.readableEnded || req.destroyed) {
        const b = req.body;
        raw = Buffer.from(typeof b === 'string' ? b : (isForm ? qs.stringify(b || {}) : JSON.stringify(b || {})), 'utf8');
      } else {
        raw = await readRaw(req);
      }
      req.rawBody = raw;
      let parsed = {};
      if (raw.length) parsed = isJson ? JSON.parse(raw.toString('utf8')) : qs.parse(raw.toString('utf8'));
      setBody(req, parsed);
    } catch (e) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'Некорректное тело запроса' }));
    }
  }
  return app(req, res);
};
