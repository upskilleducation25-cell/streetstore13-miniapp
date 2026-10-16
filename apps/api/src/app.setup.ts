import type { INestApplication } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

import { HttpExceptionFilter } from "./common/http-exception.filter.js";
import { createValidationPipe } from "./common/validation.js";
import { ENV } from "./config/config.module.js";
import type { Env } from "./config/env.js";
import { LOCAL_UPLOADS_ROUTE, LocalStorageDriver } from "./storage/storage.js";
import { StorageService } from "./storage/storage.service.js";

/** Спільне налаштування застосунку для main.ts і інтеграційних тестів. */
export function configureApp(app: INestApplication): void {
  const env = app.get<Env>(ENV);
  const express = app as NestExpressApplication;

  if (env.TRUST_PROXY !== undefined) {
    const value = env.TRUST_PROXY;
    express.set(
      "trust proxy",
      /^\d+$/.test(value)
        ? Number(value)
        : value === "true"
          ? true
          : value === "false"
            ? false
            : value,
    );
  }

  app.setGlobalPrefix("api/v1", { exclude: ["health"] });
  app.enableCors({ origin: env.CORS_ORIGINS, credentials: true });
  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(new HttpExceptionFilter());

  // Local-сховище (розробка і тести): фото віддає сам API. У production — R2 зі своїм доменом.
  const driver = app.get(StorageService).driver;
  if (driver instanceof LocalStorageDriver) {
    express.useStaticAssets(driver.root, {
      prefix: `${LOCAL_UPLOADS_ROUTE}/`,
      index: false,
      dotfiles: "deny",
      fallthrough: false,
      maxAge: "1d",
    });
  }

  const config = new DocumentBuilder()
    .setTitle("STREETSTORE.13 API")
    .setDescription(
      "Публічне API Mini App і адмін-API (/admin/*, сесія в httpOnly cookie + X-CSRF-Token). Усі ціни — цілі копійки (UAH).",
    )
    .setVersion("1")
    .addBearerAuth()
    .addCookieAuth(env.ADMIN_COOKIE_SECURE ? "__Host-ss13_admin" : "ss13_admin")
    .build();
  SwaggerModule.setup("docs", app, () => SwaggerModule.createDocument(app, config), {
    jsonDocumentUrl: "docs/json",
  });
}
