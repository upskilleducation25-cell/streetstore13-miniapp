import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";

import { CurrentUser } from "../auth/current-user.decorator.js";
import { TelegramAuthGuard } from "../auth/telegram-auth.guard.js";
import { ApiErrorResponses } from "../common/swagger.js";
import type { User } from "../generated/prisma/client.js";
import { CartService } from "./cart.service.js";
import { AddCartItemDto, CartDto, UpdateCartItemDto } from "./dto.js";

@ApiTags("Кошик")
@ApiBearerAuth()
@UseGuards(TelegramAuthGuard)
@Controller("cart")
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Get()
  @ApiOperation({
    summary: "Мій кошик",
    description: "Ціни й наявність — актуальні з бази на момент запиту, а не на момент додавання.",
  })
  @ApiOkResponse({ type: CartDto })
  @ApiErrorResponses(401)
  get(@CurrentUser() user: User): Promise<CartDto> {
    return this.cart.getCart(user);
  }

  @Post("items")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Додати варіант у кошик",
    description:
      "Якщо варіант уже в кошику, кількість додається. 409 INSUFFICIENT_STOCK / OUT_OF_STOCK — не вистачає залишку (details: available, inCart).",
  })
  @ApiOkResponse({ type: CartDto })
  @ApiErrorResponses(400, 401, 404, 409)
  add(@CurrentUser() user: User, @Body() dto: AddCartItemDto): Promise<CartDto> {
    return this.cart.addItem(user, dto.variantId, dto.quantity);
  }

  @Patch("items/:id")
  @ApiOperation({ summary: "Змінити кількість позиції" })
  @ApiParam({ name: "id", format: "uuid", description: "id позиції кошика" })
  @ApiOkResponse({ type: CartDto })
  @ApiErrorResponses(400, 401, 404, 409)
  update(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body() dto: UpdateCartItemDto,
  ): Promise<CartDto> {
    return this.cart.updateItem(user, id, dto.quantity);
  }

  @Delete("items/:id")
  @ApiOperation({ summary: "Видалити позицію з кошика" })
  @ApiParam({ name: "id", format: "uuid", description: "id позиції кошика" })
  @ApiOkResponse({ type: CartDto })
  @ApiErrorResponses(401, 404)
  remove(@CurrentUser() user: User, @Param("id") id: string): Promise<CartDto> {
    return this.cart.removeItem(user, id);
  }
}
