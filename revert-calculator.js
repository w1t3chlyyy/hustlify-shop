/* Возвращает прежний калькулятор окупаемости (выручка, годовая доходность, срок окупаемости).
   Остальные правки (возврат в FAQ, hero, уведомления, меню-капсула) остаются.
   Запуск из корня проекта:  node revert-calculator.js   (копии: *.bak7) */
const fs = require('fs');
const path = require('path');
const root = process.cwd();

function patch(rel, rules) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) { console.log('--  нет файла', rel); return; }
  let s = fs.readFileSync(file, 'utf8');
  if (!fs.existsSync(file + '.bak7')) fs.writeFileSync(file + '.bak7', s);
  let n = 0;
  for (const [from, to, label] of rules) {
    const had = from instanceof RegExp ? from.test(s) : s.includes(from);
    if (!had) { console.log('--  уже возвращено / не найдено в ' + rel + ': ' + (label || String(from).slice(0, 50))); continue; }
    s = from instanceof RegExp ? s.replace(from, to) : s.split(from).join(to);
    n++;
  }
  fs.writeFileSync(file, s);
  console.log('OK  ' + rel + ': возвращено правил ' + n);
}

const RULES = [
  ['Подберём кейс под ваш бюджет', 'Калькулятор окупаемости готового бизнеса'],
  ['<span class="rd-ph">Ваш бюджет</span>', '<span class="rd-ph">Сумма инвестиций</span>'],
  ['id="calcBudgetValue">15.000<', 'id="calcBudgetValue">50.000<'],
  ['min="3000" max="50000" step="1000" value="15000"', 'min="10000" max="500000" step="5000" value="50000"'],
  ['<span>3.000</span><span>50.000</span>', '<span>10.000</span><span>500.000</span>'],
  ['<span class="rd-pl">Подходящий кейс</span>', '<span class="rd-pl">Месячная выручка</span>'],
  ['<span class="rd-pl">Стоимость кейса</span>', '<span class="rd-pl">Годовая доходность</span>'],
  ['id="calcRevenueNum">—<', 'id="calcRevenueNum">155.000₽<'],
  ['id="calcRoiNum">—<', 'id="calcRoiNum">350%<'],
  [/if\(revNum \|\| roiNum\)\{[\s\S]*?\n    \}\n/,
   "if(revNum) revNum.textContent = monthlyRev.toLocaleString('de-DE') + '₽';\n    if(roiNum) roiNum.textContent = roi + '%';\n    if(paybackNum) paybackNum.textContent = paybackDays + ' дней';\n",
   'расчёт выручки/ROI/окупаемости'],
  ['\n  setTimeout(updateCalc, 1200); setTimeout(updateCalc, 3500);', ''],
  ['<span>Подбор под бюджет</span>', '<span>Калькулятор окупаемости</span>']
];
patch('public/index.html', RULES);
patch('sections.html', RULES);

const css = path.join(root, 'public', 'css', 'redesign.css');
if (fs.existsSync(css)) {
  let c = fs.readFileSync(css, 'utf8');
  const re = /\n?\/\* compliance-patch[^\n]*\n\.rd-panel\.m-c[^\n]*\n\.rd-panel\.m-a \.rd-ph\{[^\n]*\n@media[^\n]*\n/;
  if (re.test(c)) {
    if (!fs.existsSync(css + '.bak7')) fs.writeFileSync(css + '.bak7', c);
    fs.writeFileSync(css, c.replace(re, '\n'));
    console.log('OK  public/css/redesign.css');
  } else console.log('--  redesign.css: скрытие блоков уже снято / не найдено');
}
console.log('\nГотово. Обновите страницу (Ctrl+F5).');