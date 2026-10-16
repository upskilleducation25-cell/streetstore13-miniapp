import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { makeProduct } from "../../testing/fixtures";
import {
  clampQuantity,
  findVariant,
  imagesForColor,
  initialSelection,
  selectColor,
  selectSize,
  showLowStock,
  sizeOptions,
} from "./options";

// Як DEMO-001: чорний S2 M3 L0 XL1, темно-синій M1 L2.
const product = makeProduct({ black: { S: 2, M: 3, L: 0, XL: 1 }, navy: { M: 1, L: 2 } }, [
  "XS",
  "S",
  "M",
  "L",
  "XL",
]);

describe("доступні кольори і розміри", () => {
  test("розміри для кольору: є тільки пари з залишком", () => {
    assert.deepEqual(sizeOptions(product, "black"), [
      { label: "S", available: true },
      { label: "M", available: true },
      { label: "L", available: false },
      { label: "XL", available: true },
    ]);
    // S і XL у темно-синьому взагалі немає — показуються, але недоступні.
    assert.deepEqual(sizeOptions(product, "navy"), [
      { label: "S", available: false },
      { label: "M", available: true },
      { label: "L", available: true },
      { label: "XL", available: false },
    ]);
  });

  test("без вибраного кольору — доступність розміру хоча б в одному кольорі", () => {
    assert.deepEqual(
      sizeOptions(product, null).map((s) => s.available),
      [true, true, true, true],
    );
  });

  test("стартовий вибір: перший доступний колір, розмір не вибрано", () => {
    assert.deepEqual(initialSelection(product), { color: "black", size: null });
  });

  test("недоступний колір пропускається на старті", () => {
    const p = makeProduct({ white: { M: 0 }, grey: { M: 1, L: 1 } }, ["M", "L"]);
    assert.deepEqual(initialSelection(p), { color: "grey", size: null });
  });

  test("єдиний доступний розмір (ONE SIZE) вибирається сам", () => {
    const p = makeProduct({ navy: { "ONE SIZE": 4 }, beige: { "ONE SIZE": 0 } }, ["ONE SIZE"]);
    assert.deepEqual(initialSelection(p), { color: "navy", size: "ONE SIZE" });
  });

  test("товар без наявності: нічого не вибрано", () => {
    const p = makeProduct({ white: { "ONE SIZE": 0 } }, ["ONE SIZE"]);
    assert.deepEqual(initialSelection(p), { color: null, size: null });
  });

  test("недоступний розмір вибрати не можна", () => {
    const start = { color: "black", size: null };
    assert.deepEqual(selectSize(product, start, "L"), start);
    assert.deepEqual(selectSize(product, start, "M"), { color: "black", size: "M" });
  });

  test("недоступний колір вибрати не можна", () => {
    const p = makeProduct({ white: { M: 0 }, grey: { M: 1 } }, ["M"]);
    const start = { color: "grey", size: "M" };
    assert.deepEqual(selectColor(p, start, "white"), start);
  });

  test("зміна кольору зберігає розмір, якщо він є в новому кольорі", () => {
    assert.deepEqual(selectColor(product, { color: "black", size: "M" }, "navy"), {
      color: "navy",
      size: "M",
    });
  });

  test("зміна кольору скидає розмір, якого в новому кольорі немає", () => {
    assert.deepEqual(selectColor(product, { color: "black", size: "S" }, "navy"), {
      color: "navy",
      size: null,
    });
  });

  test("findVariant повертає саме пару колір + розмір", () => {
    assert.equal(findVariant(product, "navy", "L")?.stock, 2);
    assert.equal(findVariant(product, "navy", "S"), undefined);
    assert.equal(findVariant(product, null, "S"), undefined);
  });
});

describe("кількість і залишок", () => {
  test("кількість у межах 1…залишок", () => {
    assert.equal(clampQuantity(5, 3), 3);
    assert.equal(clampQuantity(0, 3), 1);
    assert.equal(clampQuantity(-2, 3), 1);
    assert.equal(clampQuantity(Number.NaN, 3), 1);
    assert.equal(clampQuantity(2, 0), 0);
  });

  test("«Залишилось N шт.» тільки при низькому залишку", () => {
    assert.equal(showLowStock(1, 2), true);
    assert.equal(showLowStock(2, 2), true);
    assert.equal(showLowStock(3, 2), false);
    assert.equal(showLowStock(0, 2), false);
  });
});

describe("фото", () => {
  test("показуються фото вибраного кольору", () => {
    assert.deepEqual(
      imagesForColor(product, "navy").map((i) => i.id),
      ["navy-1", "navy-2"],
    );
  });

  test("колір без фото — показуються всі", () => {
    const p = { ...product, images: product.images.filter((i) => i.colorSlug === "black") };
    assert.equal(imagesForColor(p, "navy").length, 2);
  });
});
