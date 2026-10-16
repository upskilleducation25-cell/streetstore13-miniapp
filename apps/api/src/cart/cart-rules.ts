// Чисті правила кошика й оформлення: ціна, доступність, статус позиції, суми.
// Однакові для GET /cart і для транзакції створення замовлення.
import type { CartItemStatus, ImageUrls } from "@ss13/shared";

import type { Prisma } from "../generated/prisma/client.js";
import { ProductStatus } from "../generated/prisma/client.js";

/** Що підвантажуємо для варіанту в кошику і при оформленні. */
export const variantForSaleInclude = {
  color: true,
  size: true,
  product: {
    include: {
      brand: true,
      category: { include: { parent: true } },
      images: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
    },
  },
} satisfies Prisma.ProductVariantInclude;

export type VariantForSale = Prisma.ProductVariantGetPayload<{
  include: typeof variantForSaleInclude;
}>;

/** Ціна варіанту з бази: власна ціна варіанту або ціна товару. Ніколи не з запиту. */
export function unitPriceOf(variant: Pick<VariantForSale, "priceOverride" | "product">): number {
  return variant.priceOverride ?? variant.product.price;
}

/**
 * Варіант продається: активний варіант видимого товару (ті самі правила, що й на вітрині:
 * товар ACTIVE і не видалений, бренд і категорія активні, батьківська категорія теж).
 */
export function isPurchasable(variant: VariantForSale): boolean {
  const { product } = variant;
  return (
    variant.isActive &&
    product.status === ProductStatus.ACTIVE &&
    product.deletedAt === null &&
    product.brand.isActive &&
    product.category.isActive &&
    (product.category.parent === null || product.category.parent.isActive)
  );
}

/** Скільки штук зараз можна купити. */
export function availableStock(variant: VariantForSale): number {
  return isPurchasable(variant) ? Math.max(0, variant.stock) : 0;
}

export function lineStatus(requested: number, available: number): CartItemStatus {
  if (available <= 0) return "UNAVAILABLE";
  if (requested > available) return "INSUFFICIENT_STOCK";
  return "OK";
}

/** Фото позиції: перше фото цього кольору, інакше перше фото товару. */
export function imageOf(variant: VariantForSale): string | null {
  const images = variant.product.images;
  const image = images.find((item) => item.colorId === variant.colorId) ?? images[0];
  const urls = image?.urls as ImageUrls | undefined;
  return urls?.thumb ?? urls?.medium ?? urls?.large ?? null;
}

export interface Totals {
  subtotal: number;
  discountTotal: number;
  deliveryCost: number;
  total: number;
}

/**
 * Суми в копійках: line_total = unit_price × quantity, total = subtotal − discount + delivery.
 * Доставка поки оплачується за тарифом перевізника окремо, тому deliveryCost = 0.
 */
export function calculateTotals(
  lines: Array<{ unitPrice: number; quantity: number }>,
  options: { discountTotal?: number; deliveryCost?: number } = {},
): Totals {
  for (const line of lines) {
    if (!Number.isSafeInteger(line.unitPrice) || line.unitPrice < 0) {
      throw new Error("Некоректна ціна позиції");
    }
    if (!Number.isSafeInteger(line.quantity) || line.quantity <= 0) {
      throw new Error("Некоректна кількість позиції");
    }
  }
  const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const discountTotal = options.discountTotal ?? 0;
  const deliveryCost = options.deliveryCost ?? 0;
  return {
    subtotal,
    discountTotal,
    deliveryCost,
    total: Math.max(0, subtotal - discountTotal + deliveryCost),
  };
}
