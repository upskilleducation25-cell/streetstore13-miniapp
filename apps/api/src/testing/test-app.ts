// Інтеграційні тести працюють з реальною БД (DATABASE_URL), на якій виконано
// pnpm db:migrate, pnpm db:seed і pnpm db:seed:demo.
import "dotenv/config";
import "reflect-metadata";

import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "../app.module.js";
import { configureApp } from "../app.setup.js";
import { signInitData } from "../auth/init-data.js";
import type { AuthResponse } from "@ss13/shared";
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
  close: () => Promise<void>;
}

export async function createTestApp(): Promise<TestApp> {
  process.env.TELEGRAM_BOT_TOKEN = TEST_BOT_TOKEN;
  process.env.JWT_SECRET ??= "integration-test-secret-integration-test";
  const telegram = await startFakeTelegram();
  process.env.TELEGRAM_API_BASE_URL = telegram.baseUrl;
  process.env.TELEGRAM_ADMIN_CHAT_ID = TEST_ADMIN_CHAT_ID;

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

  return {
    app,
    prisma: app.get(PrismaService),
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
