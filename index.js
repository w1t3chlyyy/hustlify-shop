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
        .insert([{ code, discount, expires_at: expiresAt, type: 'single', used_count: 0 }]);
      if (!error) return res.json({ code, discount });
    } catch (e) {}
  }

  const promos = readJsonFile('promocodes.json');
  promos.push({ 
    code, 
    discount, 
    type: 'single',
    used_count: 0,
    expires_at: expiresAt.toISOString(), 
    used: false,
    active: true,
    created_at: new Date().toISOString()
  });
  writeJsonFile('promocodes.json', promos);
  res.json({ code, discount });
});

// Генерация за опрос
app.post('/api/survey/promo', async (req, res) => {
  const code = 'SURVEY20-' + Math.random().toString(36).substring(2, 8).toUpperCase();
  const discount = 20;
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  
  if (supabase) {
    try {
      const { error } = await supabase
        .from('promocodes')
        .insert([{ code, discount, expires_at: expiresAt, type: 'single', used_count: 0 }]);
      if (!error) return res.json({ code, discount });
    } catch (e) {}
  }

  const promos = readJsonFile('promocodes.json');
  promos.push({ 
    code, 
    discount, 
    type: 'single',
    used_count: 0,
    expires_at: expiresAt.toISOString(), 
    used: false,
    active: true,
    created_at: new Date().toISOString()
  });
  writeJsonFile('promocodes.json', promos);
  res.json({ code, discount });
});

// ✅ ИСПРАВЛЕНО: убран мертвый код после res.json
app.get('/api/promo/check/:code', async (req, res) => {
  const code = String(req.params.code).toUpperCase().trim();
  const found = await findPromo(code);
  const err = checkPromo(found && found.promo);
  if (err) return res.json({ valid: false, error: err });
  res.json({ valid: true, discount: found.promo.discount });
});

/* ================= PROMO HELPERS ================= */
async function findPromo(code) {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('promocodes')
        .select('*')
        .eq('code', code)
        .maybeSingle();
      if (!error && data) return { source: 'db', promo: data };
    } catch (e) {}
  }
  const p = readJsonFile('promocodes.json').find(x => x.code === code);
  return p ? { source: 'file', promo: p } : null;
}

function checkPromo(p) {
  if (!p) return 'Промокод не найден';
  if (p.active === false) return 'Промокод отключён';
  const exp = p.expires_at || p.expiresAt;
  if (exp && new Date(exp) <= new Date()) return 'Срок действия промокода истёк';
  const type = p.type || 'single';
  const used = Number(p.used_count || 0);
  if (type === 'single' && (p.used || used >= 1)) return 'Промокод уже использован';
  if (type === 'multi' && p.max_uses && used >= Number(p.max_uses)) return 'Лимит использований исчерпан';
  return null;
}

async function consumePromo(code, orderId) {
  const found = await findPromo(code);
  if (!found) return;
  const p = found.promo;
  const type = p.type || 'single';
  const used_count = Number(p.used_count || 0) + 1;
  const patch = { used_count, order_id: orderId };
  if (type === 'single' || (p.max_uses && used_count >= Number(p.max_uses))) {
    patch.used = true;
  }

  if (supabase) {
    try { 
      await supabase.from('promocodes').update(patch).eq('code', code); 
    } catch (e) {}
  }
  const promos = readJsonFile('promocodes.json');
  const idx = promos.findIndex(x => x.code === code);
  if (idx !== -1) { 
    Object.assign(promos[idx], patch); 
    writeJsonFile('promocodes.json', promos); 
  }
}
