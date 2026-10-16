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
import { ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { AdminBrand, AdminCatalogDictionaries, AdminColor, AdminSize } from "@ss13/shared";

import { AdminAuthGuard } from "../admin-auth/admin-auth.guard.js";
import { ApiErrorResponses } from "../common/swagger.js";
import { AdminDictionariesService } from "./admin-dictionaries.service.js";
import { AdminBrandDto, AdminColorDto, AdminSizeDto } from "./dto.js";

@ApiTags("Адмінка: довідники")
@ApiCookieAuth()
@UseGuards(AdminAuthGuard)
@Controller("admin")
export class AdminDictionariesController {
  constructor(private readonly dictionaries: AdminDictionariesService) {}

  @Get("dictionaries")
  @ApiOperation({
    summary: "Категорії, бренди, кольори, розміри і поріг низького залишку одним запитом",
  })
  @ApiErrorResponses(401)
  all(): Promise<AdminCatalogDictionaries> {
    return this.dictionaries.all();
  }

  @Get("brands")
  @ApiOperation({ summary: "Бренди (і вимкнені)" })
  @ApiErrorResponses(401)
  brands(): Promise<AdminBrand[]> {
    return this.dictionaries.brands();
  }

  @Post("brands")
  @ApiOperation({ summary: "Додати бренд" })
  @ApiErrorResponses(400, 401, 403, 409)
  createBrand(@Body() dto: AdminBrandDto): Promise<AdminBrand> {
    return this.dictionaries.createBrand(dto);
  }

  @Patch("brands/:id")
  @ApiOperation({ summary: "Змінити бренд (повний набір полів)" })
  @ApiErrorResponses(400, 401, 403, 404, 409)
  updateBrand(@Param("id") id: string, @Body() dto: AdminBrandDto): Promise<AdminBrand> {
    return this.dictionaries.updateBrand(id, dto);
  }

  @Delete("brands/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Видалити бренд без товарів" })
  @ApiErrorResponses(401, 403, 404, 409)
  removeBrand(@Param("id") id: string): Promise<void> {
    return this.dictionaries.removeBrand(id);
  }

  @Get("colors")
  @ApiOperation({ summary: "Кольори" })
  @ApiErrorResponses(401)
  colors(): Promise<AdminColor[]> {
    return this.dictionaries.colors();
  }

  @Post("colors")
  @ApiOperation({ summary: "Додати колір" })
  @ApiErrorResponses(400, 401, 403, 409)
  createColor(@Body() dto: AdminColorDto): Promise<AdminColor> {
    return this.dictionaries.createColor(dto);
  }

  @Patch("colors/:id")
  @ApiOperation({ summary: "Змінити колір (повний набір полів)" })
  @ApiErrorResponses(400, 401, 403, 404, 409)
  updateColor(@Param("id") id: string, @Body() dto: AdminColorDto): Promise<AdminColor> {
    return this.dictionaries.updateColor(id, dto);
  }

  @Delete("colors/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Видалити невикористаний колір" })
  @ApiErrorResponses(401, 403, 404, 409)
  removeColor(@Param("id") id: string): Promise<void> {
    return this.dictionaries.removeColor(id);
  }

  @Get("sizes")
  @ApiOperation({ summary: "Розміри за сітками" })
  @ApiErrorResponses(401)
  sizes(): Promise<AdminSize[]> {
    return this.dictionaries.sizes();
  }

  @Post("sizes")
  @ApiOperation({ summary: "Додати розмір" })
  @ApiErrorResponses(400, 401, 403, 409)
  createSize(@Body() dto: AdminSizeDto): Promise<AdminSize> {
    return this.dictionaries.createSize(dto);
  }

  @Patch("sizes/:id")
  @ApiOperation({ summary: "Змінити розмір (повний набір полів)" })
  @ApiErrorResponses(400, 401, 403, 404, 409)
  updateSize(@Param("id") id: string, @Body() dto: AdminSizeDto): Promise<AdminSize> {
    return this.dictionaries.updateSize(id, dto);
  }

  @Delete("sizes/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Видалити невикористаний розмір" })
  @ApiErrorResponses(401, 403, 404, 409)
  removeSize(@Param("id") id: string): Promise<void> {
    return this.dictionaries.removeSize(id);
  }
}
