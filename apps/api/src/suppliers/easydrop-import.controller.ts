import { Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import { AdminAuthGuard } from "../admin-auth/admin-auth.guard.js";
import { ApiErrorResponses } from "../common/swagger.js";
import { EasyDropImportService } from "./easydrop-import.service.js";
import { EasyDropSyncService } from "./easydrop-sync.service.js";

@ApiTags("Адмінка: постачальники")
@ApiCookieAuth()
@UseGuards(AdminAuthGuard)
@Controller("admin/suppliers/easydrop")
export class EasyDropImportController {
  constructor(
    private readonly importer: EasyDropImportService,
    private readonly syncer: EasyDropSyncService,
  ) {}

  @Post("sync")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Синхронізувати каталог і залишки EasyDrop",
    description:
      "Повністю перевіряє фід до змін, оновлює товари, розміри та журнал складу транзакційно. Запуск не можна дублювати паралельно.",
  })
  @ApiErrorResponses(400, 401, 409, 502, 503)
  sync() {
    return this.syncer.sync();
  }

  @Get("runs")
  @ApiOperation({ summary: "Останні 20 запусків синхронізації EasyDrop" })
  @ApiErrorResponses(401)
  runs() {
    return this.syncer.history();
  }

  @Get("preview")
  @ApiOperation({
    summary: "Перевірити EasyDrop XML-фід без змін у каталозі",
    description:
      "Завантажує фід із серверної EASYDROP_FEED_URL, перевіряє XML і показує зведення та приклад варіантів. Нічого не записує в БД.",
  })
  @ApiErrorResponses(401, 502, 503)
  preview() {
    return this.importer.preview();
  }
}
