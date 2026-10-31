/* Применяет редизайн к public/index.html.
   Запуск из корня проекта:  node apply-redesign.js
   (файлы sections.html и redesign.css должны лежать рядом со скриптом или в папке redesign/) */
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const indexPath = path.join(root, 'public', 'index.html');
const here = __dirname;
const sectionsPath = [path.join(here, 'sections.html'), path.join(root, 'redesign', 'sections.html')].find(fs.existsSync);
if (!fs.existsSync(indexPath)) { console.error('Не найден public/index.html. Запускайте из корня проекта.'); process.exit(1); }
if (!sectionsPath) { console.error('Не найден sections.html рядом со скриптом.'); process.exit(1); }

let html = fs.readFileSync(indexPath, 'utf8');
if (html.includes('class="rd-hero"')) { console.log('Редизайн уже применён — ничего не делаю.'); process.exit(0); }

fs.writeFileSync(indexPath + '.bak', html);
console.log('Резервная копия: public/index.html.bak');

// 1. заменить блок от <header> до секции кейсов
const start = html.indexOf('<header>');
const end = html.indexOf('<section class="section" id="cases">');
if (start === -1 || end === -1 || end < start) { console.error('Не нашёл границы блока (<header> … id="cases"). Файл не изменён.'); process.exit(1); }
let sections = fs.readFileSync(sectionsPath, 'utf8').replace(/^\s*<!--[\s\S]*?-->\s*/, '');
html = html.slice(0, start) + sections + '\n\n' + html.slice(end);
console.log('OK  разметка заменена');

// 2. подключить CSS
if (!html.includes('/css/redesign.css')) {
  html = html.replace('</head>', '<link rel="stylesheet" href="/css/redesign.css">\n</head>');
  console.log('OK  подключён /css/redesign.css');
}

// 3. правки JS калькулятора
function patch(name, re, repl) {
  if (re.test(html)) { html = html.replace(re, repl); console.log('OK  ' + name); }
  else console.log('!!  не нашёл: ' + name + ' (поправьте вручную по PATCH.md)');
}
patch('слайдер (--pct)', /[ \t]*slider\.style\.background\s*=.*\n/, "    slider.parentElement.style.setProperty('--pct', pct + '%');\n");
patch('формат бюджета', /if\(budgetVal\)\s*budgetVal\.textContent\s*=.*\n/, "if(budgetVal) budgetVal.textContent = budget.toLocaleString('de-DE');\n");
patch('формат выручки', /if\(revNum\)\s*revNum\.textContent\s*=.*\n/, "if(revNum) revNum.textContent = monthlyRev.toLocaleString('de-DE') + '₽';\n");
patch('текст кнопки', /[ \t]*if\(ctaBtn\)\s*ctaBtn\.innerHTML\s*=.*\n/, '');

fs.writeFileSync(indexPath, html);
console.log('\nГотово. Проверьте: npm start');
