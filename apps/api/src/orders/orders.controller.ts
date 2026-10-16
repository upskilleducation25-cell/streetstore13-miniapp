import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import type { Response } from "express";

import { CurrentUser } from "../auth/current-user.decorator.js";
import { TelegramAuthGuard } from "../auth/telegram-auth.guard.js";
import { AppException } from "../common/app-exception.js";
import { ApiErrorResponses } from "../common/swagger.js";
import type { User } from "../generated/prisma/client.js";
import {
  CheckoutOptionsDto,
  CreateOrderDto,
  CreateOrderResponseDto,
  OrderDetailDto,
  OrderPageDto,
  OrdersQueryDto,
} from "./dto.js";
import { OrdersService } from "./orders.service.js";

const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9_-]{16,100}$/;

@ApiTags("Оформлення і замовлення")
@ApiBearerAuth()
@UseGuards(TelegramAuthGuard)
@Controller()
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get("checkout/options")
  @ApiOperation({ summary: "Служби доставки, способи оплати і дані для автозаповнення" })
  @ApiOkResponse({ type: CheckoutOptionsDto })
  @ApiErrorResponses(401)
  options(@CurrentUser() user: User): Promise<CheckoutOptionsDto> {
    return this.orders.getCheckoutOptions(user);
  }

  @Post("orders")
  @ApiOperation({
    summary: "Оформити замовлення з кошика",
    description:
      "Позиції беруться з серверного кошика, ціни й суми рахує сервер. Одна транзакція: блокування варіантів, перевірка залишків, списання, знімок позицій, очищення кошика. 409: CART_EMPTY, CART_ITEMS_UNAVAILABLE (details.problems), PRICE_CHANGED (details.total), IDEMPOTENCY_KEY_CONFLICT. Повтор з тим самим Idempotency-Key повертає те саме замовлення (200, created=false).",
  })
  @ApiHeader({
    name: "Idempotency-Key",
    required: true,
    description: "Унікальний ключ спроби оформлення (16–100 символів: латиниця, цифри, - і _)",
  })
  @ApiResponse({ status: 201, type: CreateOrderResponseDto, description: "Замовлення створено" })
  @ApiResponse({ status: 200, type: CreateOrderResponseDto, description: "Повтор запиту" })
  @ApiErrorResponses(400, 401, 409)
  async create(
    @CurrentUser() user: User,
    @Body() dto: CreateOrderDto,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CreateOrderResponseDto> {
    if (!idempotencyKey || !IDEMPOTENCY_KEY_RE.test(idempotencyKey)) {
      throw new AppException(
        "IDEMPOTENCY_KEY_REQUIRED",
        "Потрібен заголовок Idempotency-Key (16–100 символів: латиниця, цифри, - і _)",
        HttpStatus.BAD_REQUEST,
      );
    }
    const result = await this.orders.createOrder(user, dto, idempotencyKey);
    response.status(result.created ? HttpStatus.CREATED : HttpStatus.OK);
    return result;
  }

  @Get("orders")
  @ApiOperation({ summary: "Мої замовлення, нові спочатку" })
  @ApiOkResponse({ type: OrderPageDto })
  @ApiErrorResponses(400, 401)
  list(@CurrentUser() user: User, @Query() query: OrdersQueryDto): Promise<OrderPageDto> {
    return this.orders.listOrders(user, query);
  }

  @Get("orders/:number")
  @ApiOperation({
    summary: "Деталі мого замовлення",
    description: "Чуже або неіснуюче замовлення — 404.",
  })
  @ApiParam({ name: "number", example: "SS13-10001" })
  @ApiOkResponse({ type: OrderDetailDto })
  @ApiErrorResponses(401, 404)
  get(@CurrentUser() user: User, @Param("number") number: string): Promise<OrderDetailDto> {
    return this.orders.getOrder(user, number);
  }

  @Post("orders/:number/cancel")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Скасувати моє замовлення",
    description:
      "Тільки зі статусу «Нове». Залишки повертаються на склад у тій самій транзакції. 409 ORDER_CANNOT_BE_CANCELLED — менеджер уже взяв замовлення в роботу.",
  })
  @ApiParam({ name: "number", example: "SS13-10001" })
  @ApiOkResponse({ type: OrderDetailDto })
  @ApiErrorResponses(401, 404, 409)
  cancel(@CurrentUser() user: User, @Param("number") number: string): Promise<OrderDetailDto> {
    return this.orders.cancelOrder(user, number);
  }
}
