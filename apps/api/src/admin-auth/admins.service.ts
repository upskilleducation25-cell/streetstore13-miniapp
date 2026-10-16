import { HttpStatus, Injectable } from "@nestjs/common";
import type { AdminAccount } from "@ss13/shared";

import { AppException, notFound } from "../common/app-exception.js";
import { isUuid } from "../common/uuid.js";
import type { Admin } from "../generated/prisma/client.js";
import { AdminRole, Prisma } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";
import type { SessionWithAdmin } from "./admin-auth.service.js";
import { assertPasswordPolicy, normalizeEmail } from "./admin-auth.service.js";
import type { AdminCreateDto, AdminUpdateDto } from "./dto.js";
import { hashPassword } from "./password.js";

const adminNotFound = () => notFound("ADMIN_NOT_FOUND", "Адміністратора не знайдено");

/** Керування адміністраторами — тільки для OWNER (перевіряє guard). */
@Injectable()
export class AdminsService {
  constructor(private readonly prisma: PrismaService) {}

  private async toAccount(admin: Admin): Promise<AdminAccount> {
    const activeSessions = await this.prisma.adminSession.count({
      where: { adminId: admin.id, expiresAt: { gt: new Date() } },
    });
    return {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      isActive: admin.isActive,
      lastLoginAt: admin.lastLoginAt?.toISOString() ?? null,
      createdAt: admin.createdAt.toISOString(),
      activeSessions,
    };
  }

  async list(): Promise<AdminAccount[]> {
    const admins = await this.prisma.admin.findMany({
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    });
    return Promise.all(admins.map((admin) => this.toAccount(admin)));
  }

  async create(dto: AdminCreateDto): Promise<AdminAccount> {
    assertPasswordPolicy(dto.password);
    const passwordHash = await hashPassword(dto.password);
    try {
      const admin = await this.prisma.admin.create({
        data: { email: normalizeEmail(dto.email), name: dto.name, role: dto.role, passwordHash },
      });
      return this.toAccount(admin);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new AppException(
          "EMAIL_TAKEN",
          "Адміністратор з таким email уже є",
          HttpStatus.CONFLICT,
          [{ field: "email", errors: ["email зайнятий"] }],
        );
      }
      throw error;
    }
  }

  async update(id: string, dto: AdminUpdateDto, current: SessionWithAdmin): Promise<AdminAccount> {
    if (!isUuid(id)) throw adminNotFound();
    if (id === current.adminId && (dto.role !== undefined || dto.isActive !== undefined)) {
      throw new AppException(
        "CANNOT_CHANGE_SELF",
        "Не можна змінити власну роль чи вимкнути себе. Попросіть іншого власника.",
        HttpStatus.CONFLICT,
      );
    }
    if (dto.password !== undefined) assertPasswordPolicy(dto.password);
    const passwordHash = dto.password !== undefined ? await hashPassword(dto.password) : undefined;

    const updated = await this.prisma.$transaction(async (tx) => {
      // Блокуємо рядки власників, щоб два паралельні пониження не залишили магазин без власника.
      await tx.$queryRaw`SELECT id FROM admins WHERE role = 'OWNER' FOR UPDATE`;
      const target = await tx.admin.findUnique({ where: { id } });
      if (!target) throw adminNotFound();

      const losesOwner =
        target.role === AdminRole.OWNER &&
        target.isActive &&
        ((dto.role !== undefined && dto.role !== AdminRole.OWNER) || dto.isActive === false);
      if (losesOwner) {
        const otherOwners = await tx.admin.count({
          where: { role: AdminRole.OWNER, isActive: true, id: { not: id } },
        });
        if (otherOwners === 0) {
          throw new AppException(
            "LAST_OWNER",
            "Має залишитися хоча б один активний власник",
            HttpStatus.CONFLICT,
          );
        }
      }

      const admin = await tx.admin.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.role !== undefined ? { role: dto.role } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          ...(passwordHash ? { passwordHash } : {}),
        },
      });
      // Нова роль, вимкнення чи скидання пароля діють одразу: старі сесії недійсні.
      const changedAccess =
        (dto.role !== undefined && dto.role !== target.role) ||
        dto.isActive === false ||
        passwordHash !== undefined;
      if (changedAccess) await tx.adminSession.deleteMany({ where: { adminId: id } });
      return admin;
    });
    return this.toAccount(updated);
  }

  async revokeSessions(id: string): Promise<void> {
    if (!isUuid(id)) throw adminNotFound();
    const admin = await this.prisma.admin.findUnique({ where: { id } });
    if (!admin) throw adminNotFound();
    await this.prisma.adminSession.deleteMany({ where: { adminId: id } });
  }
}
