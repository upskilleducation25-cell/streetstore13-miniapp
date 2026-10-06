import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";

import type { ApiErrorBody, AuthResponse, AuthUser } from "@ss13/shared";

import { createTestApp, hasDatabase, TEST_BOT_TOKEN, type TestApp } from "../testing/test-app.js";
import { signInitData } from "./init-data.js";

const TELEGRAM_ID = 990_000_000_123;

function initDataFor(fields: Record<string, string>, token = TEST_BOT_TOKEN): string {
  const params = new URLSearchParams(fields);
  params.set("hash", signInitData(params, token));
  return params.toString();
}

describe("Авторизація через Telegram (інтеграційні)", { skip: !hasDatabase }, () => {
  let t: TestApp;

  before(async () => {
    t = await createTestApp();
    await t.prisma.user.deleteMany({ where: { telegramId: BigInt(TELEGRAM_ID) } });
  });

  after(async () => {
    await t?.prisma.user.deleteMany({ where: { telegramId: BigInt(TELEGRAM_ID) } });
    await t?.close();
  });

  const login = (initData: string) =>
    fetch(t.url("/api/v1/auth/telegram"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ initData }),
    });

  const fields = (first_name: string) => ({
    user: JSON.stringify({ id: TELEGRAM_ID, first_name, username: "test_buyer" }),
    auth_date: String(Math.floor(Date.now() / 1000) - 30),
  });

  test("валідний initData → створює користувача і повертає JWT, /me працює", async () => {
    const response = await login(initDataFor(fields("Тарас")));
    assert.equal(response.status, 200);
    const body = (await response.json()) as AuthResponse;
    assert.ok(body.token);
    assert.equal(body.user.telegramId, String(TELEGRAM_ID));
    assert.equal(body.user.firstName, "Тарас");

    const me = await fetch(t.url("/api/v1/me"), {
      headers: { authorization: `Bearer ${body.token}` },
    });
    assert.equal(me.status, 200);
    const user = (await me.json()) as AuthUser;
    assert.equal(user.id, body.user.id);
  });

  test("повторний вхід оновлює того самого користувача", async () => {
    const first = (await (await login(initDataFor(fields("Тарас")))).json()) as AuthResponse;
    const second = (await (await login(initDataFor(fields("Тарас Ш.")))).json()) as AuthResponse;
    assert.equal(second.user.id, first.user.id);
    assert.equal(second.user.firstName, "Тарас Ш.");
    assert.equal(await t.prisma.user.count({ where: { telegramId: BigInt(TELEGRAM_ID) } }), 1);
  });

  test("підроблений initData → 401 без деталей", async () => {
    const response = await login(initDataFor(fields("Тарас"), "999:another-token"));
    assert.equal(response.status, 401);
    const body = (await response.json()) as ApiErrorBody;
    assert.equal(body.code, "INVALID_INIT_DATA");
    assert.equal(body.details, undefined);
  });

  test("прострочений initData → 401", async () => {
    const response = await login(
      initDataFor({
        ...fields("Тарас"),
        auth_date: String(Math.floor(Date.now() / 1000) - 86_400 - 60),
      }),
    );
    assert.equal(response.status, 401);
  });

  test("порожній initData → 400 VALIDATION_ERROR", async () => {
    const response = await login("");
    assert.equal(response.status, 400);
    assert.equal(((await response.json()) as ApiErrorBody).code, "VALIDATION_ERROR");
  });

  test("/me без токена і з підробленим токеном → 401", async () => {
    const none = await fetch(t.url("/api/v1/me"));
    assert.equal(none.status, 401);
    const forged = await fetch(t.url("/api/v1/me"), {
      headers: { authorization: "Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.invalid" },
    });
    assert.equal(forged.status, 401);
  });

  test("Swagger доступний на /docs", async () => {
    const response = await fetch(t.url("/docs/json"));
    assert.equal(response.status, 200);
    const doc = (await response.json()) as { paths: Record<string, unknown> };
    for (const path of [
      "/api/v1/auth/telegram",
      "/api/v1/me",
      "/api/v1/categories",
      "/api/v1/products",
      "/api/v1/products/search",
      "/api/v1/products/{id}",
      "/api/v1/home",
    ]) {
      assert.ok(doc.paths[path], `немає ${path} у Swagger`);
    }
  });
});
