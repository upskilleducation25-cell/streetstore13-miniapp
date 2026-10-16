// Інтеграційні тести працюють з реальною БД (DATABASE_URL), на якій виконано
// pnpm db:migrate, pnpm db:seed і pnpm db:seed:demo.
import "dotenv/config";
import "reflect-metadata";

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "../app.module.js";
import { configureApp } from "../app.setup.js";
import { signInitData } from "../auth/init-data.js";
import type { AdminSessionResponse, AuthResponse } from "@ss13/shared";
import { NotificationsService } from "../notifications/notifications.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { type FakeTelegram, startFakeTelegram } from "./fake-telegram.js";

/** Тестовий токен бота: не належить жодному реальному боту. */
export const TEST_BOT_TOKEN = "123456:TEST-ONLY-token-not-real";
/** Тестовий чат власника для сповіщень. */
export const TEST_ADMIN_CHAT_ID = "-1009990001";

export interface Buyer {
  token: string;
  userId: string;
  telegramId: number;
  /** fetch від імені покупця: JWT і JSON уже в заголовках. */
  request: <T = unknown>(
    path: string,
    init?: { method?: string; body?: unknown; headers?: Record<string, string> },
  ) => Promise<{ status: number; body: T }>;
}

export interface AdminClient {
  session: AdminSessionResponse;
  cookie: string;
  /** fetch від імені адміна: cookie сесії і X-CSRF-Token уже в заголовках. */
  request: <T = unknown>(
    path: string,
    init?: {
      method?: string;
      body?: unknown;
      form?: FormData;
      headers?: Record<string, string>;
      csrf?: boolean;
    },
  ) => Promise<{ status: number; body: T }>;
}

export interface TestApp {
  app: INestApplication;
  prisma: PrismaService;
  url: (path: string) => string;
  getJson: <T = unknown>(path: string) => Promise<{ status: number; body: T }>;
  /** Фейковий Bot API: усі повідомлення бота в тестах потрапляють сюди. */
  telegram: FakeTelegram;
  notifications: NotificationsService;
  /** Вхід тестового покупця через підписаний тестовим токеном initData. */
  loginBuyer: (telegramId: number, firstName?: string) => Promise<Buyer>;
  /** Вхід адміна email + пароль; кидає помилку, якщо не 200. */
  loginAdmin: (email: string, password: string) => Promise<AdminClient>;
  /** Тека local-сховища фото цього запуску тестів. */
  storageDir: string;
  close: () => Promise<void>;
}

export async function createTestApp(): Promise<TestApp> {
  process.env.TELEGRAM_BOT_TOKEN = TEST_BOT_TOKEN;
  process.env.JWT_SECRET ??= "integration-test-secret-integration-test";
  const telegram = await startFakeTelegram();
  process.env.TELEGRAM_API_BASE_URL = telegram.baseUrl;
  process.env.TELEGRAM_ADMIN_CHAT_ID = TEST_ADMIN_CHAT_ID;
  const storageDir = mkdtempSync(join(tmpdir(), "ss13-uploads-"));
  process.env.STORAGE_DRIVER = "local";
  process.env.LOCAL_STORAGE_DIR = storageDir;

  const app = await NestFactory.create(AppModule, { logger: ["error"] });
  configureApp(app);
  await app.listen(0, "127.0.0.1");
  const address = app.getHttpServer().address() as { port: number };
  const base = `http://127.0.0.1:${address.port}`;
  const url = (path: string) => `${base}${path}`;

  const loginBuyer = async (telegramId: number, firstName = "Тест"): Promise<Buyer> => {
    const params = new URLSearchParams({
      user: JSON.stringify({ id: telegramId, first_name: firstName }),
      auth_date: String(Math.floor(Date.now() / 1000) - 10),
    });
    params.set("hash", signInitData(params, TEST_BOT_TOKEN));
    const response = await fetch(url("/api/v1/auth/telegram"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ initData: params.toString() }),
    });
    if (response.status !== 200) throw new Error(`Вхід тестового покупця: ${response.status}`);
    const auth = (await response.json()) as AuthResponse;
    return {
      token: auth.token,
      userId: auth.user.id,
      telegramId,
      request: async <T>(
        path: string,
        init: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
      ) => {
        const res = await fetch(url(path), {
          method: init.method ?? "GET",
          headers: {
            authorization: `Bearer ${auth.token}`,
            ...(init.body === undefined ? {} : { "content-type": "application/json" }),
            ...init.headers,
          },
          body: init.body === undefined ? undefined : JSON.stringify(init.body),
        });
        const text = await res.text();
        return { status: res.status, body: (text ? JSON.parse(text) : undefined) as T };
      },
    };
  };

  const loginAdmin = async (email: string, password: string): Promise<AdminClient> => {
    const response = await fetch(url("/api/v1/admin/auth/login"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (response.status !== 200) throw new Error(`Вхід адміна ${email}: ${response.status}`);
    const session = (await response.json()) as AdminSessionResponse;
    const setCookie = response.headers.get("set-cookie") ?? "";
    const cookie = setCookie.split(";")[0]!;
    return {
      session,
      cookie,
      request: async <T>(
        path: string,
        init: {
          method?: string;
          body?: unknown;
          form?: FormData;
          headers?: Record<string, string>;
          csrf?: boolean;
        } = {},
      ) => {
        const res = await fetch(url(path), {
          method: init.method ?? "GET",
          headers: {
            cookie,
            ...(init.csrf === false ? {} : { "x-csrf-token": session.csrfToken }),
            ...(init.body === undefined ? {} : { "content-type": "application/json" }),
            ...init.headers,
          },
          body: init.form ?? (init.body === undefined ? undefined : JSON.stringify(init.body)),
        });
        const text = await res.text();
        return { status: res.status, body: (text ? JSON.parse(text) : undefined) as T };
      },
    };
  };

  return {
    app,
    prisma: app.get(PrismaService),
    loginAdmin,
    storageDir,
    url,
    getJson: async <T>(path: string) => {
      const response = await fetch(url(path));
      return { status: response.status, body: (await response.json()) as T };
    },
    telegram,
    notifications: app.get(NotificationsService),
    loginBuyer,
    close: async () => {
      await app.close();
      await telegram.close();
    },
  };
}

export const hasDatabase = Boolean(process.env.DATABASE_URL);
