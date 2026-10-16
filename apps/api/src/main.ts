// Локально читає apps/api/.env; у продакшені змінні задає хостинг (вони мають пріоритет).
import "dotenv/config";
import "reflect-metadata";

import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module.js";
import { ENV } from "./config/config.module.js";
import type { Env } from "./config/env.js";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const env = app.get<Env>(ENV);

  app.setGlobalPrefix("api/v1", { exclude: ["health"] });
  app.enableCors({ origin: env.CORS_ORIGINS, credentials: true });
  app.enableShutdownHooks();

  await app.listen(env.PORT);
  console.log(`API: http://localhost:${env.PORT}  (health: /health)`);
}

void bootstrap();
