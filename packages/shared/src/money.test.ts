import assert from "node:assert/strict";
import { test } from "node:test";

import { discountPercent, kopecksToUahInput, parseUahToKopecks } from "./money.js";

test("parseUahToKopecks: різні записи суми", () => {
  assert.equal(parseUahToKopecks("1299"), 129_900);
  assert.equal(parseUahToKopecks("1 299,50"), 129_950);
  assert.equal(parseUahToKopecks("1299.5"), 129_950);
  assert.equal(parseUahToKopecks(" 0,01 ₴"), 1);
  assert.equal(parseUahToKopecks("0"), 0);
});

test("parseUahToKopecks: некоректне → null", () => {
  for (const input of ["", "-1", "12,345", "abc", "1e3", "1.2.3", "1234567890"]) {
    assert.equal(parseUahToKopecks(input), null, input);
  }
});

test("kopecksToUahInput — зворотне перетворення", () => {
  assert.equal(kopecksToUahInput(129_900), "1299");
  assert.equal(kopecksToUahInput(129_950), "1299,50");
  assert.equal(kopecksToUahInput(5), "0,05");
  assert.equal(parseUahToKopecks(kopecksToUahInput(123_456)), 123_456);
});

test("discountPercent: тільки коли стара ціна більша", () => {
  assert.equal(discountPercent(7_000, 10_000), 30);
  assert.equal(discountPercent(9_999, 10_000), 0);
  assert.equal(discountPercent(10_000, 10_000), null);
  assert.equal(discountPercent(10_000, null), null);
});
