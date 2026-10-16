import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type {
  CheckoutOptions,
  CheckoutPrefill,
  CreateOrderRequest,
  CreateOrderResponse,
  DeliveryServiceOption,
  OrderDetail,
  OrderItemView,
  OrderStatusHistoryEntry,
  OrderSummary,
  Paginated,
  PaymentMethodOption,
} from "@ss13/shared";
import { CHECKOUT_LIMITS, normalizeUaPhone, OrderStatus, PaymentStatus } from "@ss13/shared";
import type { TransformFnParams } from "class-transformer";
import { Transform } from "class-transformer";
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

import { LimitQueryDto } from "../catalog/dto/query.dto.js";

const money = (description: string) => ({ description: `${description}, копійки (UAH)` });

/** Обрізає пробіли й зводить внутрішні пробіли/переноси до одного пробілу. */
const clean = ({ value }: TransformFnParams): unknown =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim() : value;

/** Коментар: зберігаємо переноси рядків, прибираємо пробіли по краях. */
const trimOnly = ({ value }: TransformFnParams): unknown =>
  typeof value === "string" ? value.trim() : value;

const phone = ({ value }: TransformFnParams): unknown =>
  typeof value === "string" ? (normalizeUaPhone(value) ?? value) : value;

export class CreateOrderDto implements CreateOrderRequest {
  @ApiProperty({ example: "Олена Коваль", maxLength: CHECKOUT_LIMITS.customerName })
  @Transform(clean)
  @IsString()
  @MinLength(2, { message: "Вкажіть ім'я та прізвище" })
  @MaxLength(CHECKOUT_LIMITS.customerName)
  customerName!: string;

  @ApiProperty({
    example: "+380671234567",
    description: "Український номер; приймаються формати 067…, 380…, +380… з пробілами",
  })
  @Transform(phone)
  @IsString()
  @Matches(/^\+380[1-9]\d{8}$/, { message: "Телефон у форматі +380XXXXXXXXX" })
  customerPhone!: string;

  @ApiProperty({ example: "Київ", maxLength: CHECKOUT_LIMITS.city })
  @Transform(clean)
  @IsString()
  @MinLength(2, { message: "Вкажіть місто" })
  @MaxLength(CHECKOUT_LIMITS.city)
  city!: string;

  @ApiProperty({ example: "nova_poshta", description: "code з GET /checkout/options" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  deliveryServiceCode!: string;

  @ApiProperty({
    example: "Відділення №1, вул. Пирогівський шлях, 135",
    description: "Відділення або поштомат (текстом, без API перевізника)",
    maxLength: CHECKOUT_LIMITS.deliveryPoint,
  })
  @Transform(clean)
  @IsString()
  @MinLength(1, { message: "Вкажіть відділення або поштомат" })
  @MaxLength(CHECKOUT_LIMITS.deliveryPoint)
  deliveryPoint!: string;

  @ApiPropertyOptional({ maxLength: CHECKOUT_LIMITS.comment })
  @IsOptional()
  @Transform(trimOnly)
  @IsString()
  @MaxLength(CHECKOUT_LIMITS.comment)
  comment?: string;

  @ApiPropertyOptional({
    example: "manual",
    description: "code з GET /checkout/options; за замовчуванням — перший активний",
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  paymentMethodCode?: string;

  @ApiPropertyOptional({
    ...money("Сума, яку бачив покупець; якщо сервер порахував іншу — 409 PRICE_CHANGED"),
    example: 649900,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  expectedTotal?: number;
}

export class OrdersQueryDto extends LimitQueryDto {
  @ApiPropertyOptional({ description: "nextCursor з попередньої сторінки" })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  cursor?: string;
}

export class DeliveryServiceDto implements DeliveryServiceOption {
  @ApiProperty({ example: "nova_poshta" }) code!: string;
  @ApiProperty({ example: "Нова Пошта" }) name!: string;
  @ApiProperty({ description: "Є поштомати" }) supportsLockers!: boolean;
}

export class PaymentMethodDto implements PaymentMethodOption {
  @ApiProperty({ example: "manual" }) code!: string;
  @ApiProperty({ example: "Оплата після підтвердження менеджером" }) name!: string;
}

export class CheckoutPrefillDto implements CheckoutPrefill {
  @ApiProperty({ type: String, nullable: true }) customerName!: string | null;
  @ApiProperty({ type: String, nullable: true }) customerPhone!: string | null;
  @ApiProperty({ type: String, nullable: true }) city!: string | null;
  @ApiProperty({ type: String, nullable: true }) deliveryServiceCode!: string | null;
  @ApiProperty({ type: String, nullable: true }) deliveryPoint!: string | null;
}

export class CheckoutOptionsDto implements CheckoutOptions {
  @ApiProperty({ type: [DeliveryServiceDto] }) deliveryServices!: DeliveryServiceDto[];
  @ApiProperty({ type: [PaymentMethodDto] }) paymentMethods!: PaymentMethodDto[];
  @ApiProperty({ type: CheckoutPrefillDto, description: "З останнього замовлення покупця" })
  prefill!: CheckoutPrefillDto;
}

export class OrderItemDto implements OrderItemView {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ type: String, nullable: true, description: "null, якщо товар видалено" })
  productId!: string | null;
  @ApiProperty() name!: string;
  @ApiProperty() brand!: string;
  @ApiProperty() sku!: string;
  @ApiProperty() colorName!: string;
  @ApiProperty() sizeLabel!: string;
  @ApiProperty({ type: String, nullable: true }) image!: string | null;
  @ApiProperty(money("Ціна за одиницю на момент покупки")) unitPrice!: number;
  @ApiProperty() quantity!: number;
  @ApiProperty(money("Сума позиції")) lineTotal!: number;
}

export class OrderHistoryDto implements OrderStatusHistoryEntry {
  @ApiProperty({ enum: Object.values(OrderStatus) }) status!: OrderStatus;
  @ApiProperty({ format: "date-time" }) createdAt!: string;
  @ApiProperty({ type: String, nullable: true }) comment!: string | null;
}

export class OrderSummaryDto implements OrderSummary {
  @ApiProperty({ example: "SS13-10001" }) number!: string;
  @ApiProperty({ enum: Object.values(OrderStatus) }) status!: OrderStatus;
  @ApiProperty({ format: "date-time" }) createdAt!: string;
  @ApiProperty({ description: "Штук у замовленні" }) itemsCount!: number;
  @ApiProperty(money("Сума замовлення")) total!: number;
  @ApiProperty({ type: [String], description: "До 3 фото позицій" }) images!: string[];
}

export class OrderPageDto implements Paginated<OrderSummary> {
  @ApiProperty({ type: [OrderSummaryDto] }) items!: OrderSummaryDto[];
  @ApiProperty({ type: String, nullable: true }) nextCursor!: string | null;
}

export class OrderDetailDto implements OrderDetail {
  @ApiProperty({ example: "SS13-10001" }) number!: string;
  @ApiProperty({ enum: Object.values(OrderStatus) }) status!: OrderStatus;
  @ApiProperty({ format: "date-time" }) createdAt!: string;
  @ApiProperty() customerName!: string;
  @ApiProperty({ example: "+380671234567" }) customerPhone!: string;
  @ApiProperty() city!: string;
  @ApiProperty({ type: DeliveryServiceDto }) deliveryService!: DeliveryServiceDto;
  @ApiProperty() deliveryPoint!: string;
  @ApiProperty({ type: String, nullable: true }) comment!: string | null;
  @ApiProperty({ type: String, nullable: true, description: "ТТН" }) trackingNumber!: string | null;
  @ApiProperty({ type: PaymentMethodDto, nullable: true }) paymentMethod!: PaymentMethodDto | null;
  @ApiProperty({ enum: Object.values(PaymentStatus) }) paymentStatus!: PaymentStatus;
  @ApiProperty({ type: [OrderItemDto] }) items!: OrderItemDto[];
  @ApiProperty(money("Сума позицій")) subtotal!: number;
  @ApiProperty(money("Знижка")) discountTotal!: number;
  @ApiProperty(money("Доставка (0 — за тарифом перевізника)")) deliveryCost!: number;
  @ApiProperty(money("До сплати")) total!: number;
  @ApiProperty({ type: [OrderHistoryDto] }) history!: OrderHistoryDto[];
  @ApiProperty({ description: "Покупець може скасувати сам (статус «Нове»)" })
  canCancel!: boolean;
}

export class CreateOrderResponseDto implements CreateOrderResponse {
  @ApiProperty({ description: "false — повтор з тим самим Idempotency-Key" })
  created!: boolean;
  @ApiProperty({ type: OrderDetailDto }) order!: OrderDetailDto;
}
