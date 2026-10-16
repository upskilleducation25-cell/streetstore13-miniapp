import assert from "node:assert/strict";
import { test } from "node:test";

import type { AuthResponse } from "@ss13/shared";

import { createAuth } from "./auth";

const response = (token: string, expiresIn = 3600): AuthResponse => ({
  token,
  expiresIn,
  user: { id: "u1", telegramId: "1", username: null, firstName: "Тест", lastName: null },
});

test("паралельні запити чекають на один вхід", async () => {
  let logins = 0;
  const auth = createAuth({
    getInitData: async () => "init",
    login: async () => {
      logins++;
      return response(`t${logins}`);
    },
  });
  const tokens = await Promise.all([auth.getToken(), auth.getToken(), auth.getToken()]);
  assert.deepEqual(tokens, ["t1", "t1", "t1"]);
  assert.equal(logins, 1);
});

test("токен оновлюється, коли до кінця життя лишилось менше хвилини", async () => {
  let now = 0;
  let logins = 0;
  const auth = createAuth({
    getInitData: async () => "init",
    login: async () => response(`t${++logins}`, 600),
    now: () => now,
  });
  assert.equal(await auth.getToken(), "t1");
  now = 500_000; // лишилось 100 с
  assert.equal(await auth.getToken(), "t1");
  now = 545_000; // лишилось 55 с
  assert.equal(await auth.getToken(), "t2");
});

test("invalidate після 401 змушує увійти знову", async () => {
  let logins = 0;
  const auth = createAuth({
    getInitData: async () => "init",
    login: async () => response(`t${++logins}`),
  });
  await auth.getToken();
  auth.invalidate();
  assert.equal(await auth.getToken(), "t2");
});

test("без initData (браузер у production) входу немає", async () => {
  let logins = 0;
  const auth = createAuth({
    getInitData: async () => null,
    login: async () => {
      logins++;
      return response("t");
    },
  });
  assert.equal(await auth.getToken(), null);
  assert.equal(logins, 0);
});
