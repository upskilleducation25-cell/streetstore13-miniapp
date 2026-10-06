// Вибір кольору, розміру і кількості на картці товару. Доступність рахується з матриці
// variants: розмір доступний, лише якщо є варіант «вибраний колір + розмір» із залишком.
import type { ProductDetail, ProductImage, ProductVariantInfo } from "@ss13/shared";

export interface Selection {
  color: string | null;
  size: string | null;
}

export interface SizeOption {
  label: string;
  available: boolean;
}

export function findVariant(
  product: ProductDetail,
  color: string | null,
  size: string | null,
): ProductVariantInfo | undefined {
  if (!color || !size) return undefined;
  return product.variants.find((v) => v.colorSlug === color && v.sizeLabel === size);
}

/** Усі розміри товару в порядку сітки; доступність — для вибраного кольору. */
export function sizeOptions(product: ProductDetail, color: string | null): SizeOption[] {
  return product.sizes.map((size) => ({
    label: size.label,
    available: color ? Boolean(findVariant(product, color, size.label)?.available) : size.available,
  }));
}

const availableSizes = (product: ProductDetail, color: string | null) =>
  sizeOptions(product, color).filter((size) => size.available);

/** Якщо доступний рівно один розмір (наприклад, ONE SIZE), він вибирається сам. */
function autoSize(product: ProductDetail, color: string | null): string | null {
  const sizes = availableSizes(product, color);
  return sizes.length === 1 ? sizes[0]!.label : null;
}

export function initialSelection(
  product: ProductDetail,
  preferredColor?: string | null,
): Selection {
  const preferred = product.colors.find((c) => c.slug === preferredColor && c.available);
  const color = preferred?.slug ?? product.colors.find((c) => c.available)?.slug ?? null;
  return { color, size: autoSize(product, color) };
}

/** Недоступний колір вибрати не можна; розмір зберігається, якщо є в новому кольорі. */
export function selectColor(product: ProductDetail, current: Selection, color: string): Selection {
  const option = product.colors.find((c) => c.slug === color);
  if (!option?.available) return current;
  const keep = current.size && findVariant(product, color, current.size)?.available;
  return { color, size: keep ? current.size : autoSize(product, color) };
}

export function selectSize(product: ProductDetail, current: Selection, size: string): Selection {
  if (!findVariant(product, current.color, size)?.available) return current;
  return { ...current, size };
}

/** Кількість у межах 1…залишок (вже з урахуванням того, що лежить у кошику). */
export function clampQuantity(quantity: number, max: number): number {
  if (max < 1) return 0;
  return Math.min(Math.max(1, Math.floor(quantity) || 1), max);
}

/** Фото вибраного кольору (і спільні без кольору); якщо таких немає — усі. */
export function imagesForColor(product: ProductDetail, color: string | null): ProductImage[] {
  if (!color) return product.images;
  const matching = product.images.filter((image) => !image.colorSlug || image.colorSlug === color);
  return matching.length > 0 ? matching : product.images;
}

/** «Залишилось N шт.» показуємо тільки при низькому залишку. */
export const showLowStock = (stock: number, threshold: number): boolean =>
  stock > 0 && stock <= threshold;
