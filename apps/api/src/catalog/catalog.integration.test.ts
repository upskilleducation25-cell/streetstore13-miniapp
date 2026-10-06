import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";

import type {
  ApiErrorBody,
  CategoryItem,
  HomeResponse,
  Paginated,
  ProductCard,
  ProductDetail,
} from "@ss13/shared";

import { createTestApp, hasDatabase, type TestApp } from "../testing/test-app.js";

type Page = Paginated<ProductCard>;
const demoSkus = (page: Page) =>
  page.items.map((item) => item.sku).filter((sku) => sku.startsWith("DEMO-"));

describe("Каталог (інтеграційні, тестова БД з seed + demo-seed)", { skip: !hasDatabase }, () => {
  let t: TestApp;
  const ids = new Map<string, string>();

  before(async () => {
    t = await createTestApp();
    const products = await t.prisma.product.findMany({
      where: { sku: { startsWith: "DEMO-" } },
      select: { id: true, sku: true },
    });
    for (const product of products) ids.set(product.sku, product.id);
    assert.ok(ids.size >= 14, "Demo-товари не знайдено: запустіть pnpm db:seed:demo");
  });

  after(async () => {
    await t?.close();
  });

  async function allPages(query: string): Promise<ProductCard[]> {
    const items: ProductCard[] = [];
    let cursor: string | null = null;
    for (let i = 0; i < 100; i++) {
      const suffix: string = cursor ? `&cursor=${cursor}` : "";
      const { status, body } = await t.getJson<Page>(`/api/v1/products?${query}${suffix}`);
      assert.equal(status, 200);
      items.push(...body.items);
      cursor = body.nextCursor;
      if (!cursor) return items;
    }
    throw new Error("Пагінація не завершилась");
  }

  describe("GET /categories", () => {
    test("повертає 11 категорій з seed у порядку sortOrder", async () => {
      const { status, body } = await t.getJson<CategoryItem[]>("/api/v1/categories");
      assert.equal(status, 200);
      const slugs = body.map((category) => category.slug);
      for (const slug of ["puhovyky", "kurtky", "krosivky", "aksesuary"]) {
        assert.ok(slugs.includes(slug), `немає категорії ${slug}`);
      }
      const orders = body.map((category) => category.sortOrder);
      assert.deepEqual(
        orders,
        [...orders].sort((a, b) => a - b),
      );
    });

    test("лічильник не враховує прихований товар", async () => {
      const { body } = await t.getJson<CategoryItem[]>("/api/v1/categories");
      const puhovyky = body.find((category) => category.slug === "puhovyky");
      const visibleInDb = await t.prisma.product.count({
        where: { category: { slug: "puhovyky" }, status: "ACTIVE", deletedAt: null },
      });
      assert.equal(puhovyky?.productCount, visibleInDb);
    });
  });

  describe("GET /products", () => {
    test("пагінація курсором проходить усі товари без дублів, прихованого немає", async () => {
      const items = await allPages("limit=5");
      const skus = items.map((item) => item.sku);
      assert.equal(new Set(skus).size, skus.length, "є дублікати між сторінками");
      assert.ok(skus.includes("DEMO-001"));
      assert.ok(!skus.includes("DEMO-HIDDEN-01"), "прихований товар у списку");
    });

    test("сортування new: найновіші першими", async () => {
      const items = await allPages("limit=50&sort=new");
      const demo = items.filter((item) => item.sku.startsWith("DEMO-")).map((item) => item.sku);
      assert.equal(demo[0], "DEMO-001");
      assert.ok(demo.indexOf("DEMO-001") < demo.indexOf("DEMO-013"));
    });

    test("сортування за ціною вгору і вниз", async () => {
      const asc = (await allPages("limit=50&sort=price_asc")).map((item) => item.price);
      assert.deepEqual(
        asc,
        [...asc].sort((a, b) => a - b),
      );
      const desc = (await allPages("limit=50&sort=price_desc")).map((item) => item.price);
      assert.deepEqual(
        desc,
        [...desc].sort((a, b) => b - a),
      );
    });

    test("колір + розмір + наявність збігаються в одному варіанті", async () => {
      const { body } = await t.getJson<Page>(
        "/api/v1/products?color=black&size=L&inStock=true&limit=50",
      );
      // DEMO-001: чорний L = 0, тому не потрапляє; DEMO-005: чорний L = 0.
      assert.deepEqual(demoSkus(body).sort(), ["DEMO-002", "DEMO-003", "DEMO-004", "DEMO-008"]);
    });

    test("бренд + категорія", async () => {
      const { body } = await t.getJson<Page>("/api/v1/products?brand=nike&category=krosivky");
      assert.deepEqual(demoSkus(body), ["DEMO-009"]);
    });

    test("кілька брендів через кому", async () => {
      const { body } = await t.getJson<Page>("/api/v1/products?brand=premiata,arcteryx&limit=50");
      assert.deepEqual(demoSkus(body).sort(), ["DEMO-003", "DEMO-010"]);
    });

    test("ціна в копійках: minPrice і maxPrice", async () => {
      const items = await allPages("minPrice=400000&maxPrice=1200000&limit=50");
      assert.ok(items.length > 0);
      for (const item of items) {
        assert.ok(Number.isInteger(item.price));
        assert.ok(item.price >= 400_000 && item.price <= 1_200_000, `${item.sku}: ${item.price}`);
      }
    });

    test("isSale: тільки акційні, стара ціна більша за нову, знижка порахована", async () => {
      const items = await allPages("isSale=true&limit=50");
      assert.ok(items.some((item) => item.sku === "DEMO-002"));
      for (const item of items) {
        assert.equal(item.isSale, true);
        if (item.oldPrice !== null) {
          assert.ok(item.oldPrice > item.price);
          assert.ok(item.discountPercent !== null && item.discountPercent > 0);
        }
      }
      const demo2 = items.find((item) => item.sku === "DEMO-002");
      assert.equal(demo2?.discountPercent, 13);
    });

    test("isNew і isPopular", async () => {
      for (const flag of ["isNew", "isPopular"] as const) {
        const items = await allPages(`${flag}=true&limit=50`);
        assert.ok(items.length > 0);
        assert.ok(items.every((item) => item[flag]));
      }
    });

    test("inStock=false: тільки товари без жодного варіанту в наявності", async () => {
      const items = await allPages("inStock=false&limit=50");
      const skus = items.map((item) => item.sku);
      assert.ok(skus.includes("DEMO-013"));
      assert.ok(!skus.includes("DEMO-001"));
      assert.ok(items.every((item) => !item.inStock));
    });

    test("картка товару: розміри тільки в наявності, кольори тільки в наявності", async () => {
      const { body } = await t.getJson<Page>("/api/v1/products?brand=acne-studios&category=hudi");
      const hoodie = body.items.find((item) => item.sku === "DEMO-005");
      assert.ok(hoodie);
      assert.deepEqual(hoodie.availableSizes, ["S", "M"]);
      assert.deepEqual(
        hoodie.colors.map((color) => color.slug),
        ["grey"],
      );
    });

    test("некоректні параметри → 400 VALIDATION_ERROR", async () => {
      for (const query of [
        "limit=500",
        "sort=popular_desc",
        "minPrice=-1",
        "minPrice=10.5",
        "inStock=maybe",
        "cursor=not-a-uuid",
      ]) {
        const { status, body } = await t.getJson<ApiErrorBody>(`/api/v1/products?${query}`);
        assert.equal(status, 400, query);
        assert.equal(body.code, "VALIDATION_ERROR", query);
        assert.ok(Array.isArray(body.details), query);
      }
    });

    test("minPrice більший за maxPrice → 400", async () => {
      const { status, body } = await t.getJson<ApiErrorBody>(
        "/api/v1/products?minPrice=500000&maxPrice=100",
      );
      assert.equal(status, 400);
      assert.equal(body.code, "VALIDATION_ERROR");
    });

    test("невідомий бренд → порожній список, не помилка", async () => {
      const { status, body } = await t.getJson<Page>("/api/v1/products?brand=no-such-brand");
      assert.equal(status, 200);
      assert.deepEqual(body.items, []);
      assert.equal(body.nextCursor, null);
    });
  });

  describe("GET /products/:id", () => {
    test("доступність кожного кольору, розміру і пари колір + розмір", async () => {
      const { status, body } = await t.getJson<ProductDetail>(
        `/api/v1/products/${ids.get("DEMO-005")}`,
      );
      assert.equal(status, 200);
      assert.equal(body.sku, "DEMO-005");
      assert.equal(body.price, 1_149_900);
      assert.deepEqual(
        body.colors.map((color) => [color.slug, color.available]),
        [
          ["black", false],
          ["grey", true],
        ],
      );
      assert.deepEqual(
        body.sizes.map((size) => [size.label, size.available]),
        [
          ["S", true],
          ["M", true],
          ["L", false],
        ],
      );
      const pair = (color: string, size: string) =>
        body.variants.find((v) => v.colorSlug === color && v.sizeLabel === size);
      assert.equal(pair("grey", "M")?.stock, 2);
      assert.equal(pair("grey", "M")?.available, true);
      assert.equal(pair("black", "M")?.stock, 0);
      assert.equal(pair("black", "M")?.available, false);
      assert.equal(body.variants.length, 5);
      assert.ok(body.variants.every((v) => v.price === 1_149_900));
    });

    test("прихований товар → 404", async () => {
      const { status, body } = await t.getJson<ApiErrorBody>(
        `/api/v1/products/${ids.get("DEMO-HIDDEN-01")}`,
      );
      assert.equal(status, 404);
      assert.equal(body.code, "PRODUCT_NOT_FOUND");
    });

    test("неіснуючий і некоректний id → 404", async () => {
      for (const id of ["00000000-0000-4000-8000-000000000000", "abc"]) {
        const { status, body } = await t.getJson<ApiErrorBody>(`/api/v1/products/${id}`);
        assert.equal(status, 404, id);
        assert.equal(body.code, "PRODUCT_NOT_FOUND", id);
      }
    });
  });

  describe("GET /products/search", () => {
    const search = (q: string) =>
      t.getJson<Page>(`/api/v1/products/search?q=${encodeURIComponent(q)}`);

    test("за назвою", async () => {
      const { status, body } = await search("пуховик");
      assert.equal(status, 200);
      const skus = demoSkus(body);
      assert.ok(skus.includes("DEMO-001") && skus.includes("DEMO-002"));
      assert.ok(!skus.includes("DEMO-HIDDEN-01"), "прихований товар у пошуку");
    });

    test("за брендом", async () => {
      const { body } = await search("Stone Island");
      assert.deepEqual(demoSkus(body).sort(), ["DEMO-002", "DEMO-008"]);
    });

    test("за категорією", async () => {
      const { body } = await search("кросівки");
      assert.deepEqual(demoSkus(body).sort(), ["DEMO-009", "DEMO-010"]);
    });

    test("за артикулом, без урахування регістру", async () => {
      const { body } = await search("demo-009");
      assert.equal(body.items[0]?.sku, "DEMO-009");
    });

    test("з помилкою в слові (нечіткий пошук)", async () => {
      const { body } = await search("пуховік");
      assert.ok(demoSkus(body).includes("DEMO-001"));
    });

    test("спецсимволи не ламають запит", async () => {
      for (const q of ["%_", "' OR 1=1 --", "\\"]) {
        const { status } = await search(q);
        assert.equal(status, 200, q);
      }
    });

    test("порожній q → 400", async () => {
      const { status, body } = await t.getJson<ApiErrorBody>("/api/v1/products/search?q=");
      assert.equal(status, 400);
      assert.equal(body.code, "VALIDATION_ERROR");
    });

    test("пагінація пошуку", async () => {
      const first = await t.getJson<Page>("/api/v1/products/search?q=demo&limit=5");
      assert.equal(first.body.items.length, 5);
      assert.ok(first.body.nextCursor);
      const second = await t.getJson<Page>(
        `/api/v1/products/search?q=demo&limit=5&cursor=${first.body.nextCursor}`,
      );
      const overlap = second.body.items.filter((item) =>
        first.body.items.some((other) => other.id === item.id),
      );
      assert.deepEqual(overlap, []);
    });
  });

  describe("GET /home", () => {
    test("секції містять тільки товари з відповідною позначкою, без прихованих", async () => {
      const { status, body } = await t.getJson<HomeResponse>("/api/v1/home");
      assert.equal(status, 200);
      assert.ok(body.categories.length >= 11);
      assert.ok(body.newArrivals.length > 0 && body.newArrivals.every((p) => p.isNew));
      assert.ok(body.popular.length > 0 && body.popular.every((p) => p.isPopular));
      assert.ok(body.sale.length > 0 && body.sale.every((p) => p.isSale));
      const all = [...body.newArrivals, ...body.popular, ...body.sale].map((p) => p.sku);
      assert.ok(!all.includes("DEMO-HIDDEN-01"));
    });
  });

  describe("Товар у неактивній категорії", () => {
    const sku = "TEST-INACTIVE-CAT-01";
    let productId = "";

    before(async () => {
      const brand = await t.prisma.brand.findUniqueOrThrow({ where: { slug: "nike" } });
      const category = await t.prisma.category.create({
        data: { slug: "test-inactive-category", name: "Тестова прихована", isActive: false },
      });
      const product = await t.prisma.product.create({
        data: {
          sku,
          slug: "test-inactive-cat-01",
          name: "Тестовий товар неактивної категорії",
          brandId: brand.id,
          categoryId: category.id,
          price: 100_000,
          status: "ACTIVE",
          isNew: true,
        },
      });
      productId = product.id;
    });

    after(async () => {
      await t.prisma.product.deleteMany({ where: { sku } });
      await t.prisma.category.deleteMany({ where: { slug: "test-inactive-category" } });
    });

    test("не віддається у списку, пошуку, за id і в категоріях", async () => {
      const list = await allPages("limit=50");
      assert.ok(!list.some((item) => item.sku === sku));

      const found = await t.getJson<Page>(
        `/api/v1/products/search?q=${encodeURIComponent("Тестовий товар неактивної")}`,
      );
      assert.ok(!found.body.items.some((item) => item.sku === sku));

      const detail = await t.getJson<ApiErrorBody>(`/api/v1/products/${productId}`);
      assert.equal(detail.status, 404);

      const categories = await t.getJson<CategoryItem[]>("/api/v1/categories");
      assert.ok(!categories.body.some((c) => c.slug === "test-inactive-category"));
    });
  });
});
