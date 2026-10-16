// Класи відповідей для Swagger; реалізують контракти з @ss13/shared.
import { ApiProperty } from "@nestjs/swagger";
import type {
  BrandRef,
  CategoryItem,
  CategoryRef,
  ColorRef,
  HomeResponse,
  ImageUrls,
  Paginated,
  ProductCard,
  ProductColorOption,
  ProductDetail,
  ProductImage,
  ProductSizeOption,
  ProductVariantInfo,
  SizeRef,
} from "@ss13/shared";

const money = (description: string) => ({ description: `${description}, копійки (UAH)` });

export class BrandRefDto implements BrandRef {
  @ApiProperty({ example: "moncler" }) slug!: string;
  @ApiProperty({ example: "Moncler" }) name!: string;
}

export class CategoryRefDto implements CategoryRef {
  @ApiProperty({ example: "puhovyky" }) slug!: string;
  @ApiProperty({ example: "Пуховики" }) name!: string;
}

export class CategoryItemDto implements CategoryItem {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ example: "puhovyky" }) slug!: string;
  @ApiProperty({ example: "Пуховики" }) name!: string;
  @ApiProperty({ type: String, nullable: true }) imageUrl!: string | null;
  @ApiProperty({ type: String, nullable: true }) icon!: string | null;
  @ApiProperty() sortOrder!: number;
  @ApiProperty({ description: "Товарів на вітрині, включно з підкатегоріями" })
  productCount!: number;
  @ApiProperty({ type: () => [CategoryItemDto] }) children!: CategoryItemDto[];
}

export class ColorRefDto implements ColorRef {
  @ApiProperty({ example: "black" }) slug!: string;
  @ApiProperty({ example: "Чорний" }) name!: string;
  @ApiProperty({ example: "#000000" }) hex!: string;
}

export class SizeRefDto implements SizeRef {
  @ApiProperty({ example: "M" }) label!: string;
  @ApiProperty({ example: "CLOTHING", enum: ["CLOTHING", "SHOES_EU", "ONE_SIZE", "OTHER"] })
  system!: string;
}

export class ImageUrlsDto implements ImageUrls {
  @ApiProperty({ required: false }) thumb?: string;
  @ApiProperty({ required: false }) medium?: string;
  @ApiProperty({ required: false }) large?: string;
}

export class ProductCardDto implements ProductCard {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() slug!: string;
  @ApiProperty({ description: "Артикул" }) sku!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: BrandRefDto }) brand!: BrandRefDto;
  @ApiProperty({ type: CategoryRefDto }) category!: CategoryRefDto;
  @ApiProperty({ ...money("Ціна"), example: 1299900 }) price!: number;
  @ApiProperty({ ...money("Стара ціна, якщо є знижка"), type: Number, nullable: true })
  oldPrice!: number | null;
  @ApiProperty({ type: Number, nullable: true, example: 13 }) discountPercent!: number | null;
  @ApiProperty() isNew!: boolean;
  @ApiProperty() isPopular!: boolean;
  @ApiProperty() isSale!: boolean;
  @ApiProperty() inStock!: boolean;
  @ApiProperty({ type: ImageUrlsDto, nullable: true }) image!: ImageUrlsDto | null;
  @ApiProperty({ type: [ColorRefDto], description: "Кольори, що є в наявності" })
  colors!: ColorRefDto[];
  @ApiProperty({ type: [String], description: "Розміри в наявності", example: ["M", "L"] })
  availableSizes!: string[];
}

export class ProductImageDto implements ProductImage {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ type: String, nullable: true }) colorSlug!: string | null;
  @ApiProperty({ type: ImageUrlsDto }) urls!: ImageUrlsDto;
  @ApiProperty() width!: number;
  @ApiProperty() height!: number;
  @ApiProperty({ type: String, nullable: true }) alt!: string | null;
}

export class ProductColorOptionDto extends ColorRefDto implements ProductColorOption {
  @ApiProperty({ description: "Є хоча б один розмір цього кольору" }) available!: boolean;
}

export class ProductSizeOptionDto implements ProductSizeOption {
  @ApiProperty({ example: "L" }) label!: string;
  @ApiProperty({ example: "CLOTHING" }) system!: string;
  @ApiProperty({ description: "Є хоча б в одному кольорі" }) available!: boolean;
}

export class ProductVariantInfoDto implements ProductVariantInfo {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ example: "black" }) colorSlug!: string;
  @ApiProperty({ example: "L" }) sizeLabel!: string;
  @ApiProperty({ description: "Залишок цієї пари колір + розмір" }) stock!: number;
  @ApiProperty() available!: boolean;
  @ApiProperty(money("Ціна варіанту")) price!: number;
}

export class ProductDetailDto implements ProductDetail {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() slug!: string;
  @ApiProperty({ description: "Артикул" }) sku!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: BrandRefDto }) brand!: BrandRefDto;
  @ApiProperty({ type: CategoryRefDto }) category!: CategoryRefDto;
  @ApiProperty(money("Ціна")) price!: number;
  @ApiProperty({ ...money("Стара ціна"), type: Number, nullable: true }) oldPrice!: number | null;
  @ApiProperty({ type: Number, nullable: true }) discountPercent!: number | null;
  @ApiProperty() isNew!: boolean;
  @ApiProperty() isPopular!: boolean;
  @ApiProperty() isSale!: boolean;
  @ApiProperty() inStock!: boolean;
  @ApiProperty() description!: string;
  @ApiProperty({ type: String, nullable: true }) material!: string | null;
  @ApiProperty({ type: [ProductImageDto] }) images!: ProductImageDto[];
  @ApiProperty({ type: [ProductColorOptionDto] }) colors!: ProductColorOptionDto[];
  @ApiProperty({ type: [ProductSizeOptionDto] }) sizes!: ProductSizeOptionDto[];
  @ApiProperty({ type: [ProductVariantInfoDto] }) variants!: ProductVariantInfoDto[];
}

export class ProductPageDto implements Paginated<ProductCard> {
  @ApiProperty({ type: [ProductCardDto] }) items!: ProductCardDto[];
  @ApiProperty({ type: String, nullable: true }) nextCursor!: string | null;
}

export class HomeResponseDto implements HomeResponse {
  @ApiProperty({ type: [CategoryItemDto] }) categories!: CategoryItemDto[];
  @ApiProperty({ type: [ProductCardDto] }) newArrivals!: ProductCardDto[];
  @ApiProperty({ type: [ProductCardDto] }) popular!: ProductCardDto[];
  @ApiProperty({ type: [ProductCardDto] }) sale!: ProductCardDto[];
}
