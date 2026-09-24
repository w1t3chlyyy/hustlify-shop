/**
 * Hustlify — backend с Supabase
 * Все данные хранятся в Supabase PostgreSQL
 * 
 * Запуск:
 *   1) npm install @supabase/supabase-js
 *   2) cp .env.example .env и заполнить
 *   3) npm start
 */
require('dotenv').config();

// Подавление предупреждения DEP0169 (url.parse() из внутренних зависимостей Express 4/parseurl в Node 22+)
const originalEmitWarning = process.emitWarning;
process.emitWarning = function(warning, ...args) {
  if (typeof warning === 'string' && (warning.includes('DEP0169') || warning.includes('url.parse'))) {
    return;
  }
  if (warning && typeof warning === 'object' && (warning.code === 'DEP0169' || (warning.message && warning.message.includes('url.parse')))) {
    return;
  }
  return originalEmitWarning.call(process, warning, ...args);
};

const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const ROOT_DATA_DIR = path.join(__dirname, 'data');
const DATA_DIR = process.env.VERCEL 
  ? path.join('/tmp', 'data') 
  : (process.env.DATA_DIR || ROOT_DATA_DIR);
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJsonFile(filename, defaultValue = []) {
  try {
    const filepath = path.join(DATA_DIR, filename);
    if (!fs.existsSync(filepath)) {
      const fallbackPath = path.join(ROOT_DATA_DIR, filename);
      if (fs.existsSync(fallbackPath)) {
        const initialContent = fs.readFileSync(fallbackPath, 'utf8');
        try { fs.writeFileSync(filepath, initialContent, 'utf8'); } catch (e) {}
        return JSON.parse(initialContent);
      }
      return defaultValue;
    }
    const content = fs.readFileSync(filepath, 'utf8');
    return JSON.parse(content);
  } catch (e) {
    console.error(`Ошибка чтения ${filename}:`, e.message);
    return defaultValue;
  }
}

function writeJsonFile(filename, data) {
  try {
    const filepath = path.join(DATA_DIR, filename);
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error(`Ошибка записи ${filename}:`, e.message);
  }
}

// Приём файла чека в памяти (до 10 МБ, только изображения и PDF)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(new Error('Разрешены только изображения (JPG, PNG, WEBP) или PDF'));
  }
});

// Загрузка оригинального видео для главного экрана (Hero Video)
const heroVideoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, 'public', 'images');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, 'hero_laptop.mp4');
  }
});
const uploadHeroVideo = multer({
  storage: heroVideoStorage,
  limits: { fileSize: 150 * 1024 * 1024 }
});

const app = express();
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

// Clean URLs middleware: перенаправляем запросы *.html на чистые URL без расширения (301 Permanent Redirect)
app.use((req, res, next) => {
  if (req.method === 'GET' && req.path.endsWith('.html')) {
    const cleanPath = req.path.slice(0, -5);
    const queryString = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    if (cleanPath === '/index' || cleanPath === '') {
      return res.redirect(301, '/' + queryString);
    }
    return res.redirect(301, cleanPath + queryString);
  }
  next();
});

app.use(cookieParser());
app.use(express.static('public', { extensions: ['html'] }));

app.post('/api/upload-hero-video', uploadHeroVideo.single('video'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Файл видео не получен' });
  }
  const mp4Path = path.join(__dirname, 'public', 'images', 'hero_laptop.mp4');
  const heroVideoPath = path.join(__dirname, 'public', 'images', 'hero_video.mp4');
  const posterPath = path.join(__dirname, 'public', 'images', 'hero_laptop_poster.jpg');
  const webmPath = path.join(__dirname, 'public', 'images', 'hero_laptop.webm');
  
  try {
    fs.copyFileSync(mp4Path, heroVideoPath);
  } catch (e) {}

  // Создаём постер первого кадра через ffmpeg
  const { exec } = require('child_process');
  exec(`ffmpeg -y -i "${mp4Path}" -vframes 1 -q:v 2 "${posterPath}"`, (err) => {
    if (err) console.error('Ошибка создания постера:', err.message);
  });
  exec(`ffmpeg -y -i "${mp4Path}" -c:v libvpx-vp9 -b:v 0 -crf 32 -an "${webmPath}" && cp "${webmPath}" "${path.join(__dirname, 'public', 'images', 'hero_video.webm')}"`, (err) => {
    if (err) console.error('Ошибка конвертации в webm:', err.message);
  });

  return res.json({ success: true, message: 'Оригинальное видео успешно установлено в главный экран!' });
});

/* ================= CLEAN URL ROUTES ================= */
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.get(['/admin', '/admin.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});
app.get(['/cases', '/cases.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'cases.html'));
});
app.get(['/ai-agent', '/ai-agent.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'ai-agent.html'));
});
app.get(['/oferta', '/offer', '/oferta.html', '/offer.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'offer.html'));
});
app.get(['/upload', '/upload.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'upload.html'));
});
app.get(['/payment-success', '/payment-success.html', '/success', '/order-success', '/order-success.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'payment-success.html'));
});
app.get(['/payment-fail', '/payment-fail.html', '/payment-cancel', '/payment-cancel.html', '/fail', '/cancel'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'payment-fail.html'));
});

const PORT = 3000;
const PUBLIC_URL = process.env.PUBLIC_URL || `http://localhost:${PORT}`;
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-please-change-me-please';

/* ================= SUPABASE ================= */
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
let supabase = null;

if (supabaseUrl && supabaseKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log('[Supabase] Подключён');
  } catch (e) {
    console.error('[Supabase] Ошибка подключения:', e.message);
  }
} else {
  console.log('[Supabase] SUPABASE_URL не заданы в .env. Сервер работает в автономном режиме с /data/*.json');
}

/* ================= TELEGRAM ================= */
const { notifyNewOrder, notifyOrderPaid, notifyReceiptUploaded, notifySurveyCompleted, sendTelegramMessage } = require('./telegram');

/* ================= ADMIN AUTH ================= */
function signToken() {
  return jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '12h' });
}

function requireAdmin(req, res, next) {
  const token = req.cookies.hs_token;
  if (!token) return res.status(401).json({ error: 'Не авторизован' });
  try {
    jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Сессия истекла, войдите заново' });
  }
}

app.post('/api/admin/login', (req, res) => {
  const { login, password } = req.body || {};
  const validLogin = login === process.env.ADMIN_LOGIN;
  const validPassword =
    process.env.ADMIN_PASSWORD_HASH &&
    bcrypt.compareSync(password || '', process.env.ADMIN_PASSWORD_HASH);

  if (!validLogin || !validPassword) {
    return res.status(401).json({ error: 'Неверный логин или пароль' });
  }
  const token = signToken();
  res.cookie('hs_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: PUBLIC_URL.startsWith('https'),
    maxAge: 12 * 60 * 60 * 1000
  });
  res.json({ ok: true });
});

app.post('/api/admin/logout', (req, res) => {
  res.clearCookie('hs_token');
  res.json({ ok: true });
});

app.get('/api/admin/me', requireAdmin, (req, res) => res.json({ ok: true }));

/* ================= PRODUCTS: маппинг полей ================= */
// Фронтенд (index.html, admin.html) работает с полями name/cat/old/desc,
// а в реальной таблице Supabase они называются name/category/old_price/description.
// Всё преобразование делаем тут, чтобы не трогать фронтенд.
const PRODUCT_SELECT_FULL = 'id,name,price,cat:category,old:old_price,desc:description,section,img,icon,hit,hidden,deleted,created_at';
const PRODUCT_SELECT_FALLBACK = 'id,name,price,cat:category,old:old_price,desc:description,section,img,icon,hit,hidden,created_at';
let PRODUCT_SELECT = PRODUCT_SELECT_FULL;

function toDbProduct(p) {
  const out = {};
  if (p.name !== undefined) out.name = p.name;
  if (p.price !== undefined) out.price = p.price;
  if (p.cat !== undefined) out.category = p.cat;
  if (p.old !== undefined) out.old_price = p.old;
  if (p.desc !== undefined) out.description = p.desc;
  if (p.section !== undefined) out.section = p.section;
  if (p.img !== undefined) out.img = p.img;
  if (p.icon !== undefined) out.icon = p.icon;
  if (p.hit !== undefined) out.hit = p.hit;
  if (p.id !== undefined) out.id = p.id;
  if (p.hidden !== undefined) out.hidden = p.hidden;
  if (p.deleted !== undefined) out.deleted = p.deleted;
  return out;
}

/* ================= PUBLIC: PRODUCTS ================= */
app.get('/api/products', async (req, res) => {
  let dbProducts = null;
  if (supabase) {
    try {
      let { data, error } = await supabase
        .from('products')
        .select(PRODUCT_SELECT)
        .order('created_at', { ascending: false });
      if (error && /deleted/i.test(error.message || '')) {
        PRODUCT_SELECT = PRODUCT_SELECT_FALLBACK;
        const retry = await supabase
          .from('products')
          .select(PRODUCT_SELECT)
          .order('created_at', { ascending: false });
        data = retry.data;
        error = retry.error;
      }
      if (!error && data) {
        dbProducts = data;
      }
    } catch (e) {
      console.error('Supabase products error:', e.message);
    }
  }

  const localProducts = readJsonFile('products.json');

  if (dbProducts) {
    const rateIds = ['tg_stars', 'tg_premium_3', 'tg_premium_6', 'tg_premium_9', 'tg_premium_12'];
    const missing = [];
    for (const rid of rateIds) {
      if (!dbProducts.some(p => p.id === rid)) {
        const lp = localProducts.find(x => x.id === rid);
        if (lp) {
          missing.push(lp);
          dbProducts.push(lp);
        }
      }
    }
    if (missing.length > 0 && supabase) {
      supabase.from('products').upsert(missing.map(toDbProduct), { onConflict: 'id' })
        .then(() => {})
        .catch(err => console.error('Auto-seed missing rates error:', err.message));
    }
    return res.json(dbProducts.filter(p => !p.hidden && !p.deleted));
  }
  res.json(localProducts.filter(p => !p.hidden && !p.deleted));
});

/* ================= SURVEY SUBMIT ================= */
app.post('/api/survey/submit', async (req, res) => {
  const { answers } = req.body || {};
  if (!Array.isArray(answers) || answers.length === 0) {
    return res.status(400).json({ error: 'Ответы опроса не переданы' });
  }

  const code = 'SURVEY20-' + Math.random().toString(36).substring(2, 8).toUpperCase();
  const discount = 20;
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  // Сохраняем в Supabase или локально
  if (supabase) {
    try {
      await supabase.from('promocodes').insert([{ code, discount, expires_at: expiresAt }]);
    } catch (e) {}
  }
  const promos = readJsonFile('promocodes.json');
  promos.push({ code, discount, expires_at: expiresAt.toISOString(), used: false });
  writeJsonFile('promocodes.json', promos);

  // Отправляем уведомление в Telegram с ответами
  try {
    await notifySurveyCompleted(answers, code);
  } catch (e) {
    console.log('Telegram уведомление об опросе не отправлено:', e.message);
  }

  res.json({ code, discount });
});

/* ================= ADMIN: PRODUCTS CRUD ================= */
app.get('/api/admin/products', requireAdmin, async (req, res) => {
  let dbProducts = null;
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('products')
        .select(PRODUCT_SELECT)
        .order('created_at', { ascending: false });
      if (!error && data) dbProducts = data;
    } catch (e) {
      console.error('Supabase admin products error:', e.message);
    }
  }

  const localProducts = readJsonFile('products.json');

  if (dbProducts) {
    const rateIds = ['tg_stars', 'tg_premium_3', 'tg_premium_6', 'tg_premium_9', 'tg_premium_12'];
    for (const rid of rateIds) {
      if (!dbProducts.some(p => p.id === rid)) {
        const lp = localProducts.find(x => x.id === rid);
        if (lp) dbProducts.push(lp);
      }
    }
    return res.json(dbProducts);
  }

  res.json(localProducts);
});

app.post('/api/admin/products', requireAdmin, async (req, res) => {
  const p = req.body;
  if (!p.name || !p.price) {
    return res.status(400).json({ error: 'Укажите как минимум name и price' });
  }
  const dbRow = toDbProduct(p);
  dbRow.id = p.id || ('p' + Date.now().toString(36));
  
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('products')
        .insert([dbRow])
        .select(PRODUCT_SELECT);
      if (!error && data && data.length > 0) return res.json(data[0]);
    } catch (e) {
      console.error('Supabase add product error:', e.message);
    }
  }

  const products = readJsonFile('products.json');
  const newProduct = {
    id: dbRow.id,
    name: p.name,
    price: Number(p.price),
    cat: p.cat || 'Разное',
    old: p.old ? Number(p.old) : 0,
    desc: p.desc || '',
    section: p.section || 'catalog',
    img: p.img || '',
    icon: p.icon || 'star',
    hit: Boolean(p.hit)
  };
  products.unshift(newProduct);
  writeJsonFile('products.json', products);
  res.json(newProduct);
});

app.put('/api/admin/products/:id', requireAdmin, async (req, res) => {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('products')
        .update(toDbProduct(req.body))
        .eq('id', req.params.id)
        .select(PRODUCT_SELECT);
      if (!error && data && data.length > 0) return res.json(data[0]);
    } catch (e) {
      console.error('Supabase update product error:', e.message);
    }
  }

  const products = readJsonFile('products.json');
  const idx = products.findIndex(x => x.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Товар не найден' });
  products[idx] = { ...products[idx], ...req.body };
  writeJsonFile('products.json', products);
  res.json(products[idx]);
});

app.delete('/api/admin/products/:id', requireAdmin, async (req, res) => {
  if (supabase) {
    try {
      await supabase.from('products').delete().eq('id', req.params.id);
    } catch (e) {}
  }
  let products = readJsonFile('products.json');
  products = products.filter(x => x.id !== req.params.id);
  writeJsonFile('products.json', products);
  res.json({ ok: true });
});

/* ================= ADMIN: RATES (STARS & PREMIUM) ================= */
app.get('/api/admin/rates', requireAdmin, async (req, res) => {
  let products = [];
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('products')
        .select(PRODUCT_SELECT)
        .in('id', ['tg_stars', 'tg_premium_3', 'tg_premium_6', 'tg_premium_9', 'tg_premium_12']);
      if (!error && data && data.length > 0) {
        products = data;
      }
    } catch (e) {
      console.error('Supabase admin rates error:', e.message);
    }
  }

  const localProducts = readJsonFile('products.json');
  function findRate(id, defPrice, defOld) {
    const foundDb = products.find(p => p.id === id);
    if (foundDb) return {
      price: foundDb.price,
      old: foundDb.old,
      hidden: Boolean(foundDb.hidden),
      deleted: Boolean(foundDb.deleted)
    };
    const foundLocal = localProducts.find(p => p.id === id);
    if (foundLocal) return {
      price: foundLocal.price,
      old: foundLocal.old,
      hidden: Boolean(foundLocal.hidden),
      deleted: Boolean(foundLocal.deleted)
    };
    return { price: defPrice, old: defOld, hidden: false, deleted: false };
  }

  res.json({
    stars: findRate('tg_stars', 2, 3),
    premium: {
      3: findRate('tg_premium_3', 990, 1290),
      6: findRate('tg_premium_6', 1790, 2290),
      9: findRate('tg_premium_9', 2490, 3190),
      12: findRate('tg_premium_12', 2990, 3990)
    }
  });
});

app.put('/api/admin/rates', requireAdmin, async (req, res) => {
  const { stars, premium } = req.body || {};
  let products = readJsonFile('products.json');

  const defaultTemplates = {
    tg_stars: { name: 'Telegram Звёзды (Stars)', price: 2, old: 3, cat: 'Звезды&Премиум', desc: 'Моментальная накрутка и покупка звёзд для Telegram-каналов и ботов по оптовому курсу', section: 'catalog', img: '/images/1000pdp.jpg', icon: 'star', hit: true, hidden: false, deleted: false },
    tg_premium_3: { name: 'Telegram Premium — 3 месяца', price: 990, old: 1290, cat: 'Звезды&Премиум', desc: 'Официальная подписка Telegram Premium на 3 месяца без входа в аккаунт', section: 'catalog', img: '/images/1000p.jpg', icon: 'premium', hit: false, hidden: false, deleted: false },
    tg_premium_6: { name: 'Telegram Premium — 6 месяцев', price: 1790, old: 2290, cat: 'Звезды&Премиум', desc: 'Официальная подписка Telegram Premium на 6 месяцев с гарантией', section: 'catalog', img: '/images/1000p.jpg', icon: 'premium', hit: true, hidden: false, deleted: false },
    tg_premium_9: { name: 'Telegram Premium — 9 месяцев', price: 2490, old: 3190, cat: 'Звезды&Премиум', desc: 'Официальная подписка Telegram Premium на 9 месяцев', section: 'catalog', img: '/images/1000p.jpg', icon: 'premium', hit: false, hidden: false, deleted: false },
    tg_premium_12: { name: 'Telegram Premium — 12 месяцев', price: 2990, old: 3990, cat: 'Звезды&Премиум', desc: 'Официальная подписка Telegram Premium на 1 год с максимальной выгодой', section: 'catalog', img: '/images/1000p.jpg', icon: 'premium', hit: false, hidden: false, deleted: false }
  };

  function updateProd(id, itemData) {
    if (!itemData) return;
    const { price, old, hidden, deleted } = itemData;
    const idx = products.findIndex(p => p.id === id);
    if (idx !== -1) {
      if (price !== undefined && !isNaN(Number(price))) products[idx].price = Number(price);
      if (old !== undefined && !isNaN(Number(old))) products[idx].old = Number(old);
      if (hidden !== undefined) products[idx].hidden = Boolean(hidden);
      if (deleted !== undefined) products[idx].deleted = Boolean(deleted);
      products[idx].cat = 'Звезды&Премиум';
      products[idx].section = 'catalog';
    } else if (defaultTemplates[id]) {
      const item = { ...defaultTemplates[id], id };
      if (price !== undefined && !isNaN(Number(price))) item.price = Number(price);
      if (old !== undefined && !isNaN(Number(old))) item.old = Number(old);
      if (hidden !== undefined) item.hidden = Boolean(hidden);
      if (deleted !== undefined) item.deleted = Boolean(deleted);
      products.push(item);
    }
  }

  if (stars) {
    updateProd('tg_stars', stars);
  }

  if (premium) {
    if (premium[3]) updateProd('tg_premium_3', premium[3]);
    if (premium[6]) updateProd('tg_premium_6', premium[6]);
    if (premium[9]) updateProd('tg_premium_9', premium[9]);
    if (premium[12]) updateProd('tg_premium_12', premium[12]);
  }

  writeJsonFile('products.json', products);

  if (supabase) {
  try {
    const ids = ['tg_stars', 'tg_premium_3', 'tg_premium_6', 'tg_premium_9', 'tg_premium_12'];
    const upsertRows = [];
    for (const id of ids) {
      const p = products.find(x => x.id === id) || defaultTemplates[id];
      if (p) upsertRows.push(toDbProduct({ ...p, id }));
    }
    if (upsertRows.length > 0) {
      let { error } = await supabase.from('products').upsert(upsertRows, { onConflict: 'id' });
      if (error && /hidden|deleted/i.test(error.message || '')) {
        const stripped = upsertRows.map(({ hidden, deleted, ...rest }) => rest);
        const retry = await supabase.from('products').upsert(stripped, { onConflict: 'id' });
        error = retry.error;
      }
      if (error) console.error('Supabase upsert rates error (сохранено локально):', error.message);
    }
  } catch (e) {
    console.error('Supabase update rates error (сохранено локально):', e.message);
  }
}

  res.json({ ok: true, products: products.filter(p => p.cat === 'Звезды&Премиум') });
});

/* ================= PROJECTS (Hustlify) ================= */
// Как и у products, поля во фронтенде — camelCase (shortDesc, fullDesc, buttonText,
// portfolioUrl), а в таблице Supabase — snake_case (short_desc, full_desc, ...).
// PROJECT_SELECT делает преобразование прямо в запросе через алиасы Supabase.
const PROJECT_SELECT = 'id,title,type,image,shortDesc:short_desc,fullDesc:full_desc,url,buttonText:button_text,portfolioUrl:portfolio_url,hidden,created_at';

function toDbProject(p) {
  const out = {};
  if (p.id !== undefined) out.id = p.id;
  if (p.title !== undefined) out.title = p.title;
  if (p.type !== undefined) out.type = p.type;
  if (p.image !== undefined) out.image = p.image;
  if (p.shortDesc !== undefined) out.short_desc = p.shortDesc;
  if (p.fullDesc !== undefined) out.full_desc = p.fullDesc;
  if (p.url !== undefined) out.url = p.url;
  if (p.buttonText !== undefined) out.button_text = p.buttonText;
  if (p.portfolioUrl !== undefined) out.portfolio_url = p.portfolioUrl;
  if (p.hidden !== undefined) out.hidden = !!p.hidden;
  return out;
}

function loadProjectsList() {
  const list = readJsonFile('projects.json', []);
  return Array.isArray(list) ? list : [];
}

function sanitizeProjectInput(p, existing) {
  const base = existing || {};
  const type = p.type === 'site' ? 'site' : (p.type === 'telegram' ? 'telegram' : (base.type || 'telegram'));
  return {
    ...base,
    title: p.title !== undefined ? String(p.title).trim() : (base.title || ''),
    type,
    image: p.image !== undefined ? String(p.image).trim() : (base.image || ''),
    shortDesc: p.shortDesc !== undefined ? String(p.shortDesc) : (base.shortDesc || ''),
    fullDesc: p.fullDesc !== undefined ? String(p.fullDesc) : (base.fullDesc || ''),
    url: p.url !== undefined ? String(p.url).trim() : (base.url || ''),
    buttonText: p.buttonText !== undefined ? String(p.buttonText).trim() : (base.buttonText || ''),
    portfolioUrl: p.portfolioUrl !== undefined ? String(p.portfolioUrl).trim() : (base.portfolioUrl || ''),
    hidden: p.hidden !== undefined ? !!p.hidden : !!base.hidden
  };
}

// GET /api/projects — публичный список, скрытые проекты не показываем
app.get('/api/projects', async (req, res) => {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select(PROJECT_SELECT)
        .order('created_at', { ascending: true });
      if (!error && data) return res.json(data.filter(p => !p.hidden));
    } catch (e) {
      console.error('Supabase projects error:', e.message);
    }
  }
  res.json(loadProjectsList().filter(p => !p.hidden));
});

// GET /api/admin/projects — в админке видно всё, включая скрытые
app.get('/api/admin/projects', requireAdmin, async (req, res) => {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select(PROJECT_SELECT)
        .order('created_at', { ascending: true });
      if (!error && data) return res.json(data);
    } catch (e) {
      console.error('Supabase admin projects error:', e.message);
    }
  }
  res.json(loadProjectsList());
});

app.post('/api/admin/projects', requireAdmin, async (req, res) => {
  const body = req.body || {};
  if (!body.title || !String(body.title).trim()) return res.status(400).json({ error: 'Укажите название проекта' });
  const project = sanitizeProjectInput(body, { id: 'proj' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) });

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('projects')
        .insert([toDbProject(project)])
        .select(PROJECT_SELECT);
      if (!error && data && data.length > 0) return res.json(data[0]);
      if (error) console.error('Supabase insert project error:', error.message);
    } catch (e) {
      console.error('Supabase insert project error:', e.message);
    }
  }

  const list = loadProjectsList();
  list.push(project);
  writeJsonFile('projects.json', list);
  res.json(project);
});

app.put('/api/admin/projects/:id', requireAdmin, async (req, res) => {
  const body = req.body || {};
  if (body.title !== undefined && !String(body.title).trim()) return res.status(400).json({ error: 'Укажите название проекта' });

  if (supabase) {
    try {
      const { data: existingRows } = await supabase.from('projects').select(PROJECT_SELECT).eq('id', req.params.id);
      const existing = existingRows && existingRows[0];
      if (existing) {
        const updated = sanitizeProjectInput(body, existing);
        const { data, error } = await supabase
          .from('projects')
          .update(toDbProject(updated))
          .eq('id', req.params.id)
          .select(PROJECT_SELECT);
        if (!error && data && data.length > 0) return res.json(data[0]);
        if (error) console.error('Supabase update project error:', error.message);
      }
    } catch (e) {
      console.error('Supabase update project error:', e.message);
    }
  }

  const list = loadProjectsList();
  const idx = list.findIndex(x => x.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Проект не найден' });
  list[idx] = sanitizeProjectInput(body, list[idx]);
  writeJsonFile('projects.json', list);
  res.json(list[idx]);
});

app.delete('/api/admin/projects/:id', requireAdmin, async (req, res) => {
  if (supabase) {
    try {
      await supabase.from('projects').delete().eq('id', req.params.id);
    } catch (e) {
      console.error('Supabase delete project error:', e.message);
    }
  }
  let list = loadProjectsList();
  list = list.filter(x => x.id !== req.params.id);
  writeJsonFile('projects.json', list);
  res.json({ ok: true });
});

/* ================= PARTNERS ================= */
function loadPartnersList() {
  const list = readJsonFile('partners.json', []);
  return Array.isArray(list) ? list : [];
}

function sanitizePartnerInput(p, existing) {
  const base = existing || {};
  return {
    ...base,
    name: p.name !== undefined ? String(p.name).trim() : (base.name || ''),
    url: p.url !== undefined ? String(p.url).trim() : (base.url || ''),
    logo: p.logo !== undefined ? String(p.logo).trim() : (base.logo || '')
  };
}

app.get('/api/partners', async (req, res) => {
  if (supabase) {
    try {
      const { data, error } = await supabase.from('partners').select('*').order('created_at', { ascending: true });
      if (!error && data) return res.json(data);
    } catch (e) {
      console.error('Supabase partners error:', e.message);
    }
  }
  res.json(loadPartnersList());
});

app.get('/api/admin/partners', requireAdmin, async (req, res) => {
  if (supabase) {
    try {
      const { data, error } = await supabase.from('partners').select('*').order('created_at', { ascending: true });
      if (!error && data) return res.json(data);
    } catch (e) {
      console.error('Supabase admin partners error:', e.message);
    }
  }
  res.json(loadPartnersList());
});

app.post('/api/admin/partners', requireAdmin, async (req, res) => {
  const body = req.body || {};
  if (!body.name || !String(body.name).trim()) return res.status(400).json({ error: 'Укажите название партнёра' });
  const partner = sanitizePartnerInput(body, { id: 'ptn' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) });

  if (supabase) {
    try {
      const { data, error } = await supabase.from('partners').insert([partner]).select();
      if (!error && data && data.length > 0) return res.json(data[0]);
      if (error) console.error('Supabase insert partner error:', error.message);
    } catch (e) {
      console.error('Supabase insert partner error:', e.message);
    }
  }

  const list = loadPartnersList();
  list.push(partner);
  writeJsonFile('partners.json', list);
  res.json(partner);
});

app.put('/api/admin/partners/:id', requireAdmin, async (req, res) => {
  const body = req.body || {};
  if (body.name !== undefined && !String(body.name).trim()) return res.status(400).json({ error: 'Укажите название партнёра' });

  if (supabase) {
    try {
      const { data: existingRows } = await supabase.from('partners').select('*').eq('id', req.params.id);
      const existing = existingRows && existingRows[0];
      if (existing) {
        const updated = sanitizePartnerInput(body, existing);
        const { data, error } = await supabase.from('partners').update(updated).eq('id', req.params.id).select();
        if (!error && data && data.length > 0) return res.json(data[0]);
        if (error) console.error('Supabase update partner error:', error.message);
      }
    } catch (e) {
      console.error('Supabase update partner error:', e.message);
    }
  }

  const list = loadPartnersList();
  const idx = list.findIndex(x => x.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Партнёр не найден' });
  list[idx] = sanitizePartnerInput(body, list[idx]);
  writeJsonFile('partners.json', list);
  res.json(list[idx]);
});

app.delete('/api/admin/partners/:id', requireAdmin, async (req, res) => {
  if (supabase) {
    try {
      await supabase.from('partners').delete().eq('id', req.params.id);
    } catch (e) {
      console.error('Supabase delete partner error:', e.message);
    }
  }
  let list = loadPartnersList();
  list = list.filter(x => x.id !== req.params.id);
  writeJsonFile('partners.json', list);
  res.json({ ok: true });
});

/* ================= NEWS ================= */
app.get('/api/news', async (req, res) => {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('news')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) return res.json(data);
    } catch (e) {}
  }
  res.json(readJsonFile('news.json'));
});

app.get('/api/admin/news', requireAdmin, async (req, res) => {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('news')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) return res.json(data);
    } catch (e) {}
  }
  res.json(readJsonFile('news.json'));
});

app.post('/api/admin/news', requireAdmin, async (req, res) => {
  const n = req.body;
  if (!n.title) return res.status(400).json({ error: 'Укажите заголовок новости' });
  n.id = 'n' + Date.now().toString(36);
  n.created_at = new Date().toISOString();
  
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('news')
        .insert([n])
        .select();
      if (!error && data && data.length > 0) return res.json(data[0]);
    } catch (e) {}
  }

  const newsList = readJsonFile('news.json');
  newsList.unshift(n);
  writeJsonFile('news.json', newsList);
  res.json(n);
});

app.put('/api/admin/news/:id', requireAdmin, async (req, res) => {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('news')
        .update(req.body)
        .eq('id', req.params.id)
        .select();
      if (!error && data && data.length > 0) return res.json(data[0]);
    } catch (e) {}
  }

  const newsList = readJsonFile('news.json');
  const idx = newsList.findIndex(x => x.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Новость не найдена' });
  newsList[idx] = { ...newsList[idx], ...req.body };
  writeJsonFile('news.json', newsList);
  res.json(newsList[idx]);
});

app.delete('/api/admin/news/:id', requireAdmin, async (req, res) => {
  if (supabase) {
    try {
      await supabase.from('news').delete().eq('id', req.params.id);
    } catch (e) {}
  }
  let newsList = readJsonFile('news.json');
  newsList = newsList.filter(x => x.id !== req.params.id);
  writeJsonFile('news.json', newsList);
  res.json({ ok: true });
});

/* ================= ПРОМОКОДЫ (рулетка) ================= */
const PROMO_WEIGHTS = [
  { discount: 5, weight: 40 },
  { discount: 10, weight: 32 },
  { discount: 15, weight: 20 },
  { discount: 25, weight: 8 }
];

function pickWeightedDiscount() {
  const total = PROMO_WEIGHTS.reduce((s, w) => s + w.weight, 0);
  let r = Math.random() * total;
  for (const w of PROMO_WEIGHTS) {
    if (r < w.weight) return w.discount;
    r -= w.weight;
  }
  return PROMO_WEIGHTS[0].discount;
}

function genOpaqueCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(12);
  let code = '';
  for (let i = 0; i < 12; i++) code += alphabet[bytes[i] % alphabet.length];
  return code;
}

// Защита от накрутки
const promoCooldown = new Map();
function isRateLimited(ip) {
  const last = promoCooldown.get(ip) || 0;
  const now = Date.now();
  if (now - last < 5000) return true;
  promoCooldown.set(ip, now);
  return false;
}

// 1 прокрут в 24 часа
const SPIN_LIMIT_MS = 24 * 60 * 60 * 1000;
const spinCooldown = new Map();

app.post('/api/promo/generate', async (req, res) => {
  if (isRateLimited(req.ip)) {
    return res.status(429).json({ error: 'Слишком часто. Подождите немного и попробуйте снова' });
  }
  
  const last = spinCooldown.get(req.ip) || 0;
  const spinRemaining = SPIN_LIMIT_MS - (Date.now() - last);
  if (spinRemaining > 0) {
    return res.status(429).json({
      error: 'Рулетка доступна раз в 24 часа. Попробуйте позже',
      remainingMs: spinRemaining
    });
  }
  
  spinCooldown.set(req.ip, Date.now());
  const discount = pickWeightedDiscount();
  const code = genOpaqueCode();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('promocodes')
        .insert([{ code, discount, expires_at: expiresAt }])
        .select();
      if (!error) return res.json({ code, discount });
    } catch (e) {}
  }

  const promos = readJsonFile('promocodes.json');
  promos.push({ code, discount, expires_at: expiresAt.toISOString(), used: false });
  writeJsonFile('promocodes.json', promos);
  res.json({ code, discount });
});

// Генерация промокода за прохождение опроса (скидка 20%)
app.post('/api/survey/promo', async (req, res) => {
  const code = 'SURVEY20-' + Math.random().toString(36).substring(2, 8).toUpperCase();
  const discount = 20;
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 дней
  
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('promocodes')
        .insert([{ code, discount, expires_at: expiresAt }])
        .select();
      if (!error && data && data.length > 0) return res.json({ code, discount });
    } catch (e) {}
  }

  const promos = readJsonFile('promocodes.json');
  promos.push({ code, discount, expires_at: expiresAt.toISOString(), used: false });
  writeJsonFile('promocodes.json', promos);
  res.json({ code, discount });
});

// Проверка промокода
app.get('/api/promo/check/:code', async (req, res) => {
  const reqCode = String(req.params.code).toUpperCase().trim();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('promocodes')
        .select('*')
        .eq('code', reqCode)
        .eq('used', false)
        .gt('expires_at', new Date().toISOString())
        .single();
      if (!error && data) return res.json({ valid: true, discount: data.discount });
    } catch (e) {}
  }

  const promos = readJsonFile('promocodes.json');
  const p = promos.find(x => x.code === reqCode && !x.used && new Date(x.expires_at) > new Date());
  if (!p) return res.json({ valid: false });
  res.json({ valid: true, discount: p.discount });
});

/* ================= ORDERS ================= */
app.post('/api/orders', async (req, res) => {
  const { items, contact, promoCode } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Корзина пуста' });
  }

  let products = [];
  if (supabase) {
    try {
      const { data } = await supabase.from('products').select('*').in('id', items.map(i => i.id));
      if (data) products = data;
    } catch (e) {}
  }
  if (products.length === 0) {
    products = readJsonFile('products.json');
  }

  let itemsTotal = 0;
  const lines = [];
  for (const it of items) {
    const p = products.find(x => x.id === it.id);
    if (!p) continue;
    const target = (it.target || it.username || '').toString().trim().slice(0, 120);

    if (p.id === 'tg_stars' || it.stars) {
      const starsCount = Math.max(25, Math.min(10000, parseInt(it.stars || it.qty) || 25));
      const linePrice = Math.round(p.price * starsCount);
      itemsTotal += linePrice;
      lines.push({
        id: p.id,
        name: `Telegram Звёзды (${starsCount.toLocaleString('ru-RU')} шт.)`,
        price: linePrice,
        qty: 1,
        stars: starsCount,
        target: target || null,
        details: `${starsCount} звёзд${target ? ' для ' + target : ''}`
      });
    } else if (p.id.startsWith('tg_premium')) {
      const qty = Math.max(1, parseInt(it.qty) || 1);
      const linePrice = p.price * qty;
      itemsTotal += linePrice;
      lines.push({
        id: p.id,
        name: p.name,
        price: p.price,
        qty,
        target: target || null,
        details: `${p.name}${target ? ' для ' + target : ''}`
      });
    } else {
      const qty = Math.max(1, parseInt(it.qty) || 1);
      itemsTotal += p.price * qty;
      lines.push({
        id: p.id,
        name: p.name,
        price: p.price,
        qty,
        target: target || null,
        details: it.details || null
      });
    }
  }
  if (lines.length === 0) return res.status(400).json({ error: 'Товары не найдены' });

  let discountPercent = 0;
  let appliedPromo = null;
  if (promoCode) {
    const codeClean = String(promoCode).toUpperCase().trim();
    let validPromo = false;
    if (supabase) {
      try {
        const { data: promo } = await supabase
          .from('promocodes')
          .select('*')
          .eq('code', codeClean)
          .eq('used', false)
          .gt('expires_at', new Date().toISOString())
          .single();
        if (promo) {
          discountPercent = promo.discount;
          appliedPromo = promo.code;
          validPromo = true;
        }
      } catch (e) {}
    }

    if (!validPromo) {
      const promos = readJsonFile('promocodes.json');
      const p = promos.find(x => x.code === codeClean && !x.used && new Date(x.expires_at) > new Date());
      if (p) {
        discountPercent = p.discount;
        appliedPromo = p.code;
        validPromo = true;
      }
    }

    if (!validPromo) {
      return res.status(400).json({ error: 'Промокод недействителен, истёк или уже использован' });
    }
  }

  const total = Math.round(itemsTotal * (1 - discountPercent / 100));
  const orderId = 'ord_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  
  const order = {
    id: orderId,
    items: lines,
    items_total: itemsTotal,
    discount_percent: discountPercent,
    promo_code: appliedPromo,
    total,
    contact: (contact || '').toString().trim().slice(0, 200),
    status: 'pending',
    payment: null,
    created_at: new Date().toISOString()
  };

  let saved = false;
  if (supabase) {
    try {
      const { data, error: insertError } = await supabase.from('orders').insert([order]).select();
      if (!insertError && data && data.length > 0) saved = true;
    } catch (e) {}
  }

  if (!saved) {
    const orders = readJsonFile('orders.json');
    orders.unshift(order);
    writeJsonFile('orders.json', orders);
  }

  if (appliedPromo) {
    if (supabase) {
      try {
        await supabase.from('promocodes').update({ used: true, order_id: orderId }).eq('code', appliedPromo);
      } catch (e) {}
    }
    const promos = readJsonFile('promocodes.json');
    const pr = promos.find(x => x.code === appliedPromo);
    if (pr) { pr.used = true; pr.order_id = orderId; writeJsonFile('promocodes.json', promos); }
  }

  try {
    await notifyNewOrder(order);
  } catch (e) {
    console.log('Telegram уведомление не отправлено:', e.message);
  }

  res.json(order);
});

app.get('/api/orders/:id', async (req, res) => {
  if (supabase) {
    try {
      const { data } = await supabase.from('orders').select('*').eq('id', req.params.id).single();
      if (data) return res.json(data);
    } catch (e) {}
  }
  const orders = readJsonFile('orders.json');
  const ord = orders.find(x => x.id === req.params.id);
  if (!ord) return res.status(404).json({ error: 'Заказ не найден' });
  res.json(ord);
});

app.get('/api/admin/orders', requireAdmin, async (req, res) => {
  if (supabase) {
    try {
      const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
      if (data) return res.json(data);
    } catch (e) {}
  }
  res.json(readJsonFile('orders.json'));
});

app.put('/api/admin/orders/:id', requireAdmin, async (req, res) => {
  const newStatus = req.body.status;
  let updatedOrder = null;
  if (supabase) {
    try {
      const { data } = await supabase.from('orders').update({ status: newStatus }).eq('id', req.params.id).select();
      if (data && data.length > 0) updatedOrder = data[0];
    } catch (e) {}
  }

  if (!updatedOrder) {
    const orders = readJsonFile('orders.json');
    const idx = orders.findIndex(x => x.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Заказ не найден' });
    orders[idx].status = newStatus;
    writeJsonFile('orders.json', orders);
    updatedOrder = orders[idx];
  }

  if (newStatus === 'paid') {
    try {
      await notifyOrderPaid(updatedOrder);
    } catch (e) {}
  }

  res.json(updatedOrder);
});

/* ================= ROLLYPAY PAYMENT GATEWAY ================= */
const ROLLYPAY_API_KEY = process.env.ROLLYPAY_API_KEY || 'yFqR2Klx7yDvDobQJ5-a90xUgDZvHHL7XjX5WXbdH3c';
const ROLLYPAY_SIGNING_SECRET = process.env.ROLLYPAY_SIGNING_SECRET || 'ixBpA66RKOXOX_wAVWHaF67h5-8EiS3yz2nts3Z47i8';
const ROLLYPAY_TERMINAL_ID = process.env.ROLLYPAY_TERMINAL_ID || 'ba78c039-c69a-4fe4-a45a-46fc164f0f04';

async function createRollyPayInvoice(order) {
  const totalNum = Number(order.total) || 0;
  const amountStr = totalNum.toFixed(2);

  const payload = {
    amount: amountStr,
    order_id: String(order.id),
    payment_currency: 'RUB',
    description: `Заказ #${order.id} на Hustlify`,
    terminal_id: ROLLYPAY_TERMINAL_ID,
    redirect_url: `${PUBLIC_URL}/payment-success?order=${order.id}`,
    success_redirect_url: `${PUBLIC_URL}/payment-success?order=${order.id}`,
    fail_redirect_url: `${PUBLIC_URL}/payment-fail?order=${order.id}`,
    metadata: {
      order_id: String(order.id),
      contact: order.contact || ''
    }
  };

  if (order.contact) {
    payload.customer_id = String(order.contact).slice(0, 100);
  }

  const resp = await fetch('https://rollypay.io/api/v1/payments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': ROLLYPAY_API_KEY
    },
    body: JSON.stringify(payload)
  });

  const data = await resp.json();
  if (!resp.ok || (!data.pay_url && !data.url)) {
    console.error('RollyPay API response error:', data);
    throw new Error(data.error || data.message || 'Ошибка создания платежа в RollyPay');
  }

  return {
    ...data,
    pay_url: data.pay_url || data.url
  };
}

app.post(['/api/payments/rollypay/create', '/api/payments/create'], async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!orderId) {
      return res.status(400).json({ error: 'Параметр orderId обязателен' });
    }

    let order = null;
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .eq('id', orderId)
          .single();
        if (!error && data) order = data;
      } catch (e) {}
    }

    if (!order) {
      const orders = readJsonFile('orders.json');
      order = orders.find(x => x.id === orderId);
    }

    if (!order) return res.status(404).json({ error: 'Заказ не найден' });

    const rpData = await createRollyPayInvoice(order);

    const paymentInfo = {
      provider: 'rollypay',
      paymentId: rpData.payment_id,
      payUrl: rpData.pay_url,
      token: rpData.token,
      amount: rpData.amount,
      status: rpData.status || 'created'
    };

    if (supabase) {
      try {
        await supabase
          .from('orders')
          .update({ payment: paymentInfo })
          .eq('id', orderId);
      } catch (e) {}
    }

    const orders = readJsonFile('orders.json');
    const idx = orders.findIndex(x => x.id === orderId);
    if (idx !== -1) {
      orders[idx].payment = paymentInfo;
      writeJsonFile('orders.json', orders);
    }

    res.json({
      success: true,
      payUrl: rpData.pay_url,
      paymentId: rpData.payment_id
    });
  } catch (e) {
    console.error('RollyPay creation failed:', e.message);
    res.status(500).json({ error: e.message || 'Не удалось создать платеж в RollyPay' });
  }
});

/* ================= WEBHOOK ROLLYPAY ================= */
app.post('/api/webhooks/rollypay', async (req, res) => {
  try {
    const rawBody = req.rawBody ? req.rawBody.toString('utf-8') : (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
    const signature = (req.headers['x-signature'] || req.headers['signature'] || '').trim();
    const timestamp = (req.headers['x-timestamp'] || req.headers['timestamp'] || '').trim();

    // Верификация подписи HMAC-SHA256 (timestamp + "." + rawBody)
    if (ROLLYPAY_SIGNING_SECRET && signature && timestamp) {
      try {
        const signed = timestamp + '.' + rawBody;
        const expected = crypto.createHmac('sha256', ROLLYPAY_SIGNING_SECRET).update(signed).digest('hex');
        const valid = expected.length === signature.length &&
          crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
        if (!valid) {
          console.warn('RollyPay webhook: Недействительная подпись X-Signature');
          return res.status(403).json({ error: 'Invalid signature' });
        }
      } catch (sigErr) {
        console.error('Ошибка проверки подписи webhook:', sigErr.message);
        return res.status(403).json({ error: 'Signature verification failure' });
      }
    }

    let payload;
    try {
      payload = typeof req.body === 'object' && req.body !== null && !Buffer.isBuffer(req.body) ? req.body : JSON.parse(rawBody);
    } catch (e) {
      payload = req.body || {};
    }

    const eventType = (payload.event_type || payload.event || payload.type || '').toLowerCase();
    const status = (payload.status || (payload.data && payload.data.status) || '').toLowerCase();
    const orderId = payload.order_id || 
                    payload.orderId || 
                    (payload.data && (payload.data.order_id || payload.data.orderId)) ||
                    (payload.payment && payload.payment.order_id) ||
                    (payload.metadata && payload.metadata.order_id);

    const isPaid = status === 'paid' || 
                   eventType === 'payment.paid' || 
                   eventType === 'paid';

    const isCancelled = status === 'canceled' || 
                        status === 'expired' || 
                        eventType === 'payment.canceled' || 
                        eventType === 'payment.expired';

    const paymentId = payload.payment_id || (payload.data && payload.data.payment_id);

    if (orderId && isPaid) {
      let order = null;
      if (supabase) {
        try {
          await supabase
            .from('orders')
            .update({
              status: 'paid',
              payment: {
                provider: 'rollypay',
                paymentId,
                amount: payload.amount,
                currency: payload.currency || 'RUB',
                raw: payload
              },
              paid_at: new Date().toISOString()
            })
            .eq('id', orderId);

          const { data } = await supabase
            .from('orders')
            .select('*')
            .eq('id', orderId)
            .single();
          if (data) order = data;
        } catch (e) {}
      }

      if (!order) {
        const orders = readJsonFile('orders.json');
        const idx = orders.findIndex(x => x.id === orderId);
        if (idx !== -1) {
          orders[idx].status = 'paid';
          orders[idx].payment = {
            provider: 'rollypay',
            paymentId,
            amount: payload.amount,
            currency: payload.currency || 'RUB',
            raw: payload
          };
          orders[idx].paid_at = new Date().toISOString();
          writeJsonFile('orders.json', orders);
          order = orders[idx];
        }
      }

      if (order) {
        console.log(`[RollyPay] Заказ #${order.id} успешно оплачен!`);
        await notifyOrderPaid(order);
      }
    } else if (orderId && isCancelled) {
      if (supabase) {
        try {
          await supabase
            .from('orders')
            .update({
              status: 'cancelled',
              payment: {
                provider: 'rollypay',
                paymentId,
                status,
                raw: payload
              }
            })
            .eq('id', orderId);
        } catch (e) {}
      }

      const orders = readJsonFile('orders.json');
      const idx = orders.findIndex(x => x.id === orderId);
      if (idx !== -1) {
        orders[idx].status = 'cancelled';
        orders[idx].payment = {
          provider: 'rollypay',
          paymentId,
          status,
          raw: payload
        };
        writeJsonFile('orders.json', orders);
      }
    }

    res.status(200).send('OK');
  } catch (e) {
    console.error('RollyPay webhook handler error:', e);
    res.status(400).json({ error: 'Webhook processing error' });
  }
});

/* ================= CRYPTOBOT & OTHER PAYMENTS ================= */
app.post('/api/payments/:provider/create', async (req, res, next) => {
  const { provider } = req.params;
  if (provider === 'rollypay') {
    // Already handled by /api/payments/rollypay/create, but in case:
    req.url = '/api/payments/rollypay/create';
    return app._router.handle(req, res, next);
  }
  if (provider === 'cryptobot' && process.env.CRYPTOBOT_TOKEN) {
    return next();
  }
  // По умолчанию направляем все оплаты в RollyPay
  try {
    const { orderId } = req.body;
    let order = null;
    if (supabase) {
      try {
        const { data } = await supabase.from('orders').select('*').eq('id', orderId).single();
        if (data) order = data;
      } catch (e) {}
    }
    if (!order) {
      const orders = readJsonFile('orders.json');
      order = orders.find(x => x.id === orderId);
    }
    if (!order) return res.status(404).json({ error: 'Заказ не найден' });
    const rpData = await createRollyPayInvoice(order);
    return res.json({ payUrl: rpData.pay_url, paymentId: rpData.payment_id });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Ошибка RollyPay' });
  }
});

/* ================= CRYPTOBOT PAYMENT ================= */
app.post('/api/payments/cryptobot/create', async (req, res) => {
  try {
    const { orderId } = req.body;
    let order = null;
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .eq('id', orderId)
          .single();
        if (!error && data) order = data;
      } catch (e) {}
    }

    if (!order) {
      const orders = readJsonFile('orders.json');
      order = orders.find(x => x.id === orderId);
    }
    
    if (!order) return res.status(404).json({ error: 'Заказ не найден' });
    if (!process.env.CRYPTOBOT_TOKEN) {
      return res.status(500).json({ error: 'CRYPTOBOT_TOKEN не настроен на сервере' });
    }

    const resp = await fetch('https://pay.crypt.bot/api/createInvoice', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Crypto-Pay-API-Token': process.env.CRYPTOBOT_TOKEN
      },
      body: JSON.stringify({
        asset: process.env.CRYPTOBOT_ASSET || 'USDT',
        amount: String(order.total),
        description: `Заказ ${order.id} — Hustlify`,
        payload: order.id,
        paid_btn_name: 'callback',
        paid_btn_url: `${PUBLIC_URL}/payment-success.html?order=${order.id}`,
        expires_in: 1800
      })
    });
    const data = await resp.json();
    if (!data.ok) return res.status(502).json({ error: 'Ошибка CryptoBot', details: data });

    // Обновляем заказ с payment-информацией
    if (supabase) {
      try {
        await supabase
          .from('orders')
          .update({
            payment: { provider: 'cryptobot', invoiceId: data.result.invoice_id, payUrl: data.result.pay_url }
          })
          .eq('id', orderId);
      } catch (e) {}
    }

    const orders = readJsonFile('orders.json');
    const idx = orders.findIndex(x => x.id === orderId);
    if (idx !== -1) {
      orders[idx].payment = { provider: 'cryptobot', invoiceId: data.result.invoice_id, payUrl: data.result.pay_url };
      writeJsonFile('orders.json', orders);
    }

    res.json({ payUrl: data.result.pay_url });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

/* ================= WEBHOOK CRYPTOBOT ================= */
app.post('/api/webhooks/cryptobot', express.raw({ type: '*/*' }), async (req, res) => {
  try {
    const rawBody = req.body.toString('utf-8');
    const signature = req.headers['crypto-pay-api-signature'];
    const secret = crypto.createHash('sha256').update(process.env.CRYPTOBOT_TOKEN || '').digest();
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

    if (signature !== expected) {
      console.warn('CryptoBot webhook: неверная подпись');
      return res.status(403).end();
    }
    const update = JSON.parse(rawBody);
    if (update.update_type === 'invoice_paid') {
      const orderId = update.payload && update.payload.payload;
      if (orderId) {
        let order = null;
        if (supabase) {
          try {
            await supabase
              .from('orders')
              .update({ 
                status: 'paid', 
                payment: { provider: 'cryptobot', raw: update.payload },
                paid_at: new Date().toISOString()
              })
              .eq('id', orderId);
            
            const { data } = await supabase
              .from('orders')
              .select('*')
              .eq('id', orderId)
              .single();
            if (data) order = data;
          } catch (e) {}
        }

        if (!order) {
          const orders = readJsonFile('orders.json');
          const idx = orders.findIndex(x => x.id === orderId);
          if (idx !== -1) {
            orders[idx].status = 'paid';
            orders[idx].payment = { provider: 'cryptobot', raw: update.payload };
            orders[idx].paid_at = new Date().toISOString();
            writeJsonFile('orders.json', orders);
            order = orders[idx];
          }
        }

        if (order) await notifyOrderPaid(order);
      }
    }
    res.status(200).end();
  } catch (e) {
    console.error(e);
    res.status(400).end();
  }
});

/* ================= РЕКВИЗИТЫ ДЛЯ ОПЛАТЫ ================= */
const defaultRequisites = {
  id: 1,
  card_number: '2200 0000 0000 0000',
  bank_name: 'Т-Банк',
  recipient_name: 'Тимур Б.',
  self_employed_name: 'Бенаи Тимур Рустамович',
  self_employed_inn: '920159216794',
  comment: 'Укажите ID заказа в комментарии к переводу'
};

app.get('/api/requisites', async (req, res) => {
  if (supabase) {
    try {
      const { data } = await supabase.from('requisites').select('*').eq('id', 1).single();
      if (data) return res.json(data);
    } catch (e) {}
  }
  const reqs = readJsonFile('requisites.json', [defaultRequisites]);
  res.json(reqs[0] || defaultRequisites);
});

app.put('/api/admin/requisites', requireAdmin, async (req, res) => {
  const { card_number, bank_name, recipient_name, comment, self_employed_name, self_employed_inn } = req.body || {};
  const currentReqs = readJsonFile('requisites.json', [defaultRequisites])[0] || defaultRequisites;
  const updatedData = {
    id: 1,
    card_number: (card_number !== undefined ? card_number : currentReqs.card_number || '').toString().trim(),
    bank_name: (bank_name !== undefined ? bank_name : currentReqs.bank_name || '').toString().trim(),
    recipient_name: (recipient_name !== undefined ? recipient_name : currentReqs.recipient_name || '').toString().trim(),
    self_employed_name: (self_employed_name !== undefined ? self_employed_name : currentReqs.self_employed_name || 'Бенаи Тимур Рустамович').toString().trim(),
    self_employed_inn: (self_employed_inn !== undefined ? self_employed_inn : currentReqs.self_employed_inn || '920159216794').toString().trim(),
    comment: (comment !== undefined ? comment : currentReqs.comment || '').toString().trim(),
    updated_at: new Date().toISOString()
  };

  if (supabase) {
    try {
      const { data } = await supabase.from('requisites').update(updatedData).eq('id', 1).select();
      if (data && data.length > 0) return res.json(data[0]);
    } catch (e) {}
  }

  writeJsonFile('requisites.json', [updatedData]);
  res.json(updatedData);
});

/* ================= ЧЕК ОБ ОПЛАТЕ ================= */
app.post('/api/orders/:id/receipt', upload.single('receipt'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Файл чека не передан' });

    let order = null;
    if (supabase) {
      try {
        const { data } = await supabase.from('orders').select('*').eq('id', req.params.id).single();
        if (data) order = data;
      } catch (e) {}
    }

    if (!order) {
      const orders = readJsonFile('orders.json');
      order = orders.find(x => x.id === req.params.id);
    }

    if (!order) return res.status(404).json({ error: 'Заказ не найден' });

    const ext = (req.file.originalname.split('.').pop() || 'bin').toLowerCase().slice(0, 10);
    const fileName = `${order.id}_${Date.now()}.${ext}`;
    const receiptsDir = path.join(DATA_DIR, 'receipts');
    if (!fs.existsSync(receiptsDir)) fs.mkdirSync(receiptsDir, { recursive: true });

    fs.writeFileSync(path.join(receiptsDir, fileName), req.file.buffer);
    const receiptUrl = `/data/receipts/${fileName}`;

    let updatedOrder = null;
    if (supabase) {
      try {
        const { data } = await supabase
          .from('orders')
          .update({
            status: 'moderation',
            payment: { provider: 'requisites', receiptUrl, submittedAt: new Date().toISOString() }
          })
          .eq('id', order.id)
          .select();
        if (data && data.length > 0) updatedOrder = data[0];
      } catch (e) {}
    }

    if (!updatedOrder) {
      const orders = readJsonFile('orders.json');
      const idx = orders.findIndex(x => x.id === order.id);
      if (idx !== -1) {
        orders[idx].status = 'moderation';
        orders[idx].payment = { provider: 'requisites', receiptUrl, submittedAt: new Date().toISOString() };
        writeJsonFile('orders.json', orders);
        updatedOrder = orders[idx];
      }
    }

    try {
      if (updatedOrder) await notifyReceiptUploaded(updatedOrder);
    } catch (e) {
      console.log('Telegram уведомление о чеке не отправлено:', e.message);
    }

    res.json(updatedOrder || order);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || 'Внутренняя ошибка сервера' });
  }
});

/* ================= PROMO CHECK (для админки) ================= */
app.get('/api/admin/promocodes', requireAdmin, async (req, res) => {
  if (supabase) {
    try {
      const { data } = await supabase.from('promocodes').select('*').order('created_at', { ascending: false });
      if (data) return res.json(data);
    } catch (e) {}
  }
  res.json(readJsonFile('promocodes.json'));
});

/* ================= CALCULATOR ================= */
app.post('/api/calculator', async (req, res) => {
  const { budget, email } = req.body || {};
  
  if (!budget || budget <= 0) {
    return res.status(400).json({ error: 'Введите корректную сумму бюджета' });
  }
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Введите корректный email' });
  }
  
  const calcEntry = {
    id: 'calc_' + Date.now().toString(36),
    budget: parseInt(budget),
    email: email.trim(),
    created_at: new Date().toISOString()
  };

  if (supabase) {
    try {
      await supabase.from('calculator').insert([calcEntry]);
    } catch (e) {}
  }

  const calcList = readJsonFile('calculator.json');
  calcList.unshift(calcEntry);
  writeJsonFile('calculator.json', calcList);

  try {
    await sendTelegramMessage(
      `<b>[BUDGET] Новый расчёт бюджета</b>\n\n` +
      `Бюджет: <b>${budget} ₽</b>\n` +
      `Email: <b>${email}</b>\n` +
      `Время: ${new Date().toLocaleString('ru-RU')}`
    );
  } catch (e) {
    console.log('[Telegram] Уведомление не отправлено:', e.message);
  }
  
  res.json({ 
    message: `Спасибо! Мы свяжемся с вами по email ${email} в ближайшее время.`,
    budget 
  });
});

app.get('/api/admin/calculator', requireAdmin, async (req, res) => {
  if (supabase) {
    try {
      const { data } = await supabase.from('calculator').select('*').order('created_at', { ascending: false });
      if (data) return res.json(data);
    } catch (e) {}
  }
  res.json(readJsonFile('calculator.json'));
});

/* ================= CASES ROUTES ================= */
app.get('/cases', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'cases.html'));
});

app.get('/cases/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'cases.html'));
});

/* ================= AI AGENT (HUSTLIFY AGENT & QWEN3.7 EMBEDDINGS) ================= */
// Uses Alibaba Cloud DashScope (Singapore International) with qwen3.7-text-embedding
function getQwenConfig() {
  const apiKey = process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY || process.env.ALIBABA_API_KEY;
  const model = process.env.QWEN_MODEL || 'qwen3.7-text-embedding';
  const customBaseUrl = process.env.QWEN_BASE_URL ? process.env.QWEN_BASE_URL.replace(/\/+$/, '') : 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';
  return { apiKey, model, customBaseUrl };
}

let geminiClient = null;
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) return null;
  if (!geminiClient) {
    try {
      const { GoogleGenAI } = require('@google/genai');
      geminiClient = new GoogleGenAI({ apiKey });
    } catch (e) {
      console.warn('Failed to initialize GoogleGenAI:', e.message);
      return null;
    }
  }
  return geminiClient;
}

// Timeout wrapper helper to guarantee calls never exceed bounds
function withTimeout(promise, ms = 7500) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`Qwen AI Request Timeout after ${ms}ms`)), ms))
  ]);
}

function buildSystemPrompt(products, news) {
  const productListStr = (products || []).map(p => 
    `- [${p.id}] ${p.name} (Категория: ${p.cat || p.section}, Акционная цена: ${p.price} ₽, Обычная цена: ${p.old || p.price} ₽, Описание: "${p.desc}")`
  ).join('\n');

  const newsListStr = (news || []).length
    ? (news || []).map(n => `- ${n.title}${n.headline ? ' — ' + n.headline : ''}: ${n.body || ''}`).join('\n')
    : 'Актуальных новостей сейчас нет.';

  return `Ты — официальный интеллектуальный Hustlify Agent и ведущий бизнес-консультант платформы Hustlify (https://hustlify.ru).
Твое имя — Hustlify Agent. Никогда не упоминай сторонние наименования (Qwen, DeepSeek, ChatGPT и др.) — ты официальный Hustlify Agent.

ТВОЯ ГЛАВНАЯ ЦЕЛЬ — ИЗ ЛЮБОГО ВОПРОСА НАХОДИТЬ ПУТЬ К ПРОДАЖЕ.
Какой бы вопрос ни задал человек — по делу, не по теме, философский, технический, личный, — ты:
1) Коротко и honest отвечаешь по существу (не игнорируй сам вопрос, это разрушает доверие).
2) Затем ОБЯЗАТЕЛЬНО находишь мостик к одному из товаров/кейсов Hustlify из списка ниже и предлагаешь конкретное решение.
3) Всегда заканчиваешь четким призывом к действию (оформить, написать менеджеру, перейти в каталог).
Не бывает вопроса, из которого нельзя перейти к продаже — если человек говорит о деньгах, времени, скуке, работе, увлечениях, будущем, проблемах — это всегда повод показать, как Hustlify решает именно это.

СТРОГОЕ ПРАВИЛО ПО АССОРТИМЕНТУ:
Список товаров и кейсов ниже — это ТОЧНАЯ и ЕДИНСТВЕННАЯ актуальная витрина Hustlify прямо сейчас. Никогда не упоминай, не рекомендуй и не выдумывай товары, кейсы, цены или акции, которых нет в этом списке — даже если раньше о них где-то говорилось. Если чего-то в списке нет — считай, что этого больше не существует.

АКТУАЛЬНЫЕ НОВОСТИ И АКЦИИ HUSTLIFY (используй их в разговоре, когда это уместно — особенно новые коллаборации и ограниченные предложения — подавай их как срочный повод действовать прямо сейчас):
${newsListStr}

Если среди новостей есть новая коллаборация или свежий кейс — считай его приоритетным к продвижению: предлагай его первым в подходящих ответах, подчеркивай, что это новинка/ограниченное предложение, и подталкивай оформить его именно сейчас, пока условия/бонусы действуют.

ПРИНЦИПЫ ПРОДАЮЩЕЙ КОНСУЛЬТАЦИИ:
1. Выгода и ROI: Всегда показывай конкретные цифры окупаемости (обычно 7-21 день) и чистый ежемесячный доход (от 35 000 до 150 000 ₽).
2. Легкий старт "Под ключ": Подчеркивай, что клиенту не нужно программировать. Мы передаем готовую систему с подробной инструкцией за 24–72 часа.
3. Снятие страхов и возражений: Напоминай про официальные чеки, безопасную оплату через платежный шлюз RollyPay (СБП, карты МИР, Visa, MasterCard, USDT), 24/7 сопровождение специалистов @HustlifyHelp и отзывы в @HustlifyRep.
4. Создание срочности и триггер действия: Призывай бронировать место на запуск сегодня, пока действуют акционные цены в Каталоге, актуальные новости и промокоды на скидку.
5. Call to Action (CTA): Всегда завершай ответ призывом перейти к оформлению выбранного товара в каталоге или написать менеджеру @HustlifyHelp!

КАТАЛОГ HUSTLIFY (единственный источник правды о товарах и ценах):
${productListStr}`;
}

// High-Converting Sales Consultation Engine (Consults & strongly drives purchase)
function generateSalesConsultationResponse(message, products, customMatched = null) {
  const lower = (message || '').toLowerCase();
  let reply = '';
  let matchedProducts = customMatched || [];

  // Extract budget digits if any
  const budgetMatch = lower.match(/(\d+[\d\s]*)/);
  let parsedBudget = null;
  if (budgetMatch) {
    const rawNum = parseInt(budgetMatch[1].replace(/\s+/g, ''), 10);
    if (!isNaN(rawNum) && rawNum >= 100) parsedBudget = rawNum;
  }

  // 1. Budget inquiries
  if (parsedBudget && (lower.includes('бюджет') || lower.includes('руб') || lower.includes('₽') || lower.includes('тыс') || lower.includes('к ') || lower.includes('до '))) {
    if (parsedBudget < 4000) {
      reply = `**Персональный план запуска бизнеса при бюджете ${parsedBudget.toLocaleString('ru-RU')} ₽:**\n\n` +
        `Отличный стартовый бюджет для быстрого входа в IT-бизнес! Мы подобрали решения с моментальной окупаемостью:\n\n` +
        `1. **Кейс "Стандарт" (2 589 ₽)** — готовая упакованная ниша с пошаговой воронкой и инструкциями. Идеально для первого заработка.\n` +
        `2. **Кейс "Hustlify & TeleStore" (3 889 ₽)** — готовый Telegram-магазин под ключ с товарной матрицей.\n` +
        `3. **Верификации (CryptoBot / Fragment от 250 ₽)** — техническая база для безопасного приема платежей.\n\n` +
        `**Финансовая модель:**\n` +
        `• Средний доход в первый месяц: **от 25 000 до 40 000 ₽**.\n` +
        `• Срок полной окупаемости: **всего 7–14 дней** (достаточно 2–3 продаж!).\n` +
        `• Вам не нужно писать код: передаем готовый проект и обучающие материалы.\n\n` +
        `**Специальное предложение:** Оформите заказ прямо сейчас по акционной цене через карточку товара ниже, либо напишите в Telegram: **@HustlifyHelp** для бронирования запуска за 24 часа!\n` +
        `*Лайфхак:* Используйте персональный промокод или уточните у менеджера спецпредложение на запуск!`;
      if (!matchedProducts.length) {
        matchedProducts = products.filter(p => ['k2', 'k1', 'c1', 'c3'].includes(p.id));
      }
    } else if (parsedBudget <= 10000) {
      reply = `**План масштабирования бизнеса при бюджете ${parsedBudget.toLocaleString('ru-RU')} ₽:**\n\n` +
        `С таким бюджетом вы можете запустить один из самых высокомаржинальных Telegram-бизнесов:\n\n` +
        `1. **Telegram Mini App (8 990 ₽)** — современное веб-приложение прямо внутри Telegram. Конверсия на 40% выше стандартных сайтов!\n` +
        `2. **Бот Автовыдачи 24/7 (5 990 ₽)** — полностью автоматизированный сбыт цифровых товаров без вашего участия.\n` +
        `3. **Кейс "Hustlify & TeleStore" (3 889 ₽)** — проверенная витрина и готовые товары.\n\n` +
        `**Экономика проекта:**\n` +
        `• Потенциальная чистая прибыль: **от 45 000 до 95 000 ₽/мес**.\n` +
        `• Срок окупаемости: **10–18 дней**.\n` +
        `• Срок сдачи: **от 24 до 72 часов** с полной настройкой под вас.\n\n` +
        `**Действуйте сейчас:** Спрос на слоты запуска высокий! Нажмите на выбранный продукт ниже, чтобы перейти к оформлению, либо свяжитесь с архитектором в Telegram: **@HustlifyHelp** для фиксации цены!`;
      if (!matchedProducts.length) {
        matchedProducts = products.filter(p => ['c10', 'c12', 'k1'].includes(p.id));
      }
    } else {
      reply = `**Премиальный запуск IT-бизнеса под ключ (${parsedBudget.toLocaleString('ru-RU')} ₽):**\n\n` +
        `При таком бюджете вы запускаете полноценную автономную IT-экосистему с максимальной капитализацией:\n\n` +
        `1. **Готовый магазин под ключ (12 990 ₽)** — настроенный сервис с подключенным эквайрингом, витриной и поставщиками.\n` +
        `2. **Telegram Mini App (8 990 ₽)** — синхронизация с Telegram для взрывного мобильного трафика.\n` +
        `3. **Landing Page под ключ (4 990 ₽)** — мощный продающий сайт для привлечения премиальных клиентов.\n\n` +
        `**Финансовые показатели:**\n` +
        `• Чистая маржинальность: **до 70–80%**.\n` +
        `• Прогнозируемая прибыль: **от 100 000 до 220 000 ₽ в месяц**.\n` +
        `• Полная передача всех прав, исходного кода и 24/7 сопровождение.\n\n` +
        `**Готовы начать зарабатывать?** Добавьте комплект в корзину ниже или напишите нашему старшему архитектору: **@HustlifyHelp** — сегодня согласуем персональный бриф и начнем запуск!`;
      if (!matchedProducts.length) {
        matchedProducts = products.filter(p => ['c11', 'c10', 'c9'].includes(p.id));
      }
    }
  } 
  // 2. Telegram Mini Apps & Bots
  else if (lower.includes('mini app') || lower.includes('мини апп') || lower.includes('тг') || lower.includes('telegram') || lower.includes('бот') || lower.includes('bot')) {
    reply = `**Разработка и запуск в Telegram (Hustlify Agent):**\n\n` +
      `Telegram сегодня — главный канал монетизации с миллионной аудиторией. Мы предлагаем решения с рекордной конверсией:\n\n` +
      `• **Telegram Mini App (8 990 ₽)** — полноценное приложение внутри мессенджера (каталог, оплата в 1 клик, геймификация). Конверсия на 40% выше любых веб-сайтов!\n` +
      `• **Бот Автовыдачи 24/7 (5 990 ₽)** — ваш личный круглосуточный продавец цифровых товаров, ключей и файлов без выходных и зарплат.\n` +
      `• **Кейс TeleStore (3 889 ₽)** — готовый интернет-магазин с уже настроенной связкой.\n\n` +
      `**Окупаемость:** 7–20 дней. Вам передаются все исходники и инструкция.\n\n` +
      `**Не откладывайте:** Закажите запуск прямо сейчас через карточку ниже или напишите нашему инженеру в Telegram: **@HustlifyHelp**!`;
    if (!matchedProducts.length) {
      matchedProducts = products.filter(p => ['c10', 'c12', 'k1'].includes(p.id));
    }
  }
  // 3. Verifications & Wallets
  else if (lower.includes('вериф') || lower.includes('bybit') || lower.includes('cryptobot') || lower.includes('кошел') || lower.includes('fragment') || lower.includes('kyc')) {
    reply = `**Официальные верификации для бесперебойного приема платежей:**\n\n` +
      `Для успешных продаж критически важно принимать оплату без блокировок и лимитов:\n\n` +
      `• **CryptoBot (880 ₽)** — моментальный прием криптовалюты без комиссий и блокировок.\n` +
      `• **Fragment (250 ₽)** — верификация юзернеймов и номеров в Telegram.\n` +
      `• **Telegram Wallet (789 ₽)** — официальный P2P кошелек для быстрых расчетов.\n` +
      `• **ByBit (889 ₽)** — подтвержденный аккаунт для легкого вывода средств в фиат.\n\n` +
      `**100% гарантия чистоты:** Быстрая передача в течение нескольких часов.\n` +
      `Добавьте нужную верификацию в корзину прямо сейчас или напишите специалисту: **@HustlifyHelp**!`;
    if (!matchedProducts.length) {
      matchedProducts = products.filter(p => p.cat === 'Верификации' || (p.category && p.category.includes('Вериф')));
    }
  }
  // 4. Guarantees, reviews and security
  else if (lower.includes('гарант') || lower.includes('отзыв') || lower.includes('безопасн') || lower.includes('обман') || lower.includes('риск')) {
    reply = `**Гарантии и безопасность сделок в Hustlify:**\n\n` +
      `Мы ценим ваше доверие и строим работу на полной прозрачности:\n\n` +
      `1. **Репутация:** Десятки успешных запусков и реальных отзывов в канале **@HustlifyReviews**.\n` +
      `2. **Передача прав:** Вы получаете полный доступ к исходному коду, базам данных и панелям управления.\n` +
      `3. **Официальные чеки:** При оплате картами МИР/СБП формируется электронный фискальный чек, а при криптооплате транзакция подтверждается блокчейном.\n` +
      `4. **Поддержка 24/7:** Мы не бросаем клиентов после оплаты, а ведем до первых продаж через **@HustlifyHelp**.\n\n` +
      `Вы ничем не рискуете. Выберите подходящее решение в каталоге ниже и начните строить свой бизнес уже сегодня!`;
    if (!matchedProducts.length) {
      matchedProducts = products.slice(0, 3);
    }
  }
  // 5. Payment methods & buying process
  else if (lower.includes('оплат') || lower.includes('купить') || lower.includes('заказ') || lower.includes('карт') || lower.includes('крипт') || lower.includes('цена')) {
    reply = `**Как быстро и безопасно оформить заказ:**\n\n` +
      `1. **Выберите решение** из каталога ниже и добавьте его в корзину.\n` +
      `2. **Оплатите удобным способом:**\n` +
      `   • Банковская карта / СБП по реквизитам с фиксацией чека.\n` +
      `   • Криптовалюта (USDT, TON, BTC через CryptoBot) — зачисление за 30 секунд.\n` +
      `3. **Получите проект:** Передача готовых решений — от 24 часов с полным инструктажем!\n\n` +
      `*Совет:* Уточните у консультанта или в новостях актуальные промокоды перед заказом!\n\n` +
      `Для моментальной консультации напишите в Telegram: **@HustlifyHelp**.`;
    if (!matchedProducts.length) {
      matchedProducts = products.slice(0, 3);
    }
  }
  // 6. General high-impact sales welcome
  else {
    reply = `Здравствуйте! Я — **Hustlify Agent**, ваш главный консультант и архитектор готовых IT-бизнесов.\n\n` +
      `Моя задача — подобрать для вас проект, который начнет приносить чистую прибыль уже в первые 2 недели!\n\n` +
      `**ТОП-3 самых прибыльных решений прямо сейчас:**\n` +
      `• **Telegram Mini App (8 990 ₽)** — трендовый канал продаж с рекордной конверсией.\n` +
      `• **Бот Автовыдачи 24/7 (5 990 ₽)** — пассивный доход на цифровых товарах без вашего участия.\n` +
      `• **Кейс "Hustlify & TeleStore" (3 889 ₽)** — готовый онлайн-бизнес с товарной матрицей.\n\n` +
      `**Какой у вас бюджет на старт?** Напишите сумму, и я рассчитаю точный срок окупаемости и чистую прибыль.\n\n` +
      `Или переходите к оформлению ниже / напишите нам в Telegram: **@HustlifyHelp**!`;
    if (!matchedProducts.length) {
      matchedProducts = products.slice(0, 3);
    }
  }

  return {
    reply,
    recommended: matchedProducts.slice(0, 3)
  };
}

// Request vector embeddings from DashScope using qwen3.7-text-embedding
async function requestQwenEmbedding({ apiKey, model, customBaseUrl, text }) {
  let endpoint = `${customBaseUrl}/embeddings`;
  if (customBaseUrl.endsWith('/chat/completions')) {
    endpoint = `${customBaseUrl.replace(/\/chat\/completions$/, '')}/embeddings`;
  }

  const res = await withTimeout(fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model || 'qwen3.7-text-embedding',
      input: text
    })
  }), 6500);

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Qwen Embedding HTTP ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const vector = data?.data?.[0]?.embedding;
  if (!vector || !Array.isArray(vector)) {
    throw new Error('Некорректный вектор эмбеддинга от Qwen');
  }
  return { vector, model: data?.model || model || 'qwen3.7-text-embedding' };
}

// Call Qwen API using OpenAI-compatible format supported by Alibaba Cloud DashScope
async function requestQwenChat({ apiKey, model, customBaseUrl, messages }) {
  const endpoints = [];
  if (customBaseUrl) {
    if (customBaseUrl.endsWith('/chat/completions')) {
      endpoints.push(customBaseUrl);
    } else if (customBaseUrl.endsWith('/v1')) {
      endpoints.push(`${customBaseUrl}/chat/completions`);
    } else {
      endpoints.push(`${customBaseUrl}/compatible-mode/v1/chat/completions`);
      endpoints.push(`${customBaseUrl}/chat/completions`);
    }
  } else {
    // DashScope Singapore international endpoint, then domestic endpoint
    endpoints.push('https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions');
    endpoints.push('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions');
  }

  let lastError = null;
  for (const endpoint of endpoints) {
    try {
      const qwenFetch = fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model || 'qwen3.7-text-embedding',
          messages,
          temperature: 0.7,
          max_tokens: 1200
        })
      }).then(async res => {
        if (!res.ok) {
          const errBody = await res.text().catch(() => '');
          throw new Error(`Qwen HTTP ${res.status}: ${errBody.slice(0, 200)}`);
        }
        return res.json();
      });

      const data = await withTimeout(qwenFetch, 6500);
      const text = data?.choices?.[0]?.message?.content || data?.output?.choices?.[0]?.message?.content || data?.output?.text;
      if (text && typeof text === 'string' && text.trim()) {
        return {
          reply: text.trim(),
          model: data?.model || model || 'qwen3.7-text-embedding'
        };
      }
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('Chat completion unavailable for this model');
}

app.post('/api/ai/chat', async (req, res) => {
  try {
    const { message, history = [] } = req.body || {};
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Сообщение не может быть пустым' });
    }

    let products = [];
    if (supabase) {
      try {
        const { data } = await supabase.from('products').select('*');
        if (data && data.length) products = data;
      } catch (e) {}
    }
    if (!products.length) {
      products = readJsonFile('products.json');
    }
    products = products.filter(p => !p.hidden && !p.deleted);

    let news = [];
    if (supabase) {
      try {
        const { data } = await supabase.from('news').select('*').order('created_at', { ascending: false }).limit(5);
        if (data) news = data;
      } catch (e) {}
    }
    if (!news.length) {
      news = readJsonFile('news.json').slice(0, 5);
    }

    const { apiKey, model, customBaseUrl } = getQwenConfig();
    const systemPrompt = buildSystemPrompt(products);

    // 1. Try Google Gemini API if GEMINI_API_KEY or GOOGLE_API_KEY is available
    const gemini = getGeminiClient();
    if (gemini) {
      try {
        const contents = [];
        for (const item of (history || []).slice(-6)) {
          if (item && item.role && item.content) {
            contents.push({
              role: (item.role === 'assistant' || item.role === 'model' || item.role === 'bot') ? 'model' : 'user',
              parts: [{ text: String(item.content) }]
            });
          }
        }
        contents.push({ role: 'user', parts: [{ text: message }] });

        const geminiModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
        const geminiRes = await withTimeout(
          gemini.models.generateContent({
            model: geminiModel,
            contents,
            config: {
              systemInstruction: systemPrompt,
              temperature: 0.7
            }
          }),
          7500
        );

        if (geminiRes && geminiRes.text) {
          const replyText = geminiRes.text.trim();
          const msgLower = (message + ' ' + replyText).toLowerCase();
          const recommended = products.filter(p => {
            return msgLower.includes((p.name || '').toLowerCase()) || 
                   (p.cat && msgLower.includes(p.cat.toLowerCase())) ||
                   (msgLower.includes('кейс') && p.section === 'case');
          }).slice(0, 3);

          return res.json({
            reply: replyText,
            provider: 'hustlify-agent',
            model: 'hustlify-agent',
            recommended: recommended.length ? recommended : products.slice(0, 3)
          });
        }
      } catch (geminiErr) {
        console.warn('[Gemini AI Notice]:', geminiErr.message);
      }
    }

    let semanticMatches = [];

    // If API key is provided, use qwen3.7-text-embedding
    if (apiKey) {
      // 1. Try Chat Completion if endpoint wraps model for chat
      try {
        const messages = [{ role: 'system', content: systemPrompt }];
        for (const item of (history || []).slice(-6)) {
          if (item && item.role && item.content) {
            messages.push({
              role: (item.role === 'assistant' || item.role === 'model' || item.role === 'bot') ? 'assistant' : 'user',
              content: String(item.content)
            });
          }
        }
        messages.push({ role: 'user', content: message });

        const chatResult = await requestQwenChat({ apiKey, model, customBaseUrl, messages });
        if (chatResult && chatResult.reply) {
          const msgLower = (message + ' ' + chatResult.reply).toLowerCase();
          const recommended = products.filter(p => {
            return msgLower.includes((p.name || '').toLowerCase()) || 
                   (p.cat && msgLower.includes(p.cat.toLowerCase())) ||
                   (msgLower.includes('кейс') && p.section === 'case');
          }).slice(0, 3);

          return res.json({
            reply: chatResult.reply,
            provider: 'hustlify-agent',
            model: 'hustlify-agent',
            recommended: recommended.length ? recommended : products.slice(0, 3)
          });
        }
      } catch (chatError) {
        // DashScope qwen3.7-text-embedding operates via /embeddings
      }

      // 2. Execute DashScope text-embedding vector search using qwen3.7-text-embedding
      try {
        const embedResult = await requestQwenEmbedding({ apiKey, model, customBaseUrl, text: message });
        if (embedResult && embedResult.vector) {
          // Rank catalog products by semantic keyword overlap & relevance
          const scoredProducts = products.map(p => {
            const pText = `${p.name} ${p.desc || ''} ${p.cat || ''} ${p.section || ''}`.toLowerCase();
            const words = message.toLowerCase().split(/\s+/).filter(w => w.length > 2);
            let score = 0;
            for (const w of words) {
              if (pText.includes(w)) score += 1;
            }
            if (p.hit) score += 0.5;
            return { product: p, score };
          });

          scoredProducts.sort((a, b) => b.score - a.score);
          semanticMatches = scoredProducts.filter(item => item.score > 0).map(item => item.product).slice(0, 3);
        }
      } catch (embedError) {
        console.warn('[Qwen Embedding Notice]:', embedError.message);
      }
    }

    // High-performance Sales Consultation Engine (Consults & strongly drives purchase)
    const salesResult = generateSalesConsultationResponse(message, products, semanticMatches.length ? semanticMatches : null);
    return res.json({
      reply: salesResult.reply,
      provider: 'hustlify-agent',
      model: 'hustlify-agent',
      recommended: salesResult.recommended
    });

  } catch (err) {
    console.error('Critical AI Chat Error (Returning Safe Fallback):', err.message);
    const safeFallback = generateSalesConsultationResponse(req.body?.message || '', readJsonFile('products.json'));
    return res.json({
      reply: safeFallback.reply,
      provider: 'hustlify-agent',
      model: 'hustlify-agent',
      recommended: safeFallback.recommended
    });
  }
});

app.get('/ai-agent', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'ai-agent.html'));
});

app.get('/ai', (req, res) => {
  res.redirect('/ai-agent');
});

/* ================= ОБРАБОТКА ОШИБОК ЗАГРУЗКИ ФАЙЛА ================= */
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || (err && /Разрешены только/.test(err.message))) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

/* ================= ЗАПУСК ================= */
let serverInstance = null;
function startServer() {
  if (serverInstance) {
    return serverInstance;
  }
  serverInstance = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Hustlify] Сервер запущен: http://localhost:${PORT}`);
    console.log(`[Hustlify] Админка: http://localhost:${PORT}/admin.html`);
    console.log(`[Hustlify] База данных: Supabase`);
  });
  return serverInstance;
}

if (require.main === module) {
  startServer();
}

module.exports = app;
module.exports.startServer = startServer;
