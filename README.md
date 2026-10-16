# STREETSTORE.13 — Telegram Mini App

Інтернет-магазин одягу у форматі Telegram Mini App + адмін-панель + API.

| Пакет             | Що це                                | Стек                       |
| ----------------- | ------------------------------------ | -------------------------- |
| `apps/api`        | REST API, Telegram-бот, сповіщення   | NestJS, Prisma, PostgreSQL |
| `apps/miniapp`    | вітрина, що відкривається в Telegram | React, Vite, Tailwind      |
| `apps/admin`      | адмін-панель для товарів і замовлень | React, Vite, Tailwind      |
| `packages/shared` | спільні enum-и, статуси, гроші       | TypeScript                 |

Архітектура та план етапів: `docs/architecture.md`.

## Вимоги

- Node.js 22+ (`.nvmrc`)
- pnpm 10 (`corepack enable`)
- Docker (для PostgreSQL і Redis) або власний PostgreSQL 16

## Запуск локально

```bash
corepack enable
pnpm install

# База і Redis
pnpm db:up

# Змінні оточення API
cp apps/api/.env.example apps/api/.env

# Схема БД і довідники (категорії, бренди, кольори, розміри, доставка)
pnpm db:migrate
pnpm db:seed

# Усі застосунки одночасно
pnpm dev
```

| Адреса                       | Що              |
| ---------------------------- | --------------- |
| http://localhost:3000/health | стан API і бази |
| http://localhost:5173        | Mini App        |
| http://localhost:5174        | адмін-панель    |

Фронтенди проксують `/api` на `localhost:3000`.

## Корисні команди

| Команда                        | Що робить                                |
| ------------------------------ | ---------------------------------------- |
| `pnpm lint` / `pnpm typecheck` | ESLint / перевірка типів у всіх пакетах  |
| `pnpm build`                   | збірка всіх пакетів                      |
| `pnpm test`                    | тести                                    |
| `pnpm format`                  | Prettier                                 |
| `pnpm db:studio`               | Prisma Studio — перегляд бази в браузері |
| `pnpm db:down`                 | зупинити Postgres і Redis                |

## Правила даних

- Гроші зберігаються цілими числами в копійках (`2999 ₴` → `299900`).
- Склад ведеться по варіантах «товар + колір + розмір» (`product_variants`).
  `products.total_stock` оновлюється тригером у базі.
- Залишок не може стати від'ємним (CHECK у базі); усі операції зі складом — у транзакціях.
- Замовлення зберігає знімок товару (`order_items`), тож зміни каталогу не ламають історію.
