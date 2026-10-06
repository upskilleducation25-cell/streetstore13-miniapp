import assert from "node:assert/strict";
import { test } from "node:test";

import { formatUah } from "@ss13/shared";

import { priceView } from "./price";

// Intl для uk-UA ставить нерозривний пробіл між тисячами; нормалізуємо для порівняння.
const plain = (text: string | null) => text?.replace(/[\u00a0\u202f]/g, " ") ?? null;

test("копійки → гривні через спільну formatUah", () => {
  assert.equal(plain(formatUah(299_900)), "2 999 ₴");
  assert.equal(plain(formatUah(6_499_900)), "64 999 ₴");
  assert.equal(plain(formatUah(59_900)), "599 ₴");
  assert.equal(plain(formatUah(12_345)), "123,45 ₴");
});

test("ціна без знижки: тільки поточна", () => {
  const view = priceView({ price: 449_900, oldPrice: null, discountPercent: null });
  assert.equal(plain(view.current), "4 499 ₴");
  assert.equal(view.old, null);
  assert.equal(view.discount, null);
});

test("знижка: стара ціна і відсоток", () => {
  const view = priceView({ price: 1_299_900, oldPrice: 1_499_900, discountPercent: 13 });
  assert.equal(plain(view.current), "12 999 ₴");
  assert.equal(plain(view.old), "14 999 ₴");
  assert.equal(view.discount, "−13%");
});

test("стара ціна не більша за поточну — знижку не показуємо", () => {
  const view = priceView({ price: 100_000, oldPrice: 100_000, discountPercent: null });
  assert.equal(view.old, null);
  assert.equal(view.discount, null);
});
