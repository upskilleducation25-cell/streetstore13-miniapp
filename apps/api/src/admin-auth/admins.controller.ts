import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { AdminAccount } from "@ss13/shared";

import { ApiErrorResponses } from "../common/swagger.js";
import type { SessionWithAdmin } from "./admin-auth.service.js";
import { AdminAuthGuard, OwnerOnly } from "./admin-auth.guard.js";
import { AdminsService } from "./admins.service.js";
import { CurrentAdminSession } from "./current-admin.decorator.js";
import { AdminCreateDto, AdminUpdateDto } from "./dto.js";

@ApiTags("Адмінка: адміністратори (тільки власник)")
@ApiCookieAuth()
@UseGuards(AdminAuthGuard)
@OwnerOnly()
@Controller("admin/admins")
export class AdminsController {
  constructor(private readonly admins: AdminsService) {}

  @Get()
  @ApiOperation({ summary: "Список адміністраторів" })
  @ApiErrorResponses(401, 403)
  list(): Promise<AdminAccount[]> {
    return this.admins.list();
  }

  @Post()
  @ApiOperation({ summary: "Створити адміністратора (менеджера або власника)" })
  @ApiErrorResponses(400, 401, 403, 409)
  create(@Body() dto: AdminCreateDto): Promise<AdminAccount> {
    return this.admins.create(dto);
  }

  @Patch(":id")
  @ApiOperation({
    summary: "Змінити ім'я, роль, активність або пароль",
    description:
      "Зміна ролі, вимкнення і новий пароль завершують усі сесії адміна. Останнього активного власника понизити чи вимкнути не можна.",
  })
  @ApiErrorResponses(400, 401, 403, 404, 409)
  update(
    @Param("id") id: string,
    @Body() dto: AdminUpdateDto,
    @CurrentAdminSession() session: SessionWithAdmin,
  ): Promise<AdminAccount> {
    return this.admins.update(id, dto, session);
  }

  @Post(":id/revoke-sessions")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Завершити всі сесії адміністратора" })
  @ApiErrorResponses(401, 403, 404)
  revoke(@Param("id") id: string): Promise<void> {
    return this.admins.revokeSessions(id);
  }
}
