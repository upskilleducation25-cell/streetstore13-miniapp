// Demo-товари для розробки і тестів. Не реальний асортимент: ціни й залишки умовні,
// фото немає. Скрипт ідемпотентний: повторний запуск відновлює ті самі значення.
// Запуск: pnpm db:seed:demo (після pnpm db:seed).
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient, ProductStatus, SizeSystem } from "../src/generated/prisma/client.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL не задано");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

type Stock = Record<string, Record<string, number>>; // колір → розмір → залишок

interface DemoProduct {
  sku: string;
  slug: string;
  name: string;
  brand: string;
  category: string;
  price: number; // копійки
  oldPrice?: number;
  isNew?: boolean;
  isPopular?: boolean;
  isSale?: boolean;
  status?: ProductStatus;
  sizeSystem: SizeSystem;
  stock: Stock;
}

const C = SizeSystem.CLOTHING;
const S = SizeSystem.SHOES_EU;
const O = SizeSystem.ONE_SIZE;

const DEMO_PRODUCTS: DemoProduct[] = [
  {
    sku: "DEMO-001",
    slug: "demo-001-moncler-puhovyk",
    name: "Пуховик Maya",
    brand: "moncler",
    category: "puhovyky",
    price: 6_499_900,
    isNew: true,
    isPopular: true,
    sizeSystem: C,
    stock: { black: { S: 2, M: 3, L: 0, XL: 1 }, navy: { M: 1, L: 2 } },
  },
  {
    sku: "DEMO-002",
    slug: "demo-002-stone-island-puhovyk",
    name: "Пуховик Garment-Dyed",
    brand: "stone-island",
    category: "puhovyky",
    price: 1_299_900,
    oldPrice: 1_499_900,
    isSale: true,
    sizeSystem: C,
    stock: { black: { M: 1, L: 1 }, olive: { L: 0, XL: 2 } },
  },
  {
    sku: "DEMO-003",
    slug: "demo-003-arcteryx-kurtka",
    name: "Куртка Beta",
    brand: "arcteryx",
    category: "kurtky",
    price: 1_899_900,
    isNew: true,
    sizeSystem: C,
    stock: { black: { M: 2, L: 1 }, blue: { L: 1 } },
  },
  {
    sku: "DEMO-004",
    slug: "demo-004-nike-vitrovka",
    name: "Вітровка Windrunner",
    brand: "nike",
    category: "vitrovky",
    price: 449_900,
    oldPrice: 549_900,
    isSale: true,
    isPopular: true,
    sizeSystem: C,
    stock: { black: { S: 3, M: 4, L: 2 }, navy: { M: 0, L: 1 } },
  },
  {
    sku: "DEMO-005",
    slug: "demo-005-acne-hudi",
    name: "Худі з логотипом",
    brand: "acne-studios",
    category: "hudi",
    price: 1_149_900,
    isNew: true,
    sizeSystem: C,
    stock: { grey: { S: 1, M: 2, L: 0 }, black: { M: 0, L: 0 } },
  },
  {
    sku: "DEMO-006",
    slug: "demo-006-polo-svitshot",
    name: "Світшот Pony",
    brand: "polo-ralph-lauren",
    category: "svitshoty",
    price: 599_900,
    isPopular: true,
    sizeSystem: C,
    stock: { navy: { M: 2, L: 2, XL: 1 }, grey: { L: 1 } },
  },
  {
    sku: "DEMO-007",
    slug: "demo-007-armani-futbolka",
    name: "Футболка з логотипом",
    brand: "armani-exchange",
    category: "futbolky",
    price: 249_900,
    oldPrice: 299_900,
    isSale: true,
    sizeSystem: C,
    stock: { white: { S: 5, M: 5, L: 3 }, black: { M: 2, L: 0 } },
  },
  {
    sku: "DEMO-008",
    slug: "demo-008-stone-island-shtany",
    name: "Штани карго",
    brand: "stone-island",
    category: "shtany",
    price: 1_099_900,
    sizeSystem: C,
    stock: { black: { M: 1, L: 1, XL: 0 }, olive: { L: 2 } },
  },
  {
    sku: "DEMO-009",
    slug: "demo-009-nike-af1",
    name: "Кросівки Air Force 1 '07",
    brand: "nike",
    category: "krosivky",
    price: 449_900,
    isPopular: true,
    sizeSystem: S,
    stock: { white: { "40": 2, "41": 3, "42": 0, "43": 1 }, black: { "42": 1 } },
  },
  {
    sku: "DEMO-010",
    slug: "demo-010-premiata-mick",
    name: "Кросівки Mick",
    brand: "premiata",
    category: "krosivky",
    price: 1_199_900,
    isNew: true,
    sizeSystem: S,
    stock: { white: { "41": 1, "42": 1, "43": 0 }, grey: { "42": 2 } },
  },
  {
    sku: "DEMO-011",
    slug: "demo-011-polo-kepka",
    name: "Кепка класична",
    brand: "polo-ralph-lauren",
    category: "holovni-ubory",
    price: 299_900,
    sizeSystem: O,
    stock: { navy: { "ONE SIZE": 4 }, beige: { "ONE SIZE": 0 } },
  },
  {
    sku: "DEMO-012",
    slug: "demo-012-acne-sumka",
    name: "Сумка через плече",
    brand: "acne-studios",
    category: "sumky",
    price: 899_900,
    oldPrice: 1_099_900,
    isSale: true,
    sizeSystem: O,
    stock: { black: { "ONE SIZE": 2 } },
  },
  {
    sku: "DEMO-013",
    slug: "demo-013-nike-shkarpetky",
    name: "Шкарпетки Everyday (немає в наявності)",
    brand: "nike",
    category: "aksesuary",
    price: 59_900,
    sizeSystem: O,
    stock: { white: { "ONE SIZE": 0 } },
  },
  // Прихований товар: не має з'являтися на вітрині ні в списках, ні за id, ні в пошуку.
  {
    sku: "DEMO-HIDDEN-01",
    slug: "demo-hidden-01-moncler",
    name: "Прихований пуховик",
    brand: "moncler",
    category: "puhovyky",
    price: 5_000_000,
    isNew: true,
    status: ProductStatus.HIDDEN,
    sizeSystem: C,
    stock: { black: { M: 5 } },
  },
];

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
  console.log(`Demo-seed завершено: товарів ${demoCount}, варіантів ${variantCount}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
