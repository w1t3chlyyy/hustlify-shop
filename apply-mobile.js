/* Hustlify — этап 2: мобильная адаптация (≤860px). Запуск из корня:  node apply-mobile.js
   Требует, чтобы apply-prod.js уже был применён. Копии: index.html.mobbak. Можно запускать повторно. */
const fs = require('fs');
const path = require('path');
const root = process.cwd();
const idxPath = path.join(root, 'public', 'index.html');
if (!fs.existsSync(idxPath)) { console.error('Запускайте из корня проекта.'); process.exit(1); }

const CSS = String.raw`/* Hustlify mobile.css — полная мобильная версия (≤860px). Десктоп не затрагивается. */
@media (max-width:860px){
html{ scroll-padding-top:84px; }
html, body{ overflow-x:clip; }
body{ padding-bottom:100px !important; }
body.no-scroll{ overflow:hidden; }

/* ================= HERO: нормальный поток вместо абсолютных координат ================= */
html body .rd-hero{ padding:8px !important; height:auto !important; }
html body .rd-hero .rd-card{
  display:flex !important; flex-direction:column; height:auto !important; min-height:0 !important;
  padding:96px 20px 0 !important; border-radius:30px !important;
  background:#000 radial-gradient(120% 55% at 85% 100%, rgba(47,107,255,.38), transparent 70%) !important;
}
html body .rd-hero .rd-card-bg{ object-fit:cover !important; }
html body .rd-hero .rd-cube, html body .rd-hero .rd-globe{ display:none !important; }
html body .rd-hero .rd-card .rd-title{
  position:static !important; width:auto !important; text-indent:0 !important; margin:0 0 16px !important;
  font-size:clamp(25px,8.2vw,40px) !important; letter-spacing:-.045em !important; line-height:.98 !important;
}
html body .rd-hero .rd-card .rd-title span{ display:block !important; white-space:normal !important; }
html body .rd-hero .rd-card .rd-title span:first-child::after{ content:none !important; }
html body .rd-hero .rd-card .rd-sub{
  position:static !important; width:auto !important; max-width:none !important; margin:0 0 22px !important;
  font-size:15px !important; line-height:1.4 !important;
}
html body .rd-hero .rd-card .rd-cta{ display:flex !important; gap:10px; width:100%; }
html body .rd-hero .rd-card .rd-btn{
  position:static !important; flex:1 1 0 !important; width:auto !important; height:54px !important;
  font-size:14px !important; border-width:2px !important; top:auto !important; left:auto !important;
}
html body .rd-hero .rd-card .rd-proof{ display:flex !important; align-items:center; gap:14px; margin-top:22px; }
html body .rd-hero .rd-card .rd-avatars{ position:relative !important; left:auto !important; top:auto !important; width:128px !important; height:50px !important; flex:none; }
html body .rd-hero .rd-card .rd-stat{ position:static !important; }
html body .rd-hero .rd-card .rd-stat b{ font-size:26px !important; letter-spacing:-.04em !important; line-height:1 !important; }
html body .rd-hero .rd-card .rd-stat span{ position:static !important; display:block; font-size:12px !important; letter-spacing:0 !important; line-height:1.3 !important; margin-top:4px; max-width:160px; white-space:normal !important; }
html body .rd-hero .rd-card .rd-3d{
  position:relative !important; order:5; left:auto !important; top:auto !important;
  width:calc(100% + 40px) !important; max-width:none !important; height:auto !important;
  margin:20px -20px 0 !important; object-fit:cover; border-radius:0 !important;
  -webkit-mask-image:linear-gradient(to bottom, transparent 0, #000 24%) !important;
  mask-image:linear-gradient(to bottom, transparent 0, #000 24%) !important;
}

/* ================= КАЛЬКУЛЯТОР ================= */
.rd-calc{ padding:44px 16px 36px !important; height:auto !important; }
.rd-calc .rd-h2{ font-size:clamp(22px,6.6vw,30px); letter-spacing:-.045em; line-height:1.02; margin:0 0 22px; }
.rd-panel.big{ padding:22px 20px; border-radius:28px; margin-top:14px; }
.rd-panel .rd-ph{ font-size:16px; white-space:normal; letter-spacing:-.03em; }
.rd-metrics .rd-ph{ font-size:clamp(17px,5.4vw,24px); white-space:nowrap; }
.rd-budget-num{ font-size:clamp(34px,11vw,48px); text-align:left; mix-blend-mode:normal; margin:10px 0 4px; }
.rd-pl.lbl{ font-size:13px; }
.rd-track{ margin:26px 0 12px; }
.rd-ticks{ font-size:12px; }
.rd-pills{ grid-template-columns:1fr 1fr; gap:10px; margin-top:16px; }
.rd-calc .rd-pill{ padding:14px 8px; font-size:12.5px; border-radius:16px; }
.rd-metrics{ gap:10px; margin-top:12px; }
.rd-metrics .rd-panel{ min-height:112px; padding:18px 14px; border-radius:22px; display:flex; flex-direction:column; justify-content:flex-end; }
.rd-metrics .rd-pl{ font-size:11.5px; margin-top:8px; }
.rd-cta-black{ height:58px; font-size:14px; margin-top:12px; }
.rd-disc{ font-size:11.5px; margin:14px 4px 0; }

/* ================= ПРОЕКТЫ / НОВОСТИ ================= */
.rd-about{ padding:44px 0 12px; }
.rd-about .rd-h2, .rd-news .rd-h2{ font-size:clamp(22px,6.6vw,30px); letter-spacing:-.045em; line-height:1.04; padding:0 16px; margin-bottom:18px; }
.rd-about .projects-wrap, .rd-news .news-wrap{ padding:0; }
.rd-about .projects-track{ gap:12px; padding:4px 16px 14px; scroll-padding-left:16px; }
.rd-about .projects-track .flip-card{ flex:0 0 min(76vw,300px); width:min(76vw,300px); min-width:0; height:auto; aspect-ratio:4/5; }
.rd-about .flip-face{ border-radius:28px; }
.rd-about .flip-back h3{ left:18px; top:22px; font-size:19px; }
.rd-about .flip-back .desc{ left:18px; right:18px; top:56px; font-size:12.5px; line-height:1.3; }
.rd-about .flip-back .proj-actions{ left:16px; bottom:16px; }
.rd-news{ padding:40px 0 36px; }
.rd-news .news-track{ gap:12px; padding:4px 16px 14px; scroll-padding-left:16px; }
.rd-news .news-card{ min-width:min(82vw,330px); padding:22px 20px; border-radius:28px; }
.rd-news .news-tag{ font-size:12px; padding:5px 5px 5px 14px; margin-bottom:18px; }
.rd-news .news-card h3{ font-size:20px; }
.rd-news .news-card .stamp{ font-size:12px; margin-bottom:14px; }
.rd-news .news-card .headline{ font-size:15px; }
.rd-news .news-card .body-txt{ font-size:13.5px; line-height:1.5; }

/* ================= ЧАСТЬ 2: общие заголовки ================= */
.rd2{ --ml:16px; --mr:16px; padding:56px 0 64px !important; }
.rd2-head{ margin-bottom:22px !important; }
.rd2-h2{ font-size:clamp(25px,7.2vw,34px) !important; line-height:1.04 !important; letter-spacing:-.045em !important; }
.rd2-sub{ font-size:15px !important; line-height:1.35 !important; letter-spacing:-.02em !important; margin-top:10px !important; }
.rd2-btn-blue{ width:100% !important; height:54px !important; font-size:14px !important; margin-top:18px !important; letter-spacing:-.02em !important; }

/* ---------- КЕЙСЫ ---------- */
.rd2-cases{ row-gap:14px; }
.rd2-case-big{ height:auto !important; min-height:0; padding:26px 22px 22px; display:flex; flex-direction:column; border-radius:32px !important; }
html body .rd2-case-big > *:not(.rd2-rot){ position:relative !important; left:auto !important; top:auto !important; bottom:auto !important; }
.rd2-case-big .rd2-rot{ opacity:.5; }
.cb-title{ gap:10px !important; }
.cb-ico{ width:44px !important; height:44px !important; }
.cb-title h3{ font-size:26px !important; letter-spacing:-.04em !important; }
.cb-desc{ width:auto !important; max-width:92%; font-size:14px !important; letter-spacing:-.01em !important; line-height:1.35 !important; margin:14px 0 0 !important; }
.cb-price{ margin:18px 0 !important; gap:14px !important; }
.cb-price b{ font-size:24px !important; letter-spacing:-.04em !important; } .cb-price s{ font-size:14px !important; }
.cb-btn{ width:100% !important; height:54px !important; font-size:14px !important; margin-top:auto; letter-spacing:-.02em !important; }
.rd2-case-side{ row-gap:14px !important; }
.rd2-case-sm{ height:auto !important; min-height:0; border-radius:28px !important; padding:22px 84px 22px 22px; }
.rd2-case-sm .rd2-rot{ display:none; }
.cs-body{ position:relative !important; left:auto !important; top:auto !important; right:auto !important; transform:none !important; width:auto !important; max-width:none !important; }
.cs-body h3{ font-size:20px !important; letter-spacing:-.04em !important; max-width:none !important; }
.cs-body p{ font-size:13px !important; margin-top:8px !important; letter-spacing:0 !important; -webkit-line-clamp:2; }
.cs-price{ margin-top:12px !important; } .cs-price b{ font-size:18px !important; } .cs-price s{ font-size:13px !important; }
.cs-plus{ width:52px !important; height:52px !important; right:18px !important; bottom:18px !important; font-size:30px !important; }

/* ---------- КАТАЛОГ ---------- */
.rd2-catalog{ margin-top:56px !important; }
.rd2 .filter-row{ margin:0 -16px 18px !important; padding:0 16px !important; gap:8px !important; }
.rd2 .filter-chip{ height:42px !important; padding:0 18px !important; font-size:13px !important; letter-spacing:-.02em !important; border-width:2px !important; }
.rd2 .pgrid{ grid-template-columns:1fr 1fr !important; gap:12px !important; }
.rd2 .rd2-pc, .rd2-pc-img{ border-radius:24px !important; }
.rd2-pc-body{ padding:14px 14px 16px !important; }
.rd2-pc-title{ font-size:13.5px !important; letter-spacing:-.03em !important; line-height:1.15 !important; }
.rd2-pc-desc{ font-size:11.5px !important; letter-spacing:0 !important; margin-top:8px !important; min-height:0 !important; -webkit-line-clamp:3 !important; }
.rd2-pc-price{ padding-top:10px !important; gap:8px !important; }
.rd2-pc-price .now{ font-size:16px !important; letter-spacing:-.03em !important; } .rd2-pc-price .old{ font-size:11.5px !important; }
.rd2 .rd2-pc-btn{ height:42px !important; margin-top:12px !important; font-size:12px !important; gap:8px !important; letter-spacing:-.02em !important; }
.rd2 .rd2-more{ width:100% !important; height:54px !important; font-size:14px !important; border-width:2px !important; }
.rd2-more-wrap{ margin-top:22px !important; }
.cfg-card{ padding:20px 18px; border-radius:28px; }
.cfg-amount-num{ font-size:28px; }

/* ---------- ПОЧЕМУ МЫ ---------- */
.rd2-whys{ margin-top:56px !important; }
.rd2-why{ padding:12px !important; row-gap:12px !important; border-radius:32px !important; }
.rd2-why-row{ row-gap:12px !important; }
.rd2-cell{ height:auto !important; min-height:270px; border-radius:24px !important; padding:22px 18px !important; }
.rd2-cell .t{ font-size:22px !important; letter-spacing:-.04em !important; white-space:normal !important; }
.rd2-cell .d{ font-size:13.5px !important; letter-spacing:-.01em !important; max-width:62% !important; width:auto !important; margin-top:10px !important; }
.rd2-cell .rd2-img, .rd2-cell .rd2-rot{ width:190px !important; height:190px !important; top:auto !important; bottom:-10px !important; left:auto !important; right:-10px !important; }

/* ---------- ПРОЦЕСС ---------- */
.rd2-proc{ margin-top:56px !important; }
.rd2-steps{ row-gap:12px !important; }
.rd2-step{ height:auto !important; min-height:210px; padding:22px 20px !important; border-radius:26px !important; }
.rd2-step .n{ font-size:14px !important; letter-spacing:-.02em !important; }
.rd2-step h3{ font-size:21px !important; letter-spacing:-.04em !important; line-height:1.05 !important; max-width:64% !important; margin-top:10px !important; }
.rd2-step p{ font-size:13.5px !important; line-height:1.35 !important; letter-spacing:0 !important; max-width:60% !important; margin-top:10px !important; }
.rd2-step .rd2-rot{ width:150px !important; height:150px !important; left:auto !important; right:-14px !important; top:auto !important; bottom:-14px !important; }

/* ---------- ОТЗЫВЫ ---------- */
.rd2-reviews{ margin-top:56px !important; }
.rd2 .vision-hero .stage{ height:320px; }

/* ---------- FAQ ---------- */
.rd2-faqsec{ margin-top:56px !important; }
.rd2-faq{ row-gap:24px !important; }
.rd2-faq-img{ height:170px !important; border-radius:26px !important; }
.rd2 .faq-q{ font-size:16px !important; line-height:1.3 !important; letter-spacing:-.02em !important; padding:20px 44px 20px 0 !important; }
.rd2 .faq-icon{ width:20px !important; height:20px !important; top:22px !important; right:2px !important; margin:0 !important; }
.rd2 .faq-icon::before{ left:9px !important; top:0 !important; width:2px !important; height:20px !important; }
.rd2 .faq-icon::after{ left:0 !important; top:9px !important; width:20px !important; height:2px !important; }
.rd2 .faq-a{ font-size:14px !important; line-height:1.5 !important; letter-spacing:0 !important; margin-top:-6px !important; padding:0 0 20px !important; }

/* ---------- КОНТАКТЫ / ПОДВАЛ ---------- */
.rd2-contacts{ margin-top:56px !important; }
.rd2-contact{ padding:30px 20px 24px !important; border-radius:30px !important; gap:12px !important; }
.rd2-contact h2{ font-size:28px !important; letter-spacing:-.045em !important; line-height:1.05 !important; }
.rd2-contact p{ font-size:15px !important; letter-spacing:-.01em !important; max-width:100% !important; line-height:1.35 !important; }
.rd2-cbtn, .rd2-cbtn.tg, .rd2-cbtn.mini, .rd2-cbtn.ai{ height:56px !important; font-size:15px !important; letter-spacing:-.02em !important; }
.rd2-contact .rd2-rot{ opacity:.3; }
footer{ padding:32px 0 24px; }

/* ================= НИЖНЯЯ ПАНЕЛЬ, МЕНЮ, ПОПАПЫ ================= */
.mobile-bottom-bar{
  left:12px; right:12px; bottom:calc(10px + env(safe-area-inset-bottom, 0px)); padding:8px 14px;
  border-radius:9999px; border:1px solid rgba(255,255,255,.14); background:rgba(10,10,12,.9);
  box-shadow:0 14px 40px rgba(0,0,0,.4);
}
#mbBarCart, #mbBarMenu{ display:none !important; }
.mb-bar-item{ font-size:11px; padding:6px 14px; flex:1; }
.mobile-nav-drawer{ width:min(86vw,340px); border-radius:0 32px 32px 0; background:#0a0a0c; font-family:'Montserrat',sans-serif; }
.mobile-nav-head{ padding:18px 20px; }
.toast{ bottom:104px; max-width:calc(100vw - 32px); text-align:center; }
.drawer{ width:100%; max-width:100vw; height:100dvh; }
.drawer-head{ padding:18px 20px; } .drawer-body{ padding:14px 20px; } .drawer-foot{ padding:16px 20px calc(16px + env(safe-area-inset-bottom,0px)); }
.search-modal{ border-radius:28px !important; max-height:calc(100dvh - 24px) !important; }
.search-input-row{ padding:16px 18px; }
.detail-media{ margin:12px 16px 0; }
.detail-body{ padding:18px 18px 22px; }
}
@media (max-width:380px){
  html body .rd-hero .rd-card .rd-btn{ font-size:13px !important; }
  .rd2 .pgrid{ gap:8px !important; }
}
`;
fs.writeFileSync(path.join(root, 'public', 'css', 'mobile.css'), CSS);
console.log('OK  public/css/mobile.css');

let html = fs.readFileSync(idxPath, 'utf8');
if (!fs.existsSync(idxPath + '.mobbak')) fs.writeFileSync(idxPath + '.mobbak', html);
if (!html.includes('/css/mobile.css')) {
  if (html.includes('/css/brand.css"')) html = html.replace('<link rel="stylesheet" href="/css/brand.css">', '<link rel="stylesheet" href="/css/brand.css">\n<link rel="stylesheet" href="/css/mobile.css?v=1">');
  else html = html.replace('</head>', '<link rel="stylesheet" href="/css/mobile.css?v=1">\n</head>');
  console.log('OK  mobile.css подключён');
}
if (!html.includes('viewport-fit=cover')) {
  html = html.replace('content="width=device-width, initial-scale=1.0"', 'content="width=device-width, initial-scale=1.0, viewport-fit=cover"');
  console.log('OK  viewport-fit=cover');
}
if (!html.includes('id="rd-scrolllock"')) {
  const js = '<script id="rd-scrolllock">\n(function(){var o=document.getElementById("overlay");if(!o)return;new MutationObserver(function(){document.body.classList.toggle("no-scroll",o.classList.contains("open"));}).observe(o,{attributes:true,attributeFilter:["class"]});})();\n</script>\n';
  const i = html.lastIndexOf('</body>');
  html = html.slice(0, i) + js + html.slice(i);
  console.log('OK  блокировка прокрутки под открытыми окнами');
}
fs.writeFileSync(idxPath, html);
console.log('\nГотово. Проверьте в DevTools (Ctrl+Shift+M) на 360 / 390 / 430px, затем пуш.');