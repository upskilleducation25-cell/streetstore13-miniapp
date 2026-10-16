import type { OrderDetail } from "@ss13/shared";
import { canTransitionOrder, OrderStatus } from "@ss13/shared";

import type { Prisma } from "../generated/prisma/client.js";

export const orderDetailInclude = {
  items: { orderBy: [{ position: "asc" }, { id: "asc" }] },
  statusHistory: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
  deliveryService: true,
  paymentMethod: true,
} satisfies Prisma.OrderInclude;

export type OrderWithDetails = Prisma.OrderGetPayload<{ include: typeof orderDetailInclude }>;

/** Відображення замовлення — зі знімка позицій, а не з поточних товарів. */
export function toOrderDetail(order: OrderWithDetails): OrderDetail {
  return {
    number: order.number,
    status: order.status,
    createdAt: order.createdAt.toISOString(),
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    city: order.city,
    deliveryService: {
      code: order.deliveryService.code,
      name: order.deliveryService.name,
      supportsLockers: order.deliveryService.supportsLockers,
    },
    deliveryPoint: order.deliveryPoint,
    comment: order.comment,
    trackingNumber: order.trackingNumber,
    paymentMethod: order.paymentMethod
      ? { code: order.paymentMethod.code, name: order.paymentMethod.name }
      : null,
    paymentStatus: order.paymentStatus,
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      name: item.productName,
      brand: item.brandName,
      sku: item.sku,
      colorName: item.colorName,
      sizeLabel: item.sizeLabel,
      image: item.imageUrl,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      lineTotal: item.lineTotal,
    })),
    subtotal: order.subtotal,
    discountTotal: order.discountTotal,
    deliveryCost: order.deliveryCost,
    total: order.total,
    // Без admin_id: покупцю не потрібно знати, хто з менеджерів змінив статус.
    history: order.statusHistory.map((entry) => ({
      status: entry.toStatus,
      createdAt: entry.createdAt.toISOString(),
      comment: entry.comment,
    })),
    canCancel:
      order.status === OrderStatus.NEW && canTransitionOrder(order.status, OrderStatus.CANCELLED),
  };
}
