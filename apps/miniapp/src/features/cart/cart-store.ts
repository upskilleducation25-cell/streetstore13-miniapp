// Локальний кошик Етапу 2: лише стан на пристрої і лічильник. Серверний кошик,
// перевірка цін і залишків під час оформлення — Етап 3.

export interface CartLine {
  variantId: string;
  productId: string;
  name: string;
  brand: string;
  colorName: string;
  sizeLabel: string;
  /** Копійки, на момент додавання. Актуальну ціну перевірить сервер на Етапі 3. */
  price: number;
  image: string | null;
  quantity: number;
  /** Залишок варіанту на момент додавання. */
  maxQuantity: number;
}

export interface AddResult {
  lines: CartLine[];
  /** Скільки штук реально додано (може бути менше через залишок). */
  added: number;
}

export function addLine(lines: CartLine[], line: CartLine): AddResult {
  const existing = lines.find((item) => item.variantId === line.variantId);
  const max = Math.max(0, line.maxQuantity);
  const current = existing?.quantity ?? 0;
  const next = Math.min(current + Math.max(0, line.quantity), max);
  const added = next - current;
  if (added <= 0) return { lines, added: 0 };
  const updated = { ...line, quantity: next };
  return {
    lines: existing
      ? lines.map((item) => (item.variantId === line.variantId ? updated : item))
      : [...lines, updated],
    added,
  };
}

export const cartCount = (lines: CartLine[]): number =>
  lines.reduce((sum, line) => sum + line.quantity, 0);

export const quantityInCart = (lines: CartLine[], variantId: string): number =>
  lines.find((line) => line.variantId === variantId)?.quantity ?? 0;

type StorageLike = Pick<Storage, "getItem" | "setItem">;

const STORAGE_KEY = "ss13.cart.v1";

function isCartLine(value: unknown): value is CartLine {
  const line = value as CartLine;
  return (
    typeof line === "object" &&
    line !== null &&
    typeof line.variantId === "string" &&
    Number.isInteger(line.quantity) &&
    line.quantity > 0 &&
    Number.isInteger(line.price)
  );
}

function load(storage: StorageLike | null): CartLine[] {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isCartLine) : [];
  } catch {
    return [];
  }
}

/** Сховище для useSyncExternalStore; зберігається в localStorage, якщо він доступний. */
export function createCartStore(storage: StorageLike | null) {
  let lines = load(storage);
  const listeners = new Set<() => void>();

  return {
    getSnapshot: () => lines,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    add(line: CartLine): number {
      const result = addLine(lines, line);
      if (result.added > 0) {
        lines = result.lines;
        try {
          storage?.setItem(STORAGE_KEY, JSON.stringify(lines));
        } catch {
          // Приватний режим або переповнене сховище: кошик живе до перезавантаження.
        }
        for (const listener of listeners) listener();
      }
      return result.added;
    },
  };
}

export type CartStore = ReturnType<typeof createCartStore>;
