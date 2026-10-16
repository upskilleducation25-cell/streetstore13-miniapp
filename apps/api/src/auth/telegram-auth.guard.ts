import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { HttpStatus, Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";

import { AppException } from "../common/app-exception.js";
import type { User } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";
import type { JwtPayload } from "./auth.service.js";

export interface AuthenticatedRequest extends Request {
  user?: User;
}

const unauthorized = () =>
  new AppException("UNAUTHORIZED", "Потрібна авторизація через Telegram", HttpStatus.UNAUTHORIZED);

/** Пропускає тільки запити з валідним JWT покупця; користувач кладеться в request.user. */
@Injectable()
export class TelegramAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [scheme, token] = (request.headers.authorization ?? "").split(" ");
    if (scheme !== "Bearer" || !token) throw unauthorized();

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw unauthorized();
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw unauthorized();

    request.user = user;
    return true;
  }
}
