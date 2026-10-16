import assert from "node:assert/strict";
import { createServer, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";

import { loadEnv } from "../config/env.js";
import { isOwnedBase, R2StorageDriver } from "./storage.js";
import { StorageService } from "./storage.service.js";

const SECRET = "test-only-secret-access-key-not-real";

interface Captured {
  method: string;
  url: string;
  headers: IncomingMessage["headers"];
  body: Buffer;
}

/** Фейковий S3-сервер: R2-драйвер шле справжні підписані запити S3 API. */
async function fakeS3(): Promise<{
  endpoint: string;
  requests: Captured[];
  close: () => Promise<void>;
}> {
  const requests: Captured[] = [];
  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      requests.push({
        method: req.method!,
        url: req.url!,
        headers: req.headers,
        body: Buffer.concat(chunks),
      });
      res.setHeader("content-type", "application/xml");
      res.end(req.url!.includes("delete") ? "<DeleteResult></DeleteResult>" : "");
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    endpoint: `http://127.0.0.1:${port}`,
    requests,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

const r2Env = (endpoint: string) =>
  loadEnv({
    DATABASE_URL: "postgresql://u:p@localhost:5432/db",
    JWT_SECRET: "x".repeat(32),
    STORAGE_DRIVER: "r2",
    R2_ENDPOINT: endpoint,
    R2_ACCESS_KEY_ID: "test-access-key",
    R2_SECRET_ACCESS_KEY: SECRET,
    R2_BUCKET: "ss13-media",
    R2_PUBLIC_URL: "https://media.example.com",
  });

test("R2: PutObject і DeleteObjects — підписані запити, секрет не передається", async () => {
  const s3 = await fakeS3();
  try {
    const driver = new R2StorageDriver(r2Env(s3.endpoint));
    const key =
      "products/00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000002-thumb.webp";
    await driver.put(key, Buffer.from("webp-bytes"), "image/webp");
    await driver.delete([key]);

    const [put, del] = s3.requests as [Captured, Captured];
    assert.equal(put.method, "PUT");
    assert.equal(put.url.split("?")[0], `/ss13-media/${key}`);
    assert.equal(put.headers["content-type"], "image/webp");
    assert.equal(put.headers["cache-control"], "public, max-age=31536000, immutable");
    assert.match(
      String(put.headers.authorization),
      /^AWS4-HMAC-SHA256 Credential=test-access-key\//,
    );
    assert.equal(put.body.toString(), "webp-bytes");
    assert.equal(del.method, "POST");
    assert.match(del.url, /^\/ss13-media\/?\?delete/);
    assert.ok(del.body.toString().includes(`<Key>${key}</Key>`));
    for (const request of s3.requests) {
      assert.equal(JSON.stringify(request.headers).includes(SECRET), false);
    }
    assert.equal(driver.publicUrl(key), `https://media.example.com/${key}`);
  } finally {
    await s3.close();
  }
});

test("сховище не налаштовано — 503 замість імітації успіху", () => {
  const service = new StorageService(
    loadEnv({
      DATABASE_URL: "postgresql://u:p@localhost:5432/db",
      JWT_SECRET: "x".repeat(32),
      STORAGE_DRIVER: "none",
    }),
  );
  assert.throws(
    () => service.assertAvailable(),
    (error: { getStatus(): number }) => error.getStatus() === 503,
  );
});

test("видаляються тільки файли адмінки, не demo/ і не test/", () => {
  assert.equal(
    isOwnedBase(
      "products/00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000002",
    ),
    true,
  );
  assert.equal(isOwnedBase("demo/products/DEMO-1/black-1.svg"), false);
  assert.equal(isOwnedBase("products/../../etc/passwd"), false);

  const service = new StorageService(r2Env("http://127.0.0.1:9"));
  const base =
    "categories/00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000002";
  assert.equal(service.baseFromUrl(`https://media.example.com/${base}-medium.webp`), base);
  assert.equal(service.baseFromUrl("https://evil.example.com/x-medium.webp"), null);
  assert.equal(service.baseFromUrl(null), null);
});
