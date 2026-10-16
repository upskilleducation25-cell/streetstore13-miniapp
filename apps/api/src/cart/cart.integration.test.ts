import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";

import type { ApiErrorBody, CartView } from "@ss13/shared";

import { ProductStatus } from "../generated/prisma/client.js";
import { cleanupTestData, createTestProduct, type TestProduct } from "../testing/fixtures.js";
import { type Buyer, createTestApp, hasDatabase, type TestApp } from "../testing/test-app.js";

const SKU = "TEST-CART-";
const ALICE = 990_000_200_001;
const BOB = 990_000_200_002;

describe("Кошик (інтеграційні)", { skip: !hasDatabase }, () => {
  let t: TestApp;
  let alice: Buyer;
  let bob: Buyer;
  let product: TestProduct;

  before(async () => {
    t = await createTestApp();
    await cleanupTestData(t.prisma, { skuPrefix: SKU, telegramIds: [ALICE, BOB] });
    alice = await t.loginBuyer(ALICE, "Аліса");
    bob = await t.loginBuyer(BOB, "Борис");
  });

  beforeEach(async () => {
    await t.prisma.cartItem.deleteMany({ where: { userId: { in: [alice.userId, bob.userId] } } });
    await t.prisma.product.deleteMany({ where: { sku: { startsWith: SKU } } });
    product = await createTestProduct(t.prisma, {
      sku: `${SKU}1`,
      price: 1_000_000,
      variants: [
        { color: "black", size: "M", stock: 3 },
        { color: "black", size: "L", stock: 0 },
        { color: "white", size: "M", stock: 5, priceOverride: 1_200_000 },
      ],
    });
  });

  after(async () => {
    await cleanupTestData(t.prisma, { skuPrefix: SKU, telegramIds: [ALICE, BOB] });
    await t?.close();
  });

  const add = (buyer: Buyer, variantId: string, quantity: number) =>
    buyer.request<CartView & ApiErrorBody>("/api/v1/cart/items", {
      method: "POST",
      body: { variantId, quantity },
    });

  test("без входу кошик недоступний", async () => {
    const response = await fetch(t.url("/api/v1/cart"));
    assert.equal(response.status, 401);
  });

  test("додавання: ціна з бази, сума, лічильник; повторне додавання складається", async () => {
    let { status, body } = await add(alice, product.variant("black/M"), 1);
    assert.equal(status, 200);
    assert.equal(body.items.length, 1);
    assert.equal(body.items[0]!.unitPrice, 1_000_000);
    assert.equal(body.items[0]!.status, "OK");

    ({ status, body } = await add(alice, product.variant("black/M"), 2));
    assert.equal(status, 200);
    assert.equal(body.items[0]!.quantity, 3);
    assert.equal(body.items[0]!.lineTotal, 3_000_000);

    ({ body } = await add(alice, product.variant("white/M"), 1));
    assert.equal(body.count, 4);
    // Ціна варіанту (price_override) має пріоритет над ціною товару.
    assert.equal(body.items[1]!.unitPrice, 1_200_000);
    assert.equal(body.subtotal, 4_200_000);
    assert.equal(body.total, 4_200_000);
    assert.equal(body.canCheckout, true);
  });

  test("більше, ніж є на складі → 409 INSUFFICIENT_STOCK; нульовий залишок → OUT_OF_STOCK", async () => {
    await add(alice, product.variant("black/M"), 2);
    const over = await add(alice, product.variant("black/M"), 2);
    assert.equal(over.status, 409);
    assert.equal(over.body.code, "INSUFFICIENT_STOCK");
    assert.deepEqual(over.body.details, { available: 3, inCart: 2 });

    const empty = await add(alice, product.variant("black/L"), 1);
    assert.equal(empty.status, 409);
    assert.equal(empty.body.code, "OUT_OF_STOCK");
  });

  test("прихований товар, неіснуючий варіант, некоректні дані", async () => {
    await t.prisma.product.update({
      where: { id: product.id },
      data: { status: ProductStatus.HIDDEN },
    });
    const hidden = await add(alice, product.variant("black/M"), 1);
    assert.equal(hidden.status, 404);
    assert.equal(hidden.body.code, "VARIANT_NOT_FOUND");

    const missing = await add(alice, "00000000-0000-4000-8000-000000000000", 1);
    assert.equal(missing.status, 404);

    for (const body of [
      { variantId: "не-uuid", quantity: 1 },
      { variantId: product.variant("black/M"), quantity: 0 },
      { variantId: product.variant("black/M"), quantity: 1.5 },
      { variantId: product.variant("black/M"), quantity: 21 },
    ]) {
      const response = await alice.request<ApiErrorBody>("/api/v1/cart/items", {
        method: "POST",
        body,
      });
      assert.equal(response.status, 400, JSON.stringify(body));
      assert.equal(response.body.code, "VALIDATION_ERROR");
    }
  });

  test("зміна кількості і видалення позиції", async () => {
    const { body: cart } = await add(alice, product.variant("white/M"), 1);
    const itemId = cart.items[0]!.id;

    let response = await alice.request<CartView & ApiErrorBody>(`/api/v1/cart/items/${itemId}`, {
      method: "PATCH",
      body: { quantity: 4 },
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.items[0]!.quantity, 4);

    response = await alice.request(`/api/v1/cart/items/${itemId}`, {
      method: "PATCH",
      body: { quantity: 6 },
    });
    assert.equal(response.status, 409);
    assert.equal(response.body.code, "INSUFFICIENT_STOCK");

    response = await alice.request(`/api/v1/cart/items/${itemId}`, { method: "DELETE" });
    assert.equal(response.status, 200);
    assert.equal(response.body.items.length, 0);
    assert.equal(response.body.canCheckout, false);

    response = await alice.request(`/api/v1/cart/items/${itemId}`, { method: "DELETE" });
    assert.equal(response.status, 404);
  });

  test("чужу позицію кошика не можна змінити чи видалити", async () => {
    const { body: cart } = await add(alice, product.variant("black/M"), 1);
    const itemId = cart.items[0]!.id;

    const patch = await bob.request<ApiErrorBody>(`/api/v1/cart/items/${itemId}`, {
      method: "PATCH",
      body: { quantity: 2 },
    });
    assert.equal(patch.status, 404);
    const remove = await bob.request<ApiErrorBody>(`/api/v1/cart/items/${itemId}`, {
      method: "DELETE",
    });
    assert.equal(remove.status, 404);

    const bobCart = await bob.request<CartView>("/api/v1/cart");
    assert.equal(bobCart.body.items.length, 0);
    const aliceCart = await alice.request<CartView>("/api/v1/cart");
    assert.equal(aliceCart.body.items[0]!.quantity, 1);
  });

  test("GET /cart показує актуальну ціну і нестачу, що виникла після додавання", async () => {
    await add(alice, product.variant("black/M"), 3);
    await add(alice, product.variant("white/M"), 1);

    await t.prisma.product.update({ where: { id: product.id }, data: { price: 900_000 } });
    await t.prisma.productVariant.update({
      where: { id: product.variant("black/M") },
      data: { stock: 1 },
    });
    await t.prisma.productVariant.update({
      where: { id: product.variant("white/M") },
      data: { isActive: false },
    });

    const { body } = await alice.request<CartView>("/api/v1/cart");
    const [black, white] = body.items;
    assert.equal(black!.unitPrice, 900_000);
    assert.equal(black!.status, "INSUFFICIENT_STOCK");
    assert.equal(black!.stock, 1);
    assert.equal(white!.status, "UNAVAILABLE");
    assert.equal(white!.stock, 0);
    assert.equal(body.canCheckout, false);
    assert.equal(body.subtotal, 0, "сума рахує тільки доступні позиції");
  });
});
