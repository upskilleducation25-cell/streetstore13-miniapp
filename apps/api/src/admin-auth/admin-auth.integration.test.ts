import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";

import type { AdminAccount, AdminSessionResponse, ApiErrorBody } from "@ss13/shared";

import {
  cleanupTestAdmins,
  createTestAdmin,
  TEST_ADMIN_DOMAIN,
  TEST_ADMIN_PASSWORD,
} from "../testing/fixtures.js";
import { createTestApp, hasDatabase, type TestApp } from "../testing/test-app.js";
import { LOGIN_LIMITS } from "./admin-auth.service.js";

const OWNER = `owner${TEST_ADMIN_DOMAIN}`;
const MANAGER = `manager${TEST_ADMIN_DOMAIN}`;
const BUYER_TG = 990_000_400_001;

describe("Адмінка: вхід, сесії і ролі (інтеграційні)", { skip: !hasDatabase }, () => {
  let t: TestApp;

  const login = (email: string, password: string, headers: Record<string, string> = {}) =>
    fetch(t.url("/api/v1/admin/auth/login"), {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify({ email, password }),
    });

  before(async () => {
    t = await createTestApp();
  });

  beforeEach(async () => {
    await cleanupTestAdmins(t.prisma);
    await createTestAdmin(t.prisma, { email: OWNER, role: "OWNER" });
    await createTestAdmin(t.prisma, { email: MANAGER, role: "MANAGER" });
  });

  after(async () => {
    await cleanupTestAdmins(t.prisma);
    await t.prisma.user.deleteMany({ where: { telegramId: BigInt(BUYER_TG) } });
    await t.close();
  });

  test("вхід: httpOnly cookie, CSRF-токен, у БД тільки хеші", async () => {
    const response = await login(`  OWNER${TEST_ADMIN_DOMAIN.toUpperCase()} `, TEST_ADMIN_PASSWORD);
    assert.equal(response.status, 200);
    const body = (await response.json()) as AdminSessionResponse;
    assert.equal(body.admin.email, OWNER);
    assert.equal(body.admin.role, "OWNER");
    assert.ok(body.csrfToken.length >= 32);
    assert.equal(JSON.stringify(body).includes("password"), false);
    assert.equal(response.headers.get("cache-control"), "no-store");

    const cookie = response.headers.get("set-cookie") ?? "";
    assert.match(cookie, /^ss13_admin=/);
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Strict/i);
    assert.match(cookie, /Path=\//);

    const token = cookie.split(";")[0]!.split("=")[1]!;
    const admin = await t.prisma.admin.findUniqueOrThrow({
      where: { email: OWNER },
      include: { sessions: true },
    });
    assert.match(admin.passwordHash, /^\$argon2id\$/);
    assert.equal(admin.sessions.length, 1);
    assert.notEqual(admin.sessions[0]!.tokenHash, token);
    assert.ok(admin.lastLoginAt);
  });

  test("невірний пароль, неіснуючий і вимкнений адмін — однакова відповідь 401", async () => {
    await createTestAdmin(t.prisma, {
      email: `off${TEST_ADMIN_DOMAIN}`,
      role: "MANAGER",
      isActive: false,
    });
    const bodies: ApiErrorBody[] = [];
    for (const [email, password] of [
      [OWNER, "wrong-password-123"],
      [`nobody${TEST_ADMIN_DOMAIN}`, "wrong-password-123"],
      [`off${TEST_ADMIN_DOMAIN}`, TEST_ADMIN_PASSWORD],
    ] as const) {
      const response = await login(email, password);
      assert.equal(response.status, 401, email);
      assert.equal(response.headers.get("set-cookie"), null);
      bodies.push((await response.json()) as ApiErrorBody);
    }
    assert.deepEqual(bodies[0], {
      code: "INVALID_CREDENTIALS",
      message: "Невірний email або пароль",
    });
    assert.deepEqual(bodies[1], bodies[0]);
    assert.deepEqual(bodies[2], bodies[0]);
  });

  test("ліміт спроб: після 5 невдалих на email — 429 навіть з правильним паролем", async () => {
    for (let i = 0; i < LOGIN_LIMITS.perEmail; i++) {
      assert.equal((await login(MANAGER, `wrong-password-${i}`)).status, 401);
    }
    const blocked = await login(MANAGER, TEST_ADMIN_PASSWORD);
    assert.equal(blocked.status, 429);
    assert.equal(((await blocked.json()) as ApiErrorBody).code, "TOO_MANY_LOGIN_ATTEMPTS");

    // Неіснуючий email блокується так само: відповідь не видає, чи є такий адмін.
    const ghost = `ghost${TEST_ADMIN_DOMAIN}`;
    for (let i = 0; i < LOGIN_LIMITS.perEmail; i++) await login(ghost, `wrong-password-${i}`);
    assert.equal((await login(ghost, "wrong-password-x")).status, 429);

    // Інший адмін з цього ж IP ще може увійти (ліміт IP вищий).
    assert.equal((await login(OWNER, TEST_ADMIN_PASSWORD)).status, 200);
  });

  test("ліміт спроб на IP: перебір різних email блокується", async () => {
    for (let i = 0; i < LOGIN_LIMITS.perIp; i++) {
      await login(`spray-${i}${TEST_ADMIN_DOMAIN}`, "wrong-password-123");
    }
    const response = await login(OWNER, TEST_ADMIN_PASSWORD);
    assert.equal(response.status, 429);
  });

  test("/me і вихід: після logout сесія недійсна", async () => {
    const owner = await t.loginAdmin(OWNER, TEST_ADMIN_PASSWORD);
    const me = await owner.request<AdminSessionResponse>("/api/v1/admin/auth/me");
    assert.equal(me.status, 200);
    assert.equal(me.body.csrfToken, owner.session.csrfToken);

    const logout = await owner.request("/api/v1/admin/auth/logout", { method: "POST" });
    assert.equal(logout.status, 204);
    assert.equal((await owner.request("/api/v1/admin/auth/me")).status, 401);
  });

  test("без cookie, з чужим токеном або з JWT покупця — 401", async () => {
    assert.equal((await fetch(t.url("/api/v1/admin/products"))).status, 401);
    const forged = await fetch(t.url("/api/v1/admin/products"), {
      headers: { cookie: "ss13_admin=not-a-real-session-token" },
    });
    assert.equal(forged.status, 401);

    const buyer = await t.loginBuyer(BUYER_TG);
    for (const path of [
      "/api/v1/admin/products",
      "/api/v1/admin/admins",
      "/api/v1/admin/auth/me",
    ]) {
      const response = await buyer.request<ApiErrorBody>(path);
      assert.equal(response.status, 401, path);
      assert.equal(response.body.code, "ADMIN_UNAUTHORIZED");
    }
  });

  test("CSRF: зміна даних без токена, з чужим токеном або з чужого Origin — 403", async () => {
    const manager = await t.loginAdmin(MANAGER, TEST_ADMIN_PASSWORD);
    const body = { name: "CSRF", parentId: null, icon: null, isActive: false };

    const noToken = await manager.request<ApiErrorBody>("/api/v1/admin/categories", {
      method: "POST",
      body,
      csrf: false,
    });
    assert.equal(noToken.status, 403);
    assert.equal(noToken.body.code, "CSRF_TOKEN_INVALID");

    const wrongToken = await manager.request<ApiErrorBody>("/api/v1/admin/categories", {
      method: "POST",
      body,
      headers: { "x-csrf-token": "x".repeat(43) },
    });
    assert.equal(wrongToken.status, 403);

    const evil = await manager.request<ApiErrorBody>("/api/v1/admin/categories", {
      method: "POST",
      body,
      headers: { origin: "https://evil.example" },
    });
    assert.equal(evil.status, 403);
    assert.equal(evil.body.code, "ORIGIN_NOT_ALLOWED");

    const loginCsrf = await login(OWNER, TEST_ADMIN_PASSWORD, { origin: "https://evil.example" });
    assert.equal(loginCsrf.status, 403);

    // GET не потребує CSRF-токена.
    assert.equal((await manager.request("/api/v1/admin/categories", { csrf: false })).status, 200);
    assert.equal(await t.prisma.category.count({ where: { name: "CSRF" } }), 0);
  });

  test("менеджер не має доступу до керування адмінами (прямі виклики API)", async () => {
    const manager = await t.loginAdmin(MANAGER, TEST_ADMIN_PASSWORD);
    const owner = await t.prisma.admin.findUniqueOrThrow({ where: { email: OWNER } });
    const self = await t.prisma.admin.findUniqueOrThrow({ where: { email: MANAGER } });

    const attempts: Array<[string, string, unknown?]> = [
      ["GET", "/api/v1/admin/admins"],
      [
        "POST",
        "/api/v1/admin/admins",
        {
          email: `new-owner${TEST_ADMIN_DOMAIN}`,
          name: "X",
          role: "OWNER",
          password: "long-enough-password",
        },
      ],
      ["PATCH", `/api/v1/admin/admins/${self.id}`, { role: "OWNER" }],
      ["PATCH", `/api/v1/admin/admins/${owner.id}`, { isActive: false }],
      ["POST", `/api/v1/admin/admins/${owner.id}/revoke-sessions`],
    ];
    for (const [method, path, body] of attempts) {
      const response = await manager.request<ApiErrorBody>(path, { method, body });
      assert.equal(response.status, 403, `${method} ${path}`);
      assert.equal(response.body.code, "FORBIDDEN_ROLE");
    }
    assert.equal(
      (await t.prisma.admin.findUniqueOrThrow({ where: { id: self.id } })).role,
      "MANAGER",
    );
    assert.equal(
      await t.prisma.admin.count({ where: { email: `new-owner${TEST_ADMIN_DOMAIN}` } }),
      0,
    );
  });

  test("власник створює менеджера; зміна ролі завершує сесії; останнього власника не понизити", async () => {
    const owner = await t.loginAdmin(OWNER, TEST_ADMIN_PASSWORD);
    const created = await owner.request<AdminAccount>("/api/v1/admin/admins", {
      method: "POST",
      body: {
        email: `New${TEST_ADMIN_DOMAIN}`,
        name: "Новий",
        role: "MANAGER",
        password: "new-manager-pass-1",
      },
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.email, `new${TEST_ADMIN_DOMAIN}`);
    assert.equal(JSON.stringify(created.body).includes("passwordHash"), false);

    const dup = await owner.request<ApiErrorBody>("/api/v1/admin/admins", {
      method: "POST",
      body: {
        email: `new${TEST_ADMIN_DOMAIN}`,
        name: "Дубль",
        role: "MANAGER",
        password: "new-manager-pass-1",
      },
    });
    assert.equal(dup.status, 409);
    assert.equal(dup.body.code, "EMAIL_TAKEN");

    const weak = await owner.request<ApiErrorBody>("/api/v1/admin/admins", {
      method: "POST",
      body: {
        email: `weak${TEST_ADMIN_DOMAIN}`,
        name: "Слабкий",
        role: "MANAGER",
        password: "short",
      },
    });
    assert.equal(weak.status, 400);

    const fresh = await t.loginAdmin(`new${TEST_ADMIN_DOMAIN}`, "new-manager-pass-1");
    assert.equal((await fresh.request("/api/v1/admin/auth/me")).status, 200);
    const promoted = await owner.request<AdminAccount>(`/api/v1/admin/admins/${created.body.id}`, {
      method: "PATCH",
      body: { role: "OWNER" },
    });
    assert.equal(promoted.body.role, "OWNER");
    assert.equal((await fresh.request("/api/v1/admin/auth/me")).status, 401, "стара сесія скинута");

    const ownerRow = await t.prisma.admin.findUniqueOrThrow({ where: { email: OWNER } });
    const self = await owner.request<ApiErrorBody>(`/api/v1/admin/admins/${ownerRow.id}`, {
      method: "PATCH",
      body: { role: "MANAGER" },
    });
    assert.equal(self.status, 409);
    assert.equal(self.body.code, "CANNOT_CHANGE_SELF");

    // Новий власник понижує першого; тепер він останній і себе понизити не може.
    const second = await t.loginAdmin(`new${TEST_ADMIN_DOMAIN}`, "new-manager-pass-1");
    const demoted = await second.request<AdminAccount>(`/api/v1/admin/admins/${ownerRow.id}`, {
      method: "PATCH",
      body: { role: "MANAGER" },
    });
    assert.equal(demoted.status, 200);
    assert.equal(
      (await owner.request("/api/v1/admin/admins")).status,
      401,
      "сесію пониженого скинуто",
    );
    const lastOwner = await t.prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT count(*) FROM admins WHERE role = 'OWNER' AND is_active
    `;
    assert.ok(Number(lastOwner[0]!.count) >= 1);
  });

  test("вимкнення адміна завершує його сесії", async () => {
    const owner = await t.loginAdmin(OWNER, TEST_ADMIN_PASSWORD);
    const manager = await t.loginAdmin(MANAGER, TEST_ADMIN_PASSWORD);
    const managerRow = await t.prisma.admin.findUniqueOrThrow({ where: { email: MANAGER } });
    const off = await owner.request<AdminAccount>(`/api/v1/admin/admins/${managerRow.id}`, {
      method: "PATCH",
      body: { isActive: false },
    });
    assert.equal(off.body.isActive, false);
    assert.equal((await manager.request("/api/v1/admin/products")).status, 401);
    assert.equal((await login(MANAGER, TEST_ADMIN_PASSWORD)).status, 401);
  });

  test("зміна власного пароля: невірний поточний — 400, успіх завершує інші сесії", async () => {
    const first = await t.loginAdmin(MANAGER, TEST_ADMIN_PASSWORD);
    const second = await t.loginAdmin(MANAGER, TEST_ADMIN_PASSWORD);
    const wrong = await first.request<ApiErrorBody>("/api/v1/admin/auth/password", {
      method: "POST",
      body: { currentPassword: "not-my-password", newPassword: "brand-new-password-1" },
    });
    assert.equal(wrong.status, 400);
    assert.equal(wrong.body.code, "INVALID_CURRENT_PASSWORD");

    const ok = await first.request("/api/v1/admin/auth/password", {
      method: "POST",
      body: { currentPassword: TEST_ADMIN_PASSWORD, newPassword: "brand-new-password-1" },
    });
    assert.equal(ok.status, 204);
    assert.equal((await first.request("/api/v1/admin/auth/me")).status, 200);
    assert.equal((await second.request("/api/v1/admin/auth/me")).status, 401);
    assert.equal((await login(MANAGER, "brand-new-password-1")).status, 200);
  });
});
