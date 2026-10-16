// Локально читає apps/api/.env; у продакшені змінні задає хостинг (вони мають пріоритет).
import "dotenv/config";
import "reflect-metadata";

import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module.js";
import { configureApp } from "./app.setup.js";
import { ENV } from "./config/config.module.js";
import type { Env } from "./config/env.js";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  app.enableShutdownHooks();

  const env = app.get<Env>(ENV);
  await app.listen(env.PORT);
  console.log(`API: http://localhost:${env.PORT}  (health: /health, Swagger: /docs)`);
}

void bootstrap();
