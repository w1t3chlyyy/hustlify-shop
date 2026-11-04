/* Плавающее меню-капсула: при прокрутке страницы появляется сверху по центру,
   скругление максимальное, остаётся на экране на всей странице.
   Запуск из корня проекта:  node apply-sticky-nav.js   (копии: *.bak6) */
const fs = require('fs');
const path = require('path');
const root = process.cwd();

const MARKUP = `<!-- rd-pill-nav -->
<nav class="rd-pill-nav" id="rdPillNav" aria-label="Основная навигация">
  <a href="/" class="pn-logo" aria-label="Hustlify"><img src="/images/design/logo.svg" alt="Hustlify"></a>
  <div class="pn-links">
    <a href="#calculator">Калькулятор</a>
    <a href="#catalog">Каталог</a>
    <a href="#about">О нас</a>
    <a href="#faq">FAQ</a>
    <a href="https://t.me/HustlifyHelp" target="_blank" rel="noopener">Поддержка</a>
  </div>
  <div class="pn-tools">
    <button type="button" class="pn-ico" data-proxy="searchBtn" aria-label="Поиск"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg></button>
    <button type="button" class="pn-ico" data-proxy="cartBtn" aria-label="Корзина"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1.5"/><circle cx="19" cy="21" r="1.5"/><path d="M2.5 3h2l2.4 12.4a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 2-1.6L21 7.5H6"/></svg><span class="pn-badge" id="pillCartCount" hidden>0</span></button>
  </div>
  <a href="#contacts" class="pn-cta">Контакты</a>
</nav>
<script>
(function(){
  var nav = document.getElementById('rdPillNav');
  if (!nav) return;
  var ticking = false;
  function update(){ nav.classList.toggle('show', (window.pageYOffset || document.documentElement.scrollTop) > 160); ticking = false; }
  addEventListener('scroll', function(){ if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  addEventListener('resize', update);
  update();

  /* кнопки поиска и корзины запускают те же обработчики, что и в шапке */
  nav.querySelectorAll('[data-proxy]').forEach(function(b){
    b.addEventListener('click', function(){ var t = document.getElementById(b.getAttribute('data-proxy')); if (t) t.click(); });
  });

  /* счётчик корзины */
  function syncBadge(){
    var src = document.getElementById('cartCount'), dst = document.getElementById('pillCartCount');
    if (!dst) return;
    var n = src ? src.textContent.trim() : '0';
    dst.textContent = n; dst.hidden = (!n || n === '0');
  }
  function bindBadge(){
    var src = document.getElementById('cartCount');
    if (src) new MutationObserver(syncBadge).observe(src, { childList: true, characterData: true, subtree: true });
    syncBadge();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindBadge); else bindBadge();

  /* подсветка текущего раздела */
  if ('IntersectionObserver' in window) {
    var links = {};
    nav.querySelectorAll('.pn-links a[href^="#"]').forEach(function(a){ links[a.getAttribute('href').slice(1)] = a; });
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if (!en.isIntersecting) return;
        Object.keys(links).forEach(function(k){ links[k].classList.toggle('active', k === en.target.id); });
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    Object.keys(links).forEach(function(id){ var s = document.getElementById(id); if (s) io.observe(s); });
  }
})();
</script>

`;

const CSS = `
/* sticky-pill-nav */
.rd-pill-nav{
  position:fixed; top:14px; left:50%; z-index:200;
  display:flex; align-items:center; gap:clamp(12px,1.8vw,30px);
  max-width:calc(100vw - 24px); padding:8px 8px 8px 20px;
  border-radius:9999px;
  background:rgba(10,10,12,.72);
  -webkit-backdrop-filter:blur(14px) saturate(140%); backdrop-filter:blur(14px) saturate(140%);
  border:1px solid rgba(255,255,255,.16);
  box-shadow:0 12px 36px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.08);
  color:#fff;
  transform:translate(-50%,-160%); opacity:0; pointer-events:none;
  transition:transform .5s cubic-bezier(.16,1,.3,1), opacity .3s ease;
}
.rd-pill-nav.show{ transform:translate(-50%,0); opacity:1; pointer-events:auto; }
.pn-logo{ display:flex; align-items:center; flex:none; }
.pn-logo img{ height:30px; width:auto; display:block; max-width:none; }
.pn-links{ display:flex; align-items:center; gap:clamp(14px,1.6vw,26px); }
.pn-links a{
  font:600 14px/1 'Montserrat',sans-serif; letter-spacing:-.01em; white-space:nowrap;
  color:rgba(255,255,255,.72); text-decoration:none; transition:color .2s;
}
.pn-links a:hover, .pn-links a.active{ color:#fff; }
.pn-tools{ display:flex; align-items:center; gap:4px; }
.pn-ico{
  position:relative; width:38px; height:38px; border-radius:50%; border:0; background:transparent;
  color:#fff; display:flex; align-items:center; justify-content:center; cursor:pointer; transition:background .2s;
}
.pn-ico:hover{ background:rgba(255,255,255,.12); }
.pn-ico svg{ width:18px; height:18px; }
.pn-badge{
  position:absolute; top:1px; right:1px; min-width:16px; height:16px; padding:0 4px; border-radius:9999px;
  background:#2f6bff; color:#fff; font:700 10px/16px 'Inter',sans-serif; text-align:center;
}
.pn-cta{
  flex:none; display:flex; align-items:center; height:40px; padding:0 22px; border-radius:9999px;
  background:#2f6bff; color:#fff; text-decoration:none; white-space:nowrap;
  font:600 14px/1 'Unbounded',sans-serif; letter-spacing:-.02em; transition:filter .2s, transform .2s;
}
.pn-cta:hover{ filter:brightness(1.1); transform:translateY(-1px); }
@media (max-width:1100px){ .pn-links{ display:none; } }
@media (max-width:860px){ .rd-pill-nav{ display:none; } } /* на мобильных работает нижняя панель */
`;

// 1) разметка в index.html (перед блоком hero, чтобы update-redesign.js её не затирал)
const indexPath = path.join(root, 'public', 'index.html');
if (!fs.existsSync(indexPath)) { console.error('Не найден public/index.html. Запускайте из корня проекта.'); process.exit(1); }
let html = fs.readFileSync(indexPath, 'utf8');
if (html.includes('id="rdPillNav"')) {
  console.log('--  меню-капсула уже добавлено');
} else {
  const at = html.indexOf('<section class="rd-hero"');
  if (at === -1) { console.error('Не нашёл <section class="rd-hero"> в index.html. Файл не изменён.'); process.exit(1); }
  fs.writeFileSync(indexPath + '.bak6', html);
  html = html.slice(0, at) + MARKUP + html.slice(at);
  fs.writeFileSync(indexPath, html);
  console.log('OK  public/index.html');
}

// 2) стили
const cssPath = path.join(root, 'public', 'css', 'redesign.css');
if (!fs.existsSync(cssPath)) { console.error('Не найден public/css/redesign.css'); process.exit(1); }
let css = fs.readFileSync(cssPath, 'utf8');
if (css.includes('/* sticky-pill-nav */')) console.log('--  стили уже добавлены');
else {
  fs.writeFileSync(cssPath + '.bak6', css);
  fs.writeFileSync(cssPath, css + CSS);
  console.log('OK  public/css/redesign.css');
}
console.log('\nГотово. Обновите страницу (Ctrl+F5) и прокрутите вниз.');
