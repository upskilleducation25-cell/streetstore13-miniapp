import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { AuthResponse, AuthUser } from "@ss13/shared";

import { AppException } from "../common/app-exception.js";
import { ENV } from "../config/config.module.js";
import type { Env } from "../config/env.js";
import type { User } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { InitDataError, validateInitData } from "./init-data.js";

export interface JwtPayload {
  /** users.id */
  sub: string;
}

export function toAuthUser(user: User): AuthUser {
  return {
    id: user.id,
    telegramId: user.telegramId.toString(),
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
  };
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async loginWithTelegram(initData: string): Promise<AuthResponse> {
    const botToken = this.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      throw new AppException(
        "TELEGRAM_AUTH_NOT_CONFIGURED",
        "Вхід через Telegram не налаштовано",
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    let validated;
    try {
      validated = validateInitData(initData, botToken, {
        maxAgeSeconds: this.env.TELEGRAM_INIT_DATA_TTL_SECONDS,
      });
    } catch (error) {
      if (error instanceof InitDataError) {
        // Без деталей, що саме не збіглося.
        throw new AppException(
          "INVALID_INIT_DATA",
          "Не вдалося підтвердити вхід через Telegram",
          HttpStatus.UNAUTHORIZED,
        );
      }
      throw error;
    }

    // telegramId — тільки з перевіреного initData.
    const { user: tgUser } = validated;
    const profile = {
      username: tgUser.username ?? null,
      firstName: tgUser.first_name ?? null,
      lastName: tgUser.last_name ?? null,
      languageCode: tgUser.language_code ?? null,
      lastSeenAt: new Date(),
    };
    const user = await this.prisma.user.upsert({
      where: { telegramId: BigInt(tgUser.id) },
      create: { telegramId: BigInt(tgUser.id), ...profile },
      update: profile,
    });

    const payload: JwtPayload = { sub: user.id };
    const token = await this.jwt.signAsync(payload);
    return { token, expiresIn: this.env.JWT_EXPIRES_IN_SECONDS, user: toAuthUser(user) };
  }
}
