import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { AdminSessionResponse } from "@ss13/shared";
import type { Request, Response } from "express";

import { AppException } from "../common/app-exception.js";
import { ApiErrorResponses } from "../common/swagger.js";
import { ENV } from "../config/config.module.js";
import type { Env } from "../config/env.js";
import type { SessionWithAdmin } from "./admin-auth.service.js";
import { AdminAuthService } from "./admin-auth.service.js";
import { AdminAuthGuard } from "./admin-auth.guard.js";
import { CurrentAdminSession } from "./current-admin.decorator.js";
import { AdminLoginDto, ChangePasswordDto } from "./dto.js";
import { isAllowedOrigin, sessionCookieName, sessionCookieOptions } from "./session.js";

@ApiTags("Адмінка: вхід")
@Controller("admin/auth")
export class AdminAuthController {
  constructor(
    private readonly auth: AdminAuthService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Вхід адміна за email і паролем",
    description:
      "Ставить httpOnly cookie сесії і повертає csrfToken для заголовка X-CSRF-Token. Після 5 невдалих спроб на email (або 20 на IP) за 15 хвилин — 429.",
  })
  @ApiErrorResponses(400, 401, 403, 429)
  async login(
    @Body() dto: AdminLoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AdminSessionResponse> {
    if (!isAllowedOrigin(request, this.env)) {
      throw new AppException(
        "ORIGIN_NOT_ALLOWED",
        "Запит з недозволеної адреси",
        HttpStatus.FORBIDDEN,
      );
    }
    const { token, session, expiresAt } = await this.auth.login(dto.email, dto.password, {
      ip: request.ip ?? "unknown",
      userAgent: request.headers["user-agent"],
    });
    response.cookie(sessionCookieName(this.env), token, sessionCookieOptions(this.env, expiresAt));
    response.setHeader("Cache-Control", "no-store");
    return session;
  }

  @Get("me")
  @UseGuards(AdminAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: "Поточний адмін і CSRF-токен сесії" })
  @ApiErrorResponses(401)
  me(
    @CurrentAdminSession() session: SessionWithAdmin,
    @Res({ passthrough: true }) response: Response,
  ): AdminSessionResponse {
    response.setHeader("Cache-Control", "no-store");
    return this.auth.toSessionResponse(session);
  }

  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AdminAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: "Вихід: сесія видаляється на сервері, cookie очищується" })
  @ApiErrorResponses(401, 403)
  async logout(
    @CurrentAdminSession() session: SessionWithAdmin,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.logout(session.id);
    response.clearCookie(sessionCookieName(this.env), sessionCookieOptions(this.env));
  }

  @Post("password")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AdminAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: "Змінити власний пароль (інші сесії завершуються)" })
  @ApiErrorResponses(400, 401, 403)
  async changePassword(
    @CurrentAdminSession() session: SessionWithAdmin,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    await this.auth.changePassword(session, dto.currentPassword, dto.newPassword);
  }
}
