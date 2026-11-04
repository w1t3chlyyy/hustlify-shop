/* Hustlify — подготовка к проду (этап 1: всё, кроме мобильной адаптации).
   Запуск из корня проекта:  node apply-prod.js
   Копии изменяемых файлов: *.prodbak. Скрипт можно запускать повторно. */
const fs = require('fs');
const path = require('path');
const root = process.cwd();
const P = (...a) => path.join(root, ...a);
const read = f => fs.readFileSync(f, 'utf8');
function save(f, s) {
  if (fs.existsSync(f) && !fs.existsSync(f + '.prodbak')) fs.copyFileSync(f, f + '.prodbak');
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, s);
}
const log = (ok, msg) => console.log((ok ? 'OK  ' : '!!  ') + msg);
function rep(s, from, to, label) {
  const has = from instanceof RegExp ? from.test(s) : s.includes(from);
  if (!has) { log(false, 'не найдено (возможно уже применено): ' + label); return s; }
  log(true, label);
  return from instanceof RegExp ? s.replace(from, () => to) : s.split(from).join(to);
}

if (!fs.existsSync(P('public', 'index.html'))) { console.error('Запускайте из корня проекта (hustlify-shop).'); process.exit(1); }

/* ====================== 1. CSS: шапка + попапы ====================== */
const BRAND_CSS = String.raw`/* Hustlify brand.css — единый стиль: шапка-капсула, корзина, попапы */
html{ scroll-padding-top:110px; }

/* ---------- ШАПКА: элементы не двигаются, при скролле за ними появляется капсула ---------- */
.rd-header{ position:fixed; top:0; left:0; right:0; z-index:300; padding-top:14px; pointer-events:none; }
.rd-header-in{
  pointer-events:auto; position:relative; isolation:isolate;
  width:min(1560px, calc(100% - 32px)); height:80px; margin:0 auto; padding:0 44px;
  display:flex; align-items:center; justify-content:space-between; gap:28px; color:#fff;
}
.rd-header-in::before{
  content:''; position:absolute; inset:0; z-index:-1; border-radius:9999px;
  background:rgba(10,10,12,.84); border:1px solid rgba(255,255,255,.16);
  -webkit-backdrop-filter:blur(18px) saturate(150%); backdrop-filter:blur(18px) saturate(150%);
  box-shadow:0 16px 48px rgba(0,0,0,.42), inset 0 1px 0 rgba(255,255,255,.08);
  opacity:0; transform:scale(.985); transition:opacity .35s ease, transform .45s cubic-bezier(.16,1,.3,1);
}
.rd-header.scrolled .rd-header-in::before{ opacity:1; transform:none; }
.rdh-logo{ display:flex; align-items:center; flex:none; }
.rdh-logo img{ height:48px; width:auto; display:block; max-width:none; }
.rdh-links{ display:flex; align-items:center; gap:clamp(22px,2.6vw,44px); }
.rdh-links a{ font:600 17px/1 'Montserrat',sans-serif; letter-spacing:-.02em; white-space:nowrap; color:rgba(255,255,255,.78); text-decoration:none; transition:color .2s; }
.rdh-links a:hover, .rdh-links a.active{ color:#fff; }
.rdh-tools{ display:flex; align-items:center; gap:10px; flex:none; }
.rdh-ico{ position:relative; width:46px; height:46px; border-radius:50%; border:0; background:transparent; color:#fff; display:flex; align-items:center; justify-content:center; cursor:pointer; transition:background .2s; }
.rdh-ico:hover{ background:rgba(255,255,255,.14); }
.rdh-ico svg{ width:24px; height:24px; }
.rdh-ico .badge{ top:2px; right:0; background:#2f6bff; color:#fff; }
#mobileMenuBtn{ display:none; }
.rdh-cta{ display:flex; align-items:center; justify-content:center; height:54px; padding:0 34px; margin-left:8px; border-radius:9999px; border:2px solid #fff; background:rgba(217,217,217,.2); color:#fff; text-decoration:none; white-space:nowrap; font:500 16px/1 'Unbounded',sans-serif; transition:background .2s, transform .2s; }
.rdh-cta:hover{ background:rgba(255,255,255,.3); transform:translateY(-2px); }
@media (max-width:1100px){ .rdh-links{ display:none; } }
/* временная мобильная шапка (полная переработка — на втором этапе) */
@media (max-width:860px){
  .rd-header{ padding-top:8px; }
  .rd-header-in{ width:calc(100% - 16px); height:60px; padding:0 14px; }
  .rdh-logo img{ height:36px; } .rdh-cta{ display:none; }
  .rdh-ico{ width:40px; height:40px; } .rdh-ico svg{ width:21px; height:21px; }
  #mobileMenuBtn{ display:flex; }
}

/* ---------- ПОПАПЫ И КОРЗИНА: светлая карточка, синие кнопки ---------- */
.drawer, .search-modal{
  --bg:#ffffff; --bg-soft:#f1f4fc; --card:#ffffff; --card-hi:#f6f8fe;
  --white:#0a0a0c; --gray:#4d5366; --gray-dim:#80869a; --line:rgba(10,10,12,.12);
  background:#fff; color:#0a0a0c; font-family:'Montserrat',sans-serif;
  border:1px solid rgba(10,10,12,.08); box-shadow:0 40px 90px rgba(0,0,0,.35);
}
.search-modal{ border-radius:36px; }
.drawer{ border-radius:36px 0 0 36px; border-right:0; }
@media (max-width:860px){ .drawer{ border-radius:0; } }
.drawer h3, .search-modal h3, .drawer h5{ color:#0a0a0c; }
.drawer .close-x, .search-modal .close-x{ background:rgba(10,10,12,.07); color:#0a0a0c; }
.drawer .close-x:hover, .search-modal .close-x:hover{ background:rgba(10,10,12,.14); }
.search-modal .btn-white, .search-modal .btn-white:hover,
.drawer .checkout-btn, .drawer .btn-white{
  background:#2f6bff !important; color:#fff !important; border:0 !important; border-radius:200px;
  font-family:'Unbounded',sans-serif; font-weight:600; box-shadow:none;
}
.search-modal .btn-white:hover, .drawer .checkout-btn:hover{ filter:brightness(1.1); transform:translateY(-2px); }
.search-modal .btn-outline{ border:1.5px solid rgba(10,10,12,.25); color:#0a0a0c; border-radius:200px; }
.search-modal .btn-outline:hover{ background:rgba(10,10,12,.05); }
.search-modal input[type=checkbox]{ accent-color:#2f6bff; }
.search-modal input[type=text], .search-modal input[type=file]{ border-radius:16px !important; border:1.5px solid rgba(10,10,12,.14) !important; background:#f1f4fc !important; color:#0a0a0c !important; }
.search-modal input[type=text]:focus{ border-color:#2f6bff !important; }
.search-modal a{ color:#2f6bff; }
.search-modal .btn-white{ }
.search-input-row{ border-bottom:1px solid rgba(10,10,12,.1); }
.sr-item:hover{ background:rgba(10,10,12,.05); }
.cart-item .ci-img{ background:#f1f4fc; }
.ci-remove:hover{ color:#2f6bff; }
.detail-media{ background:#eef2ff; border:0; }
.detail-eyebrow{ color:#2f6bff; }
.detail-price .now{ color:#0a0a0c; }
#offerModal [style*="#d4d4d8"]{ color:#33384a !important; }
#offerModal [style*="rgba(255,255,255,.04)"]{ background:#f1f4fc !important; }
#offerModal a{ color:#2f6bff !important; }
#receiptSentModal [style*="border-radius:50%"]{ background:#e9efff !important; color:#2f6bff !important; }
.survey-q-title, .survey-opt-btn{ color:#0a0a0c; }
.survey-opt-btn{ background:#f1f4fc; border-color:rgba(10,10,12,.12); }
.toast{ background:#0a0a0c; color:#fff; }
.overlay{ background:rgba(8,10,20,.5); }

/* ---------- калькулятор: пояснение ---------- */
.rd-disc{ margin:14px 0 0; font:500 12px/1.4 'Montserrat',sans-serif; color:rgba(0,0,0,.55); }
@media (min-width:861px){
  .rd-disc{ position:absolute; left:calc(3392 * var(--u)); top:calc(2400 * var(--u)); width:calc(2574 * var(--u)); margin:0; font-size:calc(44 * var(--u)); }
}
`;
save(P('public', 'css', 'brand.css'), BRAND_CSS);
log(true, 'public/css/brand.css');

const PAGES_CSS = String.raw`/* Hustlify brand-pages.css — единый стиль внутренних страниц: белая страница, чёрные карточки, синие кнопки */
html, body{ background:#fff !important; }
.ambient{ background:#fff !important; } .noise{ display:none !important; }
header{ background:#0a0a0c !important; -webkit-backdrop-filter:none !important; backdrop-filter:none !important; border-bottom:0 !important; }
.btn-primary, .btn-tg, .send-btn, .calc-action-btn, .rec-card-btn{ background:#2f6bff !important; color:#fff !important; border-color:#2f6bff !important; }
.btn-primary:hover, .btn-tg:hover{ background:#2358d6 !important; }
.btn-support{ background:transparent; }
.card, .chat-main, .sidebar-card, .doc-card{ border-radius:40px !important; }
.doc-card{ background:#0b0c0e !important; }
.msg-row.user .msg-bubble, .msg-row.user .msg-avatar{ background:#2f6bff !important; color:#fff !important; }
.cfg-chip.active{ background:#2f6bff; border-color:#2f6bff; color:#fff; }
footer, footer a{ color:#4d5366 !important; }
h1, h2, h3, .brand-name{ letter-spacing:-.03em; }
`;
save(P('public', 'css', 'brand-pages.css'), PAGES_CSS);
log(true, 'public/css/brand-pages.css');

for (const pg of ['payment-success.html', 'payment-fail.html', 'offer.html', 'ai-agent.html']) {
  const f = P('public', pg);
  if (!fs.existsSync(f)) { log(false, 'нет ' + pg); continue; }
  let s = read(f);
  if (s.includes('brand-pages.css')) { log(true, pg + ' (уже подключён)'); continue; }
  s = s.replace('</head>', '<link rel="stylesheet" href="/css/brand-pages.css">\n</head>');
  save(f, s); log(true, pg + ': подключён единый стиль');
}

/* ====================== 2. index.html ====================== */
const HEADER = `<!-- rd-header -->
<div class="rd-header" id="rdHeader" role="banner">
  <div class="rd-header-in">
    <a href="/" class="rdh-logo" aria-label="Hustlify"><img src="/images/design/logo.svg" alt="Hustlify"></a>
    <nav class="rdh-links" aria-label="Основная навигация">
      <a href="#calculator">Калькулятор</a>
      <a href="#catalog">Каталог</a>
      <a href="#about">О нас</a>
      <a href="#faq">FAQ</a>
      <a href="https://t.me/HustlifyHelp" target="_blank" rel="noopener">Поддержка</a>
    </nav>
    <div class="rdh-tools">
      <button id="wishBtn" aria-label="Избранное" style="display:none"><span class="badge" id="wishCount">0</span></button>
      <button class="rdh-ico" id="searchBtn" aria-label="Поиск"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg></button>
      <button class="rdh-ico" id="cartBtn" aria-label="Корзина"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1.5"/><circle cx="19" cy="21" r="1.5"/><path d="M2.5 3h2l2.4 12.4a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 2-1.6L21 7.5H6"/></svg><span class="badge" id="cartCount">0</span></button>
      <button class="rdh-ico" id="mobileMenuBtn" aria-label="Меню"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg></button>
      <a href="#contacts" class="rdh-cta">Контакты</a>
    </div>
  </div>
</div>
<script>
(function(){
  var h = document.getElementById('rdHeader'); if(!h) return;
  var t = false;
  function u(){ h.classList.toggle('scrolled', (window.pageYOffset || document.documentElement.scrollTop) > 30); t = false; }
  addEventListener('scroll', function(){ if(!t){ t = true; requestAnimationFrame(u); } }, { passive: true });
  u();
  if('IntersectionObserver' in window){
    var links = {};
    h.querySelectorAll('.rdh-links a[href^="#"]').forEach(function(a){ links[a.getAttribute('href').slice(1)] = a; });
    var io = new IntersectionObserver(function(es){ es.forEach(function(e){ if(!e.isIntersecting) return;
      Object.keys(links).forEach(function(k){ links[k].classList.toggle('active', k === e.target.id); }); }); }, { rootMargin: '-40% 0px -55% 0px' });
    Object.keys(links).forEach(function(id){ var s = document.getElementById(id); if(s) io.observe(s); });
  }
})();
</script>

`;

const CALC = [
  [/const catMultipliers = \{[\s\S]*?\};/,
   "const catMultipliers = {\n    ai: { rev: 0.09 },\n    shop: { rev: 0.07 },\n    crypto: { rev: 0.06 },\n    saas: { rev: 0.05 }\n  }; /* ежемесячная выручка как доля бюджета — консервативная оценка */",
   'калькулятор: реалистичные коэффициенты'],
  ['const monthlyRev = Math.round(budget * m.rev);',
   'const eff = 1 - 0.15 * (budget - min) / (max - min);\n    const monthlyRev = Math.max(100, Math.round(budget * m.rev * eff / 100) * 100);',
   'калькулятор: выручка'],
  ['const roi = Math.round(m.roi);', 'const roi = Math.round(monthlyRev * 12 / budget * 100);', 'калькулятор: годовая доходность'],
  ['const paybackDays = Math.max(7, Math.round(m.payback * (50000 / budget)));', 'const paybackMonths = Math.max(1, Math.ceil(budget / monthlyRev));', 'калькулятор: окупаемость'],
  ["paybackNum.textContent = paybackDays + ' дней';", "paybackNum.textContent = paybackMonths + ' мес.';", 'калькулятор: вывод окупаемости'],
  ['id="calcRevenueNum">155.000₽<', 'id="calcRevenueNum">4.400₽<', 'калькулятор: стартовое значение выручки'],
  ['id="calcRoiNum">350%<', 'id="calcRoiNum">106%<', 'калькулятор: стартовая доходность'],
  ['id="calcPaybackNum">9 дней<', 'id="calcPaybackNum">12 мес.<', 'калькулятор: стартовая окупаемость'],
  ['<span class="rd-pl">Годовая доходность</span>', '<span class="rd-pl">Годовая доходность (оценка)</span>', 'калькулятор: подпись'],
  ['<button class="rd-cta-black" id="calcCtaBtn">Подобрать уникальный проект</button>',
   '<button class="rd-cta-black" id="calcCtaBtn">Подобрать уникальный проект</button>\n  <p class="rd-disc">Расчёт ориентировочный и не является гарантией или обещанием дохода. Реальный результат зависит от ниши, вложений и вашей работы.</p>',
   'калькулятор: дисклеймер']
];

let html = read(P('public', 'index.html'));
if (!html.includes('id="rdHeader"')) {
  html = rep(html, /<!-- rd-pill-nav -->[\s\S]*?<\/script>\s*(?=<section class="rd-hero")/, '', 'удалена старая капсула-дубль');
  html = rep(html, /<div class="rd-nav-row">[\s\S]*?(?=\s*<div class="rd-cube">)/, '', 'убрано меню из карточки хиро');
  html = rep(html, '<section class="rd-hero"', HEADER + '<section class="rd-hero"', 'новая закреплённая шапка');
} else log(true, 'шапка уже установлена');
if (!html.includes('/css/brand.css')) html = rep(html, '<link rel="stylesheet" href="/css/redesign.css">', '<link rel="stylesheet" href="/css/redesign.css">\n<link rel="stylesheet" href="/css/brand.css">', 'подключён brand.css');
for (const [a, b, l] of CALC) html = rep(html, a, b, l);
save(P('public', 'index.html'), html);

if (fs.existsSync(P('sections.html'))) {
  let sec = read(P('sections.html'));
  sec = sec.replace(/<div class="rd-nav-row">[\s\S]*?(?=\s*<div class="rd-cube">)/, '');
  for (const [a, b] of CALC.filter(c => typeof c[0] === 'string')) sec = sec.split(a).join(b);
  save(P('sections.html'), sec); log(true, 'sections.html синхронизирован (старые update-*.js больше НЕ запускайте)');
}

/* ====================== 3. Бэкенд ====================== */
fs.writeFileSync(P('api', 'index.js'), `/* Vercel serverless entrypoint: пробрасывает запросы в Express-приложение.
   JSON-тело читаем сами, чтобы сохранить ТОЧНЫЕ байты для проверки подписи вебхука RollyPay. */
const { app } = require('../index.js');

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
  if (req.method !== 'GET' && req.method !== 'HEAD' && ct.includes('application/json')) {
    try {
      let raw;
      if (req.readableEnded || req.destroyed) {
        const b = req.body;
        raw = Buffer.from(typeof b === 'string' ? b : JSON.stringify(b || {}), 'utf8');
      } else {
        raw = await readRaw(req);
      }
      req.rawBody = raw;
      let parsed = {};
      if (raw.length) parsed = JSON.parse(raw.toString('utf8'));
      setBody(req, parsed);
    } catch (e) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'Некорректный JSON' }));
    }
  }
  return app(req, res);
};
`);
log(true, 'api/index.js переписан (корректный rawBody для вебхуков)');

let idx = read(P('index.js'));
idx = rep(idx, "app.set('trust proxy', true);",
  "app.set('trust proxy', true);\napp.use((req, res, next) => {\n  res.set('X-Content-Type-Options', 'nosniff');\n  res.set('X-Frame-Options', 'SAMEORIGIN');\n  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');\n  next();\n});", 'index.js: security-заголовки');
idx = rep(idx, "const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');",
  "const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');\nif (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') console.warn('ВНИМАНИЕ: JWT_SECRET не задан — вход в админку будет сбрасываться на serverless');", 'index.js: предупреждение про JWT_SECRET');
idx = rep(idx, 'const envHash = process.env.ADMIN_PASSWORD_HASH || defaultHash;',
  "const envHash = process.env.ADMIN_PASSWORD_HASH || (process.env.NODE_ENV === 'production' ? '' : defaultHash);", 'index.js: убран пароль админки по умолчанию в проде');
idx = rep(idx, "process.env.GEMINI_MODEL || 'gemini-3.8-flash'", "process.env.GEMINI_MODEL || 'gemini-2.5-flash'", 'index.js: существующая модель Gemini по умолчанию');
idx = rep(idx, 'target: it.target || null, details: it.details || null',
  'target: it.target ? String(it.target).slice(0, 200) : null, details: it.details ? String(it.details).slice(0, 300) : null', 'index.js: лимиты длины полей заказа');
idx = rep(idx, "contact: String(contact || '').trim(),", "contact: String(contact || '').trim().slice(0, 200),", 'index.js: лимит длины контакта');
save(P('index.js'), idx);

if (fs.existsSync(P('telegram.js'))) {
  let tg = read(P('telegram.js'));
  if (!tg.includes('const esc =')) {
    tg = tg.replace('function formatOrderMessage', "const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');\n\nfunction formatOrderMessage");
    tg = rep(tg, '${i.name}${i.qty', '${esc(i.name)}${i.qty', 'telegram.js: экранирование названия');
    tg = rep(tg, '<code>${i.target}</code>', '<code>${esc(i.target)}</code>', 'telegram.js: экранирование получателя');
    tg = rep(tg, 'Детали: ${i.details}', 'Детали: ${esc(i.details)}', 'telegram.js: экранирование деталей');
    tg = rep(tg, '<b>${order.promo_code}</b>', '<b>${esc(order.promo_code)}</b>', 'telegram.js: экранирование промокода');
    tg = rep(tg, '<b>${order.contact}</b>', '<b>${esc(order.contact)}</b>', 'telegram.js: экранирование контакта');
    tg = rep(tg, '`${i + 1}. ${a}`', '`${i + 1}. ${esc(a)}`', 'telegram.js: экранирование ответов опроса');
    save(P('telegram.js'), tg);
  } else log(true, 'telegram.js уже исправлен');
}

/* package.json */
const pj = JSON.parse(read(P('package.json')));
pj.scripts = pj.scripts || {};
if (!pj.scripts.lint.includes('sync-products')) pj.scripts.lint += ' && node --check sync-products.js';
pj.scripts['prod:check'] = 'npm run lint';
pj.engines = { node: '>=20' };
save(P('package.json'), JSON.stringify(pj, null, 2) + '\n');
log(true, 'package.json');

if (fs.existsSync(P('public', 'vercel.json'))) { fs.unlinkSync(P('public', 'vercel.json')); log(true, 'удалён public/vercel.json (бесполезен и публично доступен)'); }

/* .gitignore */
let gi = fs.existsSync(P('.gitignore')) ? read(P('.gitignore')) : '';
for (const l of ['public/uploads/', '.vercel', '*.prodbak']) if (!gi.includes(l)) gi += (gi.endsWith('\n') ? '' : '\n') + l + '\n';
fs.writeFileSync(P('.gitignore'), gi);

/* ====================== 4. Схема Supabase ====================== */
fs.writeFileSync(P('supabase-schema.sql'), `-- Выполнить в Supabase → SQL Editor (дополняет таблицы из README: products, news, projects, partners, requisites)
create table if not exists public.orders (
  id text primary key,
  items jsonb not null default '[]',
  contact text default '',
  items_total numeric default 0,
  total numeric not null default 0,
  promo_code text,
  discount_percent numeric default 0,
  status text not null default 'pending',
  payment jsonb,
  paid_at timestamptz,
  updated_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.promocodes (
  code text primary key,
  discount int not null,
  type text not null default 'single',
  max_uses int,
  expires_at timestamptz,
  used_count int not null default 0,
  used boolean not null default false,
  active boolean not null default true,
  note text default '',
  order_id text,
  created_at timestamptz not null default now()
);
create table if not exists public.settings (
  id int primary key default 1,
  roulette_hidden boolean not null default false,
  updated_at timestamptz default now()
);
insert into public.settings (id) values (1) on conflict (id) do nothing;

-- Закрываем таблицы от публичного (anon) ключа. Сервер ходит через service_role и RLS обходит.
alter table public.orders enable row level security;
alter table public.promocodes enable row level security;
alter table public.settings enable row level security;
alter table public.products enable row level security;
alter table public.news enable row level security;
alter table public.projects enable row level security;
alter table public.partners enable row level security;
alter table public.requisites enable row level security;
`);
log(true, 'supabase-schema.sql');
console.log('\nГотово. Дальше: npm run prod:check  →  npm start  →  git add/commit/push (команды в чате).');
