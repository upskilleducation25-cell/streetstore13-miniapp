import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { buildQuery, createApiClient } from "./client";
import { ApiError, errorKind } from "./errors";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("API-клієнт", () => {
  test("query: масиви через кому, порожні значення пропускаються", () => {
    assert.equal(
      buildQuery({
        brand: ["nike", "acne"],
        color: [],
        minPrice: 100_000,
        isNew: undefined,
        q: "",
      }),
      "?brand=nike%2Cacne&minPrice=100000",
    );
    assert.equal(buildQuery({}), "");
  });

  test("помилка API {code, message, details} → ApiError з тими самими полями", async () => {
    const client = createApiClient({
      baseUrl: "/api/v1",
      fetch: async () =>
        json(400, {
          code: "VALIDATION_ERROR",
          message: "Некоректні параметри",
          details: [{ field: "limit" }],
        }),
    });
    await assert.rejects(client.request("/products"), (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.status, 400);
      assert.equal(error.code, "VALIDATION_ERROR");
      assert.equal(error.message, "Некоректні параметри");
      assert.deepEqual(error.details, [{ field: "limit" }]);
      assert.equal(errorKind(error), "client");
      return true;
    });
  });

  test("відповідь не у форматі API (HTML від проксі) → ApiError з кодом HTTP_502", async () => {
    const client = createApiClient({
      baseUrl: "",
      fetch: async () => new Response("<html>Bad gateway</html>", { status: 502 }),
    });
    await assert.rejects(client.request("/home"), (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.code, "HTTP_502");
      assert.equal(errorKind(error), "server");
      return true;
    });
  });

  test("мережа недоступна → NETWORK_ERROR", async () => {
    const client = createApiClient({
      baseUrl: "",
      fetch: async () => {
        throw new TypeError("Failed to fetch");
      },
    });
    await assert.rejects(client.request("/home"), (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.code, "NETWORK_ERROR");
      assert.equal(errorKind(error), "network");
      return true;
    });
  });

  test("404 → errorKind notFound", () => {
    assert.equal(
      errorKind(new ApiError(404, "PRODUCT_NOT_FOUND", "Товар не знайдено")),
      "notFound",
    );
  });

  test("auth: JWT у заголовку; на 401 — новий вхід і один повтор", async () => {
    const seen: Array<string | null> = [];
    let token = "old";
    let invalidated = 0;
    const client = createApiClient({
      baseUrl: "",
      tokens: {
        getToken: async () => token,
        invalidate: () => {
          invalidated++;
          token = "new";
        },
      },
      fetch: async (_url, init) => {
        const header = (init?.headers as Record<string, string>).Authorization ?? null;
        seen.push(header);
        return header === "Bearer new"
          ? json(200, { id: "u1" })
          : json(401, { code: "UNAUTHORIZED", message: "x" });
      },
    });
    assert.deepEqual(await client.request("/me", { auth: true }), { id: "u1" });
    assert.deepEqual(seen, ["Bearer old", "Bearer new"]);
    assert.equal(invalidated, 1);
  });

  test("публічні запити токен не надсилають", async () => {
    let header: string | undefined;
    const client = createApiClient({
      baseUrl: "",
      tokens: { getToken: async () => "secret", invalidate: () => {} },
      fetch: async (_url, init) => {
        header = (init?.headers as Record<string, string>).Authorization;
        return json(200, []);
      },
    });
    await client.request("/categories");
    assert.equal(header, undefined);
  });
});
