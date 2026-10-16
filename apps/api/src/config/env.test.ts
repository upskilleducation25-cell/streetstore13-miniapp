import assert from "node:assert/strict";
import { test } from "node:test";

import { loadEnv } from "./env.js";

test("env: значення за замовчуванням і список CORS", () => {
  const env = loadEnv({
    DATABASE_URL: "postgresql://u:p@localhost:5432/db",
    JWT_SECRET: "x".repeat(32),
    CORS_ORIGINS: "http://a.test, http://b.test",
  });
  assert.equal(env.PORT, 3000);
  assert.deepEqual(env.CORS_ORIGINS, ["http://a.test", "http://b.test"]);
  assert.equal(env.TELEGRAM_INIT_DATA_TTL_SECONDS, 86_400);
  assert.equal(env.TELEGRAM_BOT_TOKEN, undefined);
});

test("env: короткий JWT_SECRET відхиляється", () => {
  assert.throws(
    () => loadEnv({ DATABASE_URL: "postgresql://u:p@localhost:5432/db", JWT_SECRET: "short" }),
    /JWT_SECRET/,
  );
});

test("env: без DATABASE_URL — зрозуміла помилка", () => {
  assert.throws(() => loadEnv({}), /DATABASE_URL/);
});

test("env: налаштування сповіщень", () => {
  const base = { DATABASE_URL: "postgresql://u:p@localhost:5432/db", JWT_SECRET: "x".repeat(32) };
  const env = loadEnv(base);
  assert.equal(env.TELEGRAM_ADMIN_CHAT_ID, undefined);
  assert.equal(env.TELEGRAM_API_BASE_URL, "https://api.telegram.org");
  assert.equal(env.MINIAPP_URL, undefined);

  const full = loadEnv({
    ...base,
    TELEGRAM_ADMIN_CHAT_ID: "-1001234567890",
    MINIAPP_URL: "https://shop.example.com/",
  });
  assert.equal(full.TELEGRAM_ADMIN_CHAT_ID, "-1001234567890");
  assert.equal(full.MINIAPP_URL, "https://shop.example.com");
  assert.equal(
    loadEnv({ ...base, TELEGRAM_ADMIN_CHAT_ID: "@ss13_orders" }).TELEGRAM_ADMIN_CHAT_ID,
    "@ss13_orders",
  );

  assert.throws(
    () => loadEnv({ ...base, TELEGRAM_ADMIN_CHAT_ID: "чат власника" }),
    /ADMIN_CHAT_ID/,
  );
  assert.throws(() => loadEnv({ ...base, MINIAPP_URL: "http://insecure.test" }), /MINIAPP_URL/);
});
