/* Обновляет редизайн в public/index.html: заменяет весь блок от <section class="rd-hero">
   до <footer> (часть 1 + часть 2) на актуальный sections.html, копирует redesign.css в public/css/,
   правит ленту отзывов, карточки проектов и убирает всплывающее уведомление о продажах.
   Запуск из корня проекта:  node update-redesign.js
   (файлы sections.html и redesign.css лежат рядом со скриптом или в корне проекта) */
const fs = require('fs');
const path = require('path');
const root = process.cwd();
const indexPath = path.join(root, 'public', 'index.html');
const find = (name) => [path.join(__dirname, name), path.join(root, name), path.join(root, 'redesign', name)].find(fs.existsSync);
const sectionsPath = find('sections.html');
if (!fs.existsSync(indexPath)) { console.error('Не найден public/index.html. Запускайте из корня проекта.'); process.exit(1); }
if (!sectionsPath) { console.error('Не найден sections.html.'); process.exit(1); }

let html = fs.readFileSync(indexPath, 'utf8');
const start = html.indexOf('<section class="rd-hero"');
const end = html.indexOf('<footer>');
if (start === -1 || end === -1 || end < start) { console.error('Не нашёл блок редизайна (rd-hero … <footer>). Файл не изменён.'); process.exit(1); }

fs.writeFileSync(indexPath + '.bak5', html);
const sections = fs.readFileSync(sectionsPath, 'utf8').replace(/^\s*<!--[\s\S]*?-->\s*/, '');
html = html.slice(0, start) + sections + '\n\n' + html.slice(end);
console.log('OK  разметка заменена (копия: public/index.html.bak5)');

// CSS: положить в public/css и подключить
const cssSrc = find('redesign.css');
const cssDst = path.join(root, 'public', 'css', 'redesign.css');
if (cssSrc && path.resolve(cssSrc) !== path.resolve(cssDst)) {
  fs.mkdirSync(path.dirname(cssDst), { recursive: true });
  fs.copyFileSync(cssSrc, cssDst);
  console.log('OK  redesign.css → public/css/redesign.css');
}
html = html.replace(/[ \t]*<link rel="stylesheet" href="\/redesign\.css">\s*\n?/g, '');
html = html.replace(/[ \t]*<script src="\/redesign\.js"><\/script>\s*\n?/g, '');
if (!html.includes('/css/redesign.css')) html = html.replace('</head>', '<link rel="stylesheet" href="/css/redesign.css">\n</head>');

function patch(name, re, repl) {
  if (re.test(html)) { html = html.replace(re, repl); console.log('OK  ' + name); }
  else console.log('--  ' + name + ': уже применено или не найдено');
}

// ---- лента отзывов ----
patch('имена файлов отзывов', /Frame (7\d)\.png/g, 'Frame_$1.png');
patch('ширина карточки отзыва', /parseInt\(getComputedStyle\(document\.documentElement\)\.getPropertyValue\('--card-w'\)\) \|\| 240/g,
  "(document.documentElement.clientWidth <= 900 ? 190 : Math.round(document.documentElement.clientWidth * 1380 / 6085))");
patch('отступ между карточками', /spacing = cardW \+ 28;/g, 'spacing = cardW + 28 * cardW / 240;');
patch('VISUAL_RANGE', /const VISUAL_RANGE = 740;/, 'let VISUAL_RANGE = 740 * cardW / 240;');
patch('MAX_DEPTH', /const MAX_DEPTH = 150;/, 'let MAX_DEPTH = 150 * cardW / 240;');
patch('FADE_WIDTH', /const FADE_WIDTH = 150;/, 'let FADE_WIDTH = 150 * cardW / 240;');
patch('SPEED', /const SPEED = 42;/, 'let SPEED = 42 * cardW / 240;');
patch('пересчёт при ресайзе', /(function updateMetrics\(\) \{\s*cardW = [^;]+;)/,
  '$1\n    VISUAL_RANGE = 740 * cardW / 240; MAX_DEPTH = 150 * cardW / 240; FADE_WIDTH = 150 * cardW / 240; SPEED = 42 * cardW / 240;');

// ---- карточки проектов: кнопка-«портфель» ведёт в портфолио (только если оно задано),
//      клик по всей карточке открывает подробности (как на макете) ----
patch('кнопка портфолио в карточке проекта',
  /<button class="pbtn \$\{btnClass\}" onclick="openProjectModal\('\$\{escapeHtml\(p\.id\)\}'\)"[^>]*>Подробнее<\/button>/,
  () => '${p.portfolioUrl ? `<a class="pbtn ${btnClass}" href="${escapeHtml(p.portfolioUrl)}" target="_blank" rel="noopener noreferrer" title="Портфолио" data-nomodal></a>` : \'\'}');
patch('клик по карточке проекта открывает окно',
  /\n\s*if\(!card\.classList\.contains\('flipped'\)\) return;/, '');

// ---- всплывающее уведомление о продажах (справа снизу) отключено; остаётся только опрос ----
patch('таймеры уведомления о продажах',
  /[ \t]*setTimeout\(showNext, 4000\);\s*\n[ \t]*setInterval\(showNext, 16000\);/, '  /* уведомления о продажах отключены */');

fs.writeFileSync(indexPath, html);
console.log(html.includes('clientWidth / 6085') || html.includes('clientWidth/6085') ? 'OK  скрипт --u на месте' : '!!  скрипт --u не найден — проверьте sections.html');
console.log('\nГотово. Дальше: bash download-assets.sh (если ещё не качали картинки) и npm start');