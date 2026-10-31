/* Обновляет редизайн в public/index.html: заменяет блок от <section class="rd-hero"> до секции кейсов
   на актуальный sections.html и убирает устаревшие подключения /redesign.css и /redesign.js.
   Запуск из корня проекта:  node update-redesign.js */
const fs = require('fs');
const path = require('path');
const root = process.cwd();
const indexPath = path.join(root, 'public', 'index.html');
const sectionsPath = [path.join(__dirname, 'sections.html'), path.join(root, 'sections.html'), path.join(root, 'redesign', 'sections.html')].find(fs.existsSync);
if (!fs.existsSync(indexPath)) { console.error('Не найден public/index.html. Запускайте из корня проекта.'); process.exit(1); }
if (!sectionsPath) { console.error('Не найден sections.html.'); process.exit(1); }

let html = fs.readFileSync(indexPath, 'utf8');
const start = html.indexOf('<section class="rd-hero"');
const end = html.indexOf('<section class="section" id="cases">');
if (start === -1 || end === -1 || end < start) { console.error('Не нашёл блок редизайна или секцию кейсов. Файл не изменён.'); process.exit(1); }

fs.writeFileSync(indexPath + '.bak3', html);
const sections = fs.readFileSync(sectionsPath, 'utf8').replace(/^\s*<!--[\s\S]*?-->\s*/, '');
html = html.slice(0, start) + sections + '\n\n' + html.slice(end);

// устаревшие дубли, которые перебивали/ломали новый CSS
html = html.replace(/[ \t]*<link rel="stylesheet" href="\/redesign\.css">\s*\n?/g, '');
html = html.replace(/[ \t]*<script src="\/redesign\.js"><\/script>\s*\n?/g, '');
if (!html.includes('/css/redesign.css')) html = html.replace('</head>', '<link rel="stylesheet" href="/css/redesign.css">\n</head>');

fs.writeFileSync(indexPath, html);
console.log('OK  блок редизайна обновлён (копия: public/index.html.bak3)');
console.log(html.includes('clientWidth/6085') ? 'OK  скрипт --u на месте' : '!!  скрипт --u не найден — проверьте sections.html');
console.log(html.includes('/css/redesign.css') ? 'OK  подключён /css/redesign.css' : '!!  нет /css/redesign.css');