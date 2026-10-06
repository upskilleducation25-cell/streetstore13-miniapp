import { applyDecorators } from "@nestjs/common";
import { ApiProperty, ApiResponse } from "@nestjs/swagger";
import type { ApiErrorBody } from "@ss13/shared";

export class ApiErrorDto implements ApiErrorBody {
  @ApiProperty({ example: "PRODUCT_NOT_FOUND" }) code!: string;
  @ApiProperty({ example: "Товар не знайдено" }) message!: string;
  @ApiProperty({ required: false, description: "Деталі, напр. помилки валідації по полях" })
  details?: unknown;
}

const DESCRIPTIONS: Record<number, string> = {
  400: "Некоректні параметри (VALIDATION_ERROR)",
  401: "Немає або некоректна авторизація",
  404: "Не знайдено",
  503: "Сервіс не налаштовано",
};

/** Документує стандартні помилки ендпоїнта єдиною схемою ApiErrorDto. */
export function ApiErrorResponses(...statuses: number[]) {
  return applyDecorators(
    ...statuses.map((status) =>
      ApiResponse({ status, description: DESCRIPTIONS[status] ?? "Помилка", type: ApiErrorDto }),
    ),
  );
}
