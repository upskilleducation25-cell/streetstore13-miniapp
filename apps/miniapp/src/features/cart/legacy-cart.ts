// Етап 2 зберігав кошик лише на пристрої (localStorage, ключ ss13.cart.v1). З Етапу 3
// кошик серверний; позиції зі старого локального кошика один раз переносяться на сервер.

export interface LegacyCartLine {
  variantId: string;
  quantity: number;
}

type StorageLike = Pick<Storage, "getItem" | "removeItem">;

export const LEGACY_CART_KEY = "ss13.cart.v1";

/** Позиції старого локального кошика; биті дані ігноруються. */
export function readLegacyCart(storage: StorageLike | null): LegacyCartLine[] {
  try {
    const raw = storage?.getItem(LEGACY_CART_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item: unknown) => {
      const line = item as Partial<LegacyCartLine> | null;
      return line &&
        typeof line.variantId === "string" &&
        Number.isInteger(line.quantity) &&
        (line.quantity ?? 0) > 0
        ? [{ variantId: line.variantId, quantity: line.quantity! }]
        : [];
    });
  } catch {
    return [];
  }
}

export function clearLegacyCart(storage: StorageLike | null): void {
  try {
    storage?.removeItem(LEGACY_CART_KEY);
  } catch {
    // Приватний режим: нема чого чистити.
  }
}
