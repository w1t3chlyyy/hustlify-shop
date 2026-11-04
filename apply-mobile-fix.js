/* Hustlify — правки: тень слева, логотип, нижнее меню, иконки, моб. адаптация внутренних страниц.
   Запуск из корня проекта:  node apply-mobile-fix.js   (можно запускать повторно)
   Создаёт: public/css/mobile-fix.css, pages-mobile.css, admin-mobile.css и подключает их.
   Копии изменяемых html: *.fixbak */
const fs = require('fs');
const path = require('path');
const root = process.cwd();
const P = (...a) => path.join(root, ...a);
if (!fs.existsSync(P('public', 'index.html'))) { console.error('Запускайте из корня проекта.'); process.exit(1); }

/* ---------------------------------------------------------------- главная */
const MAIN_CSS = String.raw`/* Hustlify mobile-fix.css — подключается ПОСЛЕДНИМ */

/* 1. Чёрный градиент у края экрана: это тень закрытых выезжающих панелей
      (mobile-nav-drawer слева и drawer корзины справа), которая «подтекала» на экран. */
.mobile-nav-drawer{ box-shadow:none !important; visibility:hidden; transition:transform .35s cubic-bezier(.16,1,.3,1), visibility 0s linear .35s; }
.mobile-nav-drawer.open{ box-shadow:20px 0 60px rgba(0,0,0,.35) !important; visibility:visible; transition:transform .35s cubic-bezier(.16,1,.3,1), visibility 0s; }
.drawer{ box-shadow:none !important; visibility:hidden; transition:transform .4s cubic-bezier(.16,1,.3,1), visibility 0s linear .4s; }
.drawer.open{ box-shadow:-20px 0 60px rgba(0,0,0,.3) !important; visibility:visible; transition:transform .4s cubic-bezier(.16,1,.3,1), visibility 0s; }
.search-modal:not(.open){ box-shadow:none !important; visibility:hidden; }
.search-modal.open{ visibility:visible; }
html, body{ overflow-x:clip; }

/* 2. Логотип в шапке — меньше и по левому краю контента (десктоп) */
@media (min-width:861px){
  .rdh-logo img{ height:28px; }
  .rd-header-in{ width:calc(5273 * var(--u)); max-width:none; margin:0 0 0 calc(334 * var(--u)); padding:0; }
  .rd-header-in::before{ inset:0 -28px; }
}

/* 3. Мобильная версия */
@media (max-width:860px){
  /* нижнее меню убрано */
  .mobile-bottom-bar, #mobileBottomBar{ display:none !important; }
  body{ padding-bottom:0 !important; }
  .toast{ bottom:20px; }

  /* шапка: лого слева (на одной линии с текстом хиро), иконки справа */
  .rd-header{ padding-top:8px; }
  .rd-header-in{ width:calc(100% - 16px); height:56px; margin:0 auto; padding:0 20px; gap:4px; }
  .rd-header-in::before{ inset:0; }
  .rdh-logo img{ height:24px; }
  .rdh-links, .rdh-cta{ display:none !important; }
  .rdh-tools{ display:flex !important; margin-left:auto; gap:2px; }

  /* иконки поиска, корзины и меню — вернуть */
  #searchBtn, #cartBtn, #mobileMenuBtn{
    display:flex !important; position:relative !important; left:auto !important; top:auto !important;
    width:40px !important; height:40px !important; padding:0 !important;
    align-items:center; justify-content:center; color:#fff; background:transparent !important; border:0 !important; border-radius:50%;
  }
  #searchBtn svg, #cartBtn svg, #mobileMenuBtn svg{ display:block !important; width:21px; height:21px; }
  #cartBtn .badge{ top:2px; right:0; }
  #mobileMenuBtn::after, #searchBtn::after, #cartBtn::after{ display:none; }
}
`;

/* ---------------------------------------------------------- внутренние страницы */
const PAGES_CSS = String.raw`/* Hustlify pages-mobile.css — ai-agent, offer, payment-success/fail, upload */
@media (max-width:860px){
  html, body{ overflow-x:hidden; }
  header{ padding:10px 0 !important; }
  header .wrap, .header-wrap{ padding:0 16px; gap:10px; }
  .logo-title, .brand-name, .logo-text{ font-size:14px; }
  .back-btn, .head-back-btn, .btn-back-home, .btn-tg{ padding:8px 13px; font-size:12px; gap:6px; white-space:nowrap; }

  /* payment-success / payment-fail */
  main{ padding:22px 14px 40px; }
  .card{ padding:28px 18px; border-radius:24px !important; }
  .actions-group .btn-primary, .actions-group .btn-support{ padding:13px 16px; font-size:14px; }

  /* offer */
  .wrap{ padding:0 14px; }
  .doc-card{ padding:22px 16px; margin-top:20px; border-radius:24px !important; }
  .doc-section h2{ font-size:16px; }
  .doc-section p, .doc-section li{ font-size:14px; text-align:left; }
  .requisites-badge{ border-radius:18px; padding:10px 14px; gap:6px 12px; }
  .req-box{ padding:14px 16px; }
  .req-item{ flex-direction:column; gap:2px; }
  .req-value{ text-align:left; word-break:break-word; }

  /* ai-agent */
  .nav-left{ gap:14px; }
  .nav-left a{ font-size:13.5px; }
  .ai-app-container{ height:calc(100dvh - 58px); min-height:0; }
  .chat-topbar{ padding:12px 14px; }
  .bot-avatar{ width:40px; height:40px; }
  .bot-meta h2{ font-size:14.5px; flex-wrap:wrap; }
  .msg-row{ max-width:96%; gap:8px; }
  .msg-avatar{ width:30px; height:30px; }
  .msg-bubble{ padding:11px 14px; font-size:14px; }
  .chat-input-bar{ padding:10px 12px calc(10px + env(safe-area-inset-bottom,0px)); }
  .chat-textarea{ font-size:16px; }
  .input-caption{ display:none; }
  .rec-card{ flex-direction:column; align-items:stretch; }
  .rec-card-foot{ flex-direction:row; align-items:center; justify-content:space-between; }

  /* upload */
  .card .drop-zone{ padding:32px 14px; }
}
`;

const ADMIN_CSS = String.raw`/* Hustlify admin-mobile.css */
@media (max-width:860px){
  .wrap{ padding:0 14px; }
  header{ padding:12px 0; }
  .brand{ font-size:13px; }
  .logout-btn{ padding:8px 14px; font-size:12px; }

  #mainTabs{ flex-wrap:nowrap; overflow-x:auto; gap:6px; margin:16px -14px; padding:0 14px 6px; scrollbar-width:none; -webkit-overflow-scrolling:touch; }
  #mainTabs::-webkit-scrollbar{ display:none; }
  .tab{ flex:none; white-space:nowrap; padding:9px 14px; font-size:12.5px; }
  #sectionFilter{ flex-wrap:nowrap; overflow-x:auto; }

  .toolbar{ flex-direction:column; align-items:stretch; }
  .toolbar > div{ flex-wrap:wrap; }
  .add-btn{ width:100%; text-align:center; }

  .panel table{ display:block; overflow-x:auto; white-space:nowrap; -webkit-overflow-scrolling:touch; }
  th, td{ padding:11px 12px; font-size:12.5px; }

  .grid2, .rates-grid{ grid-template-columns:1fr; }
  .rate-card{ padding:18px; }
  #panel-requisites > div, #panel-settings > div{ max-width:100%; }

  .modal{ width:calc(100vw - 20px); max-width:none; max-height:92dvh; border-radius:18px; }
  .modal-head, .modal-body, .modal-foot{ padding-left:18px; padding-right:18px; }
  input, select, textarea{ font-size:16px !important; }

  .login-card{ padding:30px 22px; border-radius:20px; }
}
`;

function write(rel, s) {
  fs.mkdirSync(path.dirname(P(rel)), { recursive: true });
  fs.writeFileSync(P(rel), s);
  console.log('OK  ' + rel);
}
write('public/css/mobile-fix.css', MAIN_CSS);
write('public/css/pages-mobile.css', PAGES_CSS);
write('public/css/admin-mobile.css', ADMIN_CSS);

function link(rel, css) {
  const f = P(rel);
  if (!fs.existsSync(f)) { console.log('--  нет ' + rel); return; }
  let s = fs.readFileSync(f, 'utf8');
  if (s.includes('/css/' + css)) { console.log('--  ' + rel + ': уже подключено'); return; }
  if (!fs.existsSync(f + '.fixbak')) fs.writeFileSync(f + '.fixbak', s);
  if (!/name="viewport"/.test(s)) s = s.replace('<head>', '<head>\n<meta name="viewport" content="width=device-width, initial-scale=1.0">');
  s = s.replace('</head>', '<link rel="stylesheet" href="/css/' + css + '?v=1">\n</head>');
  fs.writeFileSync(f, s);
  console.log('OK  ' + rel + ' ← ' + css);
}
link('public/index.html', 'mobile-fix.css');
link('public/admin.html', 'admin-mobile.css');
['ai-agent', 'offer', 'payment-success', 'payment-fail', 'upload'].forEach(n => link('public/' + n + '.html', 'pages-mobile.css'));

/* cases.html: iframe на всю высоту с учётом адресной строки мобильного браузера */
const cf = P('public', 'cases.html');
if (fs.existsSync(cf)) {
  let s = fs.readFileSync(cf, 'utf8');
  if (s.includes('height:100vh')) {
    if (!fs.existsSync(cf + '.fixbak')) fs.writeFileSync(cf + '.fixbak', s);
    s = s.replace('height:100vh;overflow:hidden', 'height:100vh;height:100dvh;overflow:hidden');
    if (!/name="viewport"/.test(s)) s = s.replace('<meta charset="UTF-8">', '<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">');
    fs.writeFileSync(cf, s);
    console.log('OK  public/cases.html');
  }
}
console.log('\nГотово. Обновите страницу (Ctrl+F5) и проверьте в DevTools (Ctrl+Shift+M) на 360 / 390 / 430px.');