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
const { createClient } = require('@supabase/supabase-js');

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

// На Vercel express.static() иногда не покрывает "/", поэтому раздаём
// ключевые HTML-страницы явными роутами — это работает независимо от
// того, как настроена статика/рерайты на хостинге.
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

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Ошибка: SUPABASE_URL или SUPABASE_SERVICE_ROLE_KEY не заданы в .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
console.log('✅ Supabase подключён');

/* ================= TELEGRAM ================= */
const { notifyNewOrder, notifyOrderPaid, notifyReceiptUploaded } = require('./telegram');

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
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_SELECT)
    .order('created_at', { ascending: false });
  
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

/* ================= ADMIN: PRODUCTS CRUD ================= */
app.get('/api/admin/products', requireAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_SELECT)
    .order('created_at', { ascending: false });
  
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/admin/products', requireAdmin, async (req, res) => {
  const p = req.body;
  if (!p.name || !p.price) {
    return res.status(400).json({ error: 'Укажите как минимум name и price' });
  }
  const dbRow = toDbProduct(p);
  dbRow.id = 'p' + Date.now().toString(36);
  
  const { data, error } = await supabase
    .from('products')
    .insert([dbRow])
    .select(PRODUCT_SELECT);
  
  if (error) return res.status(500).json({ error: error.message });
  res.json(data[0]);
});

app.put('/api/admin/products/:id', requireAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('products')
    .update(toDbProduct(req.body))
    .eq('id', req.params.id)
    .select(PRODUCT_SELECT);
  
  if (error) return res.status(500).json({ error: error.message });
  if (data.length === 0) return res.status(404).json({ error: 'Товар не найден' });
  res.json(data[0]);
});

app.delete('/api/admin/products/:id', requireAdmin, async (req, res) => {
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', req.params.id);
  
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

/* ================= NEWS ================= */
app.get('/api/news', async (req, res) => {
  const { data, error } = await supabase
    .from('news')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.get('/api/admin/news', requireAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('news')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/admin/news', requireAdmin, async (req, res) => {
  const n = req.body;
  if (!n.title) return res.status(400).json({ error: 'Укажите заголовок новости' });
  n.id = 'n' + Date.now().toString(36);
  n.created_at = new Date().toISOString();
  
  const { data, error } = await supabase
    .from('news')
    .insert([n])
    .select();
  
  if (error) return res.status(500).json({ error: error.message });
  res.json(data[0]);
});

app.put('/api/admin/news/:id', requireAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('news')
    .update(req.body)
    .eq('id', req.params.id)
    .select();
  
  if (error) return res.status(500).json({ error: error.message });
  if (data.length === 0) return res.status(404).json({ error: 'Новость не найдена' });
  res.json(data[0]);
});

app.delete('/api/admin/news/:id', requireAdmin, async (req, res) => {
  const { error } = await supabase
    .from('news')
    .delete()
    .eq('id', req.params.id);
  
  if (error) return res.status(500).json({ error: error.message });
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
  
  const { data, error } = await supabase
    .from('promocodes')
    .insert([{ code, discount, expires_at: expiresAt }])
    .select();
  
  if (error) return res.status(500).json({ error: error.message });
  res.json({ code, discount });
});

// Проверка промокода
app.get('/api/promo/check/:code', async (req, res) => {
  const { data, error } = await supabase
    .from('promocodes')
    .select('*')
    .eq('code', String(req.params.code).toUpperCase().trim())
    .eq('used', false)
    .gt('expires_at', new Date().toISOString())
    .single();
  
  if (error || !data) return res.json({ valid: false });
  res.json({ valid: true, discount: data.discount });
});

/* ================= ORDERS ================= */
app.post('/api/orders', async (req, res) => {
  const { items, contact, promoCode } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Корзина пуста' });
  }

  // Получаем товары из БД
  const { data: products, error } = await supabase
    .from('products')
    .select('*')
    .in('id', items.map(i => i.id));
  
  if (error) return res.status(500).json({ error: error.message });

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
    const { data: promo } = await supabase
      .from('promocodes')
      .select('*')
      .eq('code', String(promoCode).toUpperCase().trim())
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .single();
    
    if (promo) {
      discountPercent = promo.discount;
      appliedPromo = promo.code;
    } else {
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

  // Сначала сохраняем заказ
  const { data, error: insertError } = await supabase
    .from('orders')
    .insert([order])
    .select();

  if (insertError) return res.status(500).json({ error: insertError.message });

  // Если был промокод — сжигаем его
  if (appliedPromo) {
    await supabase
      .from('promocodes')
      .update({ used: true, order_id: orderId })
      .eq('code', appliedPromo);
  }

  // Уведомление в Telegram
  try {
    await notifyNewOrder(order);
  } catch (e) {
    console.log('Telegram уведомление не отправлено:', e.message);
  }

  res.json(data[0]);
});

app.get('/api/orders/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', req.params.id)
    .single();
  
  if (error) return res.status(404).json({ error: 'Заказ не найден' });
  res.json(data);
});

app.get('/api/admin/orders', requireAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.put('/api/admin/orders/:id', requireAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('orders')
    .update({ status: req.body.status })
    .eq('id', req.params.id)
    .select();
  
  if (error) return res.status(500).json({ error: error.message });
  if (data.length === 0) return res.status(404).json({ error: 'Заказ не найден' });
  
  // Если статус стал paid — уведомление в Telegram
  if (req.body.status === 'paid') {
    try {
      await notifyOrderPaid(data[0]);
    } catch (e) {}
  }
  
  res.json(data[0]);
});

/* ================= CRYPTOBOT PAYMENT ================= */
app.post('/api/payments/cryptobot/create', async (req, res) => {
  try {
    const { orderId } = req.body;
    const { data: order, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();
    
    if (error || !order) return res.status(404).json({ error: 'Заказ не найден' });
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
    await supabase
      .from('orders')
      .update({
        payment: { provider: 'cryptobot', invoiceId: data.result.invoice_id, payUrl: data.result.pay_url }
      })
      .eq('id', orderId);

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
        await supabase
          .from('orders')
          .update({ 
            status: 'paid', 
            payment: { provider: 'cryptobot', raw: update.payload },
            paid_at: new Date().toISOString()
          })
          .eq('id', orderId);
        
        // Уведомление в Telegram
        const { data: order } = await supabase
          .from('orders')
          .select('*')
          .eq('id', orderId)
          .single();
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
// Хранятся в таблице requisites (одна строка, id = 1), редактируются из админки

app.get('/api/requisites', async (req, res) => {
  const { data, error } = await supabase
    .from('requisites')
    .select('*')
    .eq('id', 1)
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.put('/api/admin/requisites', requireAdmin, async (req, res) => {
  const { card_number, bank_name, recipient_name, comment } = req.body || {};

  const { data, error } = await supabase
    .from('requisites')
    .update({
      card_number: (card_number || '').toString().trim(),
      bank_name: (bank_name || '').toString().trim(),
      recipient_name: (recipient_name || '').toString().trim(),
      comment: (comment || '').toString().trim(),
      updated_at: new Date().toISOString()
    })
    .eq('id', 1)
    .select();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data[0]);
});

/* ================= ЧЕК ОБ ОПЛАТЕ (ручная оплата по реквизитам) ================= */
// Пользователь загружает фото/PDF чека → файл уходит в Supabase Storage,
// заказ переводится в статус "moderation", уведомление с чеком летит в Telegram-бота.
app.post('/api/orders/:id/receipt', upload.single('receipt'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Файл чека не передан' });

    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (orderErr || !order) return res.status(404).json({ error: 'Заказ не найден' });

    const ext = (req.file.originalname.split('.').pop() || 'bin').toLowerCase().slice(0, 10);
    const path = `${order.id}/${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`;

    const { error: uploadErr } = await supabase
      .storage
      .from('receipts')
      .upload(path, req.file.buffer, { contentType: req.file.mimetype, upsert: false });

    if (uploadErr) return res.status(500).json({ error: 'Не удалось загрузить чек: ' + uploadErr.message });

    const { data: pub } = supabase.storage.from('receipts').getPublicUrl(path);
    const receiptUrl = pub.publicUrl;

    const { data: updated, error: updateErr } = await supabase
      .from('orders')
      .update({
        status: 'moderation',
        payment: { provider: 'requisites', receiptUrl, submittedAt: new Date().toISOString() }
      })
      .eq('id', order.id)
      .select();

    if (updateErr) return res.status(500).json({ error: updateErr.message });

    try {
      await notifyReceiptUploaded(updated[0]);
    } catch (e) {
      console.log('Telegram уведомление о чеке не отправлено:', e.message);
    }

    res.json(updated[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || 'Внутренняя ошибка сервера' });
  }
});

/* ================= PROMO CHECK (для админки) ================= */
app.get('/api/admin/promocodes', requireAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('promocodes')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

/* ================= CALCULATOR (Supabase) ================= */
app.post('/api/calculator', async (req, res) => {
  const { budget, email } = req.body || {};
  
  // Валидация
  if (!budget || budget <= 0) {
    return res.status(400).json({ error: 'Введите корректную сумму бюджета' });
  }
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Введите корректный email' });
  }
  
  // Сохраняем в Supabase
  const { data, error } = await supabase
    .from('calculator')
    .insert([{
      id: 'calc_' + Date.now().toString(36),
      budget: parseInt(budget),
      email: email.trim()
    }])
    .select();
  
  if (error) {
    console.error('❌ Ошибка сохранения в Supabase:', error);
    return res.status(500).json({ error: 'Не удалось сохранить данные' });
  }
  
  // Уведомление в Telegram
  try {
    const { sendTelegramMessage } = require('./telegram');
    await sendTelegramMessage(
      `📊 <b>Новый расчёт бюджета</b>\n\n` +
      `💰 Бюджет: <b>${budget} ₽</b>\n` +
      `📧 Email: <b>${email}</b>\n` +
      `🕐 Время: ${new Date().toLocaleString('ru-RU')}`
    );
  } catch (e) {
    console.log('⚠️ Telegram уведомление не отправлено:', e.message);
  }
  
  res.json({ 
    message: `Спасибо! Мы свяжемся с вами по email ${email} в ближайшее время.`,
    budget 
  });
});

// Просмотр заявок (только для админа)
app.get('/api/admin/calculator', requireAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('calculator')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

/* ================= ОБРАБОТКА ОШИБОК ЗАГРУЗКИ ФАЙЛА ================= */
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || (err && /Разрешены только/.test(err.message))) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

/* ================= ЗАПУСК ================= */
app.listen(PORT, () => {
  console.log(`🚀 Hustlify запущен: http://localhost:${PORT}`);
  console.log(`📋 Админка: http://localhost:${PORT}/admin.html`);
  console.log(`🗄️  База данных: Supabase`);
});
