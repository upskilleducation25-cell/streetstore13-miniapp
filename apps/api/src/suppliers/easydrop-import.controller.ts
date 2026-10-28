import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import { AdminAuthGuard } from "../admin-auth/admin-auth.guard.js";
import { ApiErrorResponses } from "../common/swagger.js";
import { EasyDropImportService } from "./easydrop-import.service.js";

@ApiTags("Адмінка: постачальники")
@ApiCookieAuth()
@UseGuards(AdminAuthGuard)
@Controller("admin/suppliers/easydrop")
export class EasyDropImportController {
  constructor(private readonly importer: EasyDropImportService) {}

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
