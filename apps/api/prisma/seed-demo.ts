// Demo-товари для розробки і тестів. Не реальний асортимент: ціни й залишки умовні,
// фото — плейсхолдери з apps/miniapp/public/demo/products (генератор: pnpm demo:images).
// Скрипт ідемпотентний: повторний запуск відновлює ті самі значення.
// Запуск: pnpm db:seed:demo (після pnpm db:seed).
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient, ProductStatus } from "../src/generated/prisma/client.js";
import {
  DEMO_IMAGE_HEIGHT,
  DEMO_IMAGE_WIDTH,
  DEMO_IMAGES_PER_COLOR,
  DEMO_PRODUCTS,
  demoImagePath,
} from "./demo-products.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL не задано");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main(): Promise<void> {
  const [brands, categories, colors, sizes] = await Promise.all([
    prisma.brand.findMany(),
    prisma.category.findMany(),
    prisma.color.findMany(),
    prisma.size.findMany(),
  ]);
  const find = <T>(list: T[], pred: (item: T) => boolean, what: string): T => {
    const item = list.find(pred);
    if (!item) throw new Error(`Не знайдено ${what}. Спершу запустіть pnpm db:seed`);
    return item;
  };

  // Стабільний порядок «новинок»: перший товар у списку — найновіший.
  const base = Date.UTC(2026, 9, 1, 12, 0, 0);

  for (const [index, demo] of DEMO_PRODUCTS.entries()) {
    const brand = find(brands, (b) => b.slug === demo.brand, `бренд ${demo.brand}`);
    const category = find(
      categories,
      (c) => c.slug === demo.category,
      `категорію ${demo.category}`,
    );
    const data = {
      name: demo.name,
      slug: demo.slug,
      brandId: brand.id,
      categoryId: category.id,
      description: "Демо-товар для розробки і тестів. Ціна та залишки умовні.",
      material: null,
      price: demo.price,
      oldPrice: demo.oldPrice ?? null,
      status: demo.status ?? ProductStatus.ACTIVE,
      isNew: demo.isNew ?? false,
      isPopular: demo.isPopular ?? false,
      isSale: demo.isSale ?? false,
      deletedAt: null,
      createdAt: new Date(base - index * 60_000),
    };
    const product = await prisma.product.upsert({
      where: { sku: demo.sku },
      create: { sku: demo.sku, ...data },
      update: data,
    });

    // Фото: перестворюються при кожному запуску, тож кінцевий стан той самий.
    await prisma.productImage.deleteMany({
      where: { productId: product.id, storageKey: { startsWith: "demo/" } },
    });
    let sortOrder = 0;
    for (const colorSlug of Object.keys(demo.stock)) {
      const color = find(colors, (c) => c.slug === colorSlug, `колір ${colorSlug}`);
      for (let index = 1; index <= DEMO_IMAGES_PER_COLOR; index++) {
        const url = demoImagePath(demo.sku, colorSlug, index);
        await prisma.productImage.create({
          data: {
            productId: product.id,
            colorId: color.id,
            storageKey: `demo${url}`,
            urls: { thumb: url, medium: url, large: url },
            width: DEMO_IMAGE_WIDTH,
            height: DEMO_IMAGE_HEIGHT,
            alt: `${demo.name}, ${color.name.toLowerCase()}`,
            sortOrder: sortOrder++,
          },
        });
      }
    }

    for (const [colorSlug, bySize] of Object.entries(demo.stock)) {
      const color = find(colors, (c) => c.slug === colorSlug, `колір ${colorSlug}`);
      for (const [label, stock] of Object.entries(bySize)) {
        const size = find(
          sizes,
          (s) => s.sizeSystem === demo.sizeSystem && s.label === label,
          `розмір ${label}`,
        );
        await prisma.productVariant.upsert({
          where: {
            productId_colorId_sizeId: { productId: product.id, colorId: color.id, sizeId: size.id },
          },
          create: { productId: product.id, colorId: color.id, sizeId: size.id, stock },
          update: { stock, isActive: true, priceOverride: null },
        });
      }
    }
  }

  const demoCount = await prisma.product.count({ where: { sku: { startsWith: "DEMO-" } } });
  const variantCount = await prisma.productVariant.count({
    where: { product: { sku: { startsWith: "DEMO-" } } },
  });
  const imageCount = await prisma.productImage.count({
    where: { product: { sku: { startsWith: "DEMO-" } } },
  });
  console.log(
    `Demo-seed завершено: товарів ${demoCount}, варіантів ${variantCount}, фото ${imageCount}`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
