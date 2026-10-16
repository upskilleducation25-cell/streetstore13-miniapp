import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type {
  AdminBrandInput,
  AdminCategoryInput,
  AdminColorInput,
  AdminImageUpdateInput,
  AdminProductCreateInput,
  AdminProductInput,
  AdminProductSort,
  AdminSaveVariantsInput,
  AdminSizeInput,
  AdminSortOrderItem,
  AdminStockAdjustInput,
  AdminStockFilter,
  AdminVariantInput,
} from "@ss13/shared";
import {
  ADMIN_PRODUCT_LIMITS as LIMITS,
  ADMIN_PRODUCT_SORTS,
  ADMIN_STOCK_FILTERS,
  SLUG_MAX_LENGTH,
  SLUG_PATTERN,
} from "@ss13/shared";
import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  NotEquals,
  ValidateIf,
  ValidateNested,
} from "class-validator";

import { ProductStatus, SizeSystem } from "../generated/prisma/client.js";

/** Обрізає пробіли; порожній рядок стає null (для необов'язкових текстових полів). */
const trimToNull = ({ value }: { value: unknown }) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
};
const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);
/** Порожній slug означає «згенерувати з назви». */
const optionalSlug = ({ value }: { value: unknown }) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim().toLowerCase();
  return trimmed === "" ? undefined : trimmed;
};

const SLUG_MESSAGE = "slug: латинські літери, цифри й дефіси";

// ─── Товари ─────────────────────────────────────────────────────────────────

export class AdminProductsQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  page: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: LIMITS.pageSizeMax, default: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(LIMITS.pageSizeMax)
  limit: number = 25;

  @ApiPropertyOptional({ description: "Пошук за назвою, артикулом товару чи варіанту" })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({
    enum: ProductStatus,
    description: "Без фільтра показуються всі, крім архіву",
  })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @ApiPropertyOptional({ format: "uuid", description: "Включно з підкатегоріями" })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @ApiPropertyOptional({ enum: ADMIN_STOCK_FILTERS })
  @IsOptional()
  @IsIn(ADMIN_STOCK_FILTERS)
  stock?: AdminStockFilter;

  @ApiPropertyOptional({ enum: ["new", "popular", "sale"] })
  @IsOptional()
  @IsIn(["new", "popular", "sale"])
  flag?: "new" | "popular" | "sale";

  @ApiPropertyOptional({ enum: ADMIN_PRODUCT_SORTS, default: "updated_desc" })
  @IsOptional()
  @IsIn(ADMIN_PRODUCT_SORTS)
  sort: AdminProductSort = "updated_desc";
}

export class AdminVariantDto implements AdminVariantInput {
  @ApiPropertyOptional({
    format: "uuid",
    description: "Інформаційно; варіант визначає пара колір+розмір",
  })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({ format: "uuid" })
  @IsUUID()
  colorId!: string;

  @ApiProperty({ format: "uuid" })
  @IsUUID()
  sizeId!: string;

  @ApiProperty({ type: String, nullable: true })
  @Transform(trimToNull)
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(LIMITS.variantSku)
  sku!: string | null;

  @ApiProperty({ type: Number, nullable: true, description: "Своя ціна варіанту, копійки" })
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(0)
  @Max(LIMITS.maxPrice)
  priceOverride!: number | null;

  @ApiProperty()
  @IsBoolean()
  isActive!: boolean;

  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  @Max(LIMITS.maxStock)
  stock!: number;

  @ApiPropertyOptional({ description: "Залишок, який бачив адмін (захист від перезапису продажу)" })
  @IsOptional()
  @IsInt()
  @Min(0)
  expectedStock?: number;
}

export class AdminProductDto implements AdminProductInput {
  @ApiProperty({ example: "SS13-0001" })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: "Вкажіть артикул" })
  @MaxLength(LIMITS.sku)
  @Matches(/^[\p{L}\p{N}._/-]+$/u, { message: "Артикул: літери, цифри, . _ / -" })
  sku!: string;

  @ApiProperty({ example: "Пуховик Maya" })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: "Вкажіть назву" })
  @MaxLength(LIMITS.name)
  name!: string;

  @ApiPropertyOptional({ description: "Порожньо — з назви" })
  @IsOptional()
  @Transform(optionalSlug)
  @IsString()
  @MaxLength(SLUG_MAX_LENGTH)
  @Matches(SLUG_PATTERN, { message: SLUG_MESSAGE })
  slug?: string;

  @ApiProperty({ format: "uuid" })
  @IsUUID("all", { message: "Оберіть бренд" })
  brandId!: string;

  @ApiProperty({ format: "uuid" })
  @IsUUID("all", { message: "Оберіть категорію" })
  categoryId!: string;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MaxLength(LIMITS.description)
  description!: string;

  @ApiProperty({ type: String, nullable: true })
  @Transform(trimToNull)
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(LIMITS.material)
  material!: string | null;

  @ApiProperty({ description: "Ціна, копійки" })
  @IsInt()
  @Min(0)
  @Max(LIMITS.maxPrice)
  price!: number;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: "Стара ціна, копійки; більша за price",
  })
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(1)
  @Max(LIMITS.maxPrice)
  oldPrice!: number | null;

  @ApiProperty({ enum: ProductStatus })
  @IsEnum(ProductStatus)
  status!: ProductStatus;

  @ApiProperty() @IsBoolean() isNew!: boolean;
  @ApiProperty() @IsBoolean() isPopular!: boolean;
  @ApiProperty() @IsBoolean() isSale!: boolean;

  @ApiPropertyOptional({ description: "Пріоритет у рекомендованих (більше — вище)" })
  @IsOptional()
  @IsInt()
  @Min(-1000)
  @Max(1000)
  sortWeight?: number;
}

export class AdminProductCreateDto extends AdminProductDto implements AdminProductCreateInput {
  @ApiPropertyOptional({ type: [AdminVariantDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(300)
  @ValidateNested({ each: true })
  @Type(() => AdminVariantDto)
  variants?: AdminVariantDto[];

  @ApiPropertyOptional({ description: "Причина початкових залишків" })
  @IsOptional()
  @Transform(trimToNull)
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(200)
  stockNote?: string;

  @ApiPropertyOptional({ format: "uuid", description: "Дублювання: скопіювати фото цього товару" })
  @IsOptional()
  @IsUUID()
  copyImagesFromId?: string;
}

/** PATCH: усі поля товару необов'язкові. */
export class AdminProductUpdateDto implements Partial<AdminProductInput> {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: "Вкажіть артикул" })
  @MaxLength(LIMITS.sku)
  @Matches(/^[\p{L}\p{N}._/-]+$/u, { message: "Артикул: літери, цифри, . _ / -" })
  sku?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: "Вкажіть назву" })
  @MaxLength(LIMITS.name)
  name?: string;

  @ApiPropertyOptional({ description: "Порожньо — з назви" })
  @IsOptional()
  @Transform(optionalSlug)
  @IsString()
  @MaxLength(SLUG_MAX_LENGTH)
  @Matches(SLUG_PATTERN, { message: SLUG_MESSAGE })
  slug?: string;

  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID() brandId?: string;
  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID() categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(LIMITS.description)
  description?: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @Transform(trimToNull)
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(LIMITS.material)
  material?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(LIMITS.maxPrice)
  price?: number;

  @ApiPropertyOptional({ type: Number, nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(1)
  @Max(LIMITS.maxPrice)
  oldPrice?: number | null;

  @ApiPropertyOptional({ enum: ProductStatus })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() isNew?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isPopular?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isSale?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(-1000)
  @Max(1000)
  sortWeight?: number;
}

export class AdminSaveVariantsDto implements AdminSaveVariantsInput {
  @ApiProperty({
    type: [AdminVariantDto],
    description: "Повна матриця: відсутні пари видаляються або вимикаються",
  })
  @IsArray()
  @ArrayMaxSize(300)
  @ValidateNested({ each: true })
  @Type(() => AdminVariantDto)
  variants!: AdminVariantDto[];

  @ApiPropertyOptional({ description: "Причина зміни залишків (обов'язкова, якщо вони змінились)" })
  @IsOptional()
  @Transform(trimToNull)
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(200)
  stockNote?: string;
}

export class AdminStockAdjustDto implements AdminStockAdjustInput {
  @ApiProperty({ example: 5, description: "+ надходження, − списання; не 0" })
  @IsInt()
  @NotEquals(0, { message: "Зміна не може бути 0" })
  @Min(-LIMITS.maxStock)
  @Max(LIMITS.maxStock)
  delta!: number;

  @ApiProperty({ example: "Надходження" })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: "Вкажіть причину" })
  @MaxLength(200)
  note!: string;
}

export class AdminMovementsQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 200, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit: number = 50;
}

// ─── Фото ───────────────────────────────────────────────────────────────────

export class AdminImageUploadDto {
  @ApiPropertyOptional({ format: "uuid", description: "Колір для всіх фото цього завантаження" })
  @IsOptional()
  @Transform(trimToNull)
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  colorId?: string | null;
}

export class AdminImageOrderDto {
  @ApiProperty({ type: [String], description: "Усі id фото товару в новому порядку" })
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID("all", { each: true })
  ids!: string[];
}

export class AdminImageUpdateDto implements AdminImageUpdateInput {
  @ApiPropertyOptional({ type: String, nullable: true, format: "uuid" })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  colorId?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @Transform(trimToNull)
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(200)
  alt?: string | null;
}

// ─── Категорії та довідники ─────────────────────────────────────────────────

export class AdminCategoryDto implements AdminCategoryInput {
  @ApiProperty({ example: "Пуховики" })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: "Вкажіть назву" })
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(optionalSlug)
  @IsString()
  @MaxLength(SLUG_MAX_LENGTH)
  @Matches(SLUG_PATTERN, { message: SLUG_MESSAGE })
  slug?: string;

  @ApiProperty({ type: String, nullable: true, format: "uuid" })
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  parentId!: string | null;

  @ApiProperty({ type: String, nullable: true, description: "Емодзі або коротка назва іконки" })
  @Transform(trimToNull)
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(32)
  icon!: string | null;

  @ApiProperty() @IsBoolean() isActive!: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  sortOrder?: number;
}

export class AdminCategoryUpdateDto implements Partial<AdminCategoryInput> {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: "Вкажіть назву" })
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(optionalSlug)
  @IsString()
  @MaxLength(SLUG_MAX_LENGTH)
  @Matches(SLUG_PATTERN, { message: SLUG_MESSAGE })
  slug?: string;

  @ApiPropertyOptional({ type: String, nullable: true, format: "uuid" })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  parentId?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @Transform(trimToNull)
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(32)
  icon?: string | null;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  sortOrder?: number;
}

export class AdminSortOrderItemDto implements AdminSortOrderItem {
  @ApiProperty({ format: "uuid" }) @IsUUID() id!: string;
  @ApiProperty() @IsInt() @Min(0) @Max(1_000_000) sortOrder!: number;
}

export class AdminSortOrderDto {
  @ApiProperty({ type: [AdminSortOrderItemDto] })
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => AdminSortOrderItemDto)
  items!: AdminSortOrderItemDto[];
}

export class AdminBrandDto implements AdminBrandInput {
  @ApiProperty({ example: "Moncler" })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: "Вкажіть назву" })
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(optionalSlug)
  @IsString()
  @MaxLength(SLUG_MAX_LENGTH)
  @Matches(SLUG_PATTERN, { message: SLUG_MESSAGE })
  slug?: string;

  @ApiProperty({ type: String, nullable: true })
  @Transform(trimToNull)
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(500)
  @Matches(/^(https:\/\/|\/)/, { message: "Посилання на логотип: https://… або /…" })
  logoUrl!: string | null;

  @ApiProperty() @IsBoolean() isActive!: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  sortOrder?: number;
}

export class AdminColorDto implements AdminColorInput {
  @ApiProperty({ example: "Чорний" })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: "Вкажіть назву" })
  @MaxLength(50)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(optionalSlug)
  @IsString()
  @MaxLength(SLUG_MAX_LENGTH)
  @Matches(SLUG_PATTERN, { message: SLUG_MESSAGE })
  slug?: string;

  @ApiProperty({ example: "#000000" })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  )
  @Matches(/^#[0-9a-f]{6}$/, { message: "Колір у форматі #rrggbb" })
  hex!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  sortOrder?: number;
}

export class AdminSizeDto implements AdminSizeInput {
  @ApiProperty({ example: "XL" })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: "Вкажіть розмір" })
  @MaxLength(20)
  label!: string;

  @ApiProperty({ enum: SizeSystem })
  @IsEnum(SizeSystem)
  sizeSystem!: SizeSystem;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  sortOrder?: number;
}
