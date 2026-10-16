import assert from "node:assert/strict";
import { test } from "node:test";

import { formatUaPhone, normalizeUaPhone } from "./phone.js";

test("український номер у різних записах → +380XXXXXXXXX", () => {
  for (const input of [
    "+380671234567",
    "+380 67 123 45 67",
    "380671234567",
    "0671234567",
    "067-123-45-67",
    "(067) 123 45 67",
  ]) {
    assert.equal(normalizeUaPhone(input), "+380671234567", input);
  }
});

test("не український або неповний номер відхиляється", () => {
  for (const input of ["", "12345", "+48123456789", "+3800671234567", "0071234567", "067123456a"]) {
    assert.equal(normalizeUaPhone(input), null, input);
  }
});

test("форматування для людини", () => {
  assert.equal(formatUaPhone("+380671234567"), "+380 67 123 45 67");
  assert.equal(formatUaPhone("не номер"), "не номер");
});
