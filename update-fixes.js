/* Hustlify — правка 3: хиро (500+, вращение фото, плавный край большого фото) + фото отзывов.
   Запуск из корня проекта:  node update-fixes3.js
   Бэкап: public/index.html.bak7. Можно запускать повторно.
   Старые update-fixes.js / update-fixes2.js после этого НЕ запускайте повторно. */
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const indexPath = path.join(root, 'public', 'index.html');
const cssPath = path.join(root, 'public', 'css', 'redesign.css');
const imgDir = path.join(root, 'public', 'images');
if (!fs.existsSync(indexPath) || !fs.existsSync(cssPath)) {
  console.error('Не найден public/index.html или public/css/redesign.css. Запускайте из корня проекта.');
  process.exit(1);
}
let html = fs.readFileSync(indexPath, 'utf8');
fs.writeFileSync(indexPath + '.bak7', html);

/* ---------- 1. Фото для ленты отзывов: найти и переложить в public/images/reviews ---------- */
function walk(dir, out) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (['design', 'avatars'].includes(e.name)) continue; walk(p, out); }
    else out.push(p);
  }
  return out;
}
const IMG_RE = /\.(png|jpe?g|webp)$/i;
const all = walk(imgDir, []);
const reviewsDir = path.join(imgDir, 'reviews');

// сначала ищем «Frame 72.png», «Frame_73.png» и т.п. по всей папке images
let picked = [];
const byNum = new Map();
for (const f of all) {
  const m = path.basename(f).match(/^frame[\s_-]*(\d+)\.(png|jpe?g|webp)$/i);
  if (!m) continue;
  const n = Number(m[1]);
  const inReviews = path.dirname(f) === reviewsDir;
  if (!byNum.has(n) || inReviews) byNum.set(n, { file: f, ext: m[2].toLowerCase(), name: 'Frame_' + n + '.' + m[2].toLowerCase() });
}
if (byNum.size) {
  picked = [...byNum.entries()].sort((a, b) => a[0] - b[0]).map(e => e[1]);
  console.log('OK  найдены файлы Frame_*: ' + picked.length);
} else {
  // запасной вариант: любые картинки из images/projects, кроме иконок самих проектов
  const projDir = path.join(imgDir, 'projects');
  const rest = all.filter(f => path.dirname(f) === projDir && IMG_RE.test(f) && !/^(apex|flux|vieto|cursor)\./i.test(path.basename(f)));
  rest.sort((a, b) => path.basename(a).localeCompare(path.basename(b), 'ru', { numeric: true }));
  picked = rest.map(f => ({ file: f, name: path.basename(f).replace(/\s+/g, '_') }));
  if (picked.length) console.log('OK  Frame_* не нашёл, беру картинки из images/projects (кроме apex/flux/vieto/cursor): ' + picked.length);
}

if (!picked.length) {
  console.log('!!  Фото отзывов не найдены. Пришлите вывод:  dir public\\images  (или ls -R public/images)');
} else {
  fs.mkdirSync(reviewsDir, { recursive: true });
  for (const p of picked) {
    const dst = path.join(reviewsDir, p.name);
    if (path.resolve(p.file) !== path.resolve(dst)) fs.copyFileSync(p.file, dst);
  }
  console.log('OK  скопировано в public/images/reviews/: ' + picked.map(p => p.name).join(', '));

  const items = picked.map((p, i) => "    { frame: '" + p.name + "', alt: 'Отзыв клиента Hustlify #" + (i + 1) + "' }").join(',\n');
  const reItems = /const reviewItems = \[[\s\S]*?\];/;
  if (reItems.test(html)) { html = html.replace(reItems, () => 'const reviewItems = [\n' + items + ',\n  ];'); console.log('OK  список отзывов в index.html обновлён'); }
  else console.log('!!  не нашёл reviewItems в index.html');
}

const reCand = /const candidates = \[[\s\S]*?\];/;
if (reCand.test(html) && !html.includes("'/images/projects/' + encodeURIComponent(item.frame)")) {
  const cand =
    "const candidates = [\n" +
    "      '/images/reviews/' + encodeURIComponent(item.frame),\n" +
    "      '/images/projects/' + encodeURIComponent(item.frame),\n" +
    "      '/images/' + encodeURIComponent(item.frame),\n" +
    "      '/images/reviews/' + item.frame\n" +
    "    ];";
  html = html.replace(reCand, () => cand);
  console.log('OK  пути поиска картинок отзывов расширены');
}

/* ---------- 2. JS: плавное движение большого фото при наведении ---------- */
if (!html.includes('id="rd-fixes3-js"')) {
  const js = [
    '<script id="rd-fixes3-js">',
    '(function(){',
    '  if(matchMedia("(prefers-reduced-motion: reduce)").matches) return;',
    '  var el=document.querySelector(".rd-3d"); if(!el) return;',
    '  var hover=false, amp=0, phase=0, last=performance.now();',
    '  el.addEventListener("mouseenter", function(){ hover=true; });',
    '  el.addEventListener("mouseleave", function(){ hover=false; });',
    '  (function loop(now){',
    '    var dt=Math.min(0.05,(now-last)/1000); last=now;',
    '    amp += ((hover?1:0)-amp)*Math.min(1,dt*4);',
    '    if(amp>0.001){ phase+=dt*1.6; var h=el.offsetHeight||300; el.style.transform="translateY("+(Math.sin(phase)*h*0.035*amp).toFixed(2)+"px)"; }',
    '    else if(el.style.transform){ el.style.transform=""; phase=0; }',
    '    requestAnimationFrame(loop);',
    '  })(last);',
    '})();',
    '</script>'
  ].join('\n');
  const i = html.lastIndexOf('</body>');
  if (i !== -1) { html = html.slice(0, i) + js + '\n' + html.slice(i); console.log('OK  добавлено плавное движение большого фото'); }
}
fs.writeFileSync(indexPath, html);

/* ---------- 3. CSS ---------- */
const MARK = '/* === FIXES v5 (update-fixes3.js) === */';
const block = `${MARK}
/* Настройки:
   --proof-top  — верх аватарок «500+» (пиксели макета; кнопки заканчиваются на 2211, было 2366)
   --cube-swing — на сколько градусов качается верхнее фото
   --r3d-fade   — ширина размытия левого края большого фото */
:root{ --proof-top:2330; --cube-swing:90deg; --r3d-fade:32%; }

@media (min-width:861px){
  /* 1. «500+ клиентов» и аватарки выше */
  .rd-avatars{ top:calc(var(--proof-top) * var(--u)); }
  .rd-stat{ top:calc((var(--proof-top) + 42) * var(--u)); }

  /* 4. Большое фото справа: мягкий левый/нижний край + можно навести курсор */
  .rd-3d{
    pointer-events:auto;
    -webkit-mask-image:
      linear-gradient(to right, transparent 0%, #000 var(--r3d-fade)),
      radial-gradient(ellipse 80% 85% at 72% 38%, #000 45%, transparent 100%);
    -webkit-mask-composite:source-in;
    mask-image:
      linear-gradient(to right, transparent 0%, #000 var(--r3d-fade)),
      radial-gradient(ellipse 80% 85% at 72% 38%, #000 45%, transparent 100%);
    mask-composite:intersect;
  }
  /* текст не должен перекрывать область наведения на фото */
  .rd-title, .rd-sub{ pointer-events:none; }
}

/* 2. Фото рядом с заголовком */
@keyframes rdSpin{ to{ transform:rotate(360deg); } }
@keyframes rdSwing{
  0%{ transform:rotate(0deg); }
  25%{ transform:rotate(var(--cube-swing)); }
  50%{ transform:rotate(0deg); }
  75%{ transform:rotate(calc(-1 * var(--cube-swing))); }
  100%{ transform:rotate(0deg); }
}
.rd-globe img{ transform-origin:50% 50%; animation:rdSpin 14s linear infinite; }
.rd-cube{ animation:rdSwing 8s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce){
  .rd-globe img, .rd-cube{ animation:none; }
}
`;
let css = fs.readFileSync(cssPath, 'utf8');
const mi = css.indexOf(MARK);
if (mi !== -1) {
  const next = css.indexOf('/* === FIXES', mi + MARK.length);
  css = css.slice(0, mi) + (next === -1 ? '' : css.slice(next));
}
css = css.trimEnd() + '\n\n' + block;
fs.writeFileSync(cssPath, css);
console.log('OK  redesign.css обновлён');
console.log('\nГотово. Проверьте: npm start (после запуска обновите страницу через Ctrl+F5)');