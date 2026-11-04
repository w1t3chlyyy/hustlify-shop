/* Hustlify: плавный hover хиро + мобильный хиро по Figma (node 10:2) + мобильные правки.
   Порядок: bash download-mobile-assets.sh  ->  node update-mobile.js
   Запуск из корня проекта. Бэкап: public/index.html.bak8. Можно запускать повторно. */
const fs = require('fs');
const path = require('path');
const root = process.cwd();
const indexPath = path.join(root, 'public', 'index.html');
const cssPath = path.join(root, 'public', 'css', 'redesign.css');
const sectionsPath = path.join(root, 'sections.html');
const designDir = path.join(root, 'public', 'images', 'design');
if (!fs.existsSync(indexPath) || !fs.existsSync(cssPath)) { console.error('Запускайте из корня проекта.'); process.exit(1); }

const hasBgM = fs.existsSync(path.join(designDir, 'hero-bg-m.svg'));
const hasCubeM = fs.existsSync(path.join(designDir, 'hero-cube-m.png'));
if (!hasBgM || !hasCubeM) console.log('!!  нет hero-bg-m.svg / hero-cube-m.png — сначала запустите: bash download-mobile-assets.sh (разметку под них не трогаю)');

const NEW_JS = `<script id="rd-hover-js">
(function(){
  var hero = document.querySelector('.rd-hero');
  if(hero && 'IntersectionObserver' in window){
    new IntersectionObserver(function(en){ hero.classList.toggle('rd-off', !en[0].isIntersecting); }).observe(hero);
  }
  var stage = document.getElementById('stage');
  if(stage && 'IntersectionObserver' in window){
    new IntersectionObserver(function(en){ window.__revVisible = en[0].isIntersecting; }).observe(stage);
  }
  if(matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if(!matchMedia('(hover:hover) and (pointer:fine)').matches) return;
  document.querySelectorAll('.rd-globe, .rd-avatars, .rd-3d').forEach(function(el){
    el.addEventListener('mouseenter', function(){ el.classList.add('rd-bob'); });
    el.addEventListener('animationiteration', function(e){
      if(e.animationName === 'rdBob' && !el.matches(':hover')) el.classList.remove('rd-bob');
    });
  });
})();
</script>`;

const BG_OLD = '<img class="rd-card-bg" src="/images/design/hero-bg.svg" alt="">';
const BG_NEW = '<picture><source media="(max-width:860px)" srcset="/images/design/hero-bg-m.svg">' + BG_OLD + '</picture>';
const CUBE_OLD = '<div class="rd-cube"><img src="/images/design/hero-cube.png" alt=""></div>';
const CUBE_NEW = '<div class="rd-cube"><picture><source media="(max-width:860px)" srcset="/images/design/hero-cube-m.png"><img src="/images/design/hero-cube.png" alt=""></picture></div>';

function patchHtml(file, isIndex) {
  let html = fs.readFileSync(file, 'utf8');
  const before = html;
  // rAF-циклы парения -> долой (плавность теперь на CSS)
  html = html.replace(/\n[ \t]*\/\* -+ HERO: фото слева[^\n]*\*\/[\s\S]*?(?=\n\}\nif \(document\.readyState)/, '');
  if (isIndex) {
    html = html.replace(/<script id="rd-fixes3-js">[\s\S]*?<\/script>\s*/, '');
    html = html.replace('if (!isDragging) {', 'if (!isDragging && window.__revVisible !== false) {');
    if (!html.includes('id="rd-hover-js"')) {
      const i = html.lastIndexOf('</body>');
      if (i !== -1) html = html.slice(0, i) + NEW_JS + '\n' + html.slice(i);
    }
  }
  // мобильные версии фона и куба хиро через <picture>
  if (hasBgM && html.includes(BG_OLD) && !html.includes('hero-bg-m.svg')) html = html.replace(BG_OLD, BG_NEW);
  if (hasCubeM && html.includes(CUBE_OLD)) html = html.replace(CUBE_OLD, CUBE_NEW);
  if (html !== before) {
    if (isIndex) fs.writeFileSync(file + '.bak8', before);
    fs.writeFileSync(file, html);
    console.log('OK  ' + path.relative(root, file));
  } else console.log('--  ' + path.relative(root, file) + ': без изменений');
}
patchHtml(indexPath, true);
if (fs.existsSync(sectionsPath)) patchHtml(sectionsPath, false);

const MARK = '/* === FIXES v6 (update-mobile.js) === */';
const block = `${MARK}
/* ---- плавный hover: только transform, без JS в кадре ---- */
@keyframes rdBob{
  0%,100%{ transform:translate3d(0,0,0); }
  25%{ transform:translate3d(0,calc(var(--bob,6) * -1%),0); }
  75%{ transform:translate3d(0,calc(var(--bob,6) * 1%),0); }
}
.rd-globe, .rd-avatars, .rd-3d{ will-change:transform; backface-visibility:hidden; }
.rd-globe.rd-bob, .rd-avatars.rd-bob{ --bob:9; animation:rdBob 2.4s ease-in-out infinite; }
.rd-3d.rd-bob{ --bob:3.5; animation:rdBob 3.6s ease-in-out infinite; }
.rd-hero.rd-off .rd-globe img, .rd-hero.rd-off .rd-cube{ animation-play-state:paused; }
.rd-card > picture, .rd-cube picture{ display:contents; }

/* ---- МОБИЛЬНЫЙ ХИРО по Figma (кадр 3384 px; 1 px макета = --m) ---- */
@media (max-width:860px){
  .rd-hero{ --m:calc(100vw / 3384); padding:calc(103 * var(--m)); }
  .rd-hero .rd-card{ height:calc(6522 * var(--m)); padding:0; border-radius:calc(200 * var(--m)); }
  .rd-hero .rd-card-bg{ object-fit:fill; }
  .rd-hero .rd-nav-row, .rd-hero .rd-nav-tools, .rd-hero .rd-cta, .rd-hero .rd-proof{ display:contents; }

  /* большое 3D-фото внизу */
  .rd-hero .rd-card .rd-3d{
    position:absolute; display:block; margin:0; pointer-events:none;
    left:calc(-589.5 * var(--m)); top:calc(3825.4 * var(--m));
    width:calc(4181.5 * var(--m)); height:calc(2786.1 * var(--m)); object-fit:cover;
    -webkit-mask-image:none; mask-image:none;
  }

  /* лого и иконки */
  .rd-hero .rd-card .rd-logo{ position:absolute; left:calc(136 * var(--m)); top:calc(146 * var(--m)); width:calc(242.7 * var(--m)); height:calc(224.2 * var(--m)); }
  .rd-hero .rd-card .rd-logo img{ width:100%; height:100%; }
  .rd-hero .rd-card .rd-ico{ position:absolute; top:calc(202 * var(--m)); height:calc(106 * var(--m)); width:calc(108 * var(--m)); padding:0; }
  .rd-hero .rd-card .rd-ico::after{ content:''; position:absolute; inset:-14px; }
  .rd-hero .rd-card #searchBtn{ left:calc(2277 * var(--m)); }
  .rd-hero .rd-card #cartBtn{ left:calc(2502 * var(--m)); width:calc(112 * var(--m)); }
  .rd-hero .rd-card #mobileMenuBtn{
    left:calc(2728 * var(--m)); top:calc(146 * var(--m)); width:calc(320 * var(--m)); height:calc(224 * var(--m));
    display:block; border:1px solid #fff; border-radius:calc(200 * var(--m)); color:#fff;
    background:
      linear-gradient(#fff,#fff) calc(99 * var(--m)) calc(55 * var(--m)) / calc(121 * var(--m)) calc(16 * var(--m)) no-repeat,
      linear-gradient(#fff,#fff) calc(99 * var(--m)) calc(103 * var(--m)) / calc(121 * var(--m)) calc(16 * var(--m)) no-repeat,
      linear-gradient(#fff,#fff) calc(99 * var(--m)) calc(152 * var(--m)) / calc(121 * var(--m)) calc(16 * var(--m)) no-repeat,
      rgba(217,217,217,.2);
  }
  .rd-hero .rd-card #mobileMenuBtn svg{ display:none; }
  .rd-hero .rd-card #mobileMenuBtn::after{ inset:-8px; }

  /* куб и глобус возле заголовка (на мобилке без вращения — как в макете) */
  .rd-hero .rd-card .rd-cube{ display:block; position:absolute; left:calc(153 * var(--m)); top:calc(894 * var(--m)); width:calc(268 * var(--m)); height:calc(268 * var(--m)); animation:none; overflow:visible; }
  .rd-hero .rd-card .rd-cube img{ width:100%; height:100%; object-fit:fill; object-position:bottom; mix-blend-mode:luminosity; display:block; }
  .rd-hero .rd-card .rd-globe{ display:block; position:absolute; left:calc(153 * var(--m)); top:calc(1912 * var(--m)); width:calc(268 * var(--m)); height:calc(268 * var(--m)); overflow:hidden; }
  .rd-hero .rd-card .rd-globe img{ position:absolute; left:-23%; top:-23%; width:146%; height:146%; animation:none; }

  /* заголовок: 4 строки, отступ под иконки у 1-й и 4-й */
  .rd-hero .rd-card .rd-title{
    position:absolute; left:calc(116 * var(--m)); top:calc(871 * var(--m)); width:calc(2932 * var(--m)); margin:0;
    font-size:calc(350 * var(--m)); letter-spacing:calc(-17.5 * var(--m)); line-height:.91; text-indent:calc(366 * var(--m));
  }
  .rd-hero .rd-card .rd-title span{ display:inline; white-space:normal; }
  .rd-hero .rd-card .rd-title span:first-child::after{ content:' '; }
  .rd-hero .rd-card .rd-title .l3{ display:block; }

  .rd-hero .rd-card .rd-sub{ position:absolute; left:calc(136 * var(--m)); top:calc(2447 * var(--m)); width:calc(2243 * var(--m)); max-width:none; margin:0; font-size:calc(128 * var(--m)); line-height:.987; }

  /* кнопки */
  .rd-hero .rd-card .rd-btn{ position:absolute; top:calc(3044 * var(--m)); height:calc(324 * var(--m)); flex:none; font-size:calc(96 * var(--m)); border-width:1px; }
  .rd-hero .rd-card .rd-btn.blue{ left:calc(138 * var(--m)); width:calc(1204 * var(--m)); }
  .rd-hero .rd-card .rd-btn.ghost{ left:calc(1467 * var(--m)); width:calc(1361 * var(--m)); }

  /* соц. доказательство */
  .rd-hero .rd-card .rd-avatars{ position:absolute; left:calc(138 * var(--m)); top:calc(3487 * var(--m)); width:calc(826 * var(--m)); height:calc(322 * var(--m)); }
  .rd-hero .rd-card .rd-stat{ position:absolute; left:calc(1062 * var(--m)); top:calc(3532 * var(--m)); }
  .rd-hero .rd-card .rd-stat b{ font-size:calc(150 * var(--m)); letter-spacing:calc(-7.5 * var(--m)); line-height:.91; }
  .rd-hero .rd-card .rd-stat span{ position:absolute; left:0; top:calc(144 * var(--m)); white-space:nowrap; font-size:calc(96 * var(--m)); letter-spacing:calc(-4.8 * var(--m)); line-height:.91; }
}

/* ---- общая мобильная адаптация ---- */
@media (max-width:860px){
  html, body{ overflow-x:clip; }
  *{ -webkit-tap-highlight-color:transparent; }
  a, button, .rd-pill, .faq-q, .filter-chip{ touch-action:manipulation; }
  input, textarea, select{ font-size:16px !important; }
  .rd-pl{ white-space:normal; line-height:1.15; }
  .rd-metrics .rd-panel{ min-height:96px; }
  .search-modal{ max-height:calc(100dvh - 24px); overflow-y:auto; overscroll-behavior:contain; }
  .drawer{ height:100dvh; }
  .drawer-body{ overscroll-behavior:contain; }
  .rd2 .filter-row{ scroll-snap-type:x proximity; }
  .rd2 .filter-chip{ scroll-snap-align:start; }
}
@media (hover:none){
  .rd2-case:hover .rd2-rot img, .rd2-cell:hover .rd2-rot img, .rd2-cell:hover .rd2-img img,
  .rd2-step:hover .rd2-rot img, .rd2-contact:hover .rd2-rot img, .rd2-faq-img:hover img,
  .rd2 .rd2-pc:hover .rd2-pc-img img, .rd2 .vision-hero .card:hover img{ transform:none; }
  .rd2-btn-blue:hover, .rd2-cbtn:hover, .rd-btn:hover, .rd-cta-black:hover, .rd-contact-btn:hover{ transform:none; }
}
@media (prefers-reduced-motion: reduce){
  .rd-globe img, .rd-cube, .rd-bob{ animation:none !important; }
}
`;
let css = fs.readFileSync(cssPath, 'utf8');
const mi = css.indexOf(MARK);
if (mi !== -1) {
  const next = css.indexOf('/* === FIXES', mi + MARK.length);
  css = css.slice(0, mi) + (next === -1 ? '' : css.slice(next));
}
fs.writeFileSync(cssPath, css.trimEnd() + '\n\n' + block);
console.log('OK  redesign.css обновлён\nГотово. Проверьте: npm start (Ctrl+F5, мобильный режим в DevTools)');