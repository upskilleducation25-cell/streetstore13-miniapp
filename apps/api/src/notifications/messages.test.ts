import assert from "node:assert/strict";
import { test } from "node:test";

import {
  adminOrderCancelledMessage,
  adminOrderCreatedMessage,
  buyerOrderCancelledMessage,
  buyerOrderCreatedMessage,
  type OrderMessageData,
} from "./messages.js";

const order: OrderMessageData = {
  number: "SS13-10024",
  total: 1_349_800,
  items: [
    {
      brand: "Moncler",
      name: "Пуховик",
      colorName: "Чорний",
      sizeLabel: "M",
      quantity: 1,
      lineTotal: 1_299_900,
    },
    {
      brand: "Nike",
      name: "Шкарпетки",
      colorName: "Білий",
      sizeLabel: "ONE SIZE",
      quantity: 1,
      lineTotal: 49_900,
    },
  ],
  customerName: "Олена",
  customerPhone: "+380671234567",
  city: "Львів",
  deliveryServiceName: "Нова Пошта",
  deliveryPoint: "Відділення №5",
  comment: "<b>не HTML</b>",
  telegramUsername: null,
  telegramId: "777000111",
};

const uah = (text: string) => text.replace(/[\u00a0\u202f]/g, " ");

test("покупцю: номер, позиції, сума, доставка", () => {
  const text = uah(buyerOrderCreatedMessage(order));
  assert.match(text, /Замовлення № SS13-10024 прийнято/);
  assert.match(text, /Moncler Пуховик — Чорний, M × 1 — 12 999 ₴/);
  assert.match(text, /Разом: 13 498 ₴/);
  assert.match(text, /Нова Пошта, Львів, Відділення №5/);
  assert.ok(!text.includes("+380"), "телефон покупцю не дублюємо");
});

test("власнику: контакти, кількість позицій, коментар як звичайний текст", () => {
  const text = uah(adminOrderCreatedMessage(order));
  assert.match(text, /Нове замовлення № SS13-10024/);
  assert.match(text, /2 поз\., 2 шт\., 13 498 ₴/);
  assert.match(text, /Олена, \+380 67 123 45 67, Telegram ID 777000111/);
  assert.match(text, /Коментар: <b>не HTML<\/b>/);
  assert.match(uah(adminOrderCreatedMessage({ ...order, telegramUsername: "olena" })), /@olena/);
});

test("скасування", () => {
  assert.match(buyerOrderCancelledMessage(order), /SS13-10024 скасовано/);
  assert.match(adminOrderCancelledMessage(order), /Покупець скасував замовлення № SS13-10024/);
});
