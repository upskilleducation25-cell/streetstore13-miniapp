// Початкові довідники. Скрипт ідемпотентний: можна запускати повторно.
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import type { Prisma } from "../src/generated/prisma/client.js";
import { PrismaClient, SizeSystem } from "../src/generated/prisma/client.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL не задано");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const categories: Array<[slug: string, name: string]> = [
  ["puhovyky", "Пуховики"],
  ["kurtky", "Куртки"],
  ["vitrovky", "Вітровки"],
  ["hudi", "Худі"],
  ["svitshoty", "Світшоти"],
  ["futbolky", "Футболки"],
  ["shtany", "Штани"],
  ["krosivky", "Кросівки"],
  ["sumky", "Сумки"],
  ["holovni-ubory", "Головні убори"],
  ["aksesuary", "Аксесуари"],
];

const brands: Array<[slug: string, name: string]> = [
  ["nike", "Nike"],
  ["polo-ralph-lauren", "Polo Ralph Lauren"],
  ["acne-studios", "Acne Studios"],
  ["moncler", "Moncler"],
  ["armani-exchange", "Armani Exchange"],
  ["stone-island", "Stone Island"],
  ["premiata", "Premiata"],
  ["arcteryx", "Arc'teryx"],
];

const colors: Array<[slug: string, name: string, hex: string]> = [
  ["black", "Чорний", "#000000"],
  ["white", "Білий", "#FFFFFF"],
  ["grey", "Сірий", "#8E8E93"],
  ["navy", "Темно-синій", "#1F2A44"],
  ["blue", "Синій", "#2F5DA8"],
  ["beige", "Бежевий", "#D8C3A5"],
  ["brown", "Коричневий", "#6B4A35"],
  ["olive", "Оливковий", "#5B5F3A"],
  ["green", "Зелений", "#2E6B3F"],
  ["red", "Червоний", "#B3261E"],
];

const sizes: Array<[system: SizeSystem, labels: string[]]> = [
  [SizeSystem.CLOTHING, ["XS", "S", "M", "L", "XL", "XXL", "XXXL"]],
  [SizeSystem.SHOES_EU, ["36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46"]],
  [SizeSystem.ONE_SIZE, ["ONE SIZE"]],
];

const deliveryServices: Array<[code: string, name: string, supportsLockers: boolean]> = [
  ["nova_poshta", "Нова Пошта", true],
  ["ukrposhta", "Укрпошта", false],
  ["meest", "Meest", true],
];

const settings: Record<string, Prisma.InputJsonValue> = {
  "store.name": "STREETSTORE.13",
  "store.contacts": { phone: null, telegram: null, instagram: null },
  "inventory.lowStockThreshold": 2,
  notifications: { adminChatId: null },
};

async function main(): Promise<void> {
  for (const [index, [slug, name]] of categories.entries()) {
    await prisma.category.upsert({
      where: { slug },
      update: {},
      create: { slug, name, sortOrder: (index + 1) * 10 },
    });
  }

  for (const [index, [slug, name]] of brands.entries()) {
    await prisma.brand.upsert({
      where: { slug },
      update: {},
      create: { slug, name, sortOrder: (index + 1) * 10 },
    });
  }

  for (const [index, [slug, name, hex]] of colors.entries()) {
    await prisma.color.upsert({
      where: { slug },
      update: {},
      create: { slug, name, hex, sortOrder: (index + 1) * 10 },
    });
  }

  for (const [sizeSystem, labels] of sizes) {
    for (const [index, label] of labels.entries()) {
      await prisma.size.upsert({
        where: { sizeSystem_label: { sizeSystem, label } },
        update: {},
        create: { sizeSystem, label, sortOrder: (index + 1) * 10 },
      });
    }
  }

  for (const [index, [code, name, supportsLockers]] of deliveryServices.entries()) {
    await prisma.deliveryService.upsert({
      where: { code },
      update: {},
      create: { code, name, supportsLockers, sortOrder: (index + 1) * 10 },
    });
  }

  // Онлайн-оплати поки немає: менеджер узгоджує оплату після підтвердження.
  await prisma.paymentMethod.upsert({
    where: { code: "manual" },
    update: {},
    create: {
      code: "manual",
      name: "Оплата після підтвердження менеджером",
      isActive: true,
      sortOrder: 10,
    },
  });

  for (const [key, value] of Object.entries(settings)) {
    await prisma.setting.upsert({
      where: { key },
      update: {},
      create: { key, value },
    });
  }

  const counts = {
    categories: await prisma.category.count(),
    brands: await prisma.brand.count(),
    colors: await prisma.color.count(),
    sizes: await prisma.size.count(),
    deliveryServices: await prisma.deliveryService.count(),
    paymentMethods: await prisma.paymentMethod.count(),
    settings: await prisma.setting.count(),
  };
  console.log("Seed завершено:", counts);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
