import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { addLine, cartCount, type CartLine, createCartStore, quantityInCart } from "./cart-store";

const line = (over: Partial<CartLine> = {}): CartLine => ({
  variantId: "v1",
  productId: "p1",
  name: "Пуховик",
  brand: "Moncler",
  colorName: "Чорний",
  sizeLabel: "M",
  price: 6_499_900,
  image: null,
  quantity: 1,
  maxQuantity: 3,
  ...over,
});

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

describe("локальний кошик", () => {
  test("той самий варіант складається, але не більше залишку", () => {
    let result = addLine([], line({ quantity: 2 }));
    assert.equal(result.added, 2);
    result = addLine(result.lines, line({ quantity: 2 }));
    assert.equal(result.added, 1);
    assert.equal(quantityInCart(result.lines, "v1"), 3);
    result = addLine(result.lines, line());
    assert.equal(result.added, 0);
  });

  test("різні варіанти — різні рядки; лічильник = сума штук", () => {
    const a = addLine([], line({ quantity: 2 })).lines;
    const b = addLine(a, line({ variantId: "v2", sizeLabel: "L" })).lines;
    assert.equal(b.length, 2);
    assert.equal(cartCount(b), 3);
  });

  test("стан зберігається і відновлюється зі сховища; биті дані ігноруються", () => {
    const storage = memoryStorage();
    const store = createCartStore(storage);
    let notified = 0;
    store.subscribe(() => notified++);
    assert.equal(store.add(line({ quantity: 2 })), 2);
    assert.equal(notified, 1);
    assert.equal(cartCount(createCartStore(storage).getSnapshot()), 2);

    storage.setItem("ss13.cart.v1", "{не json");
    assert.deepEqual(createCartStore(storage).getSnapshot(), []);
    storage.setItem("ss13.cart.v1", JSON.stringify([{ variantId: "x", quantity: 1.5, price: 1 }]));
    assert.deepEqual(createCartStore(storage).getSnapshot(), []);
  });

  test("без сховища (приватний режим) кошик працює в пам'яті", () => {
    const store = createCartStore(null);
    store.add(line());
    assert.equal(cartCount(store.getSnapshot()), 1);
  });
});
