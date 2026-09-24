# Инструкция по быстрому возврату CryptoBot и оплаты по реквизитам

RollyPay стал единственным видимым способом оплаты в чекауте (клиент сам выбирает
СБП / карту / USDT прямо на странице оплаты RollyPay — переключать методы на сайте
не нужно). Backend CryptoBot и оплаты по реквизитам никуда не делся — эндпоинты
`/api/payments/cryptobot/create`, `/api/webhooks/cryptobot`, `/api/orders/:id/receipt`,
`/api/requisites` в `index.js` полностью рабочие и не менялись. Скрыты только кнопки
на фронте, в `public/index.html`.

---

## 1. Вернуть кнопку CryptoBot (1 минута)

Откройте `public/index.html`, найдите модалку `payModal` и блок:

```html
<!-- CRYPTOBOT & REQUISITES PAYMENT BUTTONS (HIDDEN - See PAYMENT_METHODS_RESTORE_GUIDE.md)
<button class="btn btn-white" id="payCryptoBot" style="justify-content:center;">
  ...
</button>
<button class="btn btn-outline" id="payRequisites" style="justify-content:center;">
  ...
</button>
-->
```

Снимите HTML-комментарий `<!--` и `-->` вокруг блока — кнопки снова появятся в
окне выбора оплаты рядом с кнопкой RollyPay.

Затем в `<script>` этой же страницы найдите:

```js
/* CRYPTOBOT & REQUISITES (HIDDEN - See PAYMENT_METHODS_RESTORE_GUIDE.md)
document.getElementById('payCryptoBot').onclick = ()=> startPayment('cryptobot');
document.getElementById('payRequisites').onclick = async ()=>{
  ...
};
*/
```

Уберите `/*` и `*/` — обработчики клика заработают.

Убедитесь, что в `.env` заполнен `CRYPTOBOT_TOKEN` (получить в `@CryptoBot` →
«Crypto Pay» → «Create App») — без него сервер вернёт ошибку «CRYPTOBOT_TOKEN не
настроен на сервере».

## 2. Вернуть оплату по реквизитам

Восстанавливается тем же снятием комментария из п.1 — кнопка `payRequisites` и её
обработчик (открывает окно с реквизитами, принимает загрузку чека) идут в том же
блоке. Сами реквизиты редактируются в админке, вкладка «Реквизиты» — они не менялись
и не терялись.

## 3. Если нужны все способы сразу — вместе с RollyPay

Просто выполните п.1–2 и оставьте кнопку `payRollyPay` нетронутой — в модалке
`payModal` будет сразу три варианта оплаты. Дополнительный код не нужен, все три
обработчика независимы друг от друга.
