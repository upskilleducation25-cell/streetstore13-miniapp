// Значення мають збігатися з enum-ами в apps/api/prisma/schema.prisma.

export const ProductStatus = {
  DRAFT: "DRAFT",
  ACTIVE: "ACTIVE",
  HIDDEN: "HIDDEN",
  ARCHIVED: "ARCHIVED",
} as const;
export type ProductStatus = (typeof ProductStatus)[keyof typeof ProductStatus];

export const OrderStatus = {
  NEW: "NEW",
  CONFIRMED: "CONFIRMED",
  PACKED: "PACKED",
  SHIPPED: "SHIPPED",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const PaymentStatus = {
  NOT_REQUIRED: "NOT_REQUIRED",
  PENDING: "PENDING",
  PAID: "PAID",
  REFUNDED: "REFUNDED",
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const AdminRole = {
  OWNER: "OWNER",
  MANAGER: "MANAGER",
} as const;
export type AdminRole = (typeof AdminRole)[keyof typeof AdminRole];

export const SizeSystem = {
  CLOTHING: "CLOTHING",
  SHOES_EU: "SHOES_EU",
  ONE_SIZE: "ONE_SIZE",
  OTHER: "OTHER",
} as const;
export type SizeSystem = (typeof SizeSystem)[keyof typeof SizeSystem];

export const InventoryReason = {
  ORDER: "ORDER",
  CANCEL: "CANCEL",
  MANUAL: "MANUAL",
  IMPORT: "IMPORT",
} as const;
export type InventoryReason = (typeof InventoryReason)[keyof typeof InventoryReason];
