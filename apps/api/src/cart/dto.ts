import { ApiProperty } from "@nestjs/swagger";
import type {
  AddCartItemRequest,
  CartItemStatus,
  CartItemView,
  CartView,
  UpdateCartItemRequest,
} from "@ss13/shared";
import { MAX_CART_LINE_QUANTITY } from "@ss13/shared";
import { IsInt, IsUUID, Max, Min } from "class-validator";

const money = (description: string) => ({ description: `${description}, копійки (UAH)` });

export class AddCartItemDto implements AddCartItemRequest {
  @ApiProperty({ format: "uuid", description: "Варіант товару (колір + розмір)" })
  @IsUUID()
  variantId!: string;

  @ApiProperty({ minimum: 1, maximum: MAX_CART_LINE_QUANTITY, example: 1 })
  @IsInt()
  @Min(1)
  @Max(MAX_CART_LINE_QUANTITY)
  quantity!: number;
}

export class UpdateCartItemDto implements UpdateCartItemRequest {
  @ApiProperty({ minimum: 1, maximum: MAX_CART_LINE_QUANTITY, example: 2 })
  @IsInt()
  @Min(1)
  @Max(MAX_CART_LINE_QUANTITY)
  quantity!: number;
}

export class CartItemDto implements CartItemView {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ format: "uuid" }) variantId!: string;
  @ApiProperty({ format: "uuid" }) productId!: string;
  @ApiProperty({ example: "Пуховик Maya" }) name!: string;
  @ApiProperty({ example: "Moncler" }) brand!: string;
  @ApiProperty({ example: "DEMO-001" }) sku!: string;
  @ApiProperty({ example: "black" }) colorSlug!: string;
  @ApiProperty({ example: "Чорний" }) colorName!: string;
  @ApiProperty({ example: "M" }) sizeLabel!: string;
  @ApiProperty({ type: String, nullable: true }) image!: string | null;
  @ApiProperty(money("Актуальна ціна за одиницю")) unitPrice!: number;
  @ApiProperty() quantity!: number;
  @ApiProperty(money("Ціна × кількість")) lineTotal!: number;
  @ApiProperty({ description: "Скільки штук зараз можна купити" }) stock!: number;
  @ApiProperty({
    enum: ["OK", "INSUFFICIENT_STOCK", "UNAVAILABLE"],
    description:
      "OK — можна оформити; INSUFFICIENT_STOCK — у кошику більше, ніж є; UNAVAILABLE — немає в продажу",
  })
  status!: CartItemStatus;
}

export class CartDto implements CartView {
  @ApiProperty({ type: [CartItemDto] }) items!: CartItemDto[];
  @ApiProperty({ description: "Штук у кошику" }) count!: number;
  @ApiProperty(money("Сума позицій зі статусом OK")) subtotal!: number;
  @ApiProperty(money("До сплати (доставка — за тарифом перевізника)")) total!: number;
  @ApiProperty({ description: "Кошик не порожній і всі позиції доступні" })
  canCheckout!: boolean;
}
