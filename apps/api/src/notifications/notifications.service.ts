import type { OnModuleDestroy } from "@nestjs/common";
import { Inject, Injectable, Logger } from "@nestjs/common";

import { ENV } from "../config/config.module.js";
import type { Env } from "../config/env.js";
import { NotificationStatus } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";
import {
  adminOrderCancelledMessage,
  adminOrderCreatedMessage,
  buyerOrderCancelledMessage,
  buyerOrderCreatedMessage,
  type OrderMessageData,
} from "./messages.js";
import {
  type SendMessageOptions,
  TelegramBotClient,
  TelegramSendError,
} from "./telegram-bot.client.js";

export const NotificationType = {
  ORDER_CREATED_BUYER: "ORDER_CREATED_BUYER",
  ORDER_CREATED_ADMIN: "ORDER_CREATED_ADMIN",
  ORDER_CANCELLED_BUYER: "ORDER_CANCELLED_BUYER",
  ORDER_CANCELLED_ADMIN: "ORDER_CANCELLED_ADMIN",
} as const;
type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

/** Довжина тексту помилки в notification_log. */
const MAX_ERROR_LENGTH = 500;

/**
 * Сповіщення в Telegram про замовлення. Викликається тільки ПІСЛЯ commit транзакції
 * і ніколи не кидає помилку назовні: збій бота не скасовує замовлення.
 * Кожна спроба пишеться в notification_log (SENT / FAILED з причиною).
 */
@Injectable()
export class NotificationsService implements OnModuleDestroy {
  private readonly logger = new Logger("Notifications");
  private readonly client: TelegramBotClient | null;
  private readonly inFlight = new Set<Promise<void>>();

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly prisma: PrismaService,
  ) {
    this.client = env.TELEGRAM_BOT_TOKEN
      ? new TelegramBotClient({
          token: env.TELEGRAM_BOT_TOKEN,
          baseUrl: env.TELEGRAM_API_BASE_URL,
        })
      : null;
  }

  /** Нове замовлення: покупцю і в чат власника. Не блокує відповідь API. */
  orderCreated(orderId: string): void {
    this.track(
      this.notifyOrder(orderId, {
        buyer: [NotificationType.ORDER_CREATED_BUYER, buyerOrderCreatedMessage],
        admin: [NotificationType.ORDER_CREATED_ADMIN, adminOrderCreatedMessage],
      }),
    );
  }

  /** Покупець скасував замовлення. */
  orderCancelledByBuyer(orderId: string): void {
    this.track(
      this.notifyOrder(orderId, {
        buyer: [NotificationType.ORDER_CANCELLED_BUYER, buyerOrderCancelledMessage],
        admin: [NotificationType.ORDER_CANCELLED_ADMIN, adminOrderCancelledMessage],
      }),
    );
  }

  /** Дочекатися всіх надсилань (тести, зупинка сервера). */
  async whenIdle(): Promise<void> {
    while (this.inFlight.size > 0) await Promise.allSettled([...this.inFlight]);
  }

  async onModuleDestroy(): Promise<void> {
    await this.whenIdle();
  }

  private track(promise: Promise<void>): void {
    const tracked = promise.catch((error: unknown) => {
      // Сюди потрапляють тільки збої БД під час журналювання; без даних замовлення.
      this.logger.error(`Збій сповіщення: ${error instanceof Error ? error.name : "unknown"}`);
    });
    this.inFlight.add(tracked);
    void tracked.finally(() => this.inFlight.delete(tracked));
  }

  private async notifyOrder(
    orderId: string,
    templates: Record<"buyer" | "admin", [NotificationType, (order: OrderMessageData) => string]>,
  ): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { orderBy: [{ position: "asc" }, { id: "asc" }] },
        user: true,
        deliveryService: true,
      },
    });
    if (!order) return;

    const data: OrderMessageData = {
      number: order.number,
      total: order.total,
      items: order.items.map((item) => ({
        brand: item.brandName,
        name: item.productName,
        colorName: item.colorName,
        sizeLabel: item.sizeLabel,
        quantity: item.quantity,
        lineTotal: item.lineTotal,
      })),
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      city: order.city,
      deliveryServiceName: order.deliveryService.name,
      deliveryPoint: order.deliveryPoint,
      comment: order.comment,
      telegramUsername: order.user.username,
      telegramId: order.user.telegramId.toString(),
    };

    const [buyerType, buyerText] = templates.buyer;
    const buttons: SendMessageOptions["buttons"] = this.env.MINIAPP_URL
      ? [
          {
            text: "Відкрити замовлення",
            web_app: { url: `${this.env.MINIAPP_URL}/orders/${encodeURIComponent(order.number)}` },
          },
        ]
      : undefined;
    const buyerResult = await this.send(order.user.telegramId, buyerText(data), { buttons });
    await this.log(order.userId, order.id, buyerType, buyerResult);
    // 403 — покупець заблокував бота або не запускав його: позначаємо, щоб адмін бачив.
    const blocked = buyerResult.kind === "FORBIDDEN";
    if (buyerResult.ok || blocked) {
      await this.prisma.user.updateMany({
        where: { id: order.userId, isBotBlocked: !blocked },
        data: { isBotBlocked: blocked },
      });
    }

    const [adminType, adminText] = templates.admin;
    const adminChatId = await this.adminChatId();
    const adminResult = adminChatId
      ? await this.send(adminChatId, adminText(data))
      : ({ ok: false, kind: "NOT_CONFIGURED", error: "Чат власника не налаштовано" } as const);
    await this.log(null, order.id, adminType, adminResult);
  }

  /** TELEGRAM_ADMIN_CHAT_ID з env, інакше settings.notifications.adminChatId з БД. */
  private async adminChatId(): Promise<string | null> {
    if (this.env.TELEGRAM_ADMIN_CHAT_ID) return this.env.TELEGRAM_ADMIN_CHAT_ID;
    const setting = await this.prisma.setting.findUnique({ where: { key: "notifications" } });
    const value = (setting?.value as { adminChatId?: unknown } | null)?.adminChatId;
    if (typeof value === "number" && Number.isSafeInteger(value)) return String(value);
    if (typeof value === "string" && /^(-?\d{1,20}|@[A-Za-z0-9_]{5,32})$/.test(value.trim())) {
      return value.trim();
    }
    return null;
  }

  private async send(
    chatId: string | bigint,
    text: string,
    options?: SendMessageOptions,
  ): Promise<{ ok: true; kind?: undefined } | { ok: false; kind: string; error: string }> {
    if (!this.client) return { ok: false, kind: "NOT_CONFIGURED", error: "Бот не налаштовано" };
    try {
      await this.client.sendMessage(chatId, text, options);
      return { ok: true };
    } catch (error) {
      if (error instanceof TelegramSendError) {
        // Без тексту повідомлення, chat_id і токена: тільки тип збою.
        this.logger.warn(`Telegram: ${error.kind}${error.status ? ` (${error.status})` : ""}`);
        return { ok: false, kind: error.kind, error: `${error.kind}: ${error.message}` };
      }
      this.logger.warn("Telegram: невідома помилка");
      return { ok: false, kind: "UNKNOWN", error: "Невідома помилка" };
    }
  }

  private async log(
    userId: string | null,
    orderId: string,
    type: NotificationType,
    result: { ok: boolean; error?: string },
  ): Promise<void> {
    await this.prisma.notificationLog.create({
      data: {
        userId,
        orderId,
        type,
        status: result.ok ? NotificationStatus.SENT : NotificationStatus.FAILED,
        error: result.ok ? null : (result.error ?? "").slice(0, MAX_ERROR_LENGTH),
      },
    });
  }
}
