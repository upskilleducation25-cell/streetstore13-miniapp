import assert from "node:assert/strict";
import { test } from "node:test";

import { OrderStatus } from "./enums.js";
import { discountPercent } from "./money.js";
import { canTransitionOrder } from "./order-status.js";

test("заборонені переходи статусів відхиляються", () => {
  assert.equal(canTransitionOrder(OrderStatus.NEW, OrderStatus.CONFIRMED), true);
  assert.equal(canTransitionOrder(OrderStatus.NEW, OrderStatus.SHIPPED), false);
  assert.equal(canTransitionOrder(OrderStatus.COMPLETED, OrderStatus.CANCELLED), false);
  assert.equal(canTransitionOrder(OrderStatus.SHIPPED, OrderStatus.CANCELLED), true);
});

test("відсоток знижки", () => {
  assert.equal(discountPercent(1299900, 1499900), 13);
  assert.equal(discountPercent(100, null), null);
  assert.equal(discountPercent(100, 100), null);
});
