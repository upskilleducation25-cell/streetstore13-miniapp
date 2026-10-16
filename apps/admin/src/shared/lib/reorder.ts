import type { AdminSortOrderItem } from "@ss13/shared";

interface Sortable {
  id: string;
  sortOrder: number;
}

/**
 * Перемістити запис на одну позицію серед «сусідів» (список уже в порядку показу).
 * Повертає новий порядок усіх сусідів з кроком 10 — його зберігає PATCH …/order.
 */
export function moveAmong(
  siblings: Sortable[],
  id: string,
  delta: -1 | 1,
): AdminSortOrderItem[] | null {
  const index = siblings.findIndex((item) => item.id === id);
  const next = index + delta;
  if (index < 0 || next < 0 || next >= siblings.length) return null;
  const reordered = [...siblings];
  [reordered[index], reordered[next]] = [reordered[next]!, reordered[index]!];
  return reordered.map((item, i) => ({ id: item.id, sortOrder: (i + 1) * 10 }));
}
