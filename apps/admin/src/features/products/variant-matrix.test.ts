import assert from "node:assert/strict";
import { test } from "node:test";

import type { AdminVariant } from "@ss13/shared";

import {
  addColor,
  addSize,
  cellKey,
  emptyMatrix,
  getCell,
  matrixForDuplicate,
  matrixFromVariants,
  matrixIsDirty,
  removeColor,
  stockChanged,
  toVariantPayload,
  updateCell,
} from "./variant-matrix";

const order = { colorIds: ["black", "white", "red"], sizeIds: ["S", "M", "L"] };
const variants: AdminVariant[] = [
  {
    id: "v1",
    colorId: "white",
    sizeId: "M",
    sku: null,
    stock: 2,
    priceOverride: null,
    isActive: true,
    hasHistory: true,
  },
  {
    id: "v2",
    colorId: "black",
    sizeId: "M",
    sku: "B-M",
    stock: 0,
    priceOverride: 150_000,
    isActive: false,
    hasHistory: false,
  },
];

test("матриця з варіантів: осі в порядку довідників, стани клітинок", () => {
  const state = matrixFromVariants(variants, order);
  assert.deepEqual(state.colorIds, ["black", "white"]);
  assert.deepEqual(state.sizeIds, ["M"]);
  assert.equal(getCell(state, "black", "M").mode, "inactive");
  assert.equal(getCell(state, "black", "M").priceOverride, "1500");
  assert.equal(getCell(state, "red", "M").mode, "absent");
});

test("додати колір і розмір: нові перетини — активні варіанти із залишком 0", () => {
  let state = addColor(emptyMatrix(), "white", order.colorIds);
  state = addSize(state, "L", order.sizeIds);
  state = addSize(state, "S", order.sizeIds);
  state = addColor(state, "black", order.colorIds);
  assert.deepEqual(state.colorIds, ["black", "white"]);
  assert.deepEqual(state.sizeIds, ["S", "L"]);
  const { variants: payload, errors } = toVariantPayload(state);
  assert.deepEqual(errors, {});
  assert.equal(payload.length, 4);
  assert.ok(payload.every((v) => v.stock === 0 && v.isActive && v.expectedStock === undefined));
  assert.equal(stockChanged(state), false);
});

test("зміна залишку: expectedStock = значення з сервера, потрібна причина", () => {
  const initial = matrixFromVariants(variants, order);
  const state = updateCell(initial, "white", "M", { stock: "5" });
  assert.equal(stockChanged(state), true);
  assert.equal(matrixIsDirty(state, initial), true);
  const white = toVariantPayload(state).variants.find((v) => v.colorId === "white")!;
  assert.equal(white.stock, 5);
  assert.equal(white.expectedStock, 2);
});

test("некоректний залишок і ціна — помилка в клітинці", () => {
  let state = matrixFromVariants(variants, order);
  state = updateCell(state, "white", "M", { stock: "-1" });
  state = updateCell(state, "black", "M", { priceOverride: "abc" });
  const { errors } = toVariantPayload(state);
  assert.ok(errors[cellKey("white", "M")]);
  assert.ok(errors[cellKey("black", "M")]);
});

test("прибраний колір не йде в запит; повернутий — знову активний", () => {
  const initial = matrixFromVariants(variants, order);
  const removed = removeColor(initial, "white");
  assert.deepEqual(
    toVariantPayload(removed).variants.map((v) => v.colorId),
    ["black"],
  );
  const back = addColor(removed, "white", order.colorIds);
  assert.equal(getCell(back, "white", "M").mode, "active");
  assert.equal(getCell(back, "white", "M").originalStock, 2);
});

test("дублювання: ті самі пари, залишки 0, без expectedStock", () => {
  const copy = matrixForDuplicate(matrixFromVariants(variants, order));
  const payload = toVariantPayload(copy).variants;
  assert.equal(payload.length, 2);
  assert.ok(payload.every((v) => v.stock === 0 && v.expectedStock === undefined && v.sku === null));
});
