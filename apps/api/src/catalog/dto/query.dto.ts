import { ApiPropertyOptional } from "@nestjs/swagger";
import { PRODUCT_SORTS, type ProductSort } from "@ss13/shared";
import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";

import { toBoolean, toStringArray } from "../../common/transforms.js";

const MAX_PRICE = 100_000_000; // 1 000 000 ₴ у копійках

export class LimitQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 20;
}

/** Фільтри каталогу. Цей самий набір пізніше заповнює AI-пошук. */
export class ProductsQueryDto extends LimitQueryDto {
  @ApiPropertyOptional({
    description: "Slug категорії (включно з підкатегоріями)",
    example: "puhovyky",
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @ApiPropertyOptional({
    type: [String],
    description: "Slug брендів: ?brand=nike&brand=moncler або ?brand=nike,moncler",
    example: ["nike"],
  })
  @IsOptional()
  @Transform(toStringArray)
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  brand?: string[];

  @ApiPropertyOptional({ type: [String], description: "Slug кольорів", example: ["black"] })
  @IsOptional()
  @Transform(toStringArray)
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  color?: string[];

  @ApiPropertyOptional({ type: [String], description: "Розміри (мітки)", example: ["L", "42"] })
  @IsOptional()
  @Transform(toStringArray)
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  size?: string[];

  @ApiPropertyOptional({ description: "Мінімальна ціна, копійки", example: 100000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_PRICE)
  minPrice?: number;

  @ApiPropertyOptional({ description: "Максимальна ціна, копійки", example: 300000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_PRICE)
  maxPrice?: number;

  @ApiPropertyOptional({
    description: "Тільки в наявності. З color/size — наявність саме цього кольору/розміру",
  })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  inStock?: boolean;

  @ApiPropertyOptional() @IsOptional() @Transform(toBoolean) @IsBoolean() isNew?: boolean;
  @ApiPropertyOptional() @IsOptional() @Transform(toBoolean) @IsBoolean() isPopular?: boolean;
  @ApiPropertyOptional() @IsOptional() @Transform(toBoolean) @IsBoolean() isSale?: boolean;

  @ApiPropertyOptional({ enum: PRODUCT_SORTS, default: "new" })
  @IsOptional()
  @IsIn(PRODUCT_SORTS)
  sort: ProductSort = "new";

  @ApiPropertyOptional({ description: "nextCursor з попередньої сторінки", format: "uuid" })
  @IsOptional()
  @IsUUID()
  cursor?: string;
}

export class SearchQueryDto extends LimitQueryDto {
  @ApiPropertyOptional({
    description: "Назва, бренд, категорія або артикул",
    example: "пуховик moncler",
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  q!: string;

  @ApiPropertyOptional({ description: "nextCursor з попередньої сторінки" })
  @IsOptional()
  @IsNumberString({ no_symbols: true })
  @MaxLength(6)
  cursor?: string;
}
