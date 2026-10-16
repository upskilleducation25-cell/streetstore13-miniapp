import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { HttpStatus, Inject, Injectable, SetMetadata } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ADMIN_CSRF_HEADER } from "@ss13/shared";
import type { Request } from "express";

import { AppException } from "../common/app-exception.js";
import { ENV } from "../config/config.module.js";
import type { Env } from "../config/env.js";
import { AdminRole } from "../generated/prisma/client.js";
import type { SessionWithAdmin } from "./admin-auth.service.js";
import { AdminAuthService } from "./admin-auth.service.js";
import {
  isAllowedOrigin,
  isUnsafeMethod,
  readCookie,
  safeEqual,
  sessionCookieName,
} from "./session.js";

export interface AdminRequest extends Request {
  adminSession?: SessionWithAdmin;
}

const ROLES_KEY = "ss13:admin-roles";

/** Обмежує ендпоїнт ролями. Без декоратора доступ мають усі активні адміни. */
export const AdminRoles = (...roles: AdminRole[]) => SetMetadata(ROLES_KEY, roles);
export const OwnerOnly = () => AdminRoles(AdminRole.OWNER);

export const adminUnauthorized = () =>
  new AppException("ADMIN_UNAUTHORIZED", "Потрібен вхід в адмінку", HttpStatus.UNAUTHORIZED);

/**
 * Перевіряє серверну сесію адміна з httpOnly cookie, CSRF-токен і Origin для запитів,
 * що змінюють дані, та роль. JWT покупця з Telegram тут нічого не дає.
 */
@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    private readonly auth: AdminAuthService,
    private readonly reflector: Reflector,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AdminRequest>();
    const token = readCookie(request, sessionCookieName(this.env));
    if (!token) throw adminUnauthorized();

    const session = await this.auth.findSession(token);
    if (!session) throw adminUnauthorized();

    if (isUnsafeMethod(request.method)) {
      if (!isAllowedOrigin(request, this.env)) {
        throw new AppException(
          "ORIGIN_NOT_ALLOWED",
          "Запит з недозволеної адреси",
          HttpStatus.FORBIDDEN,
        );
      }
      const header = request.headers[ADMIN_CSRF_HEADER];
      if (typeof header !== "string" || !safeEqual(header, session.csrfToken)) {
        throw new AppException(
          "CSRF_TOKEN_INVALID",
          "Сесія застаріла. Оновіть сторінку і спробуйте ще раз.",
          HttpStatus.FORBIDDEN,
        );
      }
    }

    const roles = this.reflector.getAllAndOverride<AdminRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (roles && !roles.includes(session.admin.role)) {
      throw new AppException(
        "FORBIDDEN_ROLE",
        "Недостатньо прав для цієї дії",
        HttpStatus.FORBIDDEN,
      );
    }

    request.adminSession = session;
    return true;
  }
}
