<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Статус заказа — Hustlify</title>
<link href="https://fonts.googleapis.com/css2?family=Unbounded:wght@600;800&family=Inter:wght@400;600&display=swap" rel="stylesheet">
<style>
  body{background:#08090a;color:#f5f5f4;font-family:'Inter',sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;margin:0;}
  .card{max-width:440px;text-align:center;padding:44px 36px;border:1px solid rgba(255,255,255,.08);border-radius:28px;background:#141517;}
  .icon{width:64px;height:64px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:30px;}
  .icon.paid{background:rgba(34,197,139,.15);color:#22c58b;}
  .icon.pending{background:rgba(255,255,255,.08);color:#8b8d92;}
  h1{font-family:'Unbounded';font-size:22px;margin:0 0 10px;}
  p{color:#8b8d92;font-size:14.5px;line-height:1.6;margin:0 0 26px;}
  a{display:inline-block;background:#fff;color:#08090a;padding:14px 30px;border-radius:100px;font-weight:600;font-size:14px;text-decoration:none;}
  .status{font-size:13px;color:#5c5e63;margin-top:16px;}
</style>
</head>
<body>
  <div class="card">
    <div class="icon pending" id="icon">⏳</div>
    <h1 id="title">Проверяем оплату…</h1>
    <p id="text">Подождите пару секунд — мы уточняем статус вашего заказа у платёжной системы.</p>
    <a href="/">Вернуться в магазин</a>
    <div class="status" id="orderId"></div>
  </div>
<script>
const params = new URLSearchParams(location.search);
const orderId = params.get('order');
document.getElementById('orderId').textContent = orderId ? 'Заказ: ' + orderId : '';

async function poll(){
  if(!orderId) return;
  try{
    const res = await fetch('/api/orders/' + orderId);
    const order = await res.json();
    if(order.status === 'paid'){
      document.getElementById('icon').className = 'icon paid';
      document.getElementById('icon').textContent = '✓';
      document.getElementById('title').textContent = 'Оплата получена!';
      document.getElementById('text').textContent = 'Спасибо за заказ. Мы уже начали его обработку и скоро свяжемся с вами.';
      return;
    }
  }catch(e){}
  setTimeout(poll, 2500);
}
poll();
</script>
</body>
</html>
