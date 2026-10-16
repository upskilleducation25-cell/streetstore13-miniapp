import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  apiFieldErrors,
  type CheckoutForm,
  initialCheckoutForm,
  newIdempotencyKey,
  toCreateOrderRequest,
  validateCheckout,
} from "./form";

const valid: CheckoutForm = {
  customerName: " Олена   Коваль ",
  customerPhone: "067 123 45 67",
  city: "Київ",
  deliveryServiceCode: "nova_poshta",
  deliveryPoint: "Відділення №1",
  comment: "",
};

describe("форма оформлення", () => {
  test("валідна форма без помилок; запит нормалізований, сума з кошика", () => {
    assert.deepEqual(validateCheckout(valid), {});
    assert.deepEqual(toCreateOrderRequest(valid, 649_900), {
      customerName: "Олена Коваль",
      customerPhone: "+380671234567",
      city: "Київ",
      deliveryServiceCode: "nova_poshta",
      deliveryPoint: "Відділення №1",
      expectedTotal: 649_900,
    });
    assert.equal(
      toCreateOrderRequest({ ...valid, comment: "  тиха доставка " }, 1).comment,
      "тиха доставка",
    );
  });

  test("обов'язкові поля і формат телефону", () => {
    const errors = validateCheckout({
      customerName: "О",
      customerPhone: "12345",
      city: " ",
      deliveryServiceCode: "",
      deliveryPoint: "",
      comment: "x".repeat(501),
    });
    assert.deepEqual(Object.keys(errors).sort(), [
      "city",
      "comment",
      "customerName",
      "customerPhone",
      "deliveryPoint",
      "deliveryServiceCode",
    ]);
  });

  test("автозаповнення з останнього замовлення або служба за замовчуванням", () => {
    assert.equal(initialCheckoutForm(undefined, "nova_poshta").deliveryServiceCode, "nova_poshta");
    const form = initialCheckoutForm(
      {
        customerName: "Олена",
        customerPhone: "+380671234567",
        city: "Львів",
        deliveryServiceCode: "meest",
        deliveryPoint: "Поштомат 12",
      },
      "nova_poshta",
    );
    assert.equal(form.deliveryServiceCode, "meest");
    assert.equal(form.city, "Львів");
  });

  test("помилки валідації з API прив'язуються до полів", () => {
    assert.deepEqual(
      apiFieldErrors([
        { field: "customerPhone", errors: ["Телефон у форматі +380XXXXXXXXX"] },
        { field: "unknown", errors: ["x"] },
      ]),
      { customerPhone: "Телефон у форматі +380XXXXXXXXX" },
    );
    assert.deepEqual(apiFieldErrors(undefined), {});
  });

  test("ключ ідемпотентності проходить серверну перевірку", () => {
    const keyValue = newIdempotencyKey(() => "123e4567-e89b-42d3-a456-426614174000");
    assert.match(keyValue, /^[A-Za-z0-9_-]{16,100}$/);
    assert.notEqual(newIdempotencyKey(), newIdempotencyKey());
  });
});
