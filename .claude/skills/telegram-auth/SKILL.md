---
name: telegram-auth
description: Правила авторизації покупця через Telegram Mini App для STREETSTORE.13 — перевірка initData через HMAC-SHA256, свіжість auth_date, ідентифікація тільки з перевірених даних, токен бота лише з env. Use when implementing or changing Telegram login, initData validation, user identity, bot token handling or the Telegram bot.
---

# Авторизація через Telegram

## Перевірка initData

1. Клієнт надсилає сирий рядок `Telegram.WebApp.initData` (не `initDataUnsafe`) на
   `POST /api/v1/auth/telegram`. Сервер перевіряє його **до** будь-якого використання даних.
2. Алгоритм (офіційний для Mini Apps):
   - розібрати рядок як query string; витягти й прибрати поле `hash`
     (поле `signature`, якщо є, лишається в data-check-string);
   - `data_check_string` = решта пар `key=value`, відсортованих за ключем, через `\n`;
   - `secret_key = HMAC_SHA256(key = "WebAppData", message = bot_token)`;
   - `expected = hex(HMAC_SHA256(key = secret_key, message = data_check_string))`;
   - порівняти `expected` і `hash` через `crypto.timingSafeEqual` (однакова довжина,
     інакше — відмова).
3. Перевірити `auth_date`: не старіше за `TELEGRAM_INIT_DATA_TTL_SECONDS` (за замовчуванням
   86400 с = 24 години, рішення власника) і не з майбутнього (допуск на розсинхрон годинника — до 60 с).
4. Будь-яка невдала перевірка → `401` з єдиним форматом помилки, без деталей, що саме
   не збіглося.

## Ідентичність

5. `telegramId` береться **тільки** з поля `user` перевіреного initData. Ніколи не приймати
   `telegramId`, `userId` чи ім'я з тіла запиту, query, заголовків або localStorage.
6. Після перевірки — upsert користувача за `telegram_id` і видача короткого JWT
   (`sub` = наш `users.id`). Усі подальші запити авторизуються цим токеном.
7. Ендпоїнти покупця отримують користувача з guard-а, а не з параметрів запиту.
   Доступ до замовлень — тільки до своїх (`order.userId === currentUser.id`).

## Секрети

8. `TELEGRAM_BOT_TOKEN` — тільки зі змінних оточення, валідується при старті.
   Ніколи не комітити, не передавати на фронтенд, не повертати в API.
9. Токен бота, initData, JWT і номери телефонів **ніколи** не пишуться в логи, помилки чи
   Sentry. Логер маскує їх; URL webhook-а містить окремий секрет, а не токен бота.

## Тести

10. Обов'язкові тести: валідний initData, змінений `hash`, змінене поле даних,
    прострочений `auth_date`, `auth_date` з майбутнього, відсутній `hash`.
    Тестові дані генеруються в тесті з тестовим токеном, а не копіюються з продакшену.
