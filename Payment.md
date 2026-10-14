# Интеграция платёжной системы RollyPay

Все способы оплаты на платформе переведены на платёжный шлюз **RollyPay**.
Покупатель оформляет заказ и переходит на защищённую форму оплаты RollyPay, где может выбрать любой удобный для него метод:
- **СБП (Система быстрых платежей)** по QR-коду и ссылке
- **Банковские карты** (МИР, Visa, Mastercard)
- **Криптовалюта** (USDT и др.)

---

## 1. Реквизиты кассы RollyPay

- **Terminal ID:** получите в личном кабинете RollyPay
- **API Key:** получите в личном кабинете RollyPay
- **Signing Secret (секрет подписи):** получите в личном кабинете RollyPay

Переменные окружения в `.env`:
```env
ROLLYPAY_TERMINAL_ID=ваш_terminal_id
ROLLYPAY_API_KEY=ваш_api_key
ROLLYPAY_SIGNING_SECRET=ваш_signing_secret
```

Задайте все три значения через переменные окружения. Не храните реальные ключи в коде или документации.

---

## 2. Настройки в личном кабинете кассы RollyPay

- **Адрес для вебхуков (Callback URL):** `https://ВАШ-ДОМЕН/api/webhooks/rollypay`
- **После успешной оплаты (Success Redirect):** `https://ВАШ-ДОМЕН/payment-success.html`
- **После неуспешной оплаты (Fail Redirect):** `https://ВАШ-ДОМЕН/payment-fail.html`
- **Ссылка на поддержку (Support URL):** `https://t.me/HustlifyHelp`

---

## 3. Серверные маршруты

### Создание платежа:
- `POST /api/payments/rollypay/create` (или `POST /api/payments/create`)
  Тело запроса:
  ```json
  { "orderId": "hustlify_1727..." }
  ```
  Ответ:
  ```json
  {
    "success": true,
    "payUrl": "https://pay.rollypay.io/pay/...",
    "paymentId": "..."
  }
  ```

### Приём вебхуков:
- `POST /api/webhooks/rollypay`
  - Проверяет заголовок `X-Signature` по формуле: `HMAC-SHA256(signing_secret, X-Timestamp + "." + rawBody)`
  - При событии `payment.paid` (или статусе `paid`) переводит заказ в статус `paid`
  - Отправляет уведомление в Telegram администраторам
  - Сохраняет данные платежа в базе данных и `data/orders.json`
