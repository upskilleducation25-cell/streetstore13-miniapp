import assert from "node:assert/strict";
import { test } from "node:test";

import { formatOrderDate, orderStatusLabel, orderStatusTone } from "./format";

test("дата замовлення за київським часом", () => {
  const text = formatOrderDate("2026-10-16T21:41:00Z");
  assert.match(text, /17/);
  assert.match(text, /жовтня/);
  assert.match(text, /00:41/);
});

test("назви і тон статусів", () => {
  assert.equal(orderStatusLabel("NEW"), "Нове");
  assert.equal(orderStatusLabel("SHIPPED"), "Відправлено");
  assert.equal(orderStatusTone("CANCELLED"), "cancelled");
  assert.equal(orderStatusTone("COMPLETED"), "done");
  assert.equal(orderStatusTone("CONFIRMED"), "active");
});
