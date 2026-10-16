import assert from "node:assert/strict";
import { test } from "node:test";

import { SLUG_PATTERN, slugify } from "./slug.js";

test("slugify: українська → латиниця", () => {
  assert.equal(slugify("Пуховик Moncler Maya чорний"), "pukhovyk-moncler-maya-chornyi");
  assert.equal(slugify("Головні убори"), "holovni-ubory");
  assert.equal(slugify("Щастя, ґудзик і їжак"), "shchastia-gudzyk-i-izhak");
  assert.equal(slugify("Arc'teryx Beta LT"), "arcteryx-beta-lt");
  assert.equal(slugify("  --Café № 13--  "), "cafe-no-13");
});

test("slugify: результат відповідає SLUG_PATTERN або порожній", () => {
  for (const input of ["Худі", "A/B  c", "!!!", "Nike Tech Fleece 2026"]) {
    const slug = slugify(input);
    assert.ok(slug === "" || SLUG_PATTERN.test(slug), `${input} → ${slug}`);
  }
  assert.equal(slugify("!!!"), "");
});
