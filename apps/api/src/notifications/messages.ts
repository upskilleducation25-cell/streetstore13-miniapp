// Тексти повідомлень бота. Звичайний текст без parse_mode: дані покупця (ім'я, коментар)
// не можуть зламати розмітку чи підставити посилання.
import { formatUah, formatUaPhone } from "@ss13/shared";

export interface OrderMessageData {
  number: string;
  total: number;
  items: Array<{
    brand: string;
    name: string;
    colorName: string;
    sizeLabel: string;
    quantity: number;
    lineTotal: number;
  }>;
  customerName: string;
  customerPhone: string;
  city: string;
  deliveryServiceName: string;
  deliveryPoint: string;
  comment: string | null;
  telegramUsername: string | null;
  telegramId: string;
}

const itemLines = (order: OrderMessageData) =>
  order.items.map(
    (item) =>
      `• ${item.brand} ${item.name} — ${item.colorName}, ${item.sizeLabel} × ${item.quantity} — ${formatUah(item.lineTotal)}`,
  );

const pieces = (order: OrderMessageData) =>
  order.items.reduce((sum, item) => sum + item.quantity, 0);

const delivery = (order: OrderMessageData) =>
  `${order.deliveryServiceName}, ${order.city}, ${order.deliveryPoint}`;

export function buyerOrderCreatedMessage(order: OrderMessageData): string {
  return [
    `✅ Замовлення № ${order.number} прийнято`,
    "",
    ...itemLines(order),
    `Разом: ${formatUah(order.total)}`,
    "",
    `Доставка: ${delivery(order)}`,
    "Вартість доставки — за тарифом перевізника.",
    "",
    "Менеджер зв'яжеться з вами, щоб підтвердити замовлення й домовитися про оплату. Статус замовлення — у розділі «Мої замовлення».",
  ].join("\n");
}

export function buyerOrderCancelledMessage(order: OrderMessageData): string {
  return [
    `Замовлення № ${order.number} скасовано.`,
    "Якщо це помилка, оформіть замовлення ще раз або напишіть нам.",
  ].join("\n");
}

function customerLine(order: OrderMessageData): string {
  const telegram = order.telegramUsername
    ? `@${order.telegramUsername}`
    : `Telegram ID ${order.telegramId}`;
  return `Покупець: ${order.customerName}, ${formatUaPhone(order.customerPhone)}, ${telegram}`;
}

export function adminOrderCreatedMessage(order: OrderMessageData): string {
  return [
    `🆕 Нове замовлення № ${order.number}`,
    `${order.items.length} поз., ${pieces(order)} шт., ${formatUah(order.total)}`,
    "",
    customerLine(order),
    `Доставка: ${delivery(order)}`,
    ...(order.comment ? [`Коментар: ${order.comment}`] : []),
    "",
    ...itemLines(order),
  ].join("\n");
}

export function adminOrderCancelledMessage(order: OrderMessageData): string {
  return [
    `❌ Покупець скасував замовлення № ${order.number}`,
    `${formatUah(order.total)}. Залишки повернено на склад.`,
    customerLine(order),
  ].join("\n");
}
