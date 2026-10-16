import assert from "node:assert/strict";
import { test } from "node:test";

import type { AdminProductDetail } from "@ss13/shared";

import {
  duplicateForm,
  emptyProductForm,
  formFromProduct,
  previewDiscount,
  validateProductForm,
} from "./product-form";

const product: AdminProductDetail = {
  id: "p1",
  sku: "SS13-001",
  name: "Пуховик",
  slug: "pukhovyk",
  brandId: "b1",
  categoryId: "c1",
  description: "Опис",
  material: null,
  price: 1_299_950,
  oldPrice: 1_500_000,
  discountPercent: 13,
  status: "ACTIVE",
  isNew: true,
  isPopular: false,
  isSale: true,
  sortWeight: 5,
  totalStock: 3,
  orderItemCount: 0,
  createdAt: "2026-10-16T00:00:00.000Z",
  updatedAt: "2026-10-16T00:00:00.000Z",
  variants: [],
  images: [],
};

test("форма ↔ товар: гроші в гривнях без втрат", () => {
  const form = formFromProduct(product);
  assert.equal(form.price, "12999,50");
  assert.equal(form.oldPrice, "15000");
  const { payload, errors } = validateProductForm(form);
  assert.deepEqual(errors, {});
  assert.equal(payload!.price, 1_299_950);
  assert.equal(payload!.oldPrice, 1_500_000);
  assert.equal(payload!.material, null);
  assert.equal(payload!.slug, "pukhovyk");
});

test("валідація: обов'язкові поля, стара ціна, артикул", () => {
  const { errors, payload } = validateProductForm({
    ...emptyProductForm(),
    sku: "SKU З ПРОБІЛОМ",
    price: "100",
    oldPrice: "90",
    slug: "Не латиниця",
  });
  assert.equal(payload, null);
  assert.ok(errors.sku && errors.name && errors.brandId && errors.categoryId && errors.slug);
  assert.equal(errors.oldPrice, "Стара ціна має бути більшою за ціну");

  const bad = validateProductForm({
    ...formFromProduct(product),
    price: "12,345",
    sortWeight: "1.5",
  });
  assert.ok(bad.errors.price && bad.errors.sortWeight);
});

test("порожній slug не надсилається — сервер згенерує з назви", () => {
  const { payload } = validateProductForm({ ...formFromProduct(product), slug: "  " });
  assert.equal("slug" in payload!, false);
});

test("дублювання: новий артикул, чернетка, порожній slug", () => {
  const copy = duplicateForm(product);
  assert.equal(copy.sku, "SS13-001-COPY");
  assert.equal(copy.name, "Пуховик (копія)");
  assert.equal(copy.slug, "");
  assert.equal(copy.status, "DRAFT");
  assert.equal(copy.price, "12999,50");
});

test("знижка для підказки", () => {
  assert.equal(previewDiscount({ price: "700", oldPrice: "1000" }), 30);
  assert.equal(previewDiscount({ price: "700", oldPrice: "" }), null);
});
