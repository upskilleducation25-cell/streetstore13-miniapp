import assert from "node:assert/strict";
import { describe, test } from "node:test";

import type { CartItemView, CartView } from "@ss13/shared";

import { blockingItems, maxQuantityFor, quantityInCart } from "./cart-utils";
import { clearLegacyCart, LEGACY_CART_KEY, readLegacyCart } from "./legacy-cart";

const item = (over: Partial<CartItemView> = {}): CartItemView => ({
  id: "i1",
  variantId: "v1",
  productId: "p1",
  name: "Пуховик",
  brand: "Moncler",
  sku: "DEMO-001",
  colorSlug: "black",
  colorName: "Чорний",
  sizeLabel: "M",
  image: null,
  unitPrice: 6_499_900,
  quantity: 1,
  lineTotal: 6_499_900,
  stock: 3,
  status: "OK",
  ...over,
});

const cart = (items: CartItemView[]): CartView => ({
  items,
  count: items.reduce((sum, line) => sum + line.quantity, 0),
  subtotal: 0,
  total: 0,
  canCheckout: items.every((line) => line.status === "OK"),
});

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

describe("кошик", () => {
  test("кількість варіанту в кошику", () => {
    const c = cart([item({ quantity: 2 }), item({ id: "i2", variantId: "v2" })]);
    assert.equal(quantityInCart(c, "v1"), 2);
    assert.equal(quantityInCart(c, "v3"), 0);
    assert.equal(quantityInCart(undefined, "v1"), 0);
  });

  test("ліміт лічильника: залишок, але не більше загального ліміту", () => {
    assert.equal(maxQuantityFor(item({ stock: 3 }), 20), 3);
    assert.equal(maxQuantityFor(item({ stock: 50 }), 20), 20);
    assert.equal(maxQuantityFor(item({ stock: 0 }), 20), 0);
  });

  test("позиції, що блокують оформлення", () => {
    const c = cart([
      item(),
      item({ id: "i2", status: "INSUFFICIENT_STOCK" }),
      item({ id: "i3", status: "UNAVAILABLE" }),
    ]);
    assert.deepEqual(
      blockingItems(c).map((line) => line.id),
      ["i2", "i3"],
    );
  });

  test("старий локальний кошик Етапу 2 читається і очищається; биті дані ігноруються", () => {
    const storage = memoryStorage();
    storage.setItem(
      LEGACY_CART_KEY,
      JSON.stringify([
        { variantId: "v1", quantity: 2, price: 100, name: "x" },
        { variantId: "v2", quantity: 1.5 },
        { quantity: 1 },
        null,
      ]),
    );
    assert.deepEqual(readLegacyCart(storage), [{ variantId: "v1", quantity: 2 }]);
    clearLegacyCart(storage);
    assert.deepEqual(readLegacyCart(storage), []);

    storage.setItem(LEGACY_CART_KEY, "{не json");
    assert.deepEqual(readLegacyCart(storage), []);
    assert.deepEqual(readLegacyCart(null), []);
  });
});
