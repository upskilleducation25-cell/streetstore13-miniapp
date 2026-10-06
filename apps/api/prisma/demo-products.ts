// Дані demo-товарів: спільні для seed-demo.ts і генератора плейсхолдер-фото.
// Не реальний асортимент: ціни й залишки умовні.
import { ProductStatus, SizeSystem } from "../src/generated/prisma/enums.js";

export type Stock = Record<string, Record<string, number>>; // колір → розмір → залишок

export interface DemoProduct {
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

export const DEMO_PRODUCTS: DemoProduct[] = [
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

/** Кількість плейсхолдер-фото на кожен колір товару (для галереї). */
export const DEMO_IMAGES_PER_COLOR = 2;
export const DEMO_IMAGE_WIDTH = 600;
export const DEMO_IMAGE_HEIGHT = 800;

/** Шлях до плейсхолдера відносно кореня Mini App (apps/miniapp/public). */
export function demoImagePath(sku: string, colorSlug: string, index: number): string {
  return `/demo/products/${sku.toLowerCase()}-${colorSlug}-${index}.svg`;
}
