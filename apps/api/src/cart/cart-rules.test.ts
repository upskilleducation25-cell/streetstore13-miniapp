import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { ProductStatus } from "../generated/prisma/client.js";
import {
  availableStock,
  calculateTotals,
  imageOf,
  isPurchasable,
  lineStatus,
  unitPriceOf,
  type VariantForSale,
} from "./cart-rules.js";

function variant(over: {
  stock?: number;
  isActive?: boolean;
  priceOverride?: number | null;
  status?: ProductStatus;
  deletedAt?: Date | null;
  brandActive?: boolean;
  categoryActive?: boolean;
  parentActive?: boolean | null;
}): VariantForSale {
  const parent =
    over.parentActive === undefined || over.parentActive === null
      ? null
      : { isActive: over.parentActive };
  return {
    id: "v1",
    colorId: "c-black",
    stock: over.stock ?? 5,
    isActive: over.isActive ?? true,
    priceOverride: over.priceOverride ?? null,
    product: {
      price: 1_000_000,
      status: over.status ?? ProductStatus.ACTIVE,
      deletedAt: over.deletedAt ?? null,
      brand: { isActive: over.brandActive ?? true },
      category: { isActive: over.categoryActive ?? true, parent },
      images: [
        { colorId: "c-white", urls: { thumb: "/white-thumb.webp" } },
        { colorId: "c-black", urls: { medium: "/black-medium.webp" } },
      ],
    },
  } as unknown as VariantForSale;
}

describe("правила кошика", () => {
  test("ціна: price_override варіанту має пріоритет над ціною товару", () => {
    assert.equal(unitPriceOf(variant({})), 1_000_000);
    assert.equal(unitPriceOf(variant({ priceOverride: 900_000 })), 900_000);
    assert.equal(unitPriceOf(variant({ priceOverride: 0 })), 0);
  });

  test("продається лише активний варіант видимого товару", () => {
    assert.equal(isPurchasable(variant({})), true);
    assert.equal(isPurchasable(variant({ isActive: false })), false);
    assert.equal(isPurchasable(variant({ status: ProductStatus.HIDDEN })), false);
    assert.equal(isPurchasable(variant({ status: ProductStatus.DRAFT })), false);
    assert.equal(isPurchasable(variant({ deletedAt: new Date() })), false);
    assert.equal(isPurchasable(variant({ brandActive: false })), false);
    assert.equal(isPurchasable(variant({ categoryActive: false })), false);
    assert.equal(isPurchasable(variant({ parentActive: false })), false);
    assert.equal(isPurchasable(variant({ parentActive: true })), true);
  });

  test("доступний залишок: 0 для недоступного варіанту", () => {
    assert.equal(availableStock(variant({ stock: 3 })), 3);
    assert.equal(availableStock(variant({ stock: 3, status: ProductStatus.ARCHIVED })), 0);
  });

  test("статус позиції", () => {
    assert.equal(lineStatus(2, 3), "OK");
    assert.equal(lineStatus(3, 3), "OK");
    assert.equal(lineStatus(4, 3), "INSUFFICIENT_STOCK");
    assert.equal(lineStatus(1, 0), "UNAVAILABLE");
  });

  test("фото позиції — свого кольору", () => {
    assert.equal(imageOf(variant({})), "/black-medium.webp");
  });

  test("суми в цілих копійках", () => {
    assert.deepEqual(
      calculateTotals([
        { unitPrice: 649_900, quantity: 2 },
        { unitPrice: 99_950, quantity: 3 },
      ]),
      { subtotal: 1_599_650, discountTotal: 0, deliveryCost: 0, total: 1_599_650 },
    );
    assert.equal(calculateTotals([]).total, 0);
    assert.equal(
      calculateTotals([{ unitPrice: 100, quantity: 1 }], { discountTotal: 500 }).total,
      0,
      "сума не від'ємна",
    );
    assert.throws(() => calculateTotals([{ unitPrice: 10.5, quantity: 1 }]));
    assert.throws(() => calculateTotals([{ unitPrice: 100, quantity: 0 }]));
  });
});
