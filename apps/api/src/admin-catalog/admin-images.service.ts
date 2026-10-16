import { Injectable } from "@nestjs/common";
import type { AdminProductImage } from "@ss13/shared";
import { IMAGE_UPLOAD_LIMITS } from "@ss13/shared";

import { notFound } from "../common/app-exception.js";
import { isUuid } from "../common/uuid.js";
import { PrismaService } from "../prisma/prisma.service.js";
import type { ProcessedImage } from "../storage/image-processing.js";
import { processImage } from "../storage/image-processing.js";
import type { StoredImage } from "../storage/storage.service.js";
import { StorageService } from "../storage/storage.service.js";
import { toAdminImage } from "./admin-mappers.js";
import { conflict, fieldError } from "./catalog-errors.js";
import type { AdminImageOrderDto, AdminImageUpdateDto } from "./dto.js";

export interface UploadedFile {
  originalname: string;
  buffer: Buffer;
  size: number;
}

const productNotFound = () => notFound("PRODUCT_NOT_FOUND", "Товар не знайдено");
const imageNotFound = () => notFound("IMAGE_NOT_FOUND", "Фото не знайдено");

/** Ім'я файлу тільки для повідомлення про помилку: без шляху і керівних символів. */
const displayName = (name: string) =>
  name
    .replace(/[\\/]/g, "_")
    .replace(/\p{Cc}/gu, "")
    .slice(0, 80) || "файл";

@Injectable()
export class AdminImagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async listForProduct(productId: string): Promise<AdminProductImage[]> {
    const images = await this.prisma.productImage.findMany({
      where: { productId },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });
    return images.map(toAdminImage);
  }

  private async assertColor(colorId: string | null | undefined): Promise<void> {
    if (colorId && !(await this.prisma.color.findUnique({ where: { id: colorId } }))) {
      throw fieldError("colorId", "Колір не знайдено");
    }
  }

  async upload(
    productId: string,
    files: UploadedFile[],
    colorId: string | null | undefined,
  ): Promise<AdminProductImage[]> {
    if (!isUuid(productId)) throw productNotFound();
    this.storage.assertAvailable();
    if (files.length === 0) throw fieldError("files", "Оберіть хоча б одне фото");
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, _count: { select: { images: true } } },
    });
    if (!product) throw productNotFound();
    if (product._count.images + files.length > IMAGE_UPLOAD_LIMITS.maxImagesPerProduct) {
      throw conflict(
        "TOO_MANY_IMAGES",
        `У товару може бути не більше ${IMAGE_UPLOAD_LIMITS.maxImagesPerProduct} фото`,
      );
    }
    await this.assertColor(colorId);

    // Спершу перевіряємо й обробляємо всі файли: один поганий файл — нічого не завантажено.
    const processed: ProcessedImage[] = [];
    for (const file of files)
      processed.push(await processImage(file.buffer, displayName(file.originalname)));

    const stored: StoredImage[] = [];
    try {
      for (const image of processed)
        stored.push(await this.storage.saveImage("products", productId, image));

      await this.prisma.$transaction(async (tx) => {
        const [locked] = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM products WHERE id = ${productId}::uuid FOR UPDATE
        `;
        if (!locked) throw productNotFound();
        const count = await tx.productImage.count({ where: { productId } });
        if (count + stored.length > IMAGE_UPLOAD_LIMITS.maxImagesPerProduct) {
          throw conflict(
            "TOO_MANY_IMAGES",
            `У товару може бути не більше ${IMAGE_UPLOAD_LIMITS.maxImagesPerProduct} фото`,
          );
        }
        const last = await tx.productImage.aggregate({
          where: { productId },
          _max: { sortOrder: true },
        });
        const start = (last._max.sortOrder ?? -1) + 1;
        await tx.productImage.createMany({
          data: stored.map((image, index) => ({
            productId,
            colorId: colorId ?? null,
            storageKey: image.storageKey,
            urls: image.urls,
            width: processed[index]!.width,
            height: processed[index]!.height,
            sortOrder: start + index,
          })),
        });
      });
    } catch (error) {
      // Запис у БД не вдався — прибираємо вже завантажені файли.
      await this.storage.deleteImages(stored.map((image) => image.storageKey));
      throw error;
    }
    return this.listForProduct(productId);
  }

  async reorder(productId: string, dto: AdminImageOrderDto): Promise<AdminProductImage[]> {
    if (!isUuid(productId)) throw productNotFound();
    await this.prisma.$transaction(async (tx) => {
      const [locked] = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM products WHERE id = ${productId}::uuid FOR UPDATE
      `;
      if (!locked) throw productNotFound();
      const images = await tx.productImage.findMany({ where: { productId }, select: { id: true } });
      const current = new Set(images.map((image) => image.id));
      if (dto.ids.length !== current.size || dto.ids.some((id) => !current.has(id))) {
        throw conflict("IMAGES_CHANGED", "Список фото змінився. Оновіть сторінку.");
      }
      for (const [index, id] of dto.ids.entries()) {
        await tx.productImage.update({ where: { id }, data: { sortOrder: index } });
      }
    });
    return this.listForProduct(productId);
  }

  async update(imageId: string, dto: AdminImageUpdateDto): Promise<AdminProductImage> {
    if (!isUuid(imageId)) throw imageNotFound();
    await this.assertColor(dto.colorId);
    const image = await this.prisma.productImage.findUnique({ where: { id: imageId } });
    if (!image) throw imageNotFound();
    const updated = await this.prisma.productImage.update({
      where: { id: imageId },
      data: {
        ...(dto.colorId !== undefined ? { colorId: dto.colorId } : {}),
        ...(dto.alt !== undefined ? { alt: dto.alt } : {}),
      },
    });
    return toAdminImage(updated);
  }

  async remove(imageId: string): Promise<void> {
    if (!isUuid(imageId)) throw imageNotFound();
    const orphan = await this.prisma.$transaction(async (tx) => {
      const image = await tx.productImage.findUnique({ where: { id: imageId } });
      if (!image) throw imageNotFound();
      await tx.productImage.delete({ where: { id: imageId } });
      // Файл спільний з копією товару (дублювання) — лишаємо, поки є інші посилання.
      const others = await tx.productImage.count({ where: { storageKey: image.storageKey } });
      return others === 0 ? image.storageKey : null;
    });
    if (orphan) await this.storage.deleteImages([orphan]);
  }
}
