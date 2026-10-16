import { ORDER_STATUS_LABELS, type OrderStatus } from "@ss13/shared";

const dateFormatter = new Intl.DateTimeFormat("uk-UA", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Kyiv",
});

/** "2026-10-16T21:41:00Z" → «17 жовтня 2026 р. о 00:41» (київський час). */
export const formatOrderDate = (iso: string): string => dateFormatter.format(new Date(iso));

export const orderStatusLabel = (status: OrderStatus): string => ORDER_STATUS_LABELS[status];

/** Фінальні статуси показуються приглушено, скасований — акцентом. */
export function orderStatusTone(status: OrderStatus): "active" | "done" | "cancelled" {
  if (status === "CANCELLED") return "cancelled";
  if (status === "COMPLETED") return "done";
  return "active";
}
