import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { after, before, beforeEach, describe, test } from "node:test";

import type {
  AdminBrand,
  AdminCatalogDictionaries,
  AdminCategory,
  AdminColor,
  AdminInventoryMovement,
  AdminProductCreateInput,
  AdminProductDetail,
  AdminProductImage,
  AdminProductListResponse,
  AdminSize,
  ApiErrorBody,
  ProductDetail,
} from "@ss13/shared";
import sharp from "sharp";

import {
  cleanupTestAdmins,
  cleanupTestData,
  createTestAdmin,
  TEST_ADMIN_DOMAIN,
  TEST_ADMIN_PASSWORD,
} from "../testing/fixtures.js";
import { type AdminClient, createTestApp, hasDatabase, type TestApp } from "../testing/test-app.js";

const SKU = "TEST-ADM-";
const SLUG = "test-adm-";
const BUYER_TG = 990_000_500_001;
const MANAGER = `catalog-manager${TEST_ADMIN_DOMAIN}`;

async function cleanupCatalog(t: TestApp): Promise<void> {
  await cleanupTestData(t.prisma, { skuPrefix: SKU, telegramIds: [BUYER_TG] });
  await t.prisma.category.deleteMany({
    where: { slug: { startsWith: SLUG }, parentId: { not: null } },
  });
  await t.prisma.category.deleteMany({ where: { slug: { startsWith: SLUG } } });
  await t.prisma.brand.deleteMany({ where: { slug: { startsWith: SLUG } } });
  await t.prisma.color.deleteMany({ where: { slug: { startsWith: SLUG } } });
  await t.prisma.size.deleteMany({ where: { label: { startsWith: "TADM" } } });
}

const png = (width = 800, height = 1000) =>
  sharp({ create: { width, height, channels: 3, background: "#1f2937" } })
    .png()
    .toBuffer();

describe("Адмінка: каталог, склад і фото (інтеграційні)", { skip: !hasDatabase }, () => {
  let t: TestApp;
  let admin: AdminClient;
  let dict: AdminCatalogDictionaries;
  let ids: {
    brand: string;
    category: string;
    black: string;
    white: string;
    m: string;
    l: string;
    xl: string;
  };

  const base = (overrides: Partial<AdminProductCreateInput> = {}): AdminProductCreateInput => ({
    sku: `${SKU}${randomUUID().slice(0, 8)}`,
    name: "Тестовий пуховик Адмін",
    brandId: ids.brand,
    categoryId: ids.category,
    description: "Опис",
    material: null,
    price: 1_000_000,
    oldPrice: null,
    status: "DRAFT",
    isNew: false,
    isPopular: false,
    isSale: false,
    ...overrides,
  });

  const createProduct = async (overrides: Partial<AdminProductCreateInput> = {}) => {
    const response = await admin.request<AdminProductDetail>("/api/v1/admin/products", {
      method: "POST",
      body: base(overrides),
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    return response.body;
  };

  const variant = (colorId: string, sizeId: string, stock: number, extra: object = {}) => ({
    colorId,
    sizeId,
    sku: null,
    priceOverride: null,
    isActive: true,
    stock,
    ...extra,
  });

  before(async () => {
    t = await createTestApp();
    await cleanupCatalog(t);
    await cleanupTestAdmins(t.prisma);
    await createTestAdmin(t.prisma, { email: MANAGER, role: "MANAGER" });
    admin = await t.loginAdmin(MANAGER, TEST_ADMIN_PASSWORD);
    dict = (await admin.request<AdminCatalogDictionaries>("/api/v1/admin/dictionaries")).body;
    const find = <T extends { id: string }>(list: T[], pred: (item: T) => boolean) =>
      list.find(pred)!.id;
    ids = {
      brand: find(dict.brands, (b) => b.slug === "moncler"),
      category: find(dict.categories, (c) => c.slug === "puhovyky"),
      black: find(dict.colors, (c) => c.slug === "black"),
      white: find(dict.colors, (c) => c.slug === "white"),
      m: find(dict.sizes, (s) => s.sizeSystem === "CLOTHING" && s.label === "M"),
      l: find(dict.sizes, (s) => s.sizeSystem === "CLOTHING" && s.label === "L"),
      xl: find(dict.sizes, (s) => s.sizeSystem === "CLOTHING" && s.label === "XL"),
    };
  });

  beforeEach(async () => {
    await cleanupCatalog(t);
  });

  after(async () => {
    await cleanupCatalog(t);
    await cleanupTestAdmins(t.prisma);
    await t.close();
  });

  test("без входу адмін-каталог недоступний", async () => {
    for (const path of [
      "/api/v1/admin/products",
      "/api/v1/admin/categories",
      "/api/v1/admin/dictionaries",
    ]) {
      assert.equal((await fetch(t.url(path))).status, 401, path);
    }
  });

  test("менеджер створює товар з варіантами: рух складу з причиною й адміном, slug з назви", async () => {
    const product = await createProduct({
      status: "ACTIVE",
      oldPrice: 1_250_000,
      isSale: true,
      variants: [
        variant(ids.black, ids.m, 3),
        variant(ids.black, ids.l, 0),
        variant(ids.white, ids.m, 2),
      ],
      stockNote: "Надходження",
    });
    assert.equal(product.slug, "testovyi-pukhovyk-admin");
    assert.equal(product.discountPercent, 20);
    assert.equal(product.totalStock, 5);
    assert.equal(product.variants.length, 3);

    const movements = await admin.request<AdminInventoryMovement[]>(
      `/api/v1/admin/products/${product.id}/movements`,
    );
    assert.equal(movements.body.length, 2);
    assert.ok(movements.body.every((m) => m.reason === "MANUAL" && m.note === "Надходження"));
    assert.ok(movements.body.every((m) => m.adminName === "Тестовий менеджер"));
    assert.deepEqual(movements.body.map((m) => m.delta).sort(), [2, 3]);

    // Видно на вітрині через наявний публічний API.
    const pub = await t.getJson<ProductDetail>(`/api/v1/products/${product.id}`);
    assert.equal(pub.status, 200);
    assert.equal(pub.body.oldPrice, 1_250_000);
    assert.equal(pub.body.variants.length, 3);

    // Другий товар з такою ж назвою отримує slug із суфіксом.
    const second = await createProduct();
    assert.equal(second.slug, "testovyi-pukhovyk-admin-2");
  });

  test("валідація товару: стара ціна, артикул, активний без варіантів, невідомий бренд", async () => {
    const badOld = await admin.request<ApiErrorBody>("/api/v1/admin/products", {
      method: "POST",
      body: base({ oldPrice: 1_000_000 }),
    });
    assert.equal(badOld.status, 400);
    assert.deepEqual(badOld.body.details, [
      { field: "oldPrice", errors: ["Стара ціна має бути більшою за ціну"] },
    ]);

    const noVariants = await admin.request<ApiErrorBody>("/api/v1/admin/products", {
      method: "POST",
      body: base({ status: "ACTIVE" }),
    });
    assert.equal(noVariants.status, 409);
    assert.equal(noVariants.body.code, "PRODUCT_NOT_READY");

    const first = await createProduct();
    const dupSku = await admin.request<ApiErrorBody>("/api/v1/admin/products", {
      method: "POST",
      body: base({ sku: first.sku.toLowerCase() }),
    });
    assert.equal(dupSku.status, 409);
    assert.equal(dupSku.body.code, "SKU_TAKEN");

    const badRef = await admin.request<ApiErrorBody>("/api/v1/admin/products", {
      method: "POST",
      body: base({ brandId: randomUUID() }),
    });
    assert.equal(badRef.status, 400);

    const invalid = await admin.request<ApiErrorBody>("/api/v1/admin/products", {
      method: "POST",
      body: { ...base(), price: 12.5, name: "", extra: "ignored" },
    });
    assert.equal(invalid.status, 400);
    assert.equal(invalid.body.code, "VALIDATION_ERROR");
    const fields = (invalid.body.details as Array<{ field: string }>).map((d) => d.field);
    assert.ok(fields.includes("price") && fields.includes("name"));

    const dupPair = await admin.request<ApiErrorBody>("/api/v1/admin/products", {
      method: "POST",
      body: base({ variants: [variant(ids.black, ids.m, 0), variant(ids.black, ids.m, 1)] }),
    });
    assert.equal(dupPair.status, 400);
  });

  test("список: пошук, фільтри, сторінки, архів окремо", async () => {
    const a = await createProduct({ name: "Альфа тест", variants: [variant(ids.black, ids.m, 0)] });
    await createProduct({
      name: "Бета тест",
      isNew: true,
      variants: [variant(ids.black, ids.m, 1)],
      stockNote: "x",
    });
    const c = await createProduct({
      name: "Гама тест",
      variants: [variant(ids.black, ids.m, 5)],
      stockNote: "x",
    });
    await admin.request(`/api/v1/admin/products/${c.id}`, {
      method: "PATCH",
      body: { status: "ARCHIVED" },
    });

    const q = `/api/v1/admin/products?q=${encodeURIComponent(SKU)}`;
    const all = await admin.request<AdminProductListResponse>(`${q}&sort=name_asc`);
    assert.equal(all.body.total, 2, "архів не показується за замовчуванням");
    assert.deepEqual(
      all.body.items.map((p) => p.name),
      ["Альфа тест", "Бета тест"],
    );

    const archived = await admin.request<AdminProductListResponse>(`${q}&status=ARCHIVED`);
    assert.deepEqual(
      archived.body.items.map((p) => p.id),
      [c.id],
    );

    const out = await admin.request<AdminProductListResponse>(`${q}&stock=out`);
    assert.deepEqual(
      out.body.items.map((p) => p.id),
      [a.id],
    );
    const low = await admin.request<AdminProductListResponse>(`${q}&stock=low`);
    assert.deepEqual(
      low.body.items.map((p) => p.name),
      ["Бета тест"],
    );
    const flagged = await admin.request<AdminProductListResponse>(`${q}&flag=new`);
    assert.equal(flagged.body.total, 1);

    const page2 = await admin.request<AdminProductListResponse>(
      `${q}&sort=name_asc&limit=1&page=2`,
    );
    assert.equal(page2.body.total, 2);
    assert.deepEqual(
      page2.body.items.map((p) => p.name),
      ["Бета тест"],
    );

    const bad = await admin.request<ApiErrorBody>(`${q}&sort=random&limit=1000`);
    assert.equal(bad.status, 400);
  });

  test("редагування, приховування й архів: вітрина бачить тільки ACTIVE", async () => {
    const product = await createProduct({
      status: "ACTIVE",
      variants: [variant(ids.black, ids.m, 1)],
      stockNote: "Надходження",
    });
    const edited = await admin.request<AdminProductDetail>(`/api/v1/admin/products/${product.id}`, {
      method: "PATCH",
      body: { name: "Нова назва", price: 900_000, oldPrice: 1_100_000, material: "  " },
    });
    assert.equal(edited.status, 200);
    assert.equal(edited.body.name, "Нова назва");
    assert.equal(edited.body.material, null);
    assert.equal(edited.body.slug, product.slug, "slug не змінюється сам");
    assert.equal(
      (await t.getJson<ProductDetail>(`/api/v1/products/${product.id}`)).body.price,
      900_000,
    );

    for (const status of ["HIDDEN", "DRAFT", "ARCHIVED"] as const) {
      await admin.request(`/api/v1/admin/products/${product.id}`, {
        method: "PATCH",
        body: { status },
      });
      assert.equal((await t.getJson(`/api/v1/products/${product.id}`)).status, 404, status);
    }
    const lower = await admin.request<ApiErrorBody>(`/api/v1/admin/products/${product.id}`, {
      method: "PATCH",
      body: { price: 1_200_000 },
    });
    assert.equal(lower.status, 400, "стара ціна 1 100 000 тепер менша за нову ціну");
  });

  test("матриця: expectedStock захищає від перезапису продажу, причина обов'язкова", async () => {
    const product = await createProduct({
      variants: [variant(ids.black, ids.m, 5), variant(ids.black, ids.l, 0)],
      stockNote: "Надходження",
    });
    const url = `/api/v1/admin/products/${product.id}/variants`;

    const stale = await admin.request<ApiErrorBody>(url, {
      method: "PUT",
      body: {
        variants: [
          variant(ids.black, ids.m, 7, { expectedStock: 4 }),
          variant(ids.black, ids.l, 0),
        ],
        stockNote: "Інвентаризація",
      },
    });
    assert.equal(stale.status, 409);
    assert.equal(stale.body.code, "STOCK_CHANGED");

    const noNote = await admin.request<ApiErrorBody>(url, {
      method: "PUT",
      body: {
        variants: [
          variant(ids.black, ids.m, 7, { expectedStock: 5 }),
          variant(ids.black, ids.l, 0),
        ],
      },
    });
    assert.equal(noNote.status, 400);
    assert.equal(noNote.body.code, "STOCK_NOTE_REQUIRED");

    const saved = await admin.request<AdminProductDetail>(url, {
      method: "PUT",
      body: {
        variants: [
          variant(ids.black, ids.m, 7, {
            expectedStock: 5,
            sku: " BLK-M ",
            priceOverride: 1_100_000,
          }),
          variant(ids.white, ids.xl, 2),
        ],
        stockNote: "Інвентаризація",
      },
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    const byPair = new Map(saved.body.variants.map((v) => [`${v.colorId}/${v.sizeId}`, v]));
    assert.equal(byPair.get(`${ids.black}/${ids.m}`)!.stock, 7);
    assert.equal(byPair.get(`${ids.black}/${ids.m}`)!.sku, "BLK-M");
    assert.equal(byPair.get(`${ids.white}/${ids.xl}`)!.stock, 2);
    // black/L без історії й залишку — видалено.
    assert.equal(byPair.has(`${ids.black}/${ids.l}`), false);

    const movements = (
      await admin.request<AdminInventoryMovement[]>(
        `/api/v1/admin/products/${product.id}/movements`,
      )
    ).body;
    assert.deepEqual(
      movements
        .filter((m) => m.note === "Інвентаризація")
        .map((m) => m.delta)
        .sort(),
      [2, 2],
    );

    // Прибрана пара з історією не видаляється, а вимикається; вітрина її не пропонує.
    await admin.request(`/api/v1/admin/products/${product.id}`, {
      method: "PATCH",
      body: { status: "ACTIVE" },
    });
    const removed = await admin.request<AdminProductDetail>(url, {
      method: "PUT",
      body: { variants: [variant(ids.white, ids.xl, 2, { expectedStock: 2 })] },
    });
    const kept = removed.body.variants.find((v) => v.colorId === ids.black && v.sizeId === ids.m)!;
    assert.equal(kept.isActive, false);
    assert.equal(kept.stock, 7, "залишок вимкненого варіанту не змінюється мовчки");
    const pub = await t.getJson<ProductDetail>(`/api/v1/products/${product.id}`);
    assert.deepEqual(
      pub.body.variants.map((v) => v.sizeLabel),
      ["XL"],
    );

    const empty = await admin.request<ApiErrorBody>(url, { method: "PUT", body: { variants: [] } });
    assert.equal(empty.status, 409, "активний товар без увімкнених варіантів");
    assert.equal(empty.body.code, "PRODUCT_NOT_READY");
  });

  test("швидка зміна залишку: атомарно, без мінуса, паралельні списання не йдуть у мінус", async () => {
    const product = await createProduct({
      variants: [variant(ids.black, ids.m, 3)],
      stockNote: "Надходження",
    });
    const variantId = product.variants[0]!.id;
    const url = `/api/v1/admin/variants/${variantId}/stock`;

    const negative = await admin.request<ApiErrorBody>(url, {
      method: "PATCH",
      body: { delta: -4, note: "Брак" },
    });
    assert.equal(negative.status, 409);
    assert.equal(negative.body.code, "NEGATIVE_STOCK");

    const noNote = await admin.request<ApiErrorBody>(url, {
      method: "PATCH",
      body: { delta: 1, note: " " },
    });
    assert.equal(noNote.status, 400);
    const zero = await admin.request<ApiErrorBody>(url, {
      method: "PATCH",
      body: { delta: 0, note: "x" },
    });
    assert.equal(zero.status, 400);

    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        admin.request(url, { method: "PATCH", body: { delta: -1, note: "Брак / списання" } }),
      ),
    );
    assert.equal(results.filter((r) => r.status === 200).length, 3);
    assert.equal(results.filter((r) => r.status === 409).length, 3);
    const row = await t.prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } });
    assert.equal(row.stock, 0);
    const manual = await t.prisma.inventoryMovement.findMany({
      where: { variantId, note: "Брак / списання" },
    });
    assert.equal(manual.length, 3);
    assert.ok(manual.every((m) => m.delta === -1 && m.adminId !== null));
  });

  test("товар у замовленні: не видаляється (тільки архів), ручні зміни не чіпають замовлення", async () => {
    const product = await createProduct({
      status: "ACTIVE",
      variants: [variant(ids.black, ids.m, 2)],
      stockNote: "Надходження",
    });
    const variantId = product.variants[0]!.id;
    const buyer = await t.loginBuyer(BUYER_TG);
    assert.equal(
      (
        await buyer.request("/api/v1/cart/items", {
          method: "POST",
          body: { variantId, quantity: 1 },
        })
      ).status,
      200,
    );
    const order = await buyer.request<{ order: { number: string; total: number } }>(
      "/api/v1/orders",
      {
        method: "POST",
        headers: { "idempotency-key": `test-${randomUUID()}` },
        body: {
          customerName: "Тест",
          customerPhone: "0671234567",
          city: "Київ",
          deliveryServiceCode: "nova_poshta",
          deliveryPoint: "Відділення 1",
        },
      },
    );
    assert.equal(order.status, 201, JSON.stringify(order.body));

    const del = await admin.request<ApiErrorBody>(`/api/v1/admin/products/${product.id}`, {
      method: "DELETE",
    });
    assert.equal(del.status, 409);
    assert.equal(del.body.code, "PRODUCT_HAS_ORDERS");

    // Ціна і назва в замовленні — знімок: зміни товару їх не чіпають.
    await admin.request(`/api/v1/admin/products/${product.id}`, {
      method: "PATCH",
      body: { name: "Перейменовано", price: 1, status: "ARCHIVED" },
    });
    await admin.request(`/api/v1/admin/variants/${variantId}/stock`, {
      method: "PATCH",
      body: { delta: 5, note: "Надходження" },
    });
    const item = await t.prisma.orderItem.findFirstOrThrow({ where: { variantId } });
    assert.equal(item.productName, "Тестовий пуховик Адмін");
    assert.equal(item.unitPrice, 1_000_000);
    const stock = await t.prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } });
    assert.equal(stock.stock, 6, "2 − 1 (замовлення) + 5 (надходження)");

    const movements = (
      await admin.request<AdminInventoryMovement[]>(
        `/api/v1/admin/products/${product.id}/movements`,
      )
    ).body;
    assert.deepEqual(
      movements.map((m) => m.reason),
      ["MANUAL", "ORDER", "MANUAL"],
    );
    assert.equal(movements[1]!.orderNumber, order.body.order.number);

    // Скасування покупцем після архівації повертає залишок як і раніше (логіка Етапу 3).
    const cancel = await buyer.request(`/api/v1/orders/${order.body.order.number}/cancel`, {
      method: "POST",
    });
    assert.equal(cancel.status, 200);
    assert.equal(
      (await t.prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } })).stock,
      7,
    );
    // Сповіщення йдуть після commit; чекаємо їх до очищення тестових даних.
    await t.notifications.whenIdle();
  });

  test("товар без замовлень видаляється фізично разом з фото у сховищі", async () => {
    const product = await createProduct({
      variants: [variant(ids.black, ids.m, 1)],
      stockNote: "Надходження",
    });
    const form = new FormData();
    form.append("files", new Blob([await png()], { type: "image/png" }), "photo.png");
    const uploaded = await admin.request<AdminProductImage[]>(
      `/api/v1/admin/products/${product.id}/images`,
      {
        method: "POST",
        form,
      },
    );
    assert.equal(uploaded.status, 201);
    const image = await t.prisma.productImage.findFirstOrThrow({
      where: { productId: product.id },
    });
    const file = join(t.storageDir, `${image.storageKey}-medium.webp`);
    assert.ok(existsSync(file));

    const del = await admin.request(`/api/v1/admin/products/${product.id}`, { method: "DELETE" });
    assert.equal(del.status, 204);
    assert.equal(await t.prisma.product.count({ where: { id: product.id } }), 0);
    assert.equal(existsSync(file), false);
  });

  test("фото: перевірка вмісту, WebP-версії, порядок, колір, дублювання ділить файли", async () => {
    const product = await createProduct({
      variants: [variant(ids.black, ids.m, 1)],
      stockNote: "Надходження",
    });
    const url = `/api/v1/admin/products/${product.id}/images`;

    // Текст з розширенням .jpg і MIME image/jpeg — не зображення.
    const fake = new FormData();
    fake.append(
      "files",
      new Blob(["<script>alert(1)</script>"], { type: "image/jpeg" }),
      "evil.jpg",
    );
    const rejected = await admin.request<ApiErrorBody>(url, { method: "POST", form: fake });
    assert.equal(rejected.status, 400);
    assert.equal(rejected.body.code, "UNSUPPORTED_IMAGE");

    const svg = new FormData();
    svg.append(
      "files",
      new Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="900" height="900"/>'], {
        type: "image/png",
      }),
      "x.png",
    );
    assert.equal(
      (await admin.request(url, { method: "POST", form: svg })).status,
      400,
      "SVG не приймаємо",
    );

    const form = new FormData();
    form.append(
      "files",
      new Blob([await png(2000, 2600)], { type: "application/octet-stream" }),
      "a.png",
    );
    form.append("files", new Blob([await png()], { type: "image/png" }), "b.png");
    form.append("colorId", ids.black);
    const uploaded = await admin.request<AdminProductImage[]>(url, { method: "POST", form });
    assert.equal(uploaded.status, 201, JSON.stringify(uploaded.body));
    assert.equal(uploaded.body.length, 2);
    const [first, second] = uploaded.body as [AdminProductImage, AdminProductImage];
    assert.equal(first.colorId, ids.black);
    assert.equal(first.width, 1200, "large — не ширше 1200");
    assert.match(first.urls.medium!, /^\/api\/v1\/uploads\/products\/.+-medium\.webp$/);

    const served = await fetch(t.url(first.urls.thumb!));
    assert.equal(served.status, 200);
    const meta = await sharp(Buffer.from(await served.arrayBuffer())).metadata();
    assert.equal(meta.format, "webp");
    assert.equal(meta.width, 300);

    const reordered = await admin.request<AdminProductImage[]>(`${url}/order`, {
      method: "PATCH",
      body: { ids: [second.id, first.id] },
    });
    assert.deepEqual(
      reordered.body.map((i) => i.id),
      [second.id, first.id],
    );
    const partial = await admin.request<ApiErrorBody>(`${url}/order`, {
      method: "PATCH",
      body: { ids: [first.id] },
    });
    assert.equal(partial.status, 409);

    const recolored = await admin.request<AdminProductImage>(`/api/v1/admin/images/${second.id}`, {
      method: "PATCH",
      body: { colorId: ids.white, alt: "Спереду" },
    });
    assert.equal(recolored.body.colorId, ids.white);
    assert.equal(recolored.body.alt, "Спереду");

    // Копія товару посилається на ті самі файли; видалення фото в копії їх не прибирає.
    const copy = await createProduct({ copyImagesFromId: product.id });
    assert.equal(copy.images.length, 2);
    const firstRow = await t.prisma.productImage.findUniqueOrThrow({ where: { id: first.id } });
    const file = join(t.storageDir, `${firstRow.storageKey}-large.webp`);
    const copyOfFirst = copy.images.find((i) => i.urls.large === first.urls.large)!;
    assert.equal(
      (await admin.request(`/api/v1/admin/images/${copyOfFirst.id}`, { method: "DELETE" })).status,
      204,
    );
    assert.ok(existsSync(file), "файл ще потрібен оригіналу");
    assert.equal(
      (await admin.request(`/api/v1/admin/images/${first.id}`, { method: "DELETE" })).status,
      204,
    );
    assert.equal(existsSync(file), false, "останнє посилання — файл видалено");

    // Перше фото тепер — головне на вітрині.
    await admin.request(`/api/v1/admin/products/${product.id}`, {
      method: "PATCH",
      body: { status: "ACTIVE" },
    });
    const pub = await t.getJson<ProductDetail>(`/api/v1/products/${product.id}`);
    assert.deepEqual(
      pub.body.images.map((i) => i.id),
      [second.id],
    );
  });

  test("категорії: два рівні, без циклів, порядок, видалення лише порожніх", async () => {
    const create = (body: object) =>
      admin.request<AdminCategory>("/api/v1/admin/categories", {
        method: "POST",
        body: { parentId: null, icon: null, isActive: true, ...body },
      });
    const root = await create({ name: "Тест розділ", slug: `${SLUG}root`, icon: "🧥" });
    assert.equal(root.status, 201);
    assert.equal(root.body.icon, "🧥");
    const child = await create({
      name: "Тест підрозділ",
      slug: `${SLUG}child`,
      parentId: root.body.id,
    });
    assert.equal(child.status, 201);

    const grandchild = await create({ name: "Онук", slug: `${SLUG}gc`, parentId: child.body.id });
    assert.equal(grandchild.status, 400);

    const cycle = await admin.request<ApiErrorBody>(`/api/v1/admin/categories/${root.body.id}`, {
      method: "PATCH",
      body: { parentId: child.body.id },
    });
    assert.equal(cycle.status, 400);
    const self = await admin.request<ApiErrorBody>(`/api/v1/admin/categories/${child.body.id}`, {
      method: "PATCH",
      body: { parentId: child.body.id },
    });
    assert.equal(self.status, 400);

    const dupSlug = await create({ name: "Інша", slug: `${SLUG}root` });
    assert.equal(dupSlug.status, 409);

    // Товар у підкатегорії видно в публічному дереві й фільтрі розділу.
    await createProduct({
      categoryId: child.body.id,
      status: "ACTIVE",
      variants: [variant(ids.black, ids.m, 1)],
      stockNote: "Надходження",
    });
    const tree =
      await t.getJson<
        Array<{ slug: string; productCount: number; children: Array<{ slug: string }> }>
      >("/api/v1/categories");
    const publicRoot = tree.body.find((c) => c.slug === `${SLUG}root`)!;
    assert.equal(publicRoot.productCount, 1);
    assert.deepEqual(
      publicRoot.children.map((c) => c.slug),
      [`${SLUG}child`],
    );

    // Вимкнений розділ ховає і підкатегорію, і її товари з вітрини.
    await admin.request(`/api/v1/admin/categories/${root.body.id}`, {
      method: "PATCH",
      body: { isActive: false },
    });
    const hidden = await t.getJson<{ items: unknown[] }>(`/api/v1/products?category=${SLUG}child`);
    assert.equal(hidden.body.items.length, 0);

    const order = await admin.request<AdminCategory[]>("/api/v1/admin/categories/order", {
      method: "PATCH",
      body: { items: [{ id: root.body.id, sortOrder: 5 }] },
    });
    assert.equal(order.body.find((c) => c.id === root.body.id)!.sortOrder, 5);

    const hasChildren = await admin.request<ApiErrorBody>(
      `/api/v1/admin/categories/${root.body.id}`,
      { method: "DELETE" },
    );
    assert.equal(hasChildren.body.code, "CATEGORY_HAS_CHILDREN");
    const hasProducts = await admin.request<ApiErrorBody>(
      `/api/v1/admin/categories/${child.body.id}`,
      { method: "DELETE" },
    );
    assert.equal(hasProducts.status, 409);
    assert.equal(hasProducts.body.code, "CATEGORY_HAS_PRODUCTS");

    const empty = await create({ name: "Порожня", slug: `${SLUG}empty` });
    assert.equal(
      (await admin.request(`/api/v1/admin/categories/${empty.body.id}`, { method: "DELETE" }))
        .status,
      204,
    );
  });

  test("зображення категорії: завантаження і заміна", async () => {
    const category = await admin.request<AdminCategory>("/api/v1/admin/categories", {
      method: "POST",
      body: { name: "З фото", slug: `${SLUG}img`, parentId: null, icon: null, isActive: false },
    });
    const form = new FormData();
    form.append("file", new Blob([await png(600, 600)], { type: "image/png" }), "c.png");
    const withImage = await admin.request<AdminCategory>(
      `/api/v1/admin/categories/${category.body.id}/image`,
      {
        method: "POST",
        form,
      },
    );
    assert.equal(withImage.status, 201, JSON.stringify(withImage.body));
    assert.match(withImage.body.imageUrl!, /^\/api\/v1\/uploads\/categories\/.+-medium\.webp$/);
    const file = join(t.storageDir, withImage.body.imageUrl!.replace("/api/v1/uploads/", ""));
    assert.ok(existsSync(file));
    const cleared = await admin.request<AdminCategory>(
      `/api/v1/admin/categories/${category.body.id}/image`,
      {
        method: "DELETE",
      },
    );
    assert.equal(cleared.body.imageUrl, null);
    assert.equal(existsSync(file), false);
  });

  test("довідники: бренди, кольори, розміри; використані не видаляються", async () => {
    const brand = await admin.request<AdminBrand>("/api/v1/admin/brands", {
      method: "POST",
      body: { name: "Тест Бренд", slug: `${SLUG}brand`, logoUrl: null, isActive: true },
    });
    assert.equal(brand.status, 201);
    const dupBrand = await admin.request<ApiErrorBody>("/api/v1/admin/brands", {
      method: "POST",
      body: { name: "Тест Бренд", slug: `${SLUG}brand2`, logoUrl: null, isActive: true },
    });
    assert.equal(dupBrand.status, 409);
    const badLogo = await admin.request<ApiErrorBody>("/api/v1/admin/brands", {
      method: "POST",
      body: {
        name: "Логотип",
        slug: `${SLUG}logo`,
        logoUrl: "javascript:alert(1)",
        isActive: true,
      },
    });
    assert.equal(badLogo.status, 400);

    const color = await admin.request<AdminColor>("/api/v1/admin/colors", {
      method: "POST",
      body: { name: "Тест бузковий", slug: `${SLUG}lilac`, hex: "#C8A2C8" },
    });
    assert.equal(color.status, 201);
    assert.equal(color.body.hex, "#c8a2c8");
    const badHex = await admin.request<ApiErrorBody>("/api/v1/admin/colors", {
      method: "POST",
      body: { name: "Поганий", slug: `${SLUG}bad`, hex: "red" },
    });
    assert.equal(badHex.status, 400);

    const size = await admin.request<AdminSize>("/api/v1/admin/sizes", {
      method: "POST",
      body: { label: "TADM-4XL", sizeSystem: "CLOTHING" },
    });
    assert.equal(size.status, 201);
    const dupSize = await admin.request<ApiErrorBody>("/api/v1/admin/sizes", {
      method: "POST",
      body: { label: "TADM-4XL", sizeSystem: "CLOTHING" },
    });
    assert.equal(dupSize.status, 409);

    await createProduct({
      brandId: brand.body.id,
      variants: [variant(color.body.id, size.body.id, 0)],
    });
    for (const path of [
      `/api/v1/admin/brands/${brand.body.id}`,
      `/api/v1/admin/colors/${color.body.id}`,
      `/api/v1/admin/sizes/${size.body.id}`,
    ]) {
      const response = await admin.request<ApiErrorBody>(path, { method: "DELETE" });
      assert.equal(response.status, 409, path);
    }

    const renamed = await admin.request<AdminBrand>(`/api/v1/admin/brands/${brand.body.id}`, {
      method: "PATCH",
      body: { name: "Тест Бренд 2", logoUrl: null, isActive: false },
    });
    assert.equal(renamed.body.name, "Тест Бренд 2");
    assert.equal(renamed.body.slug, `${SLUG}brand`);
    assert.equal(renamed.body.isActive, false);

    const unused = await admin.request<AdminColor>("/api/v1/admin/colors", {
      method: "POST",
      body: { name: "Тест невикористаний", slug: `${SLUG}unused`, hex: "#010203" },
    });
    assert.equal(
      (await admin.request(`/api/v1/admin/colors/${unused.body.id}`, { method: "DELETE" })).status,
      204,
    );
  });
});
