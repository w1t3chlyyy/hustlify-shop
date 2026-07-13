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
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(express.static('public'));

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
const { notifyNewOrder, notifyOrderPaid } = require('./telegram');

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

/* ================= PUBLIC: PRODUCTS ================= */
app.get('/api/products', async (req, res) => {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

/* ================= ADMIN: PRODUCTS CRUD ================= */
app.get('/api/admin/products', requireAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/admin/products', requireAdmin, async (req, res) => {
  const p = req.body;
  if (!p.name || !p.price) {
    return res.status(400).json({ error: 'Укажите как минимум name и price' });
  }
  p.id = 'p' + Date.now().toString(36);
  
  const { data, error } = await supabase
    .from('products')
    .insert([p])
    .select();
  
  if (error) return res.status(500).json({ error: error.message });
  res.json(data[0]);
});

app.put('/api/admin/products/:id', requireAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('products')
    .update(req.body)
    .eq('id', req.params.id)
    .select();
  
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

/* ================= YOOKASSA PAYMENT ================= */
app.post('/api/payments/yookassa/create', async (req, res) => {
  try {
    const { orderId } = req.body;
    const { data: order, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();
    
    if (error || !order) return res.status(404).json({ error: 'Заказ не найден' });
    if (!process.env.YOOKASSA_SHOP_ID || !process.env.YOOKASSA_SECRET_KEY) {
      return res.status(500).json({ error: 'ЮKassa не настроена на сервере' });
    }
    
    const auth = Buffer.from(`${process.env.YOOKASSA_SHOP_ID}:${process.env.YOOKASSA_SECRET_KEY}`).toString('base64');

    const resp = await fetch('https://api.yookassa.ru/v3/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`,
        'Idempotence-Key': order.id + '_' + Date.now()
      },
      body: JSON.stringify({
        amount: { value: order.total.toFixed(2), currency: 'RUB' },
        capture: true,
        confirmation: { type: 'redirect', return_url: `${PUBLIC_URL}/order-success.html?order=${order.id}` },
        description: `Заказ ${order.id} — Hustlify`,
        metadata: { orderId: order.id }
      })
    });
    const data = await resp.json();
    if (!resp.ok) return res.status(502).json({ error: 'Ошибка ЮKassa', details: data });

    await supabase
      .from('orders')
      .update({
        payment: { provider: 'yookassa', paymentId: data.id }
      })
      .eq('id', orderId);

    res.json({ payUrl: data.confirmation.confirmation_url });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

/* ================= WEBHOOK YOOKASSA ================= */
app.post('/api/webhooks/yookassa', async (req, res) => {
  try {
    const event = req.body;
    if (event.event === 'payment.succeeded') {
      const paymentId = event.object.id;
      const auth = Buffer.from(`${process.env.YOOKASSA_SHOP_ID}:${process.env.YOOKASSA_SECRET_KEY}`).toString('base64');
      const check = await fetch(`https://api.yookassa.ru/v3/payments/${paymentId}`, {
        headers: { 'Authorization': `Basic ${auth}` }
      });
      const payment = await check.json();
      if (payment.status === 'succeeded') {
        const orderId = payment.metadata && payment.metadata.orderId;
        if (orderId) {
          await supabase
            .from('orders')
            .update({ 
              status: 'paid', 
              payment: { provider: 'yookassa', raw: payment },
              paid_at: new Date().toISOString()
            })
            .eq('id', orderId);
          
          const { data: order } = await supabase
            .from('orders')
            .select('*')
            .eq('id', orderId)
            .single();
          if (order) await notifyOrderPaid(order);
        }
      }
    }
    res.status(200).end();
  } catch (e) {
    console.error(e);
    res.status(400).end();
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

/* ================= ЗАПУСК ================= */
app.listen(PORT, () => {
  console.log(`🚀 Hustlify запущен: http://localhost:${PORT}`);
  console.log(`📋 Админка: http://localhost:${PORT}/admin.html`);
  console.log(`🗄️  База данных: Supabase`);
});