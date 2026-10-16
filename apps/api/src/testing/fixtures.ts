// Тестові товари створюються в самому тесті й видаляються після нього:
// demo-каталог і довідники з seed не змінюються.
import { ProductStatus, SizeSystem } from "../generated/prisma/client.js";
import type { PrismaService } from "../prisma/prisma.service.js";

export interface TestVariant {
  color: string;
  size: string;
  stock: number;
  priceOverride?: number;
}

export interface TestProduct {
  id: string;
  /** id варіанту за ключем «колір/розмір», напр. "black/M". */
  variant: (key: string) => string;
}

export async function createTestProduct(
  prisma: PrismaService,
  options: { sku: string; name?: string; price: number; variants: TestVariant[] },
): Promise<TestProduct> {
  const [brand, category] = await Promise.all([
    prisma.brand.findUniqueOrThrow({ where: { slug: "moncler" } }),
    prisma.category.findUniqueOrThrow({ where: { slug: "puhovyky" } }),
  ]);
  const colors = new Map(
    (
      await prisma.color.findMany({ where: { slug: { in: options.variants.map((v) => v.color) } } })
    ).map((color) => [color.slug, color.id]),
  );
  const sizes = new Map(
    (
      await prisma.size.findMany({
        where: {
          sizeSystem: SizeSystem.CLOTHING,
          label: { in: options.variants.map((v) => v.size) },
        },
      })
    ).map((size) => [size.label, size.id]),
  );

  const product = await prisma.product.create({
    data: {
      sku: options.sku,
      slug: options.sku.toLowerCase(),
      name: options.name ?? `Тестовий пуховик ${options.sku}`,
      brandId: brand.id,
      categoryId: category.id,
      price: options.price,
      status: ProductStatus.ACTIVE,
      images: {
        create: {
          storageKey: `test/${options.sku}`,
          urls: { thumb: `/test/${options.sku}-thumb.webp`, medium: `/test/${options.sku}.webp` },
          width: 600,
          height: 800,
          colorId: colors.get(options.variants[0]!.color),
        },
      },
      variants: {
        create: options.variants.map((variant) => ({
          colorId: colors.get(variant.color)!,
          sizeId: sizes.get(variant.size)!,
          stock: variant.stock,
          priceOverride: variant.priceOverride ?? null,
        })),
      },
    },
    include: { variants: { include: { color: true, size: true } } },
  });
  const byKey = new Map(
    product.variants.map((variant) => [`${variant.color.slug}/${variant.size.label}`, variant.id]),
  );
  return {
    id: product.id,
    variant: (key) => {
      const id = byKey.get(key);
      if (!id) throw new Error(`Немає тестового варіанту ${key}`);
      return id;
    },
  };
}

/** Видаляє тестових покупців (з їхніми замовленнями) і тестові товари. */
export async function cleanupTestData(
  prisma: PrismaService,
  options: { skuPrefix: string; telegramIds: number[] },
): Promise<void> {
  const telegramIds = options.telegramIds.map((id) => BigInt(id));
  const users = await prisma.user.findMany({
    where: { telegramId: { in: telegramIds } },
    select: { id: true },
  });
  const userIds = users.map((user) => user.id);
  await prisma.notificationLog.deleteMany({
    where: { OR: [{ userId: { in: userIds } }, { order: { userId: { in: userIds } } }] },
  });
  await prisma.inventoryMovement.deleteMany({ where: { order: { userId: { in: userIds } } } });
  await prisma.order.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.product.deleteMany({ where: { sku: { startsWith: options.skuPrefix } } });
}
