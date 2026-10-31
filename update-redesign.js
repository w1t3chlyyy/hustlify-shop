/* Обновляет уже применённый редизайн: заменяет блок от <section class="rd-hero"> до секции кейсов
   на актуальный sections.html. Остальной index.html не трогает.
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

fs.writeFileSync(indexPath + '.bak2', html);
const sections = fs.readFileSync(sectionsPath, 'utf8').replace(/^\s*<!--[\s\S]*?-->\s*/, '');
html = html.slice(0, start) + sections + '\n\n' + html.slice(end);
fs.writeFileSync(indexPath, html);
console.log('OK  блок редизайна обновлён (копия: public/index.html.bak2)');
console.log(html.includes("clientWidth/6085") ? 'OK  скрипт --u на месте' : '!!  скрипт --u не найден — проверьте sections.html');