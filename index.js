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
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Вспомогательные функции для локального хранилища /data
const DATA_DIR = process.env.VERCEL 
  ? path.join('/tmp', 'data') 
  : path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJsonFile(filename, defaultValue = []) {
  try {
    const filepath = path.join(DATA_DIR, filename);
    if (!fs.existsSync(filepath)) return defaultValue;
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

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.get('/admin.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});
app.get('/order-success.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'order-success.html'));
});

const PORT = process.env.PORT || 3000;
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
const PRODUCT_SELECT = 'id,name,price,cat:category,old:old_price,desc:description,section,img,icon,hit,created_at';

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
  return out;
}

/* ================= PUBLIC: PRODUCTS ================= */
app.get('/api/products', async (req, res) => {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('products')
        .select(PRODUCT_SELECT)
        .order('created_at', { ascending: false });
      if (!error && data) return res.json(data);
    } catch (e) {
      console.error('Supabase products error:', e.message);
    }
  }
  res.json(readJsonFile('products.json'));
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
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('products')
        .select(PRODUCT_SELECT)
        .order('created_at', { ascending: false });
      if (!error && data) return res.json(data);
    } catch (e) {
      console.error('Supabase admin products error:', e.message);
    }
  }
  res.json(readJsonFile('products.json'));
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
    const qty = Math.max(1, parseInt(it.qty) || 1);
    itemsTotal += p.price * qty;
    lines.push({ id: p.id, name: p.name, price: p.price, qty });
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
        paid_btn_url: `${PUBLIC_URL}/order-success.html?order=${order.id}`,
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
  recipient_name: 'Иван И.',
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
  const { card_number, bank_name, recipient_name, comment } = req.body || {};
  const updatedData = {
    id: 1,
    card_number: (card_number || '').toString().trim(),
    bank_name: (bank_name || '').toString().trim(),
    recipient_name: (recipient_name || '').toString().trim(),
    comment: (comment || '').toString().trim(),
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

/* ================= AI AGENT (GEMINI) ROUTES ================= */
let genAIClient = null;
function getGenAI() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) return null;
  if (!genAIClient) {
    try {
      const { GoogleGenAI } = require('@google/genai');
      genAIClient = new GoogleGenAI({ apiKey });
    } catch (e) {
      console.error('Ошибка инициализации GoogleGenAI:', e.message);
    }
  }
  return genAIClient;
}

function buildSystemPrompt(products) {
  const productListStr = (products || []).map(p => 
    `- [${p.id}] ${p.name} (Категория: ${p.cat || p.section}, Цена: ${p.price} ₽, Старая цена: ${p.old || p.price} ₽, Описание: "${p.desc}")`
  ).join('\n');

  return `Ты — официальный ИИ-ассистент и бизнес-архитектор платформы Hustlify (https://hustlify.ru).
Твоя задача — консультировать клиентов, подбирать готовые IT-бизнесы, рассчитывать бюджеты, отвечать на вопросы по услугам, кейсам, срокам запуска и окупаемости.

ИНФОРМАЦИЯ О СЕРВИСЕ HUSTLIFY:
- Hustlify — премиальный маркетплейс и студия запуска готовых IT-бизнесов, стартапов под ключ, Telegram Mini Apps, Telegram-ботов, дизайна и верификаций.
- Мы помогаем перейти "От голой идеи до монетизации за 2 недели".
- Быстрый старт: готовые типовые решения разворачиваются за 24 часа, разработка под ключ — от 1 до 2 недель.
- Поддержка: 24/7 в Telegram @HustlifyHelp, Telegram Bot: @HustlifyBot, канал отзывов: @HustlifyReviews.
- Способы оплаты:
  1. Банковские карты (МИР, СБП по реквизитам с подтверждением чека).
  2. Криптовалюта (CryptoBot, USDT, BTC, ETH) с моментальной автоматической фиксацией.
- Рулетка скидок: доступна 1 раз в 24 часа, можно выиграть промокод на скидку до -30%.
- Гарантии: полная техническая передача, инструкции, консультация специалистов перед и после сделки. Согласно регламенту, сделки окончательны после передачи исходников/прав.

АКТУАЛЬНЫЙ КАТАЛОГ ТОВАРОВ И КЕЙСОВ HUSTLIFY:
${productListStr}

ОСНОВНЫЕ ПАКЕТЫ И НАПРАВЛЕНИЯ:
1. Кейс "Hustlify & TeleStore" (3 889 ₽): готовый бизнес в Telegram с товарной матрицей и витриной.
2. Кейс "Стандарт" (2 589 ₽): базовая упаковка и стартовое продвижение.
3. Кейс "Расширенный" (3 289 ₽): полное оформление и помощь в продвижении.
4. Кейс "Премиум" (4 289 ₽): полное выстраивание системы, выход на крупные платформы.
5. Готовый магазин (12 990 ₽): полноценный бизнес под ключ с настроенным трафиком.
6. Telegram Mini App (8 990 ₽): веб-приложение внутри мессенджера Telegram.
7. Landing Page (4 990 ₽): конверсионный одностраничник под ключ.
8. Автовыдача 24/7 (5 990 ₽): бот автоматических продаж без участия человека.
9. Верификации (CryptoBot 880 ₽, Fragment 250 ₽, Telegram Wallet 789 ₽, ByBit 889 ₽ и др.).
10. Услуги дизайна и продвижения (баннеры, аватарки, живые подписчики, прогрев).

ПРАВИЛА ОТВЕТА:
- Отвечай вежливо, четко, экспертно и структурированно.
- Если клиент указывает бюджет (например, "у меня 15 000 руб" или "хочу бизнес до 5 000 руб"), подбери подходящие продукты из каталога Hustlify, распиши план запуска, потенциальную окупаемость и шаги.
- Выделяй важные моменты жирным шрифтом, используй удобные списки.
- Если клиенту нужна индивидуальная разработка или связь с человеком, рекомендуй написать в поддержку @HustlifyHelp.
- Ты можешь предложить клиенту перейти в Каталог, воспользоваться Калькулятором бюджета на главной странице или крутануть рулетку скидок.`;
}

app.post('/api/ai/chat', async (req, res) => {
  try {
    const { message, history = [] } = req.body;
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

    const systemPrompt = buildSystemPrompt(products);
    const ai = getGenAI();

    if (ai) {
      try {
        // Prepare conversation contents
        const contents = [];
        for (const item of history.slice(-8)) {
          if (item && item.role && item.content) {
            contents.push({
              role: item.role === 'assistant' || item.role === 'model' ? 'model' : 'user',
              parts: [{ text: item.content }]
            });
          }
        }
        contents.push({
          role: 'user',
          parts: [{ text: message }]
        });

        const response = await ai.models.generateContent({
          model: 'gemini-3.7-flash',
          contents: contents,
          config: {
            systemInstruction: systemPrompt,
            temperature: 0.7,
            maxOutputTokens: 1200
          }
        });

        const replyText = response.text || 'Извините, не удалось сформировать ответ. Попробуйте еще раз или напишите менеджеру @HustlifyHelp.';

        // Find relevant product recommendations based on message context
        const msgLower = (message + ' ' + replyText).toLowerCase();
        const recommended = products.filter(p => {
          return msgLower.includes(p.name.toLowerCase()) || 
                 (p.cat && msgLower.includes(p.cat.toLowerCase())) ||
                 (msgLower.includes('кейс') && p.section === 'case');
        }).slice(0, 3);

        return res.json({
          reply: replyText,
          provider: 'gemini-3.7-flash',
          recommended
        });
      } catch (geminiError) {
        console.error('Ошибка Gemini API:', geminiError.message);
        // Fallback to intelligent local rule engine if API fails or key is quota limited
      }
    }

    // Smart Local Knowledge Base Fallback if Gemini key is not configured or temporary error
    const lower = message.toLowerCase();
    let reply = '';
    let matchedProducts = [];

    if (lower.includes('бюджет') || lower.includes('руб') || lower.includes('₽') || lower.includes('стоит') || lower.includes('цена') || lower.includes('сколько')) {
      reply = `**Подбор решений по бюджету в Hustlify:**\n\n` +
        `• **До 5 000 ₽:** Рекомендуем кейс *Hustlify & TeleStore* (3 889 ₽) или кейс *Стандарт* (2 589 ₽) — отличный старт для Telegram-коммерции с готовой структурой.\n` +
        `• **5 000 – 15 000 ₽:** Идеален *Telegram Mini App* (8 990 ₽) или *Готовый магазин* (12 990 ₽) с настроенной автовыдачей и воронкой продаж.\n` +
        `• **Индивидуальный проект:** Создадим индивидуальную архитектуру под ваш бизнес. Воспользуйтесь нашим интерактивным калькулятором на главной странице или напишите в Telegram: **@HustlifyHelp**.\n\n` +
        `Не забудьте покрутить рулетку скидок на главной — можно получить промокод до **-30%**!`;
      matchedProducts = products.filter(p => ['k1', 'k2', 'c10', 'c11'].includes(p.id));
    } else if (lower.includes('mini app') || lower.includes('мини апп') || lower.includes('тг') || lower.includes('telegram') || lower.includes('бот')) {
      reply = `**Разработка и запуск в Telegram:**\n\n` +
        `В Hustlify мы специализируемся на Telegram-инфраструктуре:\n` +
        `1. **Telegram Mini Apps (8 990 ₽)** — современные веб-приложения внутри Telegram с оплатой в 1 клик, каталогами и бесшовным UX.\n` +
        `2. **Автовыдача 24/7 (5 990 ₽)** — бот для продажи цифровых товаров без вашего участия.\n` +
        `3. **Кейс TeleStore (3 889 ₽)** — готовый интернет-магазин в Telegram.\n\n` +
        `Срок запуска типовых решений — **24 часа**, индивидуальной разработки — **до 14 дней**. Для старта оформите заказ в каталоге или свяжитесь с нами: **@HustlifyHelp**.`;
      matchedProducts = products.filter(p => ['c10', 'c12', 'k1'].includes(p.id));
    } else if (lower.includes('вериф') || lower.includes('bybit') || lower.includes('cryptobot') || lower.includes('кошел') || lower.includes('fragment')) {
      reply = `**Верификации и безопасность:**\n\n` +
        `Мы подключаем и верифицируем все ключевые криптосервисы:\n` +
        `• **CryptoBot** (880 ₽) — быстрая верификация кошелька\n` +
        `• **Fragment** (250 ₽) — верификация юзернеймов и NFT\n` +
        `• **Telegram Wallet** (789 ₽) — подключение и KYC\n` +
        `• **ByBit** (889 ₽) — биржевой аккаунт\n\n` +
        `Все верификации выполняются безопасно и с гарантией работоспособности.`;
      matchedProducts = products.filter(p => p.cat === 'Верификации');
    } else if (lower.includes('оплат') || lower.includes('купить') || lower.includes('заказ') || lower.includes('гарант')) {
      reply = `**Как оплатить и получить заказ:**\n\n` +
        `1. **Способы оплаты:** Банковские карты (МИР/СБП по реквизитам) и Криптовалюта через CryptoBot (USDT, TON, BTC, ETH).\n` +
        `2. **Сроки:** Типовые решения передаются в течение 24 часов после оплаты, сложные проекты — от 3 до 14 дней.\n` +
        `3. **Сопровождение:** Наш специалист свяжется с вами по указанному контакту и передаст все доступы и инструкции.\n\n` +
        `По любым вопросам менеджер на связи 24/7: **@HustlifyHelp** в Telegram.`;
    } else {
      reply = `Здравствуйте! Я — **Hustlify AI Ассистент**, ваш проводник в мир готовых IT-бизнесов, стартапов под ключ и Telegram-разработки.\n\n` +
        `Чем я могу вам помочь сегодня?\n` +
        `• **Подобрать готовый бизнес** под ваш бюджет и цели\n` +
        `• **Рассказать про Telegram Mini Apps** и ботов автовыдачи\n` +
        `• **Помочь с упаковкой, дизайном** и запуском трафика\n` +
        `• **Проконсультировать по верификациям** и безопасной оплате\n\n` +
        `Напишите ваш вопрос или бюджет, и я подготовлю персональное предложение!`;
      matchedProducts = products.slice(0, 3);
    }

    res.json({
      reply,
      provider: 'knowledge-base',
      recommended: matchedProducts.slice(0, 3)
    });

  } catch (err) {
    console.error('Ошибка AI Chat:', err);
    res.status(500).json({ error: 'Ошибка обработки запроса ИИ ассистента' });
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
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Hustlify] Сервер запущен: http://localhost:${PORT}`);
    console.log(`[Hustlify] Админка: http://localhost:${PORT}/admin.html`);
    console.log(`[Hustlify] База данных: Supabase`);
  });
}

module.exports = (req, res) => app(req, res);
