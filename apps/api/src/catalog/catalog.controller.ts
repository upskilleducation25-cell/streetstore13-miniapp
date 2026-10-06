import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";

import { ApiErrorResponses } from "../common/swagger.js";
import { CatalogService } from "./catalog.service.js";
import { ProductsQueryDto, SearchQueryDto } from "./dto/query.dto.js";
import {
  BrandRefDto,
  CategoryItemDto,
  ColorRefDto,
  HomeResponseDto,
  ProductDetailDto,
  ProductPageDto,
  SizeRefDto,
} from "./dto/response.dto.js";

@ApiTags("Каталог")
@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get("home")
  @ApiOperation({ summary: "Головна: категорії, «Новинки», «Популярне», «Акції»" })
  @ApiOkResponse({ type: HomeResponseDto })
  getHome(): Promise<HomeResponseDto> {
    return this.catalog.getHome();
  }

  @Get("categories")
  @ApiOperation({ summary: "Дерево активних категорій у порядку з адмінки" })
  @ApiOkResponse({ type: [CategoryItemDto] })
  getCategories(): Promise<CategoryItemDto[]> {
    return this.catalog.getCategories();
  }

  @Get("brands")
  @ApiOperation({ summary: "Бренди, що є у видимих товарах (для фільтрів)" })
  @ApiOkResponse({ type: [BrandRefDto] })
  getBrands(): Promise<BrandRefDto[]> {
    return this.catalog.getBrands();
  }

  @Get("colors")
  @ApiOperation({ summary: "Кольори, що є в активних варіантах видимих товарів (для фільтрів)" })
  @ApiOkResponse({ type: [ColorRefDto] })
  getColors(): Promise<ColorRefDto[]> {
    return this.catalog.getColors();
  }

  @Get("sizes")
  @ApiOperation({
    summary: "Розміри, що є в активних варіантах видимих товарів (для фільтрів)",
    description: "Впорядковано за розмірною сіткою. Значення label передається у фільтр size.",
  })
  @ApiOkResponse({ type: [SizeRefDto] })
  getSizes(): Promise<SizeRefDto[]> {
    return this.catalog.getSizes();
  }

  @Get("products")
  @ApiOperation({
    summary: "Список товарів з фільтрами",
    description:
      "Фільтри поєднуються через І. color і size мають збігатися в одному варіанті. Ціни — копійки.",
  })
  @ApiOkResponse({ type: ProductPageDto })
  @ApiErrorResponses(400)
  getProducts(@Query() query: ProductsQueryDto): Promise<ProductPageDto> {
    return this.catalog.getProducts(query);
  }

  // Оголошено перед products/:id, щоб "search" не сприймався як id.
  @Get("products/search")
  @ApiOperation({ summary: "Пошук за назвою, брендом, категорією або артикулом" })
  @ApiOkResponse({ type: ProductPageDto })
  @ApiErrorResponses(400)
  search(@Query() query: SearchQueryDto): Promise<ProductPageDto> {
    return this.catalog.search(query);
  }

  @Get("products/:id")
  @ApiOperation({
    summary: "Картка товару",
    description: "Фото, кольори, розміри і залишок кожної пари колір + розмір.",
  })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiOkResponse({ type: ProductDetailDto })
  @ApiErrorResponses(404)
  getProduct(@Param("id") id: string): Promise<ProductDetailDto> {
    return this.catalog.getProduct(id);
  }
}
