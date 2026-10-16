import type { AdminCategory, AdminSortOrderItem } from "@ss13/shared";

import { moveAmong } from "../../shared/lib/reorder";

export interface CategoryNode extends AdminCategory {
  children: AdminCategory[];
}

const bySort = (a: AdminCategory, b: AdminCategory) =>
  a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "uk");

/** Два рівні: розділи і їхні підкатегорії, у порядку sortOrder. */
export function buildTree(categories: AdminCategory[]): CategoryNode[] {
  return categories
    .filter((c) => c.parentId === null)
    .sort(bySort)
    .map((root) => ({
      ...root,
      children: categories.filter((c) => c.parentId === root.id).sort(bySort),
    }));
}

/** Перемістити категорію серед категорій з тим самим батьком. */
export function moveCategory(
  categories: AdminCategory[],
  id: string,
  delta: -1 | 1,
): AdminSortOrderItem[] | null {
  const target = categories.find((c) => c.id === id);
  if (!target) return null;
  return moveAmong(
    categories.filter((c) => c.parentId === target.parentId).sort(bySort),
    id,
    delta,
  );
}

/** Куди можна перенести категорію: тільки в розділ верхнього рівня, не в себе; з підкатегоріями — нікуди. */
export function parentOptions(
  categories: AdminCategory[],
  editing: AdminCategory | null,
): AdminCategory[] {
  if (editing && editing.childCount > 0) return [];
  return categories.filter((c) => c.parentId === null && c.id !== editing?.id).sort(bySort);
}
