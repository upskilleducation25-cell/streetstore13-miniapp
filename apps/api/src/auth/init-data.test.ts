import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { InitDataError, signInitData, validateInitData } from "./init-data.js";

// Тестовий токен: не належить жодному реальному боту.
const BOT_TOKEN = "123456:TEST-ONLY-token-not-real";
const NOW = new Date("2026-10-06T12:00:00Z");
const nowSeconds = Math.floor(NOW.getTime() / 1000);
const DAY = 86_400;

function makeInitData(
  fields: Record<string, string>,
  token = BOT_TOKEN,
): { initData: string; params: URLSearchParams } {
  const params = new URLSearchParams(fields);
  params.set("hash", signInitData(params, token));
  return { initData: params.toString(), params };
}

const user = JSON.stringify({ id: 777000111, first_name: "Олена", username: "olena_test" });
const validFields = {
  query_id: "AAHdF6IQAAAAAN0XohDhrOrc",
  user,
  auth_date: String(nowSeconds - 60),
};

function expectFailure(fn: () => unknown, reason: InitDataError["reason"]): void {
  assert.throws(fn, (error: unknown) => error instanceof InitDataError && error.reason === reason);
}

describe("validateInitData", () => {
  test("валідний initData повертає користувача", () => {
    const { initData } = makeInitData(validFields);
    const result = validateInitData(initData, BOT_TOKEN, { maxAgeSeconds: DAY, now: NOW });
    assert.equal(result.user.id, 777000111);
    assert.equal(result.user.first_name, "Олена");
    assert.equal(result.authDate.getTime(), (nowSeconds - 60) * 1000);
  });

  test("підпис іншим токеном відхиляється", () => {
    const { initData } = makeInitData(validFields, "999999:ANOTHER-bot-token");
    expectFailure(
      () => validateInitData(initData, BOT_TOKEN, { maxAgeSeconds: DAY, now: NOW }),
      "INVALID_HASH",
    );
  });

  test("підмінений користувач після підпису відхиляється", () => {
    const { params } = makeInitData(validFields);
    params.set("user", JSON.stringify({ id: 1, first_name: "Зловмисник" }));
    expectFailure(
      () => validateInitData(params.toString(), BOT_TOKEN, { maxAgeSeconds: DAY, now: NOW }),
      "INVALID_HASH",
    );
  });

  test("змінений hash відхиляється", () => {
    const { params } = makeInitData(validFields);
    const hash = params.get("hash") ?? "";
    params.set("hash", (hash[0] === "a" ? "b" : "a") + hash.slice(1));
    expectFailure(
      () => validateInitData(params.toString(), BOT_TOKEN, { maxAgeSeconds: DAY, now: NOW }),
      "INVALID_HASH",
    );
  });

  test("hash неправильної довжини відхиляється без винятку порівняння", () => {
    const { params } = makeInitData(validFields);
    params.set("hash", "abc");
    expectFailure(
      () => validateInitData(params.toString(), BOT_TOKEN, { maxAgeSeconds: DAY, now: NOW }),
      "INVALID_HASH",
    );
  });

  test("без hash відхиляється", () => {
    const params = new URLSearchParams(validFields);
    expectFailure(
      () => validateInitData(params.toString(), BOT_TOKEN, { maxAgeSeconds: DAY, now: NOW }),
      "MISSING_HASH",
    );
  });

  test("прострочений auth_date (старше 24 годин) відхиляється", () => {
    const { initData } = makeInitData({ ...validFields, auth_date: String(nowSeconds - DAY - 1) });
    expectFailure(
      () => validateInitData(initData, BOT_TOKEN, { maxAgeSeconds: DAY, now: NOW }),
      "EXPIRED",
    );
  });

  test("auth_date рівно 24 години тому ще приймається", () => {
    const { initData } = makeInitData({ ...validFields, auth_date: String(nowSeconds - DAY) });
    assert.doesNotThrow(() =>
      validateInitData(initData, BOT_TOKEN, { maxAgeSeconds: DAY, now: NOW }),
    );
  });

  test("auth_date з майбутнього відхиляється", () => {
    const { initData } = makeInitData({ ...validFields, auth_date: String(nowSeconds + 3600) });
    expectFailure(
      () => validateInitData(initData, BOT_TOKEN, { maxAgeSeconds: DAY, now: NOW }),
      "FROM_FUTURE",
    );
  });

  test("без auth_date відхиляється", () => {
    const { initData } = makeInitData({ query_id: "x", user });
    expectFailure(
      () => validateInitData(initData, BOT_TOKEN, { maxAgeSeconds: DAY, now: NOW }),
      "MISSING_AUTH_DATE",
    );
  });

  test("без user відхиляється", () => {
    const { initData } = makeInitData({ query_id: "x", auth_date: String(nowSeconds) });
    expectFailure(
      () => validateInitData(initData, BOT_TOKEN, { maxAgeSeconds: DAY, now: NOW }),
      "MISSING_USER",
    );
  });
});
