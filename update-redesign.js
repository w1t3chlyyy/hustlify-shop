/* Обновляет редизайн в public/index.html.
   Заменяет блок от <section class="rd-hero"> до <footer> (hero → … → новости → кейсы → каталог →
   команда → процесс → отзывы → FAQ → контакты) на актуальный sections.html. Подвал не трогается.
   Запуск из корня проекта:  node update-redesign.js
   Нужны рядом: sections.html (в корне или в redesign/) и public/css/redesign.css */
const fs = require('fs');
const path = require('path');
const root = process.cwd();
const indexPath = path.join(root, 'public', 'index.html');
const sectionsPath = [path.join(__dirname, 'sections.html'), path.join(root, 'sections.html'), path.join(root, 'redesign', 'sections.html')].find(fs.existsSync);
if (!fs.existsSync(indexPath)) { console.error('Не найден public/index.html. Запускайте из корня проекта.'); process.exit(1); }
if (!sectionsPath) { console.error('Не найден sections.html.'); process.exit(1); }

let html = fs.readFileSync(indexPath, 'utf8');
const start = html.indexOf('<section class="rd-hero"');
const end = html.indexOf('<footer>');
if (start === -1 || end === -1 || end < start) { console.error('Не нашёл блок редизайна (<section class="rd-hero"> … <footer>). Файл не изменён.'); process.exit(1); }

fs.writeFileSync(indexPath + '.bak3', html);
let sections = fs.readFileSync(sectionsPath, 'utf8').replace(/^\s*<!--[\s\S]*?-->\s*/, '');

// поздний скрипт (переопределяет renderCases) выносим в конец <body>, после основного скрипта страницы
const lateRe = /<script id="rd-late">[\s\S]*?<\/script>\s*/;
const lateMatch = sections.match(lateRe);
const late = lateMatch ? lateMatch[0].trim() : '';
sections = sections.replace(lateRe, '');

html = html.slice(0, start) + sections + '\n\n' + html.slice(end);
html = html.replace(/<script id="rd-late">[\s\S]*?<\/script>\s*/g, '');   // убрать старую копию при повторном запуске
if (late) html = html.replace(/<\/body>/, () => late + '\n</body>');
console.log('OK  блок редизайна обновлён (копия: public/index.html.bak3)');
console.log(late ? 'OK  поздний скрипт добавлен перед </body>' : '!!  в sections.html нет <script id="rd-late">');

// устаревшие дубли
html = html.replace(/[ \t]*<link rel="stylesheet" href="\/redesign\.css">\s*\n?/g, '');
html = html.replace(/[ \t]*<script src="\/redesign\.js"><\/script>\s*\n?/g, '');
if (!html.includes('/css/redesign.css')) html = html.replace('</head>', '<link rel="stylesheet" href="/css/redesign.css">\n</head>');

function patch(name, re, repl) {
  if (re.test(html)) { html = html.replace(re, repl); console.log('OK  ' + name); }
  else console.log('--  пропущено/уже применено: ' + name);
}
// рулетки в макете нет: убираем мёртвую ссылку в мобильном меню
patch('ссылка «Колесо бонусов» в мобильном меню', /\s*<a href="#roulette" class="mobile-nav-link">[\s\S]*?<\/a>/, '');
// каталог: сначала 8 карточек (2 ряда по 4), кнопка «Показать ещё (N)»
patch('каталог: 8 карточек', /let catalogVisibleCount = \d+;/, 'let catalogVisibleCount = 8;');
patch('каталог: 8 карточек при смене фильтра', /catalogVisibleCount = 20;/g, 'catalogVisibleCount = 8;');
// отзывы: новые файлы Frame_72…Frame_78.png (public/images/reviews/), по центру — Verde
patch('отзывы: имена файлов Frame_7X.png', /'Frame (7[2-8])\.png'/g, "'Frame_$1.png'");
patch('отзывы: старт с Verde по центру', /let shift = 0;/, 'let shift = spacing * 4;');

fs.writeFileSync(indexPath, html);
console.log(html.includes('clientWidth/6085') ? 'OK  скрипт --u на месте' : '!!  скрипт --u не найден — проверьте sections.html');
console.log(html.includes('/css/redesign.css') ? 'OK  подключён /css/redesign.css' : '!!  нет /css/redesign.css');
console.log('\nДальше: bash download-assets.sh  →  положить Frame_72…78.png в public/images/reviews/  →  npm start');