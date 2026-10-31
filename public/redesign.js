/* Hustlify redesign: DOM tweaks on top of index.html */
(function(){
  var R='/images/redesign/';
  function $(s){return document.querySelector(s);}

  /* HERO: статичная картинка вместо видео + бесконечно вращающиеся объекты */
  var wrap=$('#heroMediaWrap');
  if(wrap){
    var v=$('#heroVideo'); if(v){v.pause();v.remove();}
    var im=document.createElement('img');im.className='hero-img';im.src=R+'hero.png';im.alt='';
    wrap.insertBefore(im,wrap.firstChild);
  }
  var title=$('#heroTitle');
  if(title&&!title.querySelector('.hero-float')){
    var mk=function(n){var f=document.createElement('img');f.src=R+n+'.png';f.alt='';f.className='hero-float '+n;return f;};
    var em=title.querySelector('em');
    if(em&&em.nextSibling)title.insertBefore(mk('cube'),em.nextSibling.nextSibling||null);
    var u=title.querySelector('u');
    if(u)u.parentNode.insertBefore(mk('sphere'),u);
  }

  /* CALC: две карточки слева */
  var inp=$('.calc-inputs');
  if(inp&&!inp.querySelector('.calc-box')){
    var k=Array.from(inp.children);
    var a=document.createElement('div');a.className='calc-box budget';
    var b=document.createElement('div');b.className='calc-box cats';
    k.forEach(function(el,i){(i<4?a:b).appendChild(el);});
    inp.appendChild(a);inp.appendChild(b);
  }

  /* PROCESS: 4 шага в белой карточке */
  var pl=$('#processList');
  if(pl){
    var sec=pl.closest('.section');
    var w=sec.querySelector('.wrap');w.id='processWrap';
    pl.className='process-list p4';
    var steps=[
      ['001','Анализ конкурентов','Смотрим, что работает у других — берём лучшее, добавляем своё','step1'],
      ['002','Стратегия','Чёткий план: что делаем, зачем и какой результат ждать','step2'],
      ['003','Реализация','Делаем дизайн, настраиваем рекламу или SMM — без воды и лишних правок','step3'],
      ['004','Передача файлов','Передаём весь проект вам, все системы и разработку на ваши аккаунты','step4']];
    pl.innerHTML=steps.map(function(s){return '<div class="pstep show"><small>'+s[0]+'</small><h3>'+s[1]+'</h3><p>'+s[2]+'</p><img src="'+R+s[3]+'.png" alt=""></div>';}).join('');
  }

  /* CEO */
  var ceo=document.querySelector('.team-photo img');if(ceo)ceo.src=R+'ceo.png';

  /* FAQ: картинка слева */
  var fg=$('.faq-grid');
  if(fg&&!fg.querySelector('.faq-img')){
    fg.classList.add('withimg');
    var d=document.createElement('div');d.className='faq-img';d.innerHTML='<img src="'+R+'faq.png" alt="">';
    fg.insertBefore(d,fg.firstChild);
  }

  /* CONTACTS: наушники + подписи кнопок */
  var cg=$('#contacts .contacts-orig-grid');
  if(cg&&!cg.querySelector('.support-img')){
    var s=document.createElement('img');s.className='support-img';s.src=R+'support.png';s.alt='';cg.appendChild(s);
    var links=cg.querySelectorAll('.contacts-orig-links a');
    var names=['Telegram','HustlifyAI','MiniApp'];
    links.forEach(function(a,i){var sp=a.querySelector('span');if(sp)sp.textContent=names[i]||sp.textContent;});
    var l=cg.querySelector('.contacts-orig-links');
    if(links[2]&&links[1])l.insertBefore(links[2],links[1]);
  }
})();
