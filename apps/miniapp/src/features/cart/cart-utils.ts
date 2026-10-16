import type { CartItemView, CartView } from "@ss13/shared";

export const quantityInCart = (cart: CartView | undefined, variantId: string): number =>
  cart?.items.find((item) => item.variantId === variantId)?.quantity ?? 0;

/** Максимум, який можна виставити в лічильнику позиції кошика. */
export const maxQuantityFor = (item: CartItemView, limit: number): number =>
  Math.max(0, Math.min(item.stock, limit));

/** Позиції, які заважають оформленню (немає або не вистачає залишку). */
export const blockingItems = (cart: CartView | undefined): CartItemView[] =>
  cart?.items.filter((item) => item.status !== "OK") ?? [];
