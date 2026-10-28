import assert from "node:assert/strict";
import test from "node:test";

import { parseEasyDropFeed } from "./easydrop-feed.parser.js";

const item = (id: string, size = "38") =>
  [
    `<item id="${id}" group_id="200">`,
    "<categoryId>12</categoryId>",
    `<name>Runner ${size}</name>`,
    "<priceuah>3500</priceuah>",
    `<vendorCode>SKU-${id}</vendorCode>`,
    "<image>https://easydrop.one/media/a.jpg</image>",
    `<param name="Розмір" unit="">${size}</param>`,
    "<available>true</available>",
    "<quantity_in_stock>2</quantity_in_stock>",
    "</item>",
  ].join("\n");
const feed = (items: string) =>
  `<?xml version="1.0" encoding="UTF-8"?><shop><items>${items}</items></shop>`;

test("parses shoe sizes and groups model variants", () => {
  const parsed = parseEasyDropFeed(feed(item("1", "38") + item("2", "39")));
  assert.equal(parsed.totalItems, 2);
  assert.equal(parsed.shoeVariants.length, 2);
  assert.equal(parsed.distinctModels, 1);
  assert.equal(parsed.shoeVariants[0]!.priceUah, 3500);
  assert.equal(parsed.shoeVariants[1]!.size, "39");
});

test("rejects duplicate IDs before returning data", () => {
  assert.throws(() => parseEasyDropFeed(feed(item("1") + item("1"))), /повторний id/);
});

test("rejects DTD/entity declarations", () => {
  assert.throws(
    () => parseEasyDropFeed(`<!DOCTYPE shop [<!ENTITY x "bad">]>${feed(item("1"))}`),
    /DTD/,
  );
});

test("rejects external image hosts", () => {
  assert.throws(
    () => parseEasyDropFeed(feed(item("1").replace("https://easydrop.one", "https://example.com"))),
    /дозволеному HTTPS-хості/,
  );
});

test("rejects malformed stock rather than silently treating it as zero", () => {
  assert.throws(
    () =>
      parseEasyDropFeed(feed(item("1").replace("<quantity_in_stock>2", "<quantity_in_stock>oops"))),
    /quantity_in_stock має бути цілим числом/,
  );
});

test("rejects a malformed size instead of silently skipping the item", () => {
  const malformed = item("2").replace(
    '<param name="Розмір" unit="">38</param>',
    '<param name="Розмір" unit="">M</param>',
  );
  assert.throws(
    () => parseEasyDropFeed(feed(item("1") + malformed)),
    /числовим розміром взуття EU/,
  );
});
