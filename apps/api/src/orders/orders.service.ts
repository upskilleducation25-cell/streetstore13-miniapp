import { HttpStatus, Injectable } from "@nestjs/common";
import type {
  CheckoutOptions,
  CheckoutProblem,
  CreateOrderResponse,
  OrderDetail,
  OrderSummary,
  Paginated,
} from "@ss13/shared";
import { canTransitionOrder, OrderStatus as SharedOrderStatus } from "@ss13/shared";

import {
  availableStock,
  calculateTotals,
  imageOf,
  unitPriceOf,
  variantForSaleInclude,
} from "../cart/cart-rules.js";
import { AppException, notFound } from "../common/app-exception.js";
import { isUuid } from "../common/uuid.js";
import type { User } from "../generated/prisma/client.js";
import { InventoryReason, OrderStatus, Prisma } from "../generated/prisma/client.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import type { CreateOrderDto, OrdersQueryDto } from "./dto.js";
import { orderDetailInclude, type OrderWithDetails, toOrderDetail } from "./order.mapper.js";

export const ORDER_NUMBER_PREFIX = "SS13-";

type Tx = Prisma.TransactionClient;

const orderNotFound = () => notFound("ORDER_NOT_FOUND", "Замовлення не знайдено");

/** Повтор з тим самим Idempotency-Key, який уже створив замовлення. */
class IdempotentReplay {
  constructor(readonly orderId: string) {}
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async getCheckoutOptions(user: User): Promise<CheckoutOptions> {
    const [deliveryServices, paymentMethods, lastOrder] = await Promise.all([
      this.prisma.deliveryService.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      this.prisma.paymentMethod.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      this.prisma.order.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        include: { deliveryService: true },
      }),
    ]);
    const telegramName = [user.firstName, user.lastName].filter(Boolean).join(" ") || null;
    return {
      deliveryServices: deliveryServices.map((service) => ({
        code: service.code,
        name: service.name,
        supportsLockers: service.supportsLockers,
      })),
      paymentMethods: paymentMethods.map((method) => ({ code: method.code, name: method.name })),
      prefill: {
        customerName: lastOrder?.customerName ?? telegramName,
        customerPhone: lastOrder?.customerPhone ?? user.phone,
        city: lastOrder?.city ?? null,
        deliveryServiceCode: lastOrder?.deliveryService.isActive
          ? lastOrder.deliveryService.code
          : null,
        deliveryPoint: lastOrder?.deliveryPoint ?? null,
      },
    };
  }

  /**
   * Оформлення замовлення з кошика покупця. Одна транзакція: блокування, перевірка складу,
   * ціни з бази, списання залишків, журнал складу, замовлення зі знімком позицій, історія
   * статусу, очищення кошика. Сповіщення — тільки після commit.
   */
  async createOrder(
    user: User,
    dto: CreateOrderDto,
    idempotencyKey: string,
  ): Promise<CreateOrderResponse> {
    const existing = await this.prisma.order.findUnique({ where: { idempotencyKey } });
    if (existing) return this.replay(user, existing.id);

    const [deliveryService, paymentMethod] = await Promise.all([
      this.prisma.deliveryService.findFirst({
        where: { code: dto.deliveryServiceCode, isActive: true },
      }),
      this.prisma.paymentMethod.findFirst({
        where: {
          isActive: true,
          ...(dto.paymentMethodCode ? { code: dto.paymentMethodCode } : {}),
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
    ]);
    if (!deliveryService) {
      throw new AppException(
        "VALIDATION_ERROR",
        "Оберіть службу доставки зі списку",
        HttpStatus.BAD_REQUEST,
        [{ field: "deliveryServiceCode", errors: ["Невідома або вимкнена служба доставки"] }],
      );
    }
    if (dto.paymentMethodCode && !paymentMethod) {
      throw new AppException(
        "VALIDATION_ERROR",
        "Оберіть спосіб оплати зі списку",
        HttpStatus.BAD_REQUEST,
        [{ field: "paymentMethodCode", errors: ["Невідомий або вимкнений спосіб оплати"] }],
      );
    }

    let orderId: string;
    try {
      orderId = await this.prisma.$transaction(
        (tx) =>
          this.placeOrder(tx, user, dto, idempotencyKey, deliveryService.id, paymentMethod?.id),
        { timeout: 15_000, maxWait: 10_000 },
      );
    } catch (error) {
      if (error instanceof IdempotentReplay) return this.replay(user, error.orderId);
      // Паралельний запит з тим самим ключем устиг створити замовлення першим.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const winner = await this.prisma.order.findUnique({ where: { idempotencyKey } });
        if (winner) return this.replay(user, winner.id);
      }
      throw error;
    }

    this.notifications.orderCreated(orderId);
    return { created: true, order: await this.loadDetail(orderId) };
  }

  private async placeOrder(
    tx: Tx,
    user: User,
    dto: CreateOrderDto,
    idempotencyKey: string,
    deliveryServiceId: string,
    paymentMethodId: string | undefined,
  ): Promise<string> {
    // 1. Один checkout покупця за раз: другий запит чекає, поки перший закінчиться.
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${user.id}::uuid FOR UPDATE`;
    const replay = await tx.order.findUnique({
      where: { idempotencyKey },
      select: { id: true },
    });
    if (replay) throw new IdempotentReplay(replay.id);

    const cartItems = await tx.cartItem.findMany({
      where: { userId: user.id },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    if (cartItems.length === 0) {
      throw new AppException("CART_EMPTY", "Кошик порожній", HttpStatus.CONFLICT);
    }

    // 2. Блокуємо варіанти в однаковому порядку (за id), щоб не було взаємоблокувань.
    const variantIds = [...new Set(cartItems.map((item) => item.variantId))].sort();
    await tx.$queryRaw`
      SELECT id FROM product_variants
      WHERE id = ANY(${variantIds}::uuid[])
      ORDER BY id
      FOR UPDATE
    `;
    // Після блокування читаємо актуальні дані: залишок, ціну, статус товару.
    const variants = await tx.productVariant.findMany({
      where: { id: { in: variantIds } },
      include: variantForSaleInclude,
    });
    const variantById = new Map(variants.map((variant) => [variant.id, variant]));

    // 3. Перевірка наявності кожної позиції.
    const problems: CheckoutProblem[] = [];
    for (const item of cartItems) {
      const variant = variantById.get(item.variantId);
      const available = variant ? availableStock(variant) : 0;
      if (!variant || item.quantity > available) {
        problems.push({
          cartItemId: item.id,
          variantId: item.variantId,
          name: variant ? `${variant.product.brand.name} ${variant.product.name}` : "Товар",
          colorName: variant?.color.name ?? "",
          sizeLabel: variant?.size.label ?? "",
          requested: item.quantity,
          available,
        });
      }
    }
    if (problems.length > 0) {
      throw new AppException(
        "CART_ITEMS_UNAVAILABLE",
        "Деяких товарів уже немає в потрібній кількості. Оновіть кошик.",
        HttpStatus.CONFLICT,
        { problems },
      );
    }

    // 4. Ціни — тільки з бази.
    const lines = cartItems.map((item) => {
      const variant = variantById.get(item.variantId)!;
      const unitPrice = unitPriceOf(variant);
      return { item, variant, unitPrice, quantity: item.quantity };
    });
    const totals = calculateTotals(lines);
    if (dto.expectedTotal !== undefined && dto.expectedTotal !== totals.total) {
      throw new AppException(
        "PRICE_CHANGED",
        "Ціни в кошику змінилися. Перевірте суму й підтвердіть замовлення ще раз.",
        HttpStatus.CONFLICT,
        { expectedTotal: dto.expectedTotal, total: totals.total },
      );
    }

    // 5. Списання залишків. Умова stock >= quantity — другий рубіж після блокування;
    // CHECK (stock >= 0) у БД — третій.
    for (const { variant, quantity } of lines) {
      const { count } = await tx.productVariant.updateMany({
        where: { id: variant.id, stock: { gte: quantity } },
        data: { stock: { decrement: quantity } },
      });
      if (count !== 1) throw new Error("Залишок змінився під час оформлення");
    }

    // 6. Замовлення зі знімком позицій і першим рядком історії статусів.
    const [{ next }] = await tx.$queryRaw<
      [{ next: bigint }]
    >`SELECT nextval('order_number_seq') AS next`;
    const order = await tx.order.create({
      data: {
        number: `${ORDER_NUMBER_PREFIX}${next}`,
        userId: user.id,
        status: OrderStatus.NEW,
        customerName: dto.customerName,
        customerPhone: dto.customerPhone,
        city: dto.city,
        deliveryServiceId,
        deliveryPoint: dto.deliveryPoint,
        comment: dto.comment || null,
        subtotal: totals.subtotal,
        discountTotal: totals.discountTotal,
        deliveryCost: totals.deliveryCost,
        total: totals.total,
        paymentMethodId: paymentMethodId ?? null,
        idempotencyKey,
        items: {
          create: lines.map(({ variant, unitPrice, quantity }, position) => ({
            position,
            productId: variant.productId,
            variantId: variant.id,
            productName: variant.product.name,
            brandName: variant.product.brand.name,
            sku: variant.sku ?? variant.product.sku,
            colorName: variant.color.name,
            sizeLabel: variant.size.label,
            imageUrl: imageOf(variant),
            unitPrice,
            quantity,
            lineTotal: unitPrice * quantity,
          })),
        },
        statusHistory: { create: { fromStatus: null, toStatus: OrderStatus.NEW } },
      },
      select: { id: true },
    });

    await tx.inventoryMovement.createMany({
      data: lines.map(({ variant, quantity }) => ({
        variantId: variant.id,
        delta: -quantity,
        reason: InventoryReason.ORDER,
        orderId: order.id,
      })),
    });

    // 7. Кошик очищається, телефон запам'ятовується для автозаповнення.
    await tx.cartItem.deleteMany({ where: { userId: user.id } });
    await tx.user.update({ where: { id: user.id }, data: { phone: dto.customerPhone } });
    return order.id;
  }

  private async replay(user: User, orderId: string): Promise<CreateOrderResponse> {
    const order = await this.loadDetail(orderId, user.id);
    if (!order) {
      // Ключ належить чужому замовленню: нічого про нього не розкриваємо.
      throw new AppException(
        "IDEMPOTENCY_KEY_CONFLICT",
        "Цей Idempotency-Key уже використано",
        HttpStatus.CONFLICT,
      );
    }
    return { created: false, order };
  }

  private async loadDetail(orderId: string): Promise<OrderDetail>;
  private async loadDetail(orderId: string, userId: string): Promise<OrderDetail | null>;
  private async loadDetail(orderId: string, userId?: string): Promise<OrderDetail | null> {
    const order: OrderWithDetails | null = await this.prisma.order.findFirst({
      where: { id: orderId, ...(userId ? { userId } : {}) },
      include: orderDetailInclude,
    });
    if (!order && !userId) throw orderNotFound();
    return order ? toOrderDetail(order) : null;
  }

  async listOrders(user: User, query: OrdersQueryDto): Promise<Paginated<OrderSummary>> {
    const cursor = query.cursor && isUuid(query.cursor) ? query.cursor : undefined;
    if (query.cursor && !cursor) return { items: [], nextCursor: null };
    const rows = await this.prisma.order.findMany({
      where: { userId: user.id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: query.limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        items: {
          select: { quantity: true, imageUrl: true },
          orderBy: [{ position: "asc" }, { id: "asc" }],
        },
      },
    });
    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    return {
      items: page.map((order) => ({
        number: order.number,
        status: order.status,
        createdAt: order.createdAt.toISOString(),
        itemsCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
        total: order.total,
        images: order.items
          .map((item) => item.imageUrl)
          .filter((url): url is string => Boolean(url))
          .slice(0, 3),
      })),
      nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
    };
  }

  /** Деталі тільки власного замовлення; чуже відповідає так само, як неіснуюче (404). */
  async getOrder(user: User, number: string): Promise<OrderDetail> {
    const order = await this.prisma.order.findFirst({
      where: { number, userId: user.id },
      include: orderDetailInclude,
    });
    if (!order) throw orderNotFound();
    return toOrderDetail(order);
  }

  /**
   * Скасування покупцем — тільки поки замовлення «Нове». У тій самій транзакції:
   * статус, історія, повернення залишків, журнал складу (reason = CANCEL).
   */
  async cancelOrder(user: User, number: string): Promise<OrderDetail> {
    const orderId = await this.prisma.$transaction(
      async (tx) => {
        const [locked] = await tx.$queryRaw<Array<{ id: string; status: OrderStatus }>>`
          SELECT id, status FROM orders
          WHERE number = ${number} AND user_id = ${user.id}::uuid
          FOR UPDATE
        `;
        if (!locked) throw orderNotFound();
        if (
          locked.status !== OrderStatus.NEW ||
          !canTransitionOrder(locked.status, SharedOrderStatus.CANCELLED)
        ) {
          throw new AppException(
            "ORDER_CANNOT_BE_CANCELLED",
            "Це замовлення вже не можна скасувати самостійно. Напишіть менеджеру.",
            HttpStatus.CONFLICT,
            { status: locked.status },
          );
        }

        const items = await tx.orderItem.findMany({ where: { orderId: locked.id } });
        const returns = new Map<string, number>();
        for (const item of items) {
          if (item.variantId) {
            returns.set(item.variantId, (returns.get(item.variantId) ?? 0) + item.quantity);
          }
        }
        const variantIds = [...returns.keys()].sort();
        if (variantIds.length > 0) {
          await tx.$queryRaw`
            SELECT id FROM product_variants
            WHERE id = ANY(${variantIds}::uuid[])
            ORDER BY id
            FOR UPDATE
          `;
          for (const variantId of variantIds) {
            await tx.productVariant.update({
              where: { id: variantId },
              data: { stock: { increment: returns.get(variantId)! } },
            });
          }
          await tx.inventoryMovement.createMany({
            data: variantIds.map((variantId) => ({
              variantId,
              delta: returns.get(variantId)!,
              reason: InventoryReason.CANCEL,
              orderId: locked.id,
            })),
          });
        }

        await tx.order.update({
          where: { id: locked.id },
          data: { status: OrderStatus.CANCELLED },
        });
        await tx.orderStatusHistory.create({
          data: {
            orderId: locked.id,
            fromStatus: OrderStatus.NEW,
            toStatus: OrderStatus.CANCELLED,
            comment: "Скасовано покупцем",
          },
        });
        return locked.id;
      },
      { timeout: 15_000, maxWait: 10_000 },
    );

    this.notifications.orderCancelledByBuyer(orderId);
    return this.loadDetail(orderId);
  }
}
