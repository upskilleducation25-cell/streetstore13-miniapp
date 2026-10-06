// Інтеграційні тести працюють з реальною БД (DATABASE_URL), на якій виконано
// pnpm db:migrate, pnpm db:seed і pnpm db:seed:demo.
import "dotenv/config";
import "reflect-metadata";

import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "../app.module.js";
import { configureApp } from "../app.setup.js";
import { PrismaService } from "../prisma/prisma.service.js";

/** Тестовий токен бота: не належить жодному реальному боту. */
export const TEST_BOT_TOKEN = "123456:TEST-ONLY-token-not-real";

export interface TestApp {
  app: INestApplication;
  prisma: PrismaService;
  url: (path: string) => string;
  getJson: <T = unknown>(path: string) => Promise<{ status: number; body: T }>;
  close: () => Promise<void>;
}

export async function createTestApp(): Promise<TestApp> {
  process.env.TELEGRAM_BOT_TOKEN = TEST_BOT_TOKEN;
  process.env.JWT_SECRET ??= "integration-test-secret-integration-test";

  const app = await NestFactory.create(AppModule, { logger: ["error"] });
  configureApp(app);
  await app.listen(0, "127.0.0.1");
  const address = app.getHttpServer().address() as { port: number };
  const base = `http://127.0.0.1:${address.port}`;
  const url = (path: string) => `${base}${path}`;

  return {
    app,
    prisma: app.get(PrismaService),
    url,
    getJson: async <T>(path: string) => {
      const response = await fetch(url(path));
      return { status: response.status, body: (await response.json()) as T };
    },
    close: () => app.close(),
  };
}

export const hasDatabase = Boolean(process.env.DATABASE_URL);
