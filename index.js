/* =====================================================================
 * hustlify-shop — сервер (Express) + админ API + промокоды + заказы
 * ---------------------------------------------------------------------
 * Ранее файл содержал только фрагмент промокодов без инициализации
 * приложения (app, supabase, readJsonFile были не определены). Ниже —
 * полноценный рабочий сервер:
 *   • статика из public/, JSON-хранилище в data/ (или DATA_DIR),
 *   • Supabase — если заданы SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY,
 *   • авторизация админа (ADMIN_LOGIN / ADMIN_PASSWORD_HASH, JWT-куки),
 *   • CRUD товаров/новостей/проектов/партнёров/реквизитов/заказов,
 *   • промокоды: рулетка, опрос, проверка, применение к заказам,
 *   • админ API промокодов (одноразовые, многоразовые, со сроком действия).
 * ===================================================================== */
require('dotenv').config();

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');

const app = express();
app.use(express.json({
  limit: '2mb',
  verify: (req, res, buffer) => { req.rawBody = Buffer.from(buffer); }
}));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.set('trust proxy', true); // корректный req.ip за Render/NGINX/Vercel

const uploadReceipt = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
    if (!allowedTypes.includes(file.mimetype)) {
      return callback(new Error('Поддерживаются JPG, PNG, WEBP, GIF и PDF'));
    }
    callback(null, true);
  }
}).single('receipt');

const heroVideoUploadDir = path.join(__dirname, 'public', 'uploads', 'video');
const uploadHeroVideo = multer({
  storage: multer.diskStorage({
    destination: (req, file, callback) => {
      try {
        fs.mkdirSync(heroVideoUploadDir, { recursive: true });
        callback(null, heroVideoUploadDir);
      } catch (error) {
        callback(error);
      }
    },
    filename: (req, file, callback) => callback(null, `${crypto.randomBytes(16).toString('hex')}.tmp`)
  }),
  limits: { fileSize: 150 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    if (file.mimetype !== 'video/mp4') return callback(new Error('Поддерживается только видео MP4'));
    callback(null, true);
  }
}).single('video');

/* ================= ХРАНИЛИЩЕ (JSON-файлы) ================= */
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, 'data');

function readJsonFile(name) {
  const file = path.join(DATA_DIR, name);
  try {
    if (!fs.existsSync(file)) return [];
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error(`readJsonFile(${name}) error:`, e.message);
    return [];
  }
}

function writeJsonFile(name, data) {
  const file = path.join(DATA_DIR, name);
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error(`writeJsonFile(${name}) error:`, e.message);
  }
}

/* ================= SUPABASE (опционально) ================= */
let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  try {
    const { createClient } = require('@supabase/supabase-js');
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false }
    });
  } catch (e) {
    console.error('Supabase init failed:', e.message);
  }
}

/* ================= Telegram-уведомления ================= */
let tg = {};
try {
  tg = require('./telegram.js');
} catch (e) {
  console.error('telegram.js not loaded:', e.message);
}
function notifyNewOrderSafe(order) {
  try { if (tg.notifyNewOrder) Promise.resolve(tg.notifyNewOrder(order)).catch(() => {}); } catch (e) {}
}
function notifyOrderPaidSafe(order) {
  try { if (tg.notifyOrderPaid) Promise.resolve(tg.notifyOrderPaid(order)).catch(() => {}); } catch (e) {}
}
function notifyReceiptUploadedSafe(order) {
  try { if (tg.notifyReceiptUploaded) Promise.resolve(tg.notifyReceiptUploaded(order)).catch(() => {}); } catch (e) {}
}

/* ================= СТАТИКА ================= */
app.use(express.static(path.join(__dirname, 'public')));

/* ================= АДМИН-АВТОРИЗАЦИЯ ================= */
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');

function adminToken(res, login) {
  const token = jwt.sign({ admin: login }, JWT_SECRET, { expiresIn: '12h' });
  res.cookie('admin_token', token, {
    httpOnly: true, sameSite: 'lax', maxAge: 12 * 60 * 60 * 1000
  });
  return token;
}

function requireAdmin(req, res, next) {
  const token = req.cookies && req.cookies.admin_token;
  if (!token) return res.status(401).json({ error: 'unauthorized' });
  try {
    jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: 'unauthorized' });
  }
}

app.post('/api/admin/login', (req, res) => {
  const { login, password } = req.body || {};
  const envLogin = process.env.ADMIN_LOGIN;
  const envHash = process.env.ADMIN_PASSWORD_HASH;
  if (!envLogin || !envHash) {
    return res.status(500).json({ error: 'Админ не настроен: заполните ADMIN_LOGIN и ADMIN_PASSWORD_HASH в .env' });
  }
  let ok = false;
  try { ok = login === envLogin && bcrypt.compareSync(String(password || ''), envHash); }
  catch (e) { ok = false; }
  if (!ok) return res.status(401).json({ error: 'Неверный логин или пароль' });
  adminToken(res, login);
  res.json({ ok: true });
});

app.get('/api/admin/me', requireAdmin, (req, res) => res.json({ ok: true }));

app.post('/api/admin/logout', (req, res) => {
  res.clearCookie('admin_token');
  res.json({ ok: true });
});

/* ================= ОБЩИЕ УТИЛИТЫ ДЛЯ ЗАПИСЕЙ ================= */
function newId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
}

// Нормализация товара: поле «категории» может называться cat или category
function getCat(item) { return item.cat != null ? item.cat : (item.category != null ? item.category : ''); }
function setCat(item, value) { item.cat = value || ''; item.category = value || ''; return item; }

/**
 * Универсальный CRUD для JSON-коллекций с опциональным зеркалом в Supabase.
 * table — имя таблицы Supabase (или null), file — имя json-файла,
 * prefix — префикс id, transform(body) — маппинг полей клиента → хранилище.
 */
async function readCollection(table, file) {
  if (!table || !supabase) return readJsonFile(file);
  const { data, error } = await supabase.from(table).select('*').order('created_at', { ascending: false });
  if (error) {
    if (['PGRST205', '42P01'].includes(error.code)) {
      console.warn(`Supabase table ${table} is missing; using ${file} until migration is applied`);
      return readJsonFile(file);
    }
    throw error;
  }
  return (data || []).map(item => itemFromDb(table, item));
}

function mountCollection({ urlPath, table, file, prefix, transform, publicGet = false }) {
  const listAll = () => readCollection(table, file);

  if (publicGet) {
    app.get(`/api/${urlPath}`, async (req, res) => {
      try {
        res.json(await listAll());
      } catch (e) {
        console.error(`GET /api/${urlPath} storage error:`, e.message);
        res.status(503).json({ error: 'Данные временно недоступны' });
      }
    });
  }

  app.get(`/api/admin/${urlPath}`, requireAdmin, async (req, res) => {
    try {
      res.json(await listAll());
    } catch (e) {
      console.error(`GET /api/admin/${urlPath} storage error:`, e.message);
      res.status(503).json({ error: 'Данные временно недоступны' });
    }
  });

  app.post(`/api/admin/${urlPath}`, requireAdmin, async (req, res) => {
    try {
      const item = transform(req.body || {});
      if (!item.id) item.id = newId(prefix);
      if (table && supabase) {
        const { error } = await supabase.from(table).upsert(dbFromItem(table, item));
        if (error) throw error;
      }
      const items = (await listAll()).filter(existing => String(existing.id) !== String(item.id));
      items.unshift(item);
      writeJsonFile(file, items);
      res.json(item);
    } catch (e) {
      console.error(`POST /api/admin/${urlPath} storage error:`, e.message);
      if (table && supabase) return res.status(503).json({ error: 'Не удалось сохранить в базе данных' });
      res.status(400).json({ error: e.message || 'Не удалось сохранить' });
    }
  });

  app.put(`/api/admin/${urlPath}/:id`, requireAdmin, async (req, res) => {
    try {
      const items = await listAll();
      const idx = items.findIndex(x => String(x.id) === String(req.params.id));
      if (idx === -1) return res.status(404).json({ error: 'Не найдено' });
      const updated = transform(Object.assign({}, items[idx], req.body || {}, { id: items[idx].id }));
      if (table && supabase) {
        const { error } = await supabase.from(table).upsert(dbFromItem(table, updated));
        if (error) throw error;
      }
      items[idx] = updated;
      writeJsonFile(file, items);
      res.json(updated);
    } catch (e) {
      console.error(`PUT /api/admin/${urlPath} storage error:`, e.message);
      if (table && supabase) return res.status(503).json({ error: 'Не удалось сохранить в базе данных' });
      res.status(400).json({ error: e.message || 'Не удалось обновить' });
    }
  });

  app.delete(`/api/admin/${urlPath}/:id`, requireAdmin, async (req, res) => {
    let items;
    try {
      items = await listAll();
    } catch (e) {
      console.error(`DELETE /api/admin/${urlPath} storage error:`, e.message);
      return res.status(503).json({ error: 'Данные временно недоступны' });
    }
    const next = items.filter(x => String(x.id) !== String(req.params.id));
    if (next.length === items.length) return res.status(404).json({ error: 'Не найдено' });
    if (table && supabase) {
      const { error } = await supabase.from(table).delete().eq('id', req.params.id);
      if (error) return res.status(503).json({ error: 'Не удалось удалить из базы данных' });
    }
    writeJsonFile(file, next);
    res.json({ ok: true });
  });
}

// Маппинг записи в формат таблицы Supabase (используется только для products)
function dbFromItem(table, item) {
  if (table === 'products') {
    return {
      id: item.id, name: item.name, price: item.price, category: getCat(item),
      old_price: item.old || 0, description: item.desc || '', section: item.section || 'catalog',
      img: item.img || '', icon: item.icon || 'star', hit: !!item.hit,
      hidden: !!item.hidden, deleted: !!item.deleted
    };
  }
  if (table === 'news') {
    return {
      id: item.id, tag: item.tag || '', stamp: item.stamp || '', title: item.title || '',
      headline: item.headline || '', body: item.body || '', created_at: item.created_at || item.createdAt || new Date().toISOString()
    };
  }
  if (table === 'projects') {
    return {
      id: item.id, title: item.title || '', type: item.type || 'telegram', url: item.url || '',
      button_text: item.btn || item.btnText || item.buttonText || item.button_text || '',
      portfolio_url: item.portfolio || item.portfolioUrl || item.portfolio_url || '',
      image: item.image || '', hidden: !!item.hidden, short_desc: item.shortDesc || item.short_desc || '',
      full_desc: item.fullDesc || item.full_desc || '', created_at: item.created_at || new Date().toISOString()
    };
  }
  if (table === 'partners') {
    return { id: item.id, name: item.name || '', url: item.url || '', logo: item.logo || '', created_at: item.created_at || new Date().toISOString() };
  }
  return item;
}

function itemFromDb(table, row) {
  if (table === 'products') {
    return Object.assign({}, row, {
      cat: row.category || '',
      old: row.old_price == null ? 0 : Number(row.old_price),
      desc: row.description || '',
      hidden: !!row.hidden,
      deleted: !!row.deleted
    });
  }
  if (table === 'news') {
    return Object.assign({}, row, { createdAt: row.created_at || row.createdAt || null });
  }
  if (table === 'projects') {
    const buttonText = row.button_text || row.btn || row.btnText || row.buttonText || '';
    const portfolioUrl = row.portfolio_url || row.portfolio || row.portfolioUrl || '';
    return Object.assign({}, row, {
      btn: buttonText, btnText: buttonText, buttonText,
      portfolio: portfolioUrl, portfolioUrl,
      shortDesc: row.short_desc || '', fullDesc: row.full_desc || ''
    });
  }
  return row;
}

/* ================= ТОВАРЫ ================= */
mountCollection({
  urlPath: 'products', table: 'products', file: 'products.json', prefix: 'p', publicGet: true,
  transform: (b) => {
    const item = {
      id: b.id,
      name: String(b.name || '').trim(),
      section: b.section === 'case' ? 'case' : 'catalog',
      price: Number(b.price) || 0,
      old: Number(b.old) || 0,
      img: String(b.img || '').trim(),
      desc: String(b.desc || '').trim(),
      icon: String(b.icon || '').trim(),
      hit: !!b.hit
    };
    setCat(item, b.cat != null ? b.cat : b.category);
    if (!item.name) throw new Error('Укажите название товара');
    return item;
  }
});

/* ================= НОВОСТИ ================= */
mountCollection({
  urlPath: 'news', table: 'news', file: 'news.json', prefix: 'n', publicGet: true,
  transform: (b) => ({
    id: b.id,
    tag: String(b.tag || '').trim(),
    stamp: String(b.stamp || '').trim(),
    title: String(b.title || '').trim(),
    headline: String(b.headline || '').trim(),
    body: String(b.body || '').trim(),
    created_at: b.created_at || new Date().toISOString()
  })
});

/* ================= ПРОЕКТЫ ================= */
mountCollection({
  urlPath: 'projects', table: 'projects', file: 'projects.json', prefix: 'proj', publicGet: true,
  transform: (b) => ({
    id: b.id,
    title: String(b.title || '').trim(),
    type: b.type === 'site' ? 'site' : 'telegram',
    url: String(b.url || '').trim(),
    btn: String(b.btn || b.btnText || b.buttonText || b.button_text || '').trim(),
    portfolio: String(b.portfolio || b.portfolioUrl || b.portfolio_url || '').trim(),
    image: String(b.image || '').trim(),
    hidden: !!b.hidden,
    shortDesc: String(b.shortDesc || '').trim(),
    fullDesc: String(b.fullDesc || '').trim(),
    created_at: b.created_at || new Date().toISOString()
  })
});

/* ================= ПАРТНЁРЫ ================= */
mountCollection({
  urlPath: 'partners', table: 'partners', file: 'partners.json', prefix: 'pt', publicGet: true,
  transform: (b) => ({
    id: b.id,
    name: String(b.name || '').trim(),
    url: String(b.url || '').trim(),
    logo: String(b.logo || '').trim(),
    created_at: b.created_at || new Date().toISOString()
  })
});

/* ================= РЕКВИЗИТЫ (один объект, а не список) ================= */
const REQUISITES_DEFAULTS = {
  card_number: '', bank_name: '', recipient_name: '', comment: '',
  self_employed_name: '', self_employed_inn: ''
};

function readRequisites() {
  try {
    const file = path.join(DATA_DIR, 'requisites.json');
    if (fs.existsSync(file)) {
      const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
      return Object.assign({}, REQUISITES_DEFAULTS, Array.isArray(raw) ? (raw[0] || {}) : raw);
    }
  } catch (e) {}
  return Object.assign({}, REQUISITES_DEFAULTS);
}

async function getRequisites() {
  if (supabase) {
    const { data, error } = await supabase.from('requisites').select('*').eq('id', 1).maybeSingle();
    if (error) {
      if (['PGRST205', '42P01'].includes(error.code)) return readRequisites();
      throw error;
    }
    if (data) return Object.assign({}, REQUISITES_DEFAULTS, data);
  }
  return readRequisites();
}

app.get('/api/requisites', async (req, res) => {
  try { res.json(await getRequisites()); }
  catch (e) { console.error('GET /api/requisites storage error:', e.message); res.status(503).json({ error: 'Реквизиты временно недоступны' }); }
});
app.get('/api/admin/requisites', requireAdmin, async (req, res) => {
  try { res.json(await getRequisites()); }
  catch (e) { console.error('GET /api/admin/requisites storage error:', e.message); res.status(503).json({ error: 'Реквизиты временно недоступны' }); }
});

app.put('/api/admin/requisites', requireAdmin, async (req, res) => {
  try {
    const b = req.body || {};
    const rq = Object.assign({}, await getRequisites());
    for (const k of Object.keys(REQUISITES_DEFAULTS)) {
      if (b[k] != null) rq[k] = String(b[k]);
    }
    rq.updated_at = new Date().toISOString();
    if (supabase) {
      const { error } = await supabase.from('requisites').upsert({
        id: 1, card_number: rq.card_number, bank_name: rq.bank_name,
        recipient_name: rq.recipient_name, comment: rq.comment,
        self_employed_name: rq.self_employed_name, self_employed_inn: rq.self_employed_inn,
        updated_at: rq.updated_at
      });
      if (error) throw error;
    } else {
      writeJsonFile('requisites.json', rq);
    }
    res.json(rq);
  } catch (e) {
    console.error('PUT /api/admin/requisites storage error:', e.message);
    res.status(503).json({ error: 'Не удалось сохранить реквизиты' });
  }
});

/* ================= КУРСЫ ЗВЁЗД / PREMIUM =================
 * Админка отдаёт/принимает структурированный объект:
 *   { stars: {price, old, hidden, deleted}, premium: {3:{...},6:{...},9:{...},12:{...}} }
 * Хранится в data/rates.json; цены дополнительно синхронизируются с товарами.
 * ========================================================== */
const RATE_IDS = { stars: 'tg_stars', 3: 'tg_premium_3', 6: 'tg_premium_6', 9: 'tg_premium_9', 12: 'tg_premium_12' };

function readRates(products = readJsonFile('products.json')) {
  let saved = {};
  try {
    const file = path.join(DATA_DIR, 'rates.json');
    if (fs.existsSync(file)) saved = JSON.parse(fs.readFileSync(file, 'utf8')) || {};
  } catch (e) {}
  const byId = id => products.find(p => String(p.id) === id) || {};
  const mk = (id, defPrice, defOld) => {
    const p = byId(id);
    const s = saved[id] || {};
    return {
      price: p.price != null ? Number(p.price) : (s.price != null ? s.price : defPrice),
      old: p.old != null ? Number(p.old) : (s.old != null ? s.old : defOld),
      hidden: !!(p.hidden || s.hidden),
      deleted: !!(p.deleted || s.deleted)
    };
  };
  return {
    stars: mk('tg_stars', 2, 3),
    premium: { 3: mk('tg_premium_3', 990, 1290), 6: mk('tg_premium_6', 1790, 2290), 9: mk('tg_premium_9', 2490, 3190), 12: mk('tg_premium_12', 2990, 3990) }
  };
}

app.get('/api/rates', async (req, res) => {
  try {
    res.json(readRates(await readCollection('products', 'products.json')));
  } catch (e) {
    console.error('GET /api/rates storage error:', e.message);
    res.status(503).json({ error: 'Данные временно недоступны' });
  }
});

app.get('/api/admin/rates', requireAdmin, async (req, res) => {
  try {
    res.json(readRates(await readCollection('products', 'products.json')));
  } catch (e) {
    console.error('GET /api/admin/rates storage error:', e.message);
    res.status(503).json({ error: 'Данные временно недоступны' });
  }
});

app.put('/api/admin/rates', requireAdmin, async (req, res) => {
  try {
    const b = req.body || {};
    const saved = {};
    const items = await readCollection('products', 'products.json');
    const entries = [
      ['stars', b.stars],
      [3, b.premium && b.premium[3]],
      [6, b.premium && b.premium[6]],
      [9, b.premium && b.premium[9]],
      [12, b.premium && b.premium[12]]
    ];
    for (const [key, v] of entries) {
      if (!v) continue;
      const rec = {
        price: Number(v.price) || 0,
        old: Number(v.old) || 0,
        hidden: !!v.hidden,
        deleted: !!v.deleted
      };
      saved[RATE_IDS[key]] = rec;
      // синхронизируем с товарами, чтобы изменения были видны в магазине
      const idx = items.findIndex(p => String(p.id) === RATE_IDS[key]);
      if (idx !== -1) {
        items[idx].price = rec.price;
        items[idx].old = rec.old;
        items[idx].hidden = rec.hidden;
        items[idx].deleted = rec.deleted;
      }
    }
    if (supabase) {
      for (const item of items.filter(product => Object.values(RATE_IDS).includes(String(product.id)))) {
        const { error } = await supabase.from('products').upsert(dbFromItem('products', item));
        if (error) throw error;
      }
    }
    writeJsonFile('rates.json', saved);
    writeJsonFile('products.json', items);
    res.json(readRates(items));
  } catch (e) {
    console.error('PUT /api/admin/rates error:', e);
    res.status(supabase ? 503 : 400).json({ error: 'Не удалось сохранить курсы' });
  }
});

/* ================= ЗАКАЗЫ ================= */
function orderTotal(o) {
  return Number(o.total != null ? o.total : (o.amount || 0));
}

async function getOrderById(id) {
  if (supabase) {
    const { data, error } = await supabase.from('orders').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    if (data) return Object.assign({}, data, { total: orderTotal(data) });
  }
  const order = readJsonFile('orders.json').find(item => String(item.id) === String(id));
  return order ? Object.assign({}, order, { total: orderTotal(order) }) : null;
}

async function getOrders() {
  if (supabase) {
    const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(order => Object.assign({}, order, { total: orderTotal(order) }));
  }
  return readJsonFile('orders.json').map(order => Object.assign({}, order, { total: orderTotal(order) }));
}

app.get('/api/admin/orders', requireAdmin, async (req, res) => {
  try {
    res.json(await getOrders());
  } catch (e) {
    console.error('GET /api/admin/orders storage error:', e.message);
    res.status(503).json({ error: 'Не удалось загрузить заказы из базы данных' });
  }
});

app.put('/api/admin/orders/:id', requireAdmin, async (req, res) => {
  const status = req.body && req.body.status;
  if (!['pending', 'moderation', 'paid', 'canceled'].includes(status)) {
    return res.status(400).json({ error: 'Недопустимый статус' });
  }
  try {
    let order;
    if (supabase) {
      const { data, error } = await supabase.from('orders').update({ status }).eq('id', req.params.id).select('*').maybeSingle();
      if (error) throw error;
      order = data;
    } else {
      const orders = readJsonFile('orders.json');
      const idx = orders.findIndex(item => String(item.id) === String(req.params.id));
      if (idx !== -1) {
        orders[idx].status = status;
        orders[idx].updated_at = new Date().toISOString();
        writeJsonFile('orders.json', orders);
        order = orders[idx];
      }
    }
    if (!order) return res.status(404).json({ error: 'Заказ не найден' });
    if (status === 'paid') notifyOrderPaidSafe(order);
    res.json(Object.assign({ total: orderTotal(order) }, order));
  } catch (e) {
    console.error('PUT /api/admin/orders storage error:', e.message);
    res.status(503).json({ error: 'Не удалось обновить заказ' });
  }
});

app.get('/api/orders/:id', async (req, res) => {
  try {
    const order = await getOrderById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Заказ не найден' });
    const items = Array.isArray(order.items) ? order.items : [];
    res.json({
      id: order.id,
      itemTitle: items.map(item => item.name || item.id).join(', '),
      amount: orderTotal(order),
      status: order.status
    });
  } catch (e) {
    console.error('GET /api/orders/:id storage error:', e.message);
    res.status(503).json({ error: 'Не удалось загрузить заказ' });
  }
});

app.post('/api/orders', async (req, res) => {
  try {
    const { items, contact, promoCode } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Корзина пуста' });
    }
    const products = await readCollection('products', 'products.json');
    let itemsTotal = 0;
    const lines = [];
    for (const it of items) {
      const p = products.find(x => String(x.id) === String(it.id));
      if (!p) return res.status(400).json({ error: 'Товар не найден: ' + it.id });
      const qty = Math.max(1, Number(it.qty) || 1);
      const unit = Number(p.price) || 0;
      itemsTotal += unit * qty;
      lines.push({
        id: p.id, name: p.name, price: unit, qty,
        stars: it.stars || null, months: it.months || null,
        target: it.target || null, details: it.details || null
      });
    }

    // Промокод: проверяем на сервере, размер скидки берём только из базы
    let discountPercent = 0;
    let appliedCode = null;
    if (promoCode) {
      const code = String(promoCode).toUpperCase().trim();
      const found = await findPromo(code);
      const err = checkPromo(found && found.promo);
      if (err) return res.status(400).json({ error: err });
      discountPercent = Number(found.promo.discount) || 0;
      appliedCode = code;
    }

    const total = Math.max(0, Math.round(itemsTotal * (100 - discountPercent) / 100));
    const order = {
      id: 'hustlify_' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex'),
      items: lines,
      contact: String(contact || '').trim(),
      items_total: itemsTotal,
      discount_percent: discountPercent,
      promo_code: appliedCode,
      amount: total,
      total,
      status: 'pending',
      created_at: new Date().toISOString()
    };
    if (supabase) {
      const { error } = await supabase.from('orders').insert([{
        id: order.id, items: order.items, contact: order.contact,
        items_total: Math.round(order.items_total), total: order.total,
        promo_code: order.promo_code,
        discount_percent: order.discount_percent, status: 'pending',
        created_at: order.created_at
      }]);
      if (error) {
        console.error('POST /api/orders database insert failed:', error.message);
        return res.status(503).json({ error: 'Не удалось сохранить заказ. Попробуйте ещё раз' });
      }
    } else {
      const orders = readJsonFile('orders.json');
      orders.unshift(order);
      writeJsonFile('orders.json', orders);
    }
    if (appliedCode) await consumePromo(appliedCode, order.id);
    notifyNewOrderSafe(order);
    res.json(order);
  } catch (e) {
    console.error('POST /api/orders error:', e);
    res.status(500).json({ error: 'Не удалось создать заказ' });
  }
});

function getRollyPayConfig() {
  return {
    apiKey: process.env.ROLLYPAY_API_KEY,
    signingSecret: process.env.ROLLYPAY_SIGNING_SECRET,
    terminalId: process.env.ROLLYPAY_TERMINAL_ID
  };
}

async function createRollyPayInvoice(order, req) {
  const config = getRollyPayConfig();
  if (!config.apiKey || !config.terminalId) {
    throw new Error('RollyPay не настроен: проверьте переменные окружения');
  }

  const amount = Number(order.total != null ? order.total : order.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Некорректная сумма заказа');
  const baseUrl = String(process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');
  const redirectBase = `${baseUrl}/payment-success.html?order=${encodeURIComponent(order.id)}`;
  const payload = {
    amount: amount.toFixed(2),
    order_id: String(order.id),
    payment_currency: 'RUB',
    description: `Заказ ${order.id} Hustlify`,
    terminal_id: config.terminalId,
    redirect_url: redirectBase,
    success_redirect_url: redirectBase,
    fail_redirect_url: `${baseUrl}/payment-fail.html?order=${encodeURIComponent(order.id)}`,
    metadata: { order_id: String(order.id) }
  };
  if (order.contact) payload.customer_id = String(order.contact).slice(0, 100);

  const response = await fetch('https://rollypay.io/api/v1/payments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': config.apiKey },
    body: JSON.stringify(payload)
  });
  const result = await response.json().catch(() => ({}));
  const payUrl = result.pay_url || result.url;
  if (!response.ok || !payUrl) {
    console.error('RollyPay invoice request failed:', response.status, result.error || result.message || 'invalid response');
    throw new Error(result.error || result.message || 'Не удалось создать платёж RollyPay');
  }
  return Object.assign({}, result, { pay_url: payUrl });
}

app.post(['/api/payments/rollypay/create', '/api/payments/create'], async (req, res) => {
  const { orderId } = req.body || {};
  if (!orderId) return res.status(400).json({ error: 'Не указан orderId' });

  try {
    const config = getRollyPayConfig();
    if (!config.apiKey || !config.terminalId) {
      return res.status(503).json({ error: 'Платёжный шлюз временно не настроен' });
    }

    let order = null;
    if (supabase) {
      const { data, error } = await supabase.from('orders').select('*').eq('id', orderId).maybeSingle();
      if (error) console.error('RollyPay order lookup failed:', error.message);
      else order = data;
    }
    if (!order) order = readJsonFile('orders.json').find(item => String(item.id) === String(orderId));
    if (!order) return res.status(404).json({ error: 'Заказ не найден' });
    if (order.status === 'paid' || order.status === 'canceled') {
      return res.status(409).json({ error: 'Заказ уже завершён' });
    }

    const payment = await createRollyPayInvoice(order, req);
    const paymentInfo = {
      provider: 'rollypay',
      paymentId: payment.payment_id || payment.id || null,
      payUrl: payment.pay_url,
      amount: payment.amount || order.total || order.amount,
      status: payment.status || 'created'
    };
    if (supabase) {
      const { error } = await supabase.from('orders').update({ payment: paymentInfo }).eq('id', orderId);
      if (error) console.error('RollyPay payment state sync failed:', error.message);
    }
    const orders = readJsonFile('orders.json');
    const orderIndex = orders.findIndex(item => String(item.id) === String(orderId));
    if (orderIndex !== -1) {
      orders[orderIndex].payment = paymentInfo;
      writeJsonFile('orders.json', orders);
    }
    res.json({ success: true, payUrl: payment.pay_url, paymentId: paymentInfo.paymentId });
  } catch (e) {
    console.error('RollyPay invoice creation failed:', e.message);
    res.status(502).json({ error: e.message || 'Не удалось создать платёж' });
  }
});

app.post('/api/webhooks/rollypay', async (req, res) => {
  const config = getRollyPayConfig();
  const signature = String(req.get('x-signature') || req.get('signature') || '').replace(/^sha256=/i, '').trim();
  const timestamp = String(req.get('x-timestamp') || req.get('timestamp') || '').trim();
  if (!config.signingSecret || !signature || !timestamp || !req.rawBody) {
    return res.status(401).json({ error: 'Webhook signature is required' });
  }

  const expected = crypto.createHmac('sha256', config.signingSecret)
    .update(`${timestamp}.${req.rawBody.toString('utf8')}`)
    .digest();
  const supplied = /^[a-f\d]{64}$/i.test(signature) ? Buffer.from(signature, 'hex') : Buffer.from(signature, 'base64');
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(expected, supplied)) {
    return res.status(403).json({ error: 'Invalid signature' });
  }

  try {
    const payload = req.body && typeof req.body === 'object' ? req.body : JSON.parse(req.rawBody.toString('utf8'));
    const data = payload.data || payload.payment || {};
    const status = String(payload.status || data.status || '').toLowerCase();
    const event = String(payload.event_type || payload.event || payload.type || '').toLowerCase();
    const orderId = payload.order_id || payload.orderId || data.order_id || data.orderId || (payload.metadata && payload.metadata.order_id);
    if (!orderId) return res.status(400).json({ error: 'Webhook order_id is required' });

    let order;
    try {
      order = await getOrderById(orderId);
    } catch (e) {
      console.error('RollyPay webhook order lookup failed:', e.message);
      return res.status(503).json({ error: 'Заказ временно недоступен' });
    }
    const orders = supabase ? [] : readJsonFile('orders.json');
    const orderIndex = orders.findIndex(item => String(item.id) === String(orderId));
    if (!order && orderIndex !== -1) order = orders[orderIndex];
    if (!order) return res.status(404).json({ error: 'Заказ не найден' });

    const paid = status === 'paid' || event === 'payment.paid' || event === 'paid';
    const canceled = ['canceled', 'cancelled', 'expired'].includes(status) || ['payment.canceled', 'payment.cancelled', 'payment.expired'].includes(event);
    if (paid || canceled) {
      const nextStatus = paid ? 'paid' : 'canceled';
      const amount = payload.amount == null ? data.amount : payload.amount;
      const expectedAmount = Number(order.total != null ? order.total : order.amount);
      if (paid && amount != null && Math.round(Number(amount) * 100) !== Math.round(expectedAmount * 100)) {
        return res.status(400).json({ error: 'Payment amount does not match order' });
      }
      const wasPaid = order.status === 'paid';
      const paymentInfo = {
        provider: 'rollypay',
        paymentId: payload.payment_id || data.payment_id || payload.id || data.id || null,
        amount: amount == null ? expectedAmount : amount,
        currency: payload.currency || data.currency || 'RUB',
        status: nextStatus
      };
      if (supabase) {
        const { error } = await supabase.from('orders').update({
          status: nextStatus,
          payment: paymentInfo,
          ...(paid ? { paid_at: new Date().toISOString() } : {})
        }).eq('id', orderId);
        if (error) throw error;
      }
      if (orderIndex !== -1) {
        orders[orderIndex].status = nextStatus;
        orders[orderIndex].payment = paymentInfo;
        if (paid) orders[orderIndex].paid_at = new Date().toISOString();
        writeJsonFile('orders.json', orders);
        order = orders[orderIndex];
      } else {
        order.status = nextStatus;
        order.payment = paymentInfo;
      }
      if (paid && !wasPaid) notifyOrderPaidSafe(order);
    }
    res.status(200).send('OK');
  } catch (e) {
    console.error('RollyPay webhook processing failed:', e.message);
    res.status(503).json({ error: 'Webhook processing error' });
  }
});

app.post('/api/orders/:id/receipt', (req, res) => {
  uploadReceipt(req, res, async (uploadError) => {
    if (uploadError) {
      const status = uploadError instanceof multer.MulterError && uploadError.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      return res.status(status).json({ error: uploadError.message });
    }
    if (!req.file) return res.status(400).json({ error: 'Прикрепите файл чека' });

    try {
      const order = await getOrderById(req.params.id);
      if (!order) return res.status(404).json({ error: 'Заказ не найден' });
      const orders = supabase ? null : readJsonFile('orders.json');
      const index = orders ? orders.findIndex(item => String(item.id) === String(req.params.id)) : -1;
      if (!['pending', 'moderation'].includes(order.status)) {
        return res.status(409).json({ error: 'Для этого заказа нельзя загрузить чек' });
      }

      const extensions = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'image/gif': 'gif',
        'application/pdf': 'pdf'
      };
      const fileName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${extensions[req.file.mimetype]}`;
      let receiptUrl;

      if (supabase) {
        const storagePath = `${order.id}/${fileName}`;
        const { error } = await supabase.storage.from('receipts').upload(storagePath, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: false
        });
        if (error) throw error;
        receiptUrl = supabase.storage.from('receipts').getPublicUrl(storagePath).data.publicUrl;
      } else {
        const uploadDir = path.join(__dirname, 'public', 'uploads', 'receipts');
        fs.mkdirSync(uploadDir, { recursive: true });
        fs.writeFileSync(path.join(uploadDir, fileName), req.file.buffer);
        const baseUrl = String(process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');
        receiptUrl = `${baseUrl}/uploads/receipts/${fileName}`;
      }

      order.payment = Object.assign({}, order.payment || {}, { receiptUrl, fileName: req.file.originalname });
      order.status = 'moderation';
      order.updated_at = new Date().toISOString();

      if (supabase) {
        const { error } = await supabase.from('orders').update({ status: order.status, payment: order.payment }).eq('id', order.id);
        if (error) throw error;
      } else if (index !== -1) {
        orders[index] = order;
        writeJsonFile('orders.json', orders);
      }

      notifyReceiptUploadedSafe(order);
      res.json({ ok: true, receiptUrl });
    } catch (e) {
      console.error('POST /api/orders/:id/receipt error:', e);
      res.status(500).json({ error: 'Не удалось сохранить чек' });
    }
  });
});

app.post('/api/upload-hero-video', requireAdmin, (req, res) => {
  uploadHeroVideo(req, res, (uploadError) => {
    if (uploadError) {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      const status = uploadError instanceof multer.MulterError && uploadError.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      return res.status(status).json({ error: uploadError.message });
    }
    if (!req.file) return res.status(400).json({ error: 'Выберите MP4-файл' });

    try {
      const header = Buffer.alloc(8);
      const descriptor = fs.openSync(req.file.path, 'r');
      fs.readSync(descriptor, header, 0, header.length, 0);
      fs.closeSync(descriptor);
      if (header.toString('ascii', 4, 8) !== 'ftyp') {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'Файл не является корректным MP4-видео' });
      }

      fs.renameSync(req.file.path, path.join(__dirname, 'public', 'images', 'hero_video.mp4'));
      res.json({ ok: true });
    } catch (e) {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      console.error('POST /api/upload-hero-video error:', e);
      res.status(500).json({ error: 'Не удалось установить видео' });
    }
  });
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

// Генерация промокода (рулетка)
app.post('/api/promo/generate', async (req, res) => {
  try {
    if (isRateLimited(req.ip)) {
      return res.status(429).json({ error: 'Слишком часто. Подождите немного' });
    }

    const last = spinCooldown.get(req.ip) || 0;
    const spinRemaining = SPIN_LIMIT_MS - (Date.now() - last);
    if (spinRemaining > 0) {
      return res.status(429).json({
        error: 'Рулетка доступна раз в 24 часа',
        remainingMs: spinRemaining
      });
    }

    spinCooldown.set(req.ip, Date.now());
    const discount = pickWeightedDiscount();
    const code = genOpaqueCode();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    if (supabase) {
      try {
        const { error } = await supabase
          .from('promocodes')
          .insert([{ code, discount, expires_at: expiresAt, type: 'single', used_count: 0, active: true }]);
        if (!error) return res.json({ code, discount });
      } catch (e) {}
    }

    const promos = readJsonFile('promocodes.json');
    promos.push({
      code,
      discount,
      type: 'single',
      max_uses: 1,
      used_count: 0,
      expires_at: expiresAt.toISOString(),
      used: false,
      active: true,
      created_at: new Date().toISOString()
    });
    writeJsonFile('promocodes.json', promos);
    res.json({ code, discount });
  } catch (e) {
    console.error('POST /api/promo/generate error:', e);
    res.status(500).json({ error: 'Не удалось выдать промокод' });
  }
});

/* ================= ОПРОС (анкета за скидку) ================= */
app.post('/api/survey/submit', async (req, res) => {
  try {
    const answers = (req.body && req.body.answers) || {};
    const code = 'SURVEY20-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    const discount = 20;
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    if (supabase) {
      try {
        await supabase.from('promocodes').insert([{
          code, discount, expires_at: expiresAt, type: 'single', used_count: 0, active: true
        }]);
      } catch (e) {}
    }
    const promos = readJsonFile('promocodes.json');
    promos.push({
      code, discount, type: 'single', max_uses: 1, used_count: 0,
      expires_at: expiresAt.toISOString(), used: false, active: true,
      note: 'Опрос', created_at: new Date().toISOString()
    });
    writeJsonFile('promocodes.json', promos);

    try {
      if (tg.notifySurveyCompleted) Promise.resolve(tg.notifySurveyCompleted(answers, code)).catch(() => {});
    } catch (e) {}

    res.json({ code, discount });
  } catch (e) {
    console.error('POST /api/survey/submit error:', e);
    res.status(500).json({ error: 'Не удалось выдать промокод' });
  }
});

// Генерация за опрос (старый адрес — сохранён для совместимости)
app.post('/api/survey/promo', async (req, res) => {
  try {
    const code = 'SURVEY20-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    const discount = 20;
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    if (supabase) {
      try {
        const { error } = await supabase
          .from('promocodes')
          .insert([{ code, discount, expires_at: expiresAt, type: 'single', used_count: 0, active: true }]);
        if (!error) return res.json({ code, discount });
      } catch (e) {}
    }

    const promos = readJsonFile('promocodes.json');
    promos.push({
      code,
      discount,
      type: 'single',
      max_uses: 1,
      used_count: 0,
      expires_at: expiresAt.toISOString(),
      used: false,
      active: true,
      created_at: new Date().toISOString()
    });
    writeJsonFile('promocodes.json', promos);
    res.json({ code, discount });
  } catch (e) {
    console.error('POST /api/survey/promo error:', e);
    res.status(500).json({ error: 'Не удалось выдать промокод' });
  }
});

app.get('/api/promo/check/:code', async (req, res) => {
  try {
    const code = String(req.params.code).toUpperCase().trim();
    const found = await findPromo(code);
    const err = checkPromo(found && found.promo);
    if (err) return res.json({ valid: false, error: err });
    res.json({ valid: true, discount: Number(found.promo.discount) || 0 });
  } catch (e) {
    console.error('GET /api/promo/check error:', e);
    res.status(500).json({ valid: false, error: 'Сервер недоступен' });
  }
});

/* ================= PROMO HELPERS ================= */
async function findPromo(code) {
  const norm = String(code || '').toUpperCase().trim();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('promocodes')
        .select('*')
        .eq('code', norm)
        .maybeSingle();
      if (!error && data) return { source: 'db', promo: data };
    } catch (e) {}
  }
  const p = readJsonFile('promocodes.json').find(x => String(x.code).toUpperCase() === norm);
  return p ? { source: 'file', promo: p } : null;
}

function checkPromo(p) {
  if (!p) return 'Промокод не найден';
  if (p.active === false) return 'Промокод отключён';
  const exp = p.expires_at || p.expiresAt;
  if (exp && new Date(exp) <= new Date()) return 'Срок действия промокода истёк';
  const type = p.type || 'single';
  const used = Number(p.used_count || 0);
  if (type === 'multi') {
    const max = Number(p.max_uses || 0);
    if (max > 0 && used >= max) return 'Лимит использований исчерпан';
  } else {
    // одноразовый (и любой неизвестный тип считаем одноразовым)
    if (p.used || used >= 1) return 'Промокод уже использован';
  }
  return null;
}

async function consumePromo(code, orderId) {
  const found = await findPromo(code);
  if (!found) return;
  const p = found.promo;
  const type = p.type || 'single';
  const used_count = Number(p.used_count || 0) + 1;
  const max = Number(p.max_uses || 0);
  const patch = { used_count, order_id: orderId };
  if (type !== 'multi' || (max > 0 && used_count >= max)) {
    patch.used = true;
  }

  if (supabase) {
    try {
      await supabase.from('promocodes').update(patch).eq('code', String(code).toUpperCase());
    } catch (e) {}
  }
  const promos = readJsonFile('promocodes.json');
  const idx = promos.findIndex(x => String(x.code).toUpperCase() === String(code).toUpperCase());
  if (idx !== -1) {
    Object.assign(promos[idx], patch);
    writeJsonFile('promocodes.json', promos);
  }
}

/* ================= АДМИН API ПРОМОКОДОВ =================
 * GET    /api/admin/promocodes          — список
 * POST   /api/admin/promocodes          — создать (single|multi; срок: expires_at | days | бессрочный)
 * PUT    /api/admin/promocodes/:code    — изменить (active, discount, max_uses, expires_at, note…)
 * DELETE /api/admin/promocodes/:code    — удалить
 * ======================================================== */

function normalizePromoInput(b, existing) {
  const out = Object.assign({}, existing || {});

  if (b.code != null || !existing) {
    const code = String(b.code || '').toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 32);
    if (!code) throw new Error('Код не может быть пустым');
    out.code = code;
  }

  if (b.discount != null || !existing) {
    const d = Number(b.discount);
    if (!Number.isFinite(d) || d < 1 || d > 100) throw new Error('Скидка должна быть от 1 до 100%');
    out.discount = Math.round(d);
  }

  if (b.type != null || !existing) {
    out.type = b.type === 'multi' ? 'multi' : 'single';
  }
  if (out.type === 'single') {
    out.max_uses = 1;
  } else if (b.max_uses != null || !existing) {
    if (b.max_uses === '' || b.max_uses == null) {
      out.max_uses = null; // без лимита
    } else {
      const m = Number(b.max_uses);
      if (!Number.isInteger(m) || m < 1) throw new Error('Лимит использований должен быть целым числом ≥ 1');
      out.max_uses = m;
    }
  }

  // Срок действия: приоритет у явного expires_at, затем days; пусто — без изменений
  if (b.expires_at != null && b.expires_at !== '') {
    const dt = new Date(b.expires_at);
    if (isNaN(dt.getTime())) throw new Error('Некорректная дата окончания');
    out.expires_at = dt.toISOString();
  } else if (b.days != null && b.days !== '') {
    const days = Number(b.days);
    if (!Number.isFinite(days) || days < 1 || days > 3650) throw new Error('Количество дней должно быть от 1 до 3650');
    out.expires_at = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  } else if (b.expires_at === '' || b.clear_expires === true) {
    out.expires_at = null; // сделать бессрочным
  }

  if (b.note != null) out.note = String(b.note).slice(0, 200);
  if (b.active != null) out.active = !!b.active;
  return out;
}

app.get('/api/admin/promocodes', requireAdmin, async (req, res) => {
  try {
    const local = readJsonFile('promocodes.json').map(normalizePromoRecord);
    if (supabase) {
      try {
        const { data, error } = await supabase.from('promocodes').select('*').order('created_at', { ascending: false });
        if (!error && Array.isArray(data)) {
          // объединяем БД + локальные файлы (на случай гибридного хранения)
          const merged = data.map(normalizePromoRecord);
          for (const p of local) {
            if (!merged.some(d => String(d.code).toUpperCase() === String(p.code).toUpperCase())) merged.push(p);
          }
          return res.json(merged);
        }
      } catch (e) {}
    }
    res.json(local);
  } catch (e) {
    console.error('GET /api/admin/promocodes error:', e);
    res.status(500).json({ error: 'Не удалось загрузить промокоды' });
  }
});

// Приводим запись любого происхождения (файл/Supabase/легаси) к единому виду,
// чтобы таблица админки всегда корректно отображала скидку, тип и срок.
function normalizePromoRecord(p) {
  const out = Object.assign({}, p);
  out.code = String(out.code || '').toUpperCase();
  out.discount = Number(out.discount) || 0;
  out.type = out.type === 'multi' ? 'multi' : 'single';
  out.used_count = Number(out.used_count || 0);
  if (out.expiresAt != null && out.expires_at == null) out.expires_at = out.expiresAt;
  delete out.expiresAt;
  if (out.expires_at) {
    const d = new Date(out.expires_at);
    out.expires_at = isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (out.max_uses != null) out.max_uses = Number(out.max_uses) || null;
  if (out.active == null) out.active = true;
  if (out.created_at == null) out.created_at = out.createdAt || null;
  return out;
}

app.post('/api/admin/promocodes', requireAdmin, async (req, res) => {
  try {
    const promo = normalizePromoInput(req.body || {}, null);
    promo.used_count = 0;
    promo.used = false;
    promo.active = true;
    promo.created_at = new Date().toISOString();
    if (promo.type === 'single') promo.max_uses = 1;

    const exists = await findPromo(promo.code);
    if (exists) return res.status(409).json({ error: 'Промокод с таким кодом уже существует' });

    if (supabase) {
      try {
        const { error } = await supabase.from('promocodes').insert([{
          code: promo.code, discount: promo.discount, type: promo.type,
          max_uses: promo.max_uses || null, expires_at: promo.expires_at || null,
          used_count: 0, active: true, note: promo.note || ''
        }]);
        if (!error) return res.json(promo);
      } catch (e) {}
    }

    const promos = readJsonFile('promocodes.json');
    promos.unshift(promo);
    writeJsonFile('promocodes.json', promos);
    res.json(promo);
  } catch (e) {
    res.status(400).json({ error: e.message || 'Не удалось создать промокод' });
  }
});

app.put('/api/admin/promocodes/:code', requireAdmin, async (req, res) => {
  try {
    const code = String(req.params.code).toUpperCase();
    const found = await findPromo(code);
    if (!found) return res.status(404).json({ error: 'Промокод не найден' });

    const updated = normalizePromoInput(req.body || {}, found.promo);
    // счётчики использования меняются только через consumePromo, не через этот эндпоинт
    updated.used_count = Number(found.promo.used_count || 0);
    updated.used = !!found.promo.used;

    if (supabase) {
      try {
        const { error } = await supabase.from('promocodes').update({
          discount: updated.discount, type: updated.type, max_uses: updated.max_uses || null,
          expires_at: updated.expires_at || null, active: updated.active === false ? false : true,
          note: updated.note || '', used_count: updated.used_count, used: updated.used
        }).eq('code', code);
        if (!error && found.source === 'db') return res.json(updated);
      } catch (e) {}
    }

    const promos = readJsonFile('promocodes.json');
    const idx = promos.findIndex(x => String(x.code).toUpperCase() === code);
    if (idx !== -1) promos[idx] = updated;
    else promos.unshift(updated);
    writeJsonFile('promocodes.json', promos);
    res.json(updated);
  } catch (e) {
    res.status(400).json({ error: e.message || 'Не удалось обновить промокод' });
  }
});

app.delete('/api/admin/promocodes/:code', requireAdmin, async (req, res) => {
  try {
    const code = String(req.params.code).toUpperCase();
    const found = await findPromo(code);
    if (!found) return res.status(404).json({ error: 'Промокод не найден' });

    if (supabase) {
      try { await supabase.from('promocodes').delete().eq('code', code); } catch (e) {}
    }
    const promos = readJsonFile('promocodes.json');
    const next = promos.filter(x => String(x.code).toUpperCase() !== code);
    writeJsonFile('promocodes.json', next);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Не удалось удалить промокод' });
  }
});

/* ================= ГЛАВНАЯ / 404 ================= */
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((req, res) => {
  if (String(req.path).startsWith('/api/')) {
    return res.status(404).json({ error: 'Не найдено: ' + req.path });
  }
  res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
});

/* ================= ЗАПУСК ================= */
function startServer(port) {
  const PORT = port || process.env.PORT || 3000;
  return app.listen(PORT, () => {
    console.log(`Hustlify server запущен: http://localhost:${PORT}`);
    console.log(`Админка: http://localhost:${PORT}/admin.html`);
    if (!supabase) console.log('Supabase не настроен — данные хранятся в папке data/');
  });
}

if (require.main === module) startServer();

app.app = app;
app.startServer = startServer;
module.exports = app;
