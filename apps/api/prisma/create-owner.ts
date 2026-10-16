// Створює першого власника адмінки (або скидає йому пароль) з env-змінних.
// Публічної реєстрації адмінів немає: це єдиний спосіб отримати перший вхід.
//
//   ADMIN_OWNER_EMAIL=owner@example.com ADMIN_OWNER_PASSWORD='…' pnpm admin:create-owner
//   … pnpm admin:create-owner --reset-password   # новий пароль наявному власнику
//
// Пароль не друкується і не пишеться в лог. Після запуску приберіть змінні з оточення.
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { ADMIN_PASSWORD_LIMITS } from "@ss13/shared";

import { hashPassword } from "../src/admin-auth/password.js";
import { AdminRole, PrismaClient } from "../src/generated/prisma/client.js";

function fail(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) fail("DATABASE_URL не задано");

const email = process.env.ADMIN_OWNER_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_OWNER_PASSWORD;
const name = process.env.ADMIN_OWNER_NAME?.trim() || "Власник";
const resetPassword = process.argv.includes("--reset-password");

if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  fail("ADMIN_OWNER_EMAIL не задано або некоректний");
}
if (
  !password ||
  password.length < ADMIN_PASSWORD_LIMITS.min ||
  password.length > ADMIN_PASSWORD_LIMITS.max
) {
  fail(
    `ADMIN_OWNER_PASSWORD: від ${ADMIN_PASSWORD_LIMITS.min} до ${ADMIN_PASSWORD_LIMITS.max} символів`,
  );
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main(): Promise<void> {
  const existing = await prisma.admin.findUnique({ where: { email } });
  if (existing && !resetPassword) {
    console.log(`Адмін ${email} уже існує (${existing.role}). Нічого не змінено.`);
    console.log("Щоб задати новий пароль і роль OWNER, запустіть з --reset-password.");
    return;
  }
  const passwordHash = await hashPassword(password!);
  if (existing) {
    await prisma.$transaction([
      prisma.admin.update({
        where: { id: existing.id },
        data: { passwordHash, role: AdminRole.OWNER, isActive: true },
      }),
      prisma.adminSession.deleteMany({ where: { adminId: existing.id } }),
    ]);
    console.log(`✓ Пароль власника ${email} оновлено, усі його сесії завершено.`);
    return;
  }
  await prisma.admin.create({ data: { email: email!, name, passwordHash, role: AdminRole.OWNER } });
  console.log(`✓ Власника ${email} створено. Увійдіть в адмінку з цим email і паролем.`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
