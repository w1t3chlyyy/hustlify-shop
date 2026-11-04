/* Убирает из сайта формулировки, из-за которых платёжные системы отклоняют проект:
   обещания дохода, фейковые уведомления о покупках, «возврата нет», фиктивные цены.
   Запуск из корня проекта:  node apply-compliance-patch.js
   Резервные копии: *.bak5 */
const fs = require('fs');
const path = require('path');
const root = process.cwd();

function patch(rel, rules) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) { console.log('--  нет файла', rel); return; }
  let s = fs.readFileSync(file, 'utf8');
  if (!fs.existsSync(file + '.bak5')) fs.writeFileSync(file + '.bak5', s);
  let changed = 0;
  for (const [from, to, label] of rules) {
    const had = from instanceof RegExp ? from.test(s) : s.includes(from);
    if (!had) { console.log('!!  не найдено в ' + rel + ': ' + (label || String(from).slice(0, 60))); continue; }
    s = from instanceof RegExp ? s.replace(from, to) : s.split(from).join(to);
    changed++;
  }
  fs.writeFileSync(file, s);
  console.log('OK  ' + rel + ': применено правил ' + changed + ' из ' + rules.length);
}

const MAIN = [
  // --- мета ---
  ['<title>Hustlify — Сервис По Созданию Бизнеса с 0 Под Ключ</title>', '<title>Hustlify — дизайн, сайты и Telegram-боты под ключ</title>'],
  ['content="Hustlify — Сервис По Созданию Бизнеса с 0 Под Ключ"', 'content="Hustlify — дизайн, сайты и Telegram-боты под ключ"'],
  ['Платформа и маркетплейс готовых IT-бизнесов и стартапов с витриной товаров, корзиной, калькулятором окупаемости и готовыми решениями под ключ',
   'Студия дизайна и разработки: логотипы и баннеры, сайты, Telegram-боты, AI-агенты и готовые пакеты услуг под ключ'],
  // --- hero ---
  ['<span>до монетизации</span>', '<span>до запуска</span>'],
  ['<span class="l3"><u>за 2 недели</u></span>', '<span class="l3"><u>под ключ</u></span>'],
  ['Мы берём на себя всё: от идеи до первых денег.', 'Берём на себя дизайн, разработку и запуск.'],
  // --- калькулятор: вместо прогноза дохода — подбор кейса под бюджет ---
  ['Калькулятор окупаемости готового бизнеса', 'Подберём кейс под ваш бюджет'],
  ['<span class="rd-ph">Сумма инвестиций</span>', '<span class="rd-ph">Ваш бюджет</span>'],
  ['id="calcBudgetValue">50.000<', 'id="calcBudgetValue">15.000<'],
  ['min="10000" max="500000" step="5000" value="50000"', 'min="3000" max="50000" step="1000" value="15000"'],
  ['<span>10.000</span><span>500.000</span>', '<span>3.000</span><span>50.000</span>'],
  ['<span class="rd-pl">Месячная выручка</span>', '<span class="rd-pl">Подходящий кейс</span>'],
  ['<span class="rd-pl">Годовая доходность</span>', '<span class="rd-pl">Стоимость кейса</span>'],
  ['id="calcRevenueNum">155.000₽<', 'id="calcRevenueNum">—<'],
  ['id="calcRoiNum">350%<', 'id="calcRoiNum">—<'],
  [/if\(revNum\)[^\n]*\n/, `if(revNum || roiNum){
      var pool = (typeof casesData !== 'undefined' ? casesData : []).slice().sort(function(a,b){ return a.price-b.price; });
      var pick = null;
      pool.forEach(function(p){ if(p.price <= budget) pick = p; });
      if(!pick && pool.length) pick = pool[0];
      if(revNum) revNum.textContent = pick ? pick.name.replace(/^Кейс\\s*/,'') : '—';
      if(roiNum) roiNum.textContent = pick ? money(pick.price) : '—';
    }
`, 'расчёт revNum'],
  [/[ \t]*if\(roiNum\) roiNum\.textContent = roi[^\n]*\n/, '', 'строка roiNum'],
  [/[ \t]*if\(paybackNum\)[^\n]*\n/, '', 'строка paybackNum'],
  ["slider.addEventListener('input', updateCalc);", "slider.addEventListener('input', updateCalc);\n  setTimeout(updateCalc, 1200); setTimeout(updateCalc, 3500);"],
  // --- «Окупаемость» в мобильном меню ---
  ['<span>Калькулятор окупаемости</span>', '<span>Подбор под бюджет</span>'],
  // --- мастер подбора ---
  ['Окупаемость: 10-14 дней | Прибыль: от 90k ₽', 'Подробности — у менеджера'],
  // --- FAQ: возврат ---
  ['Согласно нашей политике, возврат товара недоступен. После подтверждения и оплаты заказа все права на товар переходят к покупателю, и сделка считается окончательной. Внимательно проверяйте состав корзины перед оплатой.',
   'Возврат регулируется законодательством РФ и Публичной офертой. Если услуга не оказана или оказана ненадлежащего качества, напишите в поддержку @HustlifyHelp с номером заказа — мы рассмотрим обращение и вернём оплату за неоказанную часть.'],
  // --- фейковые уведомления о «покупках» ---
  [/setTimeout\(showNext, 4000\);\s*setInterval\(showNext, 16000\);/, '/* уведомления о «покупках» отключены */', 'таймеры social proof'],
  ['<div class="social-proof-toast" id="socialProofToast">', '<div class="social-proof-toast" id="socialProofToast" style="display:none !important">']
];
patch('public/index.html', MAIN);
// то же для шаблона разделов, чтобы update-redesign.js не вернул старые тексты
patch('sections.html', MAIN.filter(r => !String(r[0]).includes('title>') && !String(r[0]).includes('content=') && !String(r[0]).includes('Платформа') && !String(r[0]).includes('social') && !String(r[0]).includes('showNext') && !String(r[0]).includes('slider.addEventListener')));

patch('public/ai-agent.html', [
  ['<title>Hustlify Agent — Консультант и Бизнес-Архитектор</title>', '<title>Hustlify Agent — AI-консультант по услугам</title>'],
  ['Интеллектуальный Hustlify Agent: подбор готовых IT-бизнесов, расчет окупаемости, Telegram Mini Apps и верификации.', 'AI-консультант Hustlify: подбор услуг и кейсов, дизайн, сайты, Telegram-боты и AI-агенты.'],
  ['Интеллектуальный бизнес-архитектор и консультант платформы', 'AI-консультант по услугам Hustlify'],
  ['ваш персональный бизнес-архитектор и консультант.', 'AI-консультант Hustlify (я бот, а не человек).'],
  ['<p>Я знаю всё о готовых IT-бизнесах, Telegram Mini Apps, ботах, тарифах, сроках и гарантиях в сервисе <strong>Hustlify</strong>.</p>',
   '<p>Помогу разобраться в услугах <strong>Hustlify</strong>: дизайн, сайты, Telegram-боты, AI-агенты и готовые кейсы.</p>'],
  ['<p>Задайте абсолютно любой вопрос — я отвечу по делу и помогу запустить систему, которая выведет вас на <strong>65 000 – 150 000+ ₽ чистой прибыли в месяц</strong>:</p>',
   '<p>Задайте вопрос по каталогу — отвечу по делу. Могу помочь:</p>'],
  ['<li>Подобрать готовый стартап или магазин под ваш бюджет</li>', '<li>Подобрать услугу или кейс под ваш бюджет</li>'],
  ['<li>Рассчитать окупаемость (от 7–14 дней) и сроки запуска (от 24 часов)</li>', '<li>Разобраться, что входит в каждую услугу</li>'],
  ['<li>Выстроить систему под ключ и вывести ваш проект на крупные платформы</li>', '<li>Выбрать между кейсами «Стандарт», «Расширенный» и «Премиум»</li>'],
  ['<li>Проконсультировать по верификациям криптокошельков и безопасной оплате</li>', '<li>Подсказать по оплате и связи с менеджером</li>'],
  ['<div class="rec-card-price">19 890 ₽ <span class="rec-card-old">69 000 ₽</span></div>', '<div class="rec-card-price">19 890 ₽</div>'],
  ['<div class="rec-card-price">4 289 ₽ <span class="rec-card-old">5 500 ₽</span></div>', '<div class="rec-card-price">19 890 ₽</div>'],
  ['Полностью выстраиваем систему. Выходим на крупные платформы.', 'Фирменный стиль, сайт или бот, платёжные сервисы, AI-агент. Срок: 14 дней.'],
  [/price: 19890,\s*old: 69000,/, 'price: 19890,\n    old: 0,', 'DEFAULT_PREMIUM_CASE old'],
  ['Диалог очищен. Задавайте абсолютно любой вопрос — отвечу на всё и помогу запустить ваш прибыльный проект под ключ!', 'Диалог очищен. Задавайте вопросы по услугам Hustlify.'],
  // подсказки-чипы
  ['Посоветуй готовый бизнес до 15 000 рублей с быстрой окупаемостью', 'Что можно заказать в Hustlify до 15 000 рублей?'],
  ['Бизнес до 15,000 ₽', 'Услуги до 15 000 ₽'],
  ['Какие гарантии окупаемости и способы безопасной оплаты доступны в сервисе?', 'Как проходит оплата и что делать, если нужен возврат?'],
  ['Гарантии и Оплата', 'Оплата и возврат'],
  ['Как подключить и верифицировать CryptoBot и Telegram Wallet?', 'Какие дизайн-услуги есть и сколько они стоят?'],
  ['Верификации', 'Дизайн'],
  ['Как работает бот Автовыдачи 24/7 для продажи цифровых товаров?', 'Что входит в разработку Telegram-бота?'],
  ['Автовыдача 24/7', 'Telegram-боты'],
  // боковая панель
  ['Рекомендуем: <b>Telegram Mini App (8 990 ₽)</b> + Автовыдача 24/7 (5 990 ₽).', 'Рекомендуем: <b>Telegram-бот с оформлением (4 289 ₽)</b>'],
  [/if \(val < 5000\) \{[\s\S]*?\n    \}\n  \}\);/, `if (val < 3289) {
      calcMatchText.innerHTML = 'Рекомендуем: <b>логотип, баннер или аватарка</b> из раздела «Дизайн»';
    } else if (val < 4289) {
      calcMatchText.innerHTML = 'Рекомендуем: <b>Кейс «Стандарт» (3 289 ₽)</b>';
    } else if (val < 15890) {
      calcMatchText.innerHTML = 'Рекомендуем: <b>Telegram-бот с оформлением (4 289 ₽)</b>';
    } else if (val < 19890) {
      calcMatchText.innerHTML = 'Рекомендуем: <b>Кейс «Расширенный» (15 890 ₽)</b>';
    } else {
      calcMatchText.innerHTML = 'Рекомендуем: <b>Кейс «Премиум» (19 890 ₽)</b>';
    }
  });`, 'ветки подбора по бюджету'],
  ['Составь подробный план запуска IT-бизнеса в Hustlify под этот бюджет.', 'Подскажи, какие услуги Hustlify подойдут под этот бюджет.'],
  ['Запуск типовых проектов всего за <b>24 часа</b>', 'Сроки согласуются с менеджером до оплаты'],
  ['Скидочная рулетка каждые 24 часа (до <b>-30%</b>)', 'Промокоды и скидки для клиентов'],
  ['Быстрый расчет по бюджету', 'Подбор по бюджету'],
  ['Спросить AI план под этот бюджет', 'Спросить AI, что подойдёт']
]);

patch('index.js', [
  ['Ты Hustlify Agent — консультант магазина готовых IT-бизнесов и цифровых услуг Hustlify. ', 'Ты Hustlify Agent — AI-консультант студии дизайна и разработки Hustlify. Ты бот, а не человек. '],
  ['возврат товара не предусмотрен; ', 'вопросы возврата решаются по закону РФ и публичной оферте через @HustlifyHelp; '],
  ['Я консультант Hustlify. В нашем каталоге готовых IT-бизнесов представлены решения под ключ: Telegram Mini Apps, сервисы AI-агентов, дизайн-пакеты и верификации. Вы можете ознакомиться с решениями на главной странице',
   'Я AI-консультант Hustlify. В каталоге представлены дизайн, сайты, Telegram-боты, AI-агенты и готовые кейсы. Вы можете ознакомиться с ними на главной странице']
]);

// CSS: скрыть блоки, которые были про доходность
const css = path.join(root, 'public', 'css', 'redesign.css');
if (fs.existsSync(css)) {
  let c = fs.readFileSync(css, 'utf8');
  if (!c.includes('/* compliance-patch */')) {
    if (!fs.existsSync(css + '.bak5')) fs.writeFileSync(css + '.bak5', c);
    c += `
/* compliance-patch: калькулятор без прогнозов дохода */
.rd-panel.m-c, .rd-panel.m-d, .rd-panel.cat{ display:none; }
.rd-panel.m-a .rd-ph{ white-space:normal; }
@media (min-width:861px){ .rd-panel.m-a .rd-ph{ font-size:calc(72 * var(--u)); } }
`;
    fs.writeFileSync(css, c);
    console.log('OK  public/css/redesign.css');
  }
}
console.log('\nГотово. Далее: node sync-products.js  и  npm start');
