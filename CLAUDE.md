# STREETSTORE.13 — Telegram Mini App

Інтернет-магазин одягу STREETSTORE.13 у форматі Telegram Mini App: вітрина для покупців
у Telegram, окрема адмін-панель для власника і backend з Telegram-ботом.
Ринок — Україна, мова інтерфейсу — українська, валюта — гривня.

Погоджена архітектура і план етапів: `docs/architecture.md`.

## Стек

- **Монорепо:** pnpm workspaces + Turborepo, TypeScript (strict) у всіх пакетах.
- **API:** NestJS + Prisma (PostgreSQL 16), Redis для черг, бот на grammY (з Етапу 1+).
- **Mini App і адмінка:** React + Vite + Tailwind CSS.
- **Перевірки:** ESLint, Prettier, `node:test`, GitHub Actions (`.github/workflows/ci.yml`).

## Структура

```
apps/api         REST API /api/v1, Prisma-схема, міграції, seed
apps/miniapp     вітрина в Telegram (порт 5173)
apps/admin       адмін-панель (порт 5174)
packages/shared  спільні enum-и, статуси замовлень, хелпери для грошей
infra            docker-compose: PostgreSQL + Redis
docs             архітектура
.claude/skills   правила для конкретних областей (див. нижче)
```

## Команди

```bash
pnpm install          # залежності
pnpm db:up            # PostgreSQL + Redis у Docker
cp apps/api/.env.example apps/api/.env
pnpm db:migrate       # міграції Prisma
pnpm db:seed          # довідники: категорії, бренди, кольори, розміри, доставка
pnpm db:seed:demo     # demo-товари DEMO-… (умовні ціни й залишки, SVG-плейсхолдери фото)
pnpm dev              # API :3000 (Swagger: /docs), Mini App :5173, адмінка :5174
                      # Mini App поза Telegram у dev входить тестовим користувачем,
                      # initData підписує dev-сервер Vite токеном з apps/api/.env
pnpm lint             # ESLint
pnpm typecheck        # перевірка типів
pnpm test             # тести (інтеграційні API-тести потребують БД з seed і demo-seed)
pnpm build            # збірка всіх пакетів
pnpm format           # Prettier (CI запускає format:check)
```

## Правила процесу

- **Перед кожним великим кроком** коротко показати власнику, які файли будуть створені
  і які змінені. Тільки після цього писати код.
- **Працювати поетапно** за планом з `docs/architecture.md`. Не переходити до наступного
  етапу без явного підтвердження власника.
- **Кожен етап (і кожна окрема задача) — нова гілка і окремий PR.** Після етапу —
  звіт за скілом `stage-report`: структура, файли, ендпоїнти/сторінки, що перевірено,
  що не перевірено, що потрібно від власника.
- **Не вигадувати.** Що не запускалось і не перевірялось, так і пишемо: «не перевірено».
  Не вигадувати товари, ціни, розміри, наявність, характеристики чи результати тестів.
- PR зливається тільки з зеленим CI. Перед push локально пройти
  `pnpm format:check && pnpm lint && pnpm typecheck && pnpm build && pnpm test`.

## Ключові правила домену

- Гроші — цілі числа в копійках (`Int`), ніколи `float`. Форматування — `formatUah`
  з `@ss13/shared`.
- Склад ведеться по варіантах «товар + колір + розмір»; усі зміни залишків — у транзакції.
- Статуси замовлень змінюються тільки за `ORDER_STATUS_TRANSITIONS` з `@ss13/shared`.
- Схема БД змінюється тільки через нову міграцію Prisma; seed має залишатися ідемпотентним.

## Скіли

| Скіл                   | Коли читати                                                    |
| ---------------------- | -------------------------------------------------------------- |
| `stock-and-orders`     | будь-яка робота із залишками, кошиком, замовленнями, статусами |
| `telegram-auth`        | авторизація покупця, initData, токен бота                      |
| `catalog-api`          | публічні ендпоїнти каталогу, DTO, помилки, Swagger             |
| `miniapp-ui`           | сторінки й компоненти Mini App                                 |
| `ai-search-guardrails` | AI-пошук і будь-яке використання LLM з даними каталогу         |
| `stage-report`         | звіт після завершення етапу чи задачі                          |
