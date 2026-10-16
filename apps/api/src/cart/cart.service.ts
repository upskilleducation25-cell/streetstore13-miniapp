import { HttpStatus, Injectable } from "@nestjs/common";
import type { CartItemView, CartView } from "@ss13/shared";
import { MAX_CART_LINE_QUANTITY, MAX_CART_LINES } from "@ss13/shared";

import { AppException, notFound } from "../common/app-exception.js";
import { isUuid } from "../common/uuid.js";
import type { User } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";
import {
  availableStock,
  calculateTotals,
  imageOf,
  isPurchasable,
  lineStatus,
  unitPriceOf,
  type VariantForSale,
  variantForSaleInclude,
} from "./cart-rules.js";

export function toCartItemView(item: {
  id: string;
  quantity: number;
  variant: VariantForSale;
}): CartItemView {
  const { variant } = item;
  const stock = availableStock(variant);
  const unitPrice = unitPriceOf(variant);
  return {
    id: item.id,
    variantId: variant.id,
    productId: variant.productId,
    name: variant.product.name,
    brand: variant.product.brand.name,
    sku: variant.product.sku,
    colorSlug: variant.color.slug,
    colorName: variant.color.name,
    sizeLabel: variant.size.label,
    image: imageOf(variant),
    unitPrice,
    quantity: item.quantity,
    lineTotal: unitPrice * item.quantity,
    stock,
    status: lineStatus(item.quantity, stock),
  };
}

export function toCartView(items: CartItemView[]): CartView {
  const ok = items.filter((item) => item.status === "OK");
  const totals = calculateTotals(ok);
  return {
    items,
    count: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: totals.subtotal,
    total: totals.total,
    canCheckout: items.length > 0 && ok.length === items.length,
  };
}

const variantNotFound = () =>
  notFound("VARIANT_NOT_FOUND", "Товар не знайдено або він більше не продається");
const cartItemNotFound = () => notFound("CART_ITEM_NOT_FOUND", "Позицію в кошику не знайдено");

function insufficientStock(available: number, inCart: number): AppException {
  return new AppException(
    available > 0 ? "INSUFFICIENT_STOCK" : "OUT_OF_STOCK",
    available > 0 ? `Доступно лише ${available} шт.` : "Цього розміру вже немає в наявності",
    HttpStatus.CONFLICT,
    { available, inCart },
  );
}

/**
 * Серверний кошик покупця. Ціни й наявність у відповіді завжди актуальні (з бази);
 * остаточну перевірку зі складом робить транзакція оформлення замовлення.
 */
@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  async getCart(user: User): Promise<CartView> {
    const items = await this.prisma.cartItem.findMany({
      where: { userId: user.id },
      include: { variant: { include: variantForSaleInclude } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    return toCartView(items.map(toCartItemView));
  }

  async addItem(user: User, variantId: string, quantity: number): Promise<CartView> {
    const variant = isUuid(variantId)
      ? await this.prisma.productVariant.findUnique({
          where: { id: variantId },
          include: variantForSaleInclude,
        })
      : null;
    // Прихований товар чи вимкнений варіант відповідає так само, як неіснуючий.
    if (!variant || !isPurchasable(variant)) throw variantNotFound();

    const existing = await this.prisma.cartItem.findUnique({
      where: { userId_variantId: { userId: user.id, variantId } },
    });
    const inCart = existing?.quantity ?? 0;
    const next = inCart + quantity;
    const available = availableStock(variant);

    if (!existing) {
      const lines = await this.prisma.cartItem.count({ where: { userId: user.id } });
      if (lines >= MAX_CART_LINES) {
        throw new AppException(
          "CART_FULL",
          `У кошику може бути не більше ${MAX_CART_LINES} позицій`,
          HttpStatus.CONFLICT,
        );
      }
    }
    if (next > available) throw insufficientStock(available, inCart);
    if (next > MAX_CART_LINE_QUANTITY) {
      throw new AppException(
        "QUANTITY_LIMIT",
        `Не більше ${MAX_CART_LINE_QUANTITY} шт. одного товару`,
        HttpStatus.CONFLICT,
        { max: MAX_CART_LINE_QUANTITY, inCart },
      );
    }

    await this.prisma.cartItem.upsert({
      where: { userId_variantId: { userId: user.id, variantId } },
      create: { userId: user.id, variantId, quantity },
      update: { quantity: { increment: quantity } },
    });
    return this.getCart(user);
  }

  async updateItem(user: User, itemId: string, quantity: number): Promise<CartView> {
    const item = isUuid(itemId)
      ? await this.prisma.cartItem.findFirst({
          where: { id: itemId, userId: user.id },
          include: { variant: { include: variantForSaleInclude } },
        })
      : null;
    if (!item) throw cartItemNotFound();

    const available = availableStock(item.variant);
    if (quantity > available) throw insufficientStock(available, item.quantity);

    await this.prisma.cartItem.updateMany({
      where: { id: item.id, userId: user.id },
      data: { quantity },
    });
    return this.getCart(user);
  }

  async removeItem(user: User, itemId: string): Promise<CartView> {
    const { count } = isUuid(itemId)
      ? await this.prisma.cartItem.deleteMany({ where: { id: itemId, userId: user.id } })
      : { count: 0 };
    if (count === 0) throw cartItemNotFound();
    return this.getCart(user);
  }
}
