import type { CheckoutPrefill, CreateOrderRequest } from "@ss13/shared";
import { CHECKOUT_LIMITS, normalizeUaPhone } from "@ss13/shared";

import { t } from "../../shared/strings";

export interface CheckoutForm {
  customerName: string;
  customerPhone: string;
  city: string;
  deliveryServiceCode: string;
  deliveryPoint: string;
  comment: string;
}

export type CheckoutField = keyof CheckoutForm;
export type CheckoutErrors = Partial<Record<CheckoutField, string>>;

const FIELDS: CheckoutField[] = [
  "customerName",
  "customerPhone",
  "city",
  "deliveryServiceCode",
  "deliveryPoint",
  "comment",
];

const squash = (value: string) => value.replace(/\s+/g, " ").trim();

export function initialCheckoutForm(
  prefill: CheckoutPrefill | undefined,
  defaultDeliveryCode: string | undefined,
): CheckoutForm {
  return {
    customerName: prefill?.customerName ?? "",
    customerPhone: prefill?.customerPhone ?? "",
    city: prefill?.city ?? "",
    deliveryServiceCode: prefill?.deliveryServiceCode ?? defaultDeliveryCode ?? "",
    deliveryPoint: prefill?.deliveryPoint ?? "",
    comment: "",
  };
}

/** Ті самі правила, що й у CreateOrderDto на сервері (сервер усе одно перевіряє ще раз). */
export function validateCheckout(form: CheckoutForm): CheckoutErrors {
  const errors: CheckoutErrors = {};
  const name = squash(form.customerName);
  if (name.length < 2) errors.customerName = t.checkout.errors.name;
  else if (name.length > CHECKOUT_LIMITS.customerName) {
    errors.customerName = t.checkout.errors.tooLong(CHECKOUT_LIMITS.customerName);
  }
  if (!normalizeUaPhone(form.customerPhone)) errors.customerPhone = t.checkout.errors.phone;
  const city = squash(form.city);
  if (city.length < 2) errors.city = t.checkout.errors.city;
  else if (city.length > CHECKOUT_LIMITS.city) {
    errors.city = t.checkout.errors.tooLong(CHECKOUT_LIMITS.city);
  }
  if (!form.deliveryServiceCode) errors.deliveryServiceCode = t.checkout.errors.deliveryService;
  const point = squash(form.deliveryPoint);
  if (!point) errors.deliveryPoint = t.checkout.errors.deliveryPoint;
  else if (point.length > CHECKOUT_LIMITS.deliveryPoint) {
    errors.deliveryPoint = t.checkout.errors.tooLong(CHECKOUT_LIMITS.deliveryPoint);
  }
  if (form.comment.trim().length > CHECKOUT_LIMITS.comment) {
    errors.comment = t.checkout.errors.tooLong(CHECKOUT_LIMITS.comment);
  }
  return errors;
}

export function toCreateOrderRequest(
  form: CheckoutForm,
  expectedTotal: number,
): CreateOrderRequest {
  const comment = form.comment.trim();
  return {
    customerName: squash(form.customerName),
    customerPhone: normalizeUaPhone(form.customerPhone) ?? form.customerPhone.trim(),
    city: squash(form.city),
    deliveryServiceCode: form.deliveryServiceCode,
    deliveryPoint: squash(form.deliveryPoint),
    ...(comment ? { comment } : {}),
    expectedTotal,
  };
}

/** details помилки VALIDATION_ERROR ([{ field, errors }]) → помилки полів форми. */
export function apiFieldErrors(details: unknown): CheckoutErrors {
  if (!Array.isArray(details)) return {};
  const errors: CheckoutErrors = {};
  for (const entry of details as Array<{ field?: unknown; errors?: unknown }>) {
    const field = entry?.field as CheckoutField;
    if (FIELDS.includes(field) && Array.isArray(entry.errors) && entry.errors.length > 0) {
      errors[field] = String(entry.errors[0]);
    }
  }
  return errors;
}

/** Ключ однієї спроби оформлення: повтор (подвійне натискання, обрив мережі) не створить друге замовлення. */
export function newIdempotencyKey(random: () => string = () => crypto.randomUUID()): string {
  return `ma-${random()}`;
}
