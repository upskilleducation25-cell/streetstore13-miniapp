import assert from "node:assert/strict";
import { test } from "node:test";

import type { AdminCategory } from "@ss13/shared";

import { buildTree, moveCategory, parentOptions } from "./category-tree";

const cat = (
  id: string,
  parentId: string | null,
  sortOrder: number,
  childCount = 0,
): AdminCategory => ({
  id,
  parentId,
  name: id,
  slug: id,
  icon: null,
  imageUrl: null,
  sortOrder,
  isActive: true,
  productCount: 0,
  childCount,
});

const list = [cat("b", null, 20), cat("a", null, 10, 2), cat("a2", "a", 20), cat("a1", "a", 10)];

test("дерево: розділи і підкатегорії за порядком", () => {
  const tree = buildTree(list);
  assert.deepEqual(
    tree.map((n) => n.id),
    ["a", "b"],
  );
  assert.deepEqual(
    tree[0]!.children.map((c) => c.id),
    ["a1", "a2"],
  );
});

test("переміщення серед сусідів з новою нумерацією", () => {
  assert.deepEqual(moveCategory(list, "b", -1), [
    { id: "b", sortOrder: 10 },
    { id: "a", sortOrder: 20 },
  ]);
  assert.deepEqual(moveCategory(list, "a2", -1), [
    { id: "a2", sortOrder: 10 },
    { id: "a1", sortOrder: 20 },
  ]);
  assert.equal(moveCategory(list, "a", -1), null);
  assert.equal(moveCategory(list, "a2", 1), null);
});

test("батьком може бути тільки інший розділ; категорію з підкатегоріями не вкладаємо", () => {
  assert.deepEqual(
    parentOptions(list, list[0]!).map((c) => c.id),
    ["a"],
  );
  assert.deepEqual(parentOptions(list, list[1]!), []);
  assert.deepEqual(
    parentOptions(list, null).map((c) => c.id),
    ["a", "b"],
  );
});
