import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

import { HttpExceptionFilter } from "./common/http-exception.filter.js";
import { createValidationPipe } from "./common/validation.js";
import { ENV } from "./config/config.module.js";
import type { Env } from "./config/env.js";

/** Спільне налаштування застосунку для main.ts і інтеграційних тестів. */
export function configureApp(app: INestApplication): void {
  const env = app.get<Env>(ENV);

  app.setGlobalPrefix("api/v1", { exclude: ["health"] });
  app.enableCors({ origin: env.CORS_ORIGINS, credentials: true });
  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(new HttpExceptionFilter());

  const config = new DocumentBuilder()
    .setTitle("STREETSTORE.13 API")
    .setDescription("Публічне API Mini App. Усі ціни — цілі копійки (UAH).")
    .setVersion("1")
    .addBearerAuth()
    .build();
  SwaggerModule.setup("docs", app, () => SwaggerModule.createDocument(app, config), {
    jsonDocumentUrl: "docs/json",
  });
}
