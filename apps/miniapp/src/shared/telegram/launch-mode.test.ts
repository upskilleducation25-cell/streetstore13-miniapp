import assert from "node:assert/strict";
import { test } from "node:test";

import { canLogin, resolveLaunchMode } from "./launch-mode";

test("у Telegram (є initData) — справжній вхід, і в dev, і в production", () => {
  assert.equal(resolveLaunchMode({ isDev: false, initData: "query_id=1&hash=x" }), "telegram");
  assert.equal(resolveLaunchMode({ isDev: true, initData: "query_id=1&hash=x" }), "telegram");
});

test("dev-збірка поза Telegram — тестовий користувач", () => {
  assert.equal(resolveLaunchMode({ isDev: true, initData: "" }), "dev-mock");
  assert.equal(resolveLaunchMode({ isDev: true, initData: undefined }), "dev-mock");
});

test("production поза Telegram — мок вимкнено, входу немає", () => {
  const mode = resolveLaunchMode({ isDev: false, initData: undefined });
  assert.equal(mode, "browser");
  assert.equal(canLogin(mode), false);
  assert.equal(resolveLaunchMode({ isDev: false, initData: "" }), "browser");
});
