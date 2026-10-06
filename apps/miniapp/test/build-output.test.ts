// Перевіряє production-збірку (dist): dev-мок Telegram і ендпоїнт підпису initData
// не повинні туди потрапити. Запускається після `vite build` (turbo: test → build).
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const dist = fileURLToPath(new URL("../dist", import.meta.url));

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

test("production-збірка не містить dev-моку Telegram", () => {
  assert.ok(
    existsSync(join(dist, "index.html")),
    "Немає dist: спершу pnpm --filter @ss13/miniapp build",
  );
  const code = files(dist)
    .filter((file) => /\.(js|html)$/.test(file))
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");
  // Назва режиму "dev-mock" у збірці лишається (це рядок у resolveLaunchMode), а от код
  // моку, його ендпоїнт і тестовий користувач — ні.
  for (const marker of ["__ss13_dev", "loadDevInitData", "ss13_dev_buyer", "Тестовий initData"]) {
    assert.ok(!code.includes(marker), `У production-збірці знайдено «${marker}»`);
  }
});

test("production-збірка викликає resolveLaunchMode з isDev = false", () => {
  const code = files(dist)
    .filter((file) => file.endsWith(".js"))
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");
  assert.match(code, /isDev:!1/);
  assert.doesNotMatch(code, /isDev:!0/);
});

test("production-збірка не містить секретів API", () => {
  const code = files(dist)
    .filter((file) => file.endsWith(".js"))
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");
  for (const marker of ["TELEGRAM_BOT_TOKEN", "JWT_SECRET", "DATABASE_URL"]) {
    assert.ok(!code.includes(marker), `У production-збірці знайдено «${marker}»`);
  }
});
