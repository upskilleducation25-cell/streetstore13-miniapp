# Локальний запуск на Windows

Покрокова інструкція для Windows 10/11 (64-біт). Усі команди вводяться в **PowerShell**
(Пуск → «PowerShell»), по одній. Після кожної дії перевірте результат, описаний поруч.

## 1. Програми

| Програма       | Навіщо                          | Де взяти                                                                          |
| -------------- | ------------------------------- | --------------------------------------------------------------------------------- |
| Git            | завантажити код                 | https://git-scm.com/download/win (усі налаштування за замовчуванням)              |
| Node.js 22 LTS | запуск API і фронтендів         | https://nodejs.org → «22.x LTS», Windows Installer (.msi)                         |
| Docker Desktop | PostgreSQL 16 і Redis 7         | https://www.docker.com/products/docker-desktop → Windows; під час установки WSL 2 |
| VS Code        | (необов'язково) перегляд файлів | https://code.visualstudio.com                                                     |

Docker Desktop після встановлення може попросити перезавантаження і оновлення WSL —
погоджуйтесь. Перед роботою Docker Desktop має бути запущений (кит у треї не анімується).

Перевірка (кожна команда друкує версію):

```powershell
git --version
node -v          # v22.x
docker --version
docker compose version
```

## 2. pnpm

Відкрийте PowerShell **від імені адміністратора** (правий клік → «Запуск від імені
адміністратора») і виконайте:

```powershell
corepack enable
```

Закрийте адмінське вікно, відкрийте звичайний PowerShell:

```powershell
pnpm -v          # 10.28.0 (corepack сам завантажить потрібну версію; відповісти Y)
```

## 3. Код

```powershell
cd $HOME\Documents
git clone https://github.com/upskilleducation25-cell/streetstore13-miniapp.git
cd streetstore13-miniapp
pnpm install
```

## 4. База і Redis

```powershell
pnpm db:up
docker ps        # streetstore13-postgres-1 і streetstore13-redis-1, статус (healthy)
```

Якщо порт 5432 зайнятий (на комп'ютері вже стоїть PostgreSQL) — зупиніть ту службу
(«Служби» → postgresql → Зупинити) і повторіть `pnpm db:up`.

## 5. Змінні оточення

```powershell
Copy-Item apps\api\.env.example apps\api\.env
notepad apps\api\.env
```

Для локального запуску нічого міняти не обов'язково. Щоб у Mini App поза Telegram працював
вхід тестового покупця (кошик, замовлення), впишіть у `TELEGRAM_BOT_TOKEN=` токен бота
від @BotFather. Файл `.env` у git не потрапляє — не надсилайте його нікому.

## 6. Схема БД і дані

```powershell
pnpm db:migrate        # якщо спитає назву міграції — нових змін немає, просто Enter
pnpm db:seed
pnpm db:seed:demo      # демо-товари DEMO-… з умовними цінами
```

## 7. Перший власник адмінки

Пароль вводиться приховано і не потрапляє в історію PowerShell:

```powershell
$env:ADMIN_OWNER_EMAIL = "ваш@email.com"
$env:ADMIN_OWNER_PASSWORD = [System.Net.NetworkCredential]::new("", (Read-Host "Пароль (від 10 символів)" -AsSecureString)).Password
pnpm admin:create-owner
Remove-Item Env:ADMIN_OWNER_PASSWORD
```

## 8. Запуск

```powershell
pnpm dev
```

Вікно не закривайте, поки працюєте. Відкрийте в браузері:

| Адреса                       | Що                                       |
| ---------------------------- | ---------------------------------------- |
| http://localhost:3000/health | стан API і бази (`"status":"ok"`)        |
| http://localhost:3000/docs   | Swagger API                              |
| http://localhost:5173        | Mini App (вітрина)                       |
| http://localhost:5174        | адмінка (вхід email і паролем з кроку 7) |

Зупинка: `Ctrl+C` у вікні `pnpm dev`, потім `pnpm db:down` (дані бази зберігаються).

## 9. Перевірки (як у CI)

```powershell
pnpm format:check
pnpm lint
pnpm typecheck
pnpm build
pnpm test
```

`pnpm test` запускає інтеграційні тести API на тій самій базі, тож база має бути піднята
(крок 4) і заповнена (крок 6).

## Типові проблеми

- **`pnpm` не знайдено** — не виконано `corepack enable` від адміністратора (крок 2),
  або PowerShell не перевідкрито.
- **`docker` не відповідає / `pnpm db:up` падає** — Docker Desktop не запущений.
- **`P1001: Can't reach database server`** — база ще стартує; зачекайте до `(healthy)`
  у `docker ps`.
- **У Mini App «Тестовий initData недоступний»** — порожній `TELEGRAM_BOT_TOKEN` у
  `apps\api\.env` (крок 5). Каталог працює і без нього, кошик — ні.
- **Порт 3000, 5173 або 5174 зайнятий** — закрийте інший запущений `pnpm dev`.
