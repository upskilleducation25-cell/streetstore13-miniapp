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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBody, ApiConsumes, ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { AdminCategory } from "@ss13/shared";

import { AdminAuthGuard } from "../admin-auth/admin-auth.guard.js";
import { ApiErrorResponses } from "../common/swagger.js";
import { AdminCategoriesService } from "./admin-categories.service.js";
import type { UploadedFile as File } from "./admin-images.service.js";
import { uploadLimits } from "./admin-products.controller.js";
import { AdminCategoryDto, AdminCategoryUpdateDto, AdminSortOrderDto } from "./dto.js";

@ApiTags("Адмінка: категорії")
@ApiCookieAuth()
@UseGuards(AdminAuthGuard)
@Controller("admin/categories")
export class AdminCategoriesController {
  constructor(private readonly categories: AdminCategoriesService) {}

  @Get()
  @ApiOperation({ summary: "Усі категорії (і вимкнені) плоским списком з parentId" })
  @ApiErrorResponses(401)
  list(): Promise<AdminCategory[]> {
    return this.categories.list();
  }

  @Post()
  @ApiOperation({ summary: "Створити категорію або підкатегорію (два рівні)" })
  @ApiErrorResponses(400, 401, 403, 409)
  create(@Body() dto: AdminCategoryDto): Promise<AdminCategory> {
    return this.categories.create(dto);
  }

  // Оголошено перед :id, щоб "order" не сприймався як id.
  @Patch("order")
  @ApiOperation({ summary: "Зберегти порядок категорій [{id, sortOrder}]" })
  @ApiErrorResponses(400, 401, 403, 404)
  reorder(@Body() dto: AdminSortOrderDto): Promise<AdminCategory[]> {
    return this.categories.reorder(dto);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Змінити категорію: назва, батько, іконка, активність, порядок" })
  @ApiErrorResponses(400, 401, 403, 404, 409)
  update(@Param("id") id: string, @Body() dto: AdminCategoryUpdateDto): Promise<AdminCategory> {
    return this.categories.update(id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Видалити порожню категорію без підкатегорій" })
  @ApiErrorResponses(401, 403, 404, 409)
  remove(@Param("id") id: string): Promise<void> {
    return this.categories.remove(id);
  }

  @Post(":id/image")
  @UseInterceptors(FileInterceptor("file", uploadLimits))
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: { type: "object", properties: { file: { type: "string", format: "binary" } } },
  })
  @ApiOperation({ summary: "Завантажити зображення категорії" })
  @ApiErrorResponses(400, 401, 403, 404, 503)
  setImage(
    @Param("id") id: string,
    @UploadedFile() file: File | undefined,
  ): Promise<AdminCategory> {
    return this.categories.setImage(id, file);
  }

  @Delete(":id/image")
  @ApiOperation({ summary: "Прибрати зображення категорії" })
  @ApiErrorResponses(401, 403, 404)
  removeImage(@Param("id") id: string): Promise<AdminCategory> {
    return this.categories.removeImage(id);
  }
}
