// Контракти кошика, оформлення і замовлень (/api/v1/cart, /checkout, /orders).
// Гроші — цілі копійки (UAH). Ціни й суми завжди рахує сервер.

import type { OrderStatus, PaymentStatus } from "./enums.js";

/** Максимум штук одного варіанту в кошику і в замовленні. */
export const MAX_CART_LINE_QUANTITY = 20;
/** Максимум різних позицій у кошику. */
export const MAX_CART_LINES = 30;

export const CHECKOUT_LIMITS = {
  customerName: 100,
  city: 100,
  deliveryPoint: 200,
  comment: 500,
} as const;

/**
 * Стан позиції кошика відносно складу:
 * OK — можна оформити; INSUFFICIENT_STOCK — у кошику більше, ніж є;
 * UNAVAILABLE — товар прихований, варіант вимкнено або залишок 0.
 */
export type CartItemStatus = "OK" | "INSUFFICIENT_STOCK" | "UNAVAILABLE";

export interface CartItemView {
  id: string;
  variantId: string;
  productId: string;
  name: string;
  brand: string;
  sku: string;
  colorSlug: string;
  colorName: string;
  sizeLabel: string;
  image: string | null;
  /** Актуальна ціна за одиницю з бази. */
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  /** Скільки штук зараз можна купити (0, якщо недоступно). */
  stock: number;
  status: CartItemStatus;
}

export interface CartView {
  items: CartItemView[];
  /** Кількість штук у кошику (для лічильника). */
  count: number;
  /** Сума тільки позицій зі статусом OK. */
  subtotal: number;
  total: number;
  /** true, якщо кошик не порожній і всі позиції OK. */
  canCheckout: boolean;
}

export interface AddCartItemRequest {
  variantId: string;
  quantity: number;
}

export interface UpdateCartItemRequest {
  quantity: number;
}

export interface DeliveryServiceOption {
  code: string;
  name: string;
  supportsLockers: boolean;
}

export interface PaymentMethodOption {
  code: string;
  name: string;
}

export interface CheckoutPrefill {
  customerName: string | null;
  customerPhone: string | null;
  city: string | null;
  deliveryServiceCode: string | null;
  deliveryPoint: string | null;
}

export interface CheckoutOptions {
  deliveryServices: DeliveryServiceOption[];
  paymentMethods: PaymentMethodOption[];
  /** Дані з останнього замовлення покупця для автозаповнення. */
  prefill: CheckoutPrefill;
}

export interface CreateOrderRequest {
  customerName: string;
  customerPhone: string;
  city: string;
  deliveryServiceCode: string;
  deliveryPoint: string;
  comment?: string;
  paymentMethodCode?: string;
  /**
   * Сума, яку бачив покупець. Якщо сервер порахував іншу (змінилася ціна), замовлення
   * не створюється, повертається 409 PRICE_CHANGED.
   */
  expectedTotal?: number;
}

/** Позиція, через яку не вдалося оформити замовлення (details у 409). */
export interface CheckoutProblem {
  cartItemId: string;
  variantId: string;
  name: string;
  colorName: string;
  sizeLabel: string;
  requested: number;
  available: number;
}

export interface OrderItemView {
  id: string;
  productId: string | null;
  name: string;
  brand: string;
  sku: string;
  colorName: string;
  sizeLabel: string;
  image: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface OrderStatusHistoryEntry {
  status: OrderStatus;
  createdAt: string;
  comment: string | null;
}

export interface OrderSummary {
  number: string;
  status: OrderStatus;
  createdAt: string;
  itemsCount: number;
  total: number;
  /** До 3 фото позицій для прев'ю в списку. */
  images: string[];
}

export interface OrderDetail {
  number: string;
  status: OrderStatus;
  createdAt: string;
  customerName: string;
  customerPhone: string;
  city: string;
  deliveryService: DeliveryServiceOption;
  deliveryPoint: string;
  comment: string | null;
  trackingNumber: string | null;
  paymentMethod: PaymentMethodOption | null;
  paymentStatus: PaymentStatus;
  items: OrderItemView[];
  subtotal: number;
  discountTotal: number;
  deliveryCost: number;
  total: number;
  history: OrderStatusHistoryEntry[];
  /** Покупець може сам скасувати замовлення, поки менеджер його не підтвердив. */
  canCancel: boolean;
}

/** Відповідь POST /orders: created=false — повтор з тим самим Idempotency-Key. */
export interface CreateOrderResponse {
  created: boolean;
  order: OrderDetail;
}
