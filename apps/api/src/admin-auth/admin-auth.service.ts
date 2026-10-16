import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import type { AdminProfile, AdminSessionResponse } from "@ss13/shared";
import { ADMIN_PASSWORD_LIMITS } from "@ss13/shared";

import { AppException } from "../common/app-exception.js";
import { ENV } from "../config/config.module.js";
import type { Env } from "../config/env.js";
import type { Admin, AdminSession } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { hashPassword, verifyPassword } from "./password.js";
import { hashToken, newToken } from "./session.js";

/** Вікно і ліміти невдалих спроб входу. */
export const LOGIN_LIMITS = {
  windowMs: 15 * 60 * 1000,
  perEmail: 5,
  perIp: 20,
} as const;

const SEEN_UPDATE_INTERVAL_MS = 5 * 60 * 1000;

export type SessionWithAdmin = AdminSession & { admin: Admin };

export const toAdminProfile = (admin: Admin): AdminProfile => ({
  id: admin.id,
  email: admin.email,
  name: admin.name,
  role: admin.role,
});

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function assertPasswordPolicy(password: string, field = "password"): void {
  const { min, max } = ADMIN_PASSWORD_LIMITS;
  if (password.length < min || password.length > max || password.trim().length === 0) {
    throw new AppException(
      "WEAK_PASSWORD",
      `Пароль має містити від ${min} до ${max} символів`,
      HttpStatus.BAD_REQUEST,
      [{ field, errors: [`довжина ${min}–${max}`] }],
    );
  }
}

const invalidCredentials = () =>
  new AppException("INVALID_CREDENTIALS", "Невірний email або пароль", HttpStatus.UNAUTHORIZED);

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async login(
    rawEmail: string,
    password: string,
    meta: { ip: string; userAgent?: string },
  ): Promise<{ token: string; session: AdminSessionResponse; expiresAt: Date }> {
    const email = normalizeEmail(rawEmail);
    const since = new Date(Date.now() - LOGIN_LIMITS.windowMs);

    const [byEmail, byIp] = await Promise.all([
      this.prisma.adminLoginAttempt.count({
        where: { email, success: false, createdAt: { gte: since } },
      }),
      this.prisma.adminLoginAttempt.count({
        where: { ip: meta.ip, success: false, createdAt: { gte: since } },
      }),
    ]);
    // Однакова відповідь для наявного й неіснуючого email.
    if (byEmail >= LOGIN_LIMITS.perEmail || byIp >= LOGIN_LIMITS.perIp) {
      throw new AppException(
        "TOO_MANY_LOGIN_ATTEMPTS",
        "Забагато невдалих спроб входу. Спробуйте через 15 хвилин.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const admin = await this.prisma.admin.findUnique({ where: { email } });
    const usable = admin?.isActive ? admin : null;
    const ok = await verifyPassword(usable?.passwordHash ?? null, password);

    await this.prisma.adminLoginAttempt.create({
      data: { email, ip: meta.ip, success: ok },
    });
    if (!ok || !usable) throw invalidCredentials();

    const token = newToken();
    const expiresAt = new Date(Date.now() + this.env.ADMIN_SESSION_TTL_HOURS * 3600 * 1000);
    const csrfToken = newToken();
    await this.prisma.$transaction([
      this.prisma.adminSession.create({
        data: {
          tokenHash: hashToken(token),
          csrfToken,
          adminId: usable.id,
          ip: meta.ip,
          userAgent: meta.userAgent?.slice(0, 300) ?? null,
          expiresAt,
        },
      }),
      this.prisma.admin.update({ where: { id: usable.id }, data: { lastLoginAt: new Date() } }),
      // Після успіху лічильник для цього email обнуляється; старі записи прибираємо.
      this.prisma.adminLoginAttempt.deleteMany({ where: { email, success: false } }),
      this.prisma.adminLoginAttempt.deleteMany({
        where: { createdAt: { lt: new Date(Date.now() - 24 * 3600 * 1000) } },
      }),
      this.prisma.adminSession.deleteMany({ where: { expiresAt: { lt: new Date() } } }),
    ]);

    return {
      token,
      expiresAt,
      session: { admin: toAdminProfile(usable), csrfToken, expiresAt: expiresAt.toISOString() },
    };
  }

  /** Сесія за токеном з cookie; null — немає, прострочена або адміна вимкнено. */
  async findSession(token: string): Promise<SessionWithAdmin | null> {
    const session = await this.prisma.adminSession.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { admin: true },
    });
    if (!session || session.expiresAt <= new Date() || !session.admin.isActive) return null;

    if (Date.now() - session.lastSeenAt.getTime() > SEEN_UPDATE_INTERVAL_MS) {
      await this.prisma.adminSession
        .update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
        .catch(() => undefined);
    }
    return session;
  }

  toSessionResponse(session: SessionWithAdmin): AdminSessionResponse {
    return {
      admin: toAdminProfile(session.admin),
      csrfToken: session.csrfToken,
      expiresAt: session.expiresAt.toISOString(),
    };
  }

  async logout(sessionId: string): Promise<void> {
    await this.prisma.adminSession.deleteMany({ where: { id: sessionId } });
  }

  /** Зміна власного пароля: інші сесії цього адміна завершуються, поточна лишається. */
  async changePassword(
    session: SessionWithAdmin,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    if (!(await verifyPassword(session.admin.passwordHash, currentPassword))) {
      throw new AppException(
        "INVALID_CURRENT_PASSWORD",
        "Поточний пароль невірний",
        HttpStatus.BAD_REQUEST,
        [{ field: "currentPassword", errors: ["невірний пароль"] }],
      );
    }
    assertPasswordPolicy(newPassword, "newPassword");
    const passwordHash = await hashPassword(newPassword);
    await this.prisma.$transaction([
      this.prisma.admin.update({ where: { id: session.adminId }, data: { passwordHash } }),
      this.prisma.adminSession.deleteMany({
        where: { adminId: session.adminId, id: { not: session.id } },
      }),
    ]);
  }
}
