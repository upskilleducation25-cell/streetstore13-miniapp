import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";

import { ApiErrorResponses } from "../common/swagger.js";
import type { User } from "../generated/prisma/client.js";
import { AuthService, toAuthUser } from "./auth.service.js";
import { CurrentUser } from "./current-user.decorator.js";
import { AuthResponseDto, AuthUserDto, TelegramAuthDto } from "./dto.js";
import { TelegramAuthGuard } from "./telegram-auth.guard.js";

@ApiTags("Авторизація")
@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("auth/telegram")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Вхід через Telegram Mini App",
    description:
      "Перевіряє підпис initData (HMAC-SHA256) і свіжість auth_date, створює або оновлює покупця за Telegram ID і повертає JWT.",
  })
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiErrorResponses(400, 401, 503)
  login(@Body() dto: TelegramAuthDto): Promise<AuthResponseDto> {
    return this.auth.loginWithTelegram(dto.initData);
  }

  @Get("me")
  @UseGuards(TelegramAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Поточний покупець" })
  @ApiOkResponse({ type: AuthUserDto })
  @ApiErrorResponses(401)
  me(@CurrentUser() user: User): AuthUserDto {
    return toAuthUser(user);
  }
}
