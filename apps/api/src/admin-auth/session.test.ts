import assert from "node:assert/strict";
import { test } from "node:test";

import type { Request } from "express";

import { loadEnv } from "../config/env.js";
import { hashPassword, verifyPassword } from "./password.js";
import {
  hashToken,
  isAllowedOrigin,
  readCookie,
  sessionCookieName,
  sessionCookieOptions,
} from "./session.js";

const env = (extra: Record<string, string> = {}) =>
  loadEnv({
    DATABASE_URL: "postgresql://u:p@localhost:5432/db",
    JWT_SECRET: "x".repeat(32),
    CORS_ORIGINS: "http://localhost:5174",
    ...extra,
  });

const request = (headers: Record<string, string>) => ({ headers }) as unknown as Request;

test("Argon2id: хеш не містить пароля, перевірка працює", async () => {
  const hash = await hashPassword("correct horse battery");
  assert.match(hash, /^\$argon2id\$/);
  assert.equal(hash.includes("correct horse"), false);
  assert.equal(await verifyPassword(hash, "correct horse battery"), true);
  assert.equal(await verifyPassword(hash, "wrong"), false);
  assert.equal(await verifyPassword(null, "anything"), false);
  assert.equal(await verifyPassword("not-a-hash", "anything"), false);
});

test("cookie сесії: у production — __Host-, Secure, SameSite=Strict, httpOnly", () => {
  const prod = env({ NODE_ENV: "production", STORAGE_DRIVER: "none" });
  assert.equal(sessionCookieName(prod), "__Host-ss13_admin");
  assert.deepEqual(sessionCookieOptions(prod), {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
  });
  assert.equal(sessionCookieName(env()), "ss13_admin");
});

test("readCookie і hashToken", () => {
  const req = request({ cookie: "a=1; ss13_admin=abc%2Bdef; b=2" });
  assert.equal(readCookie(req, "ss13_admin"), "abc+def");
  assert.equal(readCookie(req, "missing"), undefined);
  assert.equal(hashToken("t").length, 64);
  assert.notEqual(hashToken("t"), "t");
});

test("Origin: дозволені адреси з CORS_ORIGINS, свій хост або без Origin", () => {
  const e = env();
  assert.equal(isAllowedOrigin(request({}), e), true);
  assert.equal(isAllowedOrigin(request({ origin: "http://localhost:5174" }), e), true);
  assert.equal(
    isAllowedOrigin(request({ origin: "http://api.local", host: "api.local" }), e),
    true,
  );
  assert.equal(
    isAllowedOrigin(request({ origin: "https://evil.example", host: "api.local" }), e),
    false,
  );
});
