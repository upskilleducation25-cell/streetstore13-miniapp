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
