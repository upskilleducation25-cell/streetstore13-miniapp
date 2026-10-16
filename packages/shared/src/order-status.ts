import { OrderStatus } from "./enums.js";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  NEW: "Нове",
  CONFIRMED: "Підтверджено",
  PACKED: "Зібрано",
  SHIPPED: "Відправлено",
  COMPLETED: "Виконано",
  CANCELLED: "Скасовано",
};

/** Дозволені переходи статусів. Сервер відхиляє будь-який інший перехід. */
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  NEW: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  CONFIRMED: [OrderStatus.PACKED, OrderStatus.CANCELLED],
  PACKED: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  SHIPPED: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_STATUS_TRANSITIONS[from].includes(to);
}
