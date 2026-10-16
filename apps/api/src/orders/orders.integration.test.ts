import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, describe, test } from "node:test";

import type {
  ApiErrorBody,
  CartView,
  CheckoutOptions,
  CheckoutProblem,
  CreateOrderRequest,
  CreateOrderResponse,
  OrderDetail,
  OrderSummary,
  Paginated,
} from "@ss13/shared";

import { cleanupTestData, createTestProduct, type TestProduct } from "../testing/fixtures.js";
import {
  type Buyer,
  createTestApp,
  hasDatabase,
  TEST_ADMIN_CHAT_ID,
  TEST_BOT_TOKEN,
  type TestApp,
} from "../testing/test-app.js";

const SKU = "TEST-ORD-";
const ALICE = 990_000_300_001;
const BOB = 990_000_300_002;
const CAROL = 990_000_300_003;

const checkout: CreateOrderRequest = {
  customerName: "  Аліса   Тестова ",
  customerPhone: "067 123 45 67",
  city: "Київ",
  deliveryServiceCode: "nova_poshta",
  deliveryPoint: "Відділення №1",
  comment: "Подзвоніть перед відправкою",
};

const key = () => `test-${randomUUID()}`;

describe("Оформлення і замовлення (інтеграційні)", { skip: !hasDatabase }, () => {
  let t: TestApp;
  let alice: Buyer;
  let bob: Buyer;
  let carol: Buyer;
  let product: TestProduct;

  const buyers = () => [alice, bob, carol];

  before(async () => {
    t = await createTestApp();
    await cleanupTestData(t.prisma, { skuPrefix: SKU, telegramIds: [ALICE, BOB, CAROL] });
    alice = await t.loginBuyer(ALICE, "Аліса");
    bob = await t.loginBuyer(BOB, "Борис");
    carol = await t.loginBuyer(CAROL, "Карина");
  });

  beforeEach(async () => {
    await t.notifications.whenIdle();
    await cleanupTestData(t.prisma, { skuPrefix: SKU, telegramIds: [] });
    const userIds = buyers().map((buyer) => buyer.userId);
    await t.prisma.notificationLog.deleteMany({ where: { order: { userId: { in: userIds } } } });
    await t.prisma.inventoryMovement.deleteMany({ where: { order: { userId: { in: userIds } } } });
    await t.prisma.order.deleteMany({ where: { userId: { in: userIds } } });
    await t.prisma.cartItem.deleteMany({ where: { userId: { in: userIds } } });
    await t.prisma.user.updateMany({
      where: { id: { in: userIds } },
      data: { isBotBlocked: false },
    });
    t.telegram.messages.length = 0;
    t.telegram.failFor.clear();
    product = await createTestProduct(t.prisma, {
      sku: `${SKU}1`,
      price: 1_000_000,
      variants: [
        { color: "black", size: "M", stock: 3 },
        { color: "black", size: "L", stock: 1 },
        { color: "white", size: "M", stock: 5, priceOverride: 1_200_000 },
      ],
    });
  });

  after(async () => {
    await t?.notifications.whenIdle();
    await cleanupTestData(t.prisma, { skuPrefix: SKU, telegramIds: [ALICE, BOB, CAROL] });
    await t?.close();
  });

  const addToCart = async (buyer: Buyer, variantKey: string, quantity: number) => {
    const response = await buyer.request<CartView>("/api/v1/cart/items", {
      method: "POST",
      body: { variantId: product.variant(variantKey), quantity },
    });
    assert.equal(response.status, 200);
    return response.body;
  };

  const placeOrder = (buyer: Buyer, body: Partial<CreateOrderRequest> = {}, idemKey = key()) =>
    buyer.request<CreateOrderResponse & ApiErrorBody>("/api/v1/orders", {
      method: "POST",
      body: { ...checkout, ...body },
      headers: { "Idempotency-Key": idemKey },
    });

  const stockOf = async (variantKey: string) =>
    (
      await t.prisma.productVariant.findUniqueOrThrow({
        where: { id: product.variant(variantKey) },
      })
    ).stock;

  test("GET /checkout/options: служби доставки, оплата, автозаповнення з Telegram", async () => {
    const { status, body } = await alice.request<CheckoutOptions>("/api/v1/checkout/options");
    assert.equal(status, 200);
    assert.deepEqual(
      body.deliveryServices.map((service) => service.code),
      ["nova_poshta", "ukrposhta", "meest"],
    );
    assert.ok(body.paymentMethods.some((method) => method.code === "manual"));
    assert.equal(body.prefill.customerName, "Аліса");
    assert.equal(body.prefill.city, null);
  });

  test("оформлення: ціни з бази, знімок, списання складу, журнал, історія, кошик очищено", async () => {
    await addToCart(alice, "black/M", 2);
    await addToCart(alice, "white/M", 1);

    const { status, body } = await placeOrder(alice, { expectedTotal: 3_200_000 });
    assert.equal(status, 201);
    assert.equal(body.created, true);
    const order = body.order;
    assert.match(order.number, /^SS13-\d+$/);
    assert.equal(order.status, "NEW");
    assert.equal(order.customerName, "Аліса Тестова");
    assert.equal(order.customerPhone, "+380671234567");
    assert.equal(order.deliveryService.name, "Нова Пошта");
    assert.equal(order.paymentMethod?.code, "manual");
    assert.equal(order.subtotal, 3_200_000);
    assert.equal(order.deliveryCost, 0);
    assert.equal(order.total, 3_200_000);
    assert.deepEqual(
      order.items.map((item) => [item.colorName, item.sizeLabel, item.unitPrice, item.quantity]),
      [
        ["Чорний", "M", 1_000_000, 2],
        ["Білий", "M", 1_200_000, 1],
      ],
    );
    assert.deepEqual(
      order.history.map((entry) => entry.status),
      ["NEW"],
    );
    assert.equal(order.canCancel, true);

    assert.equal(await stockOf("black/M"), 1);
    assert.equal(await stockOf("white/M"), 4);
    const movements = await t.prisma.inventoryMovement.findMany({
      where: { order: { number: order.number } },
    });
    assert.deepEqual(movements.map((m) => [m.reason, m.delta]).sort(), [
      ["ORDER", -1],
      ["ORDER", -2],
    ]);
    const product1 = await t.prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    assert.equal(product1.totalStock, 1 + 1 + 4, "тригер оновив total_stock");

    const cart = await alice.request<CartView>("/api/v1/cart");
    assert.equal(cart.body.items.length, 0);
    const user = await t.prisma.user.findUniqueOrThrow({ where: { id: alice.userId } });
    assert.equal(user.phone, "+380671234567");

    // Знімок не залежить від подальших змін товару.
    await t.prisma.product.update({
      where: { id: product.id },
      data: { name: "Перейменовано", price: 1 },
    });
    const detail = await alice.request<OrderDetail>(`/api/v1/orders/${order.number}`);
    assert.equal(detail.status, 200);
    assert.equal(detail.body.items[0]!.name, `Тестовий пуховик ${SKU}1`);
    assert.equal(detail.body.items[0]!.unitPrice, 1_000_000);
  });

  test("сервер ігнорує ціни клієнта: змінена ціна → 409 PRICE_CHANGED, нічого не списано", async () => {
    await addToCart(alice, "black/M", 1);
    await t.prisma.product.update({ where: { id: product.id }, data: { price: 1_100_000 } });

    const stale = await placeOrder(alice, { expectedTotal: 1_000_000 });
    assert.equal(stale.status, 409);
    assert.equal(stale.body.code, "PRICE_CHANGED");
    assert.deepEqual(stale.body.details, { expectedTotal: 1_000_000, total: 1_100_000 });
    assert.equal(await stockOf("black/M"), 3);
    assert.equal(await t.prisma.order.count({ where: { userId: alice.userId } }), 0);

    // Поля ціни в тілі запиту не приймаються взагалі (whitelist).
    const fresh = await placeOrder(alice, {
      expectedTotal: 1_100_000,
      ...({ total: 1, unitPrice: 1 } as object),
    });
    assert.equal(fresh.status, 201);
    assert.equal(fresh.body.order.total, 1_100_000);
  });

  test("нестача товару: 409 з переліком позицій, замовлення не створено, склад не змінено", async () => {
    await addToCart(alice, "black/M", 3);
    await addToCart(alice, "white/M", 2);
    // Поки товар лежав у кошику, частину продали і вимкнули варіант.
    await t.prisma.productVariant.update({
      where: { id: product.variant("black/M") },
      data: { stock: 1 },
    });

    const { status, body } = await placeOrder(alice);
    assert.equal(status, 409);
    assert.equal(body.code, "CART_ITEMS_UNAVAILABLE");
    const problems = (body.details as { problems: CheckoutProblem[] }).problems;
    assert.equal(problems.length, 1);
    assert.equal(problems[0]!.requested, 3);
    assert.equal(problems[0]!.available, 1);
    assert.equal(problems[0]!.sizeLabel, "M");

    assert.equal(await stockOf("black/M"), 1);
    assert.equal(await stockOf("white/M"), 5, "інші позиції теж не списані (rollback)");
    assert.equal(await t.prisma.order.count({ where: { userId: alice.userId } }), 0);
    const cart = await alice.request<CartView>("/api/v1/cart");
    assert.equal(cart.body.items.length, 2, "кошик лишається, щоб покупець його виправив");
  });

  test("порожній кошик, некоректні дані, ключ ідемпотентності", async () => {
    const empty = await placeOrder(alice);
    assert.equal(empty.status, 409);
    assert.equal(empty.body.code, "CART_EMPTY");

    await addToCart(alice, "black/M", 1);
    const badPhone = await placeOrder(alice, { customerPhone: "12345" });
    assert.equal(badPhone.status, 400);
    assert.equal(badPhone.body.code, "VALIDATION_ERROR");
    const badDelivery = await placeOrder(alice, { deliveryServiceCode: "dhl" });
    assert.equal(badDelivery.status, 400);

    const noKey = await alice.request<ApiErrorBody>("/api/v1/orders", {
      method: "POST",
      body: checkout,
    });
    assert.equal(noKey.status, 400);
    assert.equal(noKey.body.code, "IDEMPOTENCY_KEY_REQUIRED");
    assert.equal(await stockOf("black/M"), 3);
  });

  test("повтор з тим самим Idempotency-Key повертає те саме замовлення, склад списано один раз", async () => {
    await addToCart(alice, "black/M", 2);
    const idemKey = key();

    const [first, second] = await Promise.all([
      placeOrder(alice, {}, idemKey),
      placeOrder(alice, {}, idemKey),
    ]);
    const statuses = [first.status, second.status].sort();
    assert.deepEqual(statuses, [200, 201]);
    assert.equal(first.body.order.number, second.body.order.number);
    const third = await placeOrder(alice, {}, idemKey);
    assert.equal(third.status, 200);
    assert.equal(third.body.created, false);
    assert.equal(third.body.order.number, first.body.order.number);

    assert.equal(await t.prisma.order.count({ where: { userId: alice.userId } }), 1);
    assert.equal(await stockOf("black/M"), 1);

    // Чужий ключ не розкриває чуже замовлення.
    await addToCart(bob, "white/M", 1);
    const foreign = await placeOrder(bob, {}, idemKey);
    assert.equal(foreign.status, 409);
    assert.equal(foreign.body.code, "IDEMPOTENCY_KEY_CONFLICT");
    assert.equal(foreign.body.order, undefined);
  });

  test("конкурентна покупка останньої одиниці: продано рівно одну", async () => {
    // black/L має залишок 1. Троє покупців одночасно оформлюють замовлення.
    for (const buyer of buyers()) await addToCart(buyer, "black/L", 1);

    const results = await Promise.all(buyers().map((buyer) => placeOrder(buyer)));
    const created = results.filter((result) => result.status === 201);
    const rejected = results.filter((result) => result.status === 409);
    assert.equal(created.length, 1, JSON.stringify(results.map((r) => r.status)));
    assert.equal(rejected.length, 2);
    for (const result of rejected) assert.equal(result.body.code, "CART_ITEMS_UNAVAILABLE");

    assert.equal(await stockOf("black/L"), 0);
    const sold = await t.prisma.inventoryMovement.aggregate({
      where: { variantId: product.variant("black/L"), reason: "ORDER" },
      _sum: { delta: true },
    });
    assert.equal(sold._sum.delta, -1);
  });

  test("конкурентні замовлення різних кількостей не продають більше, ніж є", async () => {
    // white/M має залишок 5: 3 + 3 одночасно — пройде тільки одне.
    await addToCart(alice, "white/M", 3);
    await addToCart(bob, "white/M", 3);
    await addToCart(carol, "white/M", 2);
    const results = await Promise.all(buyers().map((buyer) => placeOrder(buyer)));
    const soldUnits = await t.prisma.orderItem.aggregate({
      where: { variantId: product.variant("white/M") },
      _sum: { quantity: true },
    });
    assert.ok((soldUnits._sum.quantity ?? 0) <= 5);
    assert.equal(await stockOf("white/M"), 5 - (soldUnits._sum.quantity ?? 0));
    assert.ok(results.some((result) => result.status === 201));
  });

  test("скасування покупцем повертає залишок; повторне скасування — 409", async () => {
    await addToCart(alice, "black/M", 2);
    const { body } = await placeOrder(alice);
    const number = body.order.number;
    assert.equal(await stockOf("black/M"), 1);

    const cancel = await alice.request<OrderDetail>(`/api/v1/orders/${number}/cancel`, {
      method: "POST",
    });
    assert.equal(cancel.status, 200);
    assert.equal(cancel.body.status, "CANCELLED");
    assert.equal(cancel.body.canCancel, false);
    assert.deepEqual(
      cancel.body.history.map((entry) => entry.status),
      ["NEW", "CANCELLED"],
    );
    assert.equal(await stockOf("black/M"), 3);
    const movements = await t.prisma.inventoryMovement.findMany({
      where: { order: { number } },
      orderBy: { createdAt: "asc" },
    });
    assert.deepEqual(
      movements.map((m) => [m.reason, m.delta]),
      [
        ["ORDER", -2],
        ["CANCEL", 2],
      ],
    );

    const again = await alice.request<ApiErrorBody>(`/api/v1/orders/${number}/cancel`, {
      method: "POST",
    });
    assert.equal(again.status, 409);
    assert.equal(again.body.code, "ORDER_CANNOT_BE_CANCELLED");
    assert.equal(await stockOf("black/M"), 3);
  });

  test("підтверджене менеджером замовлення покупець не скасовує", async () => {
    await addToCart(alice, "black/M", 1);
    const { body } = await placeOrder(alice);
    await t.prisma.order.update({
      where: { number: body.order.number },
      data: { status: "CONFIRMED" },
    });
    const cancel = await alice.request<ApiErrorBody>(`/api/v1/orders/${body.order.number}/cancel`, {
      method: "POST",
    });
    assert.equal(cancel.status, 409);
    assert.equal(await stockOf("black/M"), 2);
  });

  test("доступ: покупець бачить тільки свої замовлення", async () => {
    await addToCart(alice, "black/M", 1);
    const { body } = await placeOrder(alice);
    const number = body.order.number;

    const own = await alice.request<Paginated<OrderSummary>>("/api/v1/orders");
    assert.equal(own.status, 200);
    assert.deepEqual(
      own.body.items.map((order) => order.number),
      [number],
    );
    assert.equal(own.body.items[0]!.itemsCount, 1);
    assert.equal(own.body.items[0]!.total, 1_000_000);

    const foreignList = await bob.request<Paginated<OrderSummary>>("/api/v1/orders");
    assert.equal(foreignList.body.items.length, 0);
    const foreignDetail = await bob.request<ApiErrorBody>(`/api/v1/orders/${number}`);
    assert.equal(foreignDetail.status, 404);
    assert.equal(foreignDetail.body.code, "ORDER_NOT_FOUND");
    const foreignCancel = await bob.request<ApiErrorBody>(`/api/v1/orders/${number}/cancel`, {
      method: "POST",
    });
    assert.equal(foreignCancel.status, 404);
    assert.equal(await stockOf("black/M"), 2, "чуже скасування нічого не повернуло");

    for (const path of ["/api/v1/orders", `/api/v1/orders/${number}`, "/api/v1/checkout/options"]) {
      const anonymous = await fetch(t.url(path));
      assert.equal(anonymous.status, 401, path);
    }
  });

  test("сповіщення: покупцю і власнику після commit, журнал SENT, токен не в тексті", async () => {
    await addToCart(alice, "black/M", 1);
    const { body } = await placeOrder(alice);
    await t.notifications.whenIdle();

    const toBuyer = t.telegram.messages.find((m) => m.body.chat_id === String(ALICE));
    const toAdmin = t.telegram.messages.find((m) => m.body.chat_id === TEST_ADMIN_CHAT_ID);
    assert.ok(toBuyer, "повідомлення покупцю");
    assert.ok(toAdmin, "повідомлення власнику");
    assert.equal(toBuyer.method, "sendMessage");
    assert.match(toBuyer.body.text, new RegExp(`№ ${body.order.number} прийнято`));
    assert.match(toAdmin.body.text, /Нове замовлення/);
    assert.match(toAdmin.body.text, /\+380 67 123 45 67/);
    for (const message of t.telegram.messages) {
      assert.ok(!message.body.text.includes(TEST_BOT_TOKEN));
    }

    const log = await t.prisma.notificationLog.findMany({
      where: { order: { number: body.order.number } },
    });
    assert.deepEqual(log.map((row) => [row.type, row.status]).sort(), [
      ["ORDER_CREATED_ADMIN", "SENT"],
      ["ORDER_CREATED_BUYER", "SENT"],
    ]);
  });

  test("збій бота не скасовує замовлення: 403 → FAILED і позначка is_bot_blocked", async () => {
    t.telegram.failFor.set(String(ALICE), {
      status: 403,
      description: "Forbidden: bot was blocked by the user",
    });
    await addToCart(alice, "black/M", 1);
    const { status, body } = await placeOrder(alice);
    assert.equal(status, 201);
    await t.notifications.whenIdle();

    const log = await t.prisma.notificationLog.findFirstOrThrow({
      where: { order: { number: body.order.number }, type: "ORDER_CREATED_BUYER" },
    });
    assert.equal(log.status, "FAILED");
    assert.match(log.error ?? "", /FORBIDDEN/);
    assert.ok(!(log.error ?? "").includes(TEST_BOT_TOKEN));
    const user = await t.prisma.user.findUniqueOrThrow({ where: { id: alice.userId } });
    assert.equal(user.isBotBlocked, true);
    assert.ok(t.telegram.messages.some((m) => m.body.chat_id === TEST_ADMIN_CHAT_ID));
  });

  test("Swagger описує ендпоїнти кошика й замовлень", async () => {
    const { body } = await t.getJson<{ paths: Record<string, unknown> }>("/docs/json");
    for (const path of [
      "/api/v1/cart",
      "/api/v1/cart/items",
      "/api/v1/cart/items/{id}",
      "/api/v1/checkout/options",
      "/api/v1/orders",
      "/api/v1/orders/{number}",
      "/api/v1/orders/{number}/cancel",
    ]) {
      assert.ok(body.paths[path], `немає ${path} у Swagger`);
    }
  });
});
