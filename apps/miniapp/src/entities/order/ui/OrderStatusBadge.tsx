import type { OrderStatus } from "@ss13/shared";

import { orderStatusLabel, orderStatusTone } from "../format";

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const styles = {
    active: "border-fg text-fg",
    done: "border-line text-hint",
    cancelled: "border-sale text-sale",
  }[orderStatusTone(status)];
  return (
    <span
      className={`inline-flex h-6 items-center border px-2 text-[11px] uppercase tracking-[0.08em] ${styles}`}
    >
      {orderStatusLabel(status)}
    </span>
  );
}
