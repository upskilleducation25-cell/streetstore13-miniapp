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
  Put,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import { ApiBody, ApiConsumes, ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type {
  AdminInventoryMovement,
  AdminProductDetail,
  AdminProductImage,
  AdminProductListResponse,
} from "@ss13/shared";
import { IMAGE_UPLOAD_LIMITS } from "@ss13/shared";

import type { SessionWithAdmin } from "../admin-auth/admin-auth.service.js";
import { AdminAuthGuard } from "../admin-auth/admin-auth.guard.js";
import { CurrentAdminSession } from "../admin-auth/current-admin.decorator.js";
import { ApiErrorResponses } from "../common/swagger.js";
import type { UploadedFile as File } from "./admin-images.service.js";
import { AdminImagesService } from "./admin-images.service.js";
import { AdminProductsService } from "./admin-products.service.js";
import {
  AdminImageOrderDto,
  AdminImageUpdateDto,
  AdminImageUploadDto,
  AdminMovementsQueryDto,
  AdminProductCreateDto,
  AdminProductsQueryDto,
  AdminProductUpdateDto,
  AdminSaveVariantsDto,
  AdminStockAdjustDto,
} from "./dto.js";

/** Файли тримаються в пам'яті лише на час обробки; розмір і кількість обмежує multer. */
export const uploadLimits = {
  limits: {
    fileSize: IMAGE_UPLOAD_LIMITS.maxFileBytes,
    files: IMAGE_UPLOAD_LIMITS.maxFilesPerRequest,
    fields: 5,
    parts: IMAGE_UPLOAD_LIMITS.maxFilesPerRequest + 5,
  },
};

@ApiTags("Адмінка: товари")
@ApiCookieAuth()
@UseGuards(AdminAuthGuard)
@Controller("admin")
export class AdminProductsController {
  constructor(
    private readonly products: AdminProductsService,
    private readonly images: AdminImagesService,
  ) {}

  @Get("products")
  @ApiOperation({ summary: "Товари: пошук, фільтри, сортування, сторінки" })
  @ApiErrorResponses(400, 401)
  list(@Query() query: AdminProductsQueryDto): Promise<AdminProductListResponse> {
    return this.products.list(query);
  }

  @Post("products")
  @ApiOperation({
    summary: "Створити товар (можна одразу з матрицею варіантів)",
    description:
      "Ціни — копійки. ACTIVE потребує хоча б одного увімкненого варіанту. copyImagesFromId — для дублювання.",
  })
  @ApiErrorResponses(400, 401, 403, 409)
  create(
    @Body() dto: AdminProductCreateDto,
    @CurrentAdminSession() session: SessionWithAdmin,
  ): Promise<AdminProductDetail> {
    return this.products.create(dto, session.adminId);
  }

  @Get("products/:id")
  @ApiOperation({ summary: "Товар для форми редагування: усі варіанти (і вимкнені) та фото" })
  @ApiErrorResponses(401, 404)
  get(@Param("id") id: string): Promise<AdminProductDetail> {
    return this.products.get(id);
  }

  @Patch("products/:id")
  @ApiOperation({ summary: "Змінити поля товару, статус (зокрема архів) і позначки" })
  @ApiErrorResponses(400, 401, 403, 404, 409)
  update(@Param("id") id: string, @Body() dto: AdminProductUpdateDto): Promise<AdminProductDetail> {
    return this.products.update(id, dto);
  }

  @Delete("products/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Видалити товар без замовлень",
    description:
      "Товар, що є в замовленнях, не видаляється (409 PRODUCT_HAS_ORDERS) — його архівують.",
  })
  @ApiErrorResponses(401, 403, 404, 409)
  remove(@Param("id") id: string): Promise<void> {
    return this.products.remove(id);
  }

  @Put("products/:id/variants")
  @ApiOperation({
    summary: "Зберегти матрицю колір × розмір із залишками",
    description:
      "Зміна залишку потребує expectedStock (інакше 409 STOCK_CHANGED) і stockNote. Відсутні пари видаляються, а з історією — вимикаються.",
  })
  @ApiErrorResponses(400, 401, 403, 404, 409)
  saveVariants(
    @Param("id") id: string,
    @Body() dto: AdminSaveVariantsDto,
    @CurrentAdminSession() session: SessionWithAdmin,
  ): Promise<AdminProductDetail> {
    return this.products.saveVariants(id, dto, session.adminId);
  }

  @Patch("variants/:id/stock")
  @ApiOperation({ summary: "Швидко змінити залишок варіанту на delta з причиною" })
  @ApiErrorResponses(400, 401, 403, 404, 409)
  adjustStock(
    @Param("id") id: string,
    @Body() dto: AdminStockAdjustDto,
    @CurrentAdminSession() session: SessionWithAdmin,
  ): Promise<{ id: string; stock: number }> {
    return this.products.adjustStock(id, dto, session.adminId);
  }

  @Get("products/:id/movements")
  @ApiOperation({ summary: "Журнал руху складу товару (нові зверху)" })
  @ApiErrorResponses(401, 404)
  movements(
    @Param("id") id: string,
    @Query() query: AdminMovementsQueryDto,
  ): Promise<AdminInventoryMovement[]> {
    return this.products.movements(id, query);
  }

  @Post("products/:id/images")
  @UseInterceptors(FilesInterceptor("files", IMAGE_UPLOAD_LIMITS.maxFilesPerRequest, uploadLimits))
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        files: { type: "array", items: { type: "string", format: "binary" } },
        colorId: { type: "string", format: "uuid" },
      },
    },
  })
  @ApiOperation({
    summary: "Завантажити фото товару",
    description:
      "JPEG/PNG/WebP/AVIF/HEIC до 10 МБ, до 10 файлів за раз. Тип визначається за вмістом. Зберігаються WebP 300/600/1200.",
  })
  @ApiErrorResponses(400, 401, 403, 404, 409, 503)
  upload(
    @Param("id") id: string,
    @UploadedFiles() files: File[] | undefined,
    @Body() dto: AdminImageUploadDto,
  ): Promise<AdminProductImage[]> {
    return this.images.upload(id, files ?? [], dto.colorId);
  }

  @Patch("products/:id/images/order")
  @ApiOperation({ summary: "Новий порядок фото (перше — головне)" })
  @ApiErrorResponses(400, 401, 403, 404, 409)
  reorder(@Param("id") id: string, @Body() dto: AdminImageOrderDto): Promise<AdminProductImage[]> {
    return this.images.reorder(id, dto);
  }

  @Patch("images/:id")
  @ApiOperation({ summary: "Прив'язати фото до кольору або змінити підпис" })
  @ApiErrorResponses(400, 401, 403, 404)
  updateImage(
    @Param("id") id: string,
    @Body() dto: AdminImageUpdateDto,
  ): Promise<AdminProductImage> {
    return this.images.update(id, dto);
  }

  @Delete("images/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Видалити фото (файл у сховищі — коли на нього більше немає посилань)" })
  @ApiErrorResponses(401, 403, 404)
  removeImage(@Param("id") id: string): Promise<void> {
    return this.images.remove(id);
  }
}
