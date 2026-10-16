import { Injectable } from "@nestjs/common";
import type { AdminCategory } from "@ss13/shared";

import { notFound } from "../common/app-exception.js";
import { isUuid } from "../common/uuid.js";
import type { Category, Prisma } from "../generated/prisma/client.js";
import { ProductStatus } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { processImage } from "../storage/image-processing.js";
import { StorageService } from "../storage/storage.service.js";
import type { UploadedFile } from "./admin-images.service.js";
import { conflict, fieldError, isUniqueViolation, resolveSlug } from "./catalog-errors.js";
import type { AdminCategoryDto, AdminCategoryUpdateDto, AdminSortOrderDto } from "./dto.js";

type Tx = Prisma.TransactionClient;

const categoryNotFound = () => notFound("CATEGORY_NOT_FOUND", "Категорію не знайдено");

/**
 * Категорії: два рівні (розділ і підкатегорія), як їх показує публічний каталог.
 * Так цикли неможливі в принципі; додатково перевіряємо, що батько — не сама категорія.
 */
@Injectable()
export class AdminCategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async list(): Promise<AdminCategory[]> {
    const [categories, counts] = await Promise.all([
      this.prisma.category.findMany({
        include: { _count: { select: { children: true } } },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      this.prisma.product.groupBy({
        by: ["categoryId"],
        where: { status: { not: ProductStatus.ARCHIVED } },
        _count: { _all: true },
      }),
    ]);
    const countById = new Map(counts.map((row) => [row.categoryId, row._count._all]));
    return categories.map((category) => ({
      id: category.id,
      parentId: category.parentId,
      name: category.name,
      slug: category.slug,
      icon: category.icon,
      imageUrl: category.imageUrl,
      sortOrder: category.sortOrder,
      isActive: category.isActive,
      productCount: countById.get(category.id) ?? 0,
      childCount: category._count.children,
    }));
  }

  private async one(id: string): Promise<AdminCategory> {
    const category = (await this.list()).find((item) => item.id === id);
    if (!category) throw categoryNotFound();
    return category;
  }

  private async assertParent(tx: Tx, parentId: string | null, selfId?: string): Promise<void> {
    if (parentId === null) return;
    if (parentId === selfId)
      throw fieldError("parentId", "Категорія не може бути батьком сама собі");
    const parent = await tx.category.findUnique({ where: { id: parentId } });
    if (!parent) throw fieldError("parentId", "Батьківську категорію не знайдено");
    if (parent.parentId !== null) {
      throw fieldError("parentId", "Підкатегорію можна створити тільки в розділі верхнього рівня");
    }
    if (selfId) {
      const children = await tx.category.count({ where: { parentId: selfId } });
      if (children > 0) {
        throw fieldError("parentId", "Категорія з підкатегоріями не може стати підкатегорією");
      }
    }
  }

  private slug(tx: Tx, requested: string | undefined, name: string, exceptId?: string) {
    return resolveSlug({
      requested,
      sources: [name],
      fallback: "category",
      isTaken: async (slug) =>
        Boolean(
          await tx.category.findFirst({
            where: { slug, ...(exceptId ? { id: { not: exceptId } } : {}) },
            select: { id: true },
          }),
        ),
    });
  }

  async create(dto: AdminCategoryDto): Promise<AdminCategory> {
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        await this.assertParent(tx, dto.parentId);
        const slug = await this.slug(tx, dto.slug, dto.name);
        const last = await tx.category.aggregate({
          where: { parentId: dto.parentId },
          _max: { sortOrder: true },
        });
        return tx.category.create({
          data: {
            name: dto.name,
            slug,
            parentId: dto.parentId,
            icon: dto.icon,
            isActive: dto.isActive,
            sortOrder: dto.sortOrder ?? (last._max.sortOrder ?? 0) + 10,
          },
        });
      });
      return this.one(created.id);
    } catch (error) {
      if (isUniqueViolation(error)) throw conflict("SLUG_TAKEN", "Такий slug уже використовується");
      throw error;
    }
  }

  async update(id: string, dto: AdminCategoryUpdateDto): Promise<AdminCategory> {
    if (!isUuid(id)) throw categoryNotFound();
    try {
      await this.prisma.$transaction(async (tx) => {
        // Блокування категорій робить перевірку «немає циклу / два рівні» атомарною.
        await tx.$queryRaw`SELECT id FROM categories ORDER BY id FOR UPDATE`;
        const current = await tx.category.findUnique({ where: { id } });
        if (!current) throw categoryNotFound();
        if (dto.parentId !== undefined && dto.parentId !== current.parentId) {
          await this.assertParent(tx, dto.parentId, id);
        }
        const slug =
          dto.slug !== undefined && dto.slug !== current.slug
            ? await this.slug(tx, dto.slug, current.name, id)
            : undefined;
        await tx.category.update({
          where: { id },
          data: {
            ...(dto.name !== undefined ? { name: dto.name } : {}),
            ...(slug !== undefined ? { slug } : {}),
            ...(dto.parentId !== undefined ? { parentId: dto.parentId } : {}),
            ...(dto.icon !== undefined ? { icon: dto.icon } : {}),
            ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
            ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
          },
        });
      });
      return this.one(id);
    } catch (error) {
      if (isUniqueViolation(error)) throw conflict("SLUG_TAKEN", "Такий slug уже використовується");
      throw error;
    }
  }

  async reorder(dto: AdminSortOrderDto): Promise<AdminCategory[]> {
    const ids = dto.items.map((item) => item.id);
    if (new Set(ids).size !== ids.length) throw fieldError("items", "id повторюється");
    await this.prisma.$transaction(async (tx) => {
      const found = await tx.category.count({ where: { id: { in: ids } } });
      if (found !== ids.length) throw categoryNotFound();
      for (const item of dto.items) {
        await tx.category.update({ where: { id: item.id }, data: { sortOrder: item.sortOrder } });
      }
    });
    return this.list();
  }

  async remove(id: string): Promise<void> {
    if (!isUuid(id)) throw categoryNotFound();
    const removed = await this.prisma.$transaction(async (tx) => {
      const category = await tx.category.findUnique({
        where: { id },
        include: { _count: { select: { children: true, products: true } } },
      });
      if (!category) throw categoryNotFound();
      if (category._count.children > 0) {
        throw conflict("CATEGORY_HAS_CHILDREN", "Спершу видаліть або перенесіть підкатегорії", {
          children: category._count.children,
        });
      }
      if (category._count.products > 0) {
        throw conflict(
          "CATEGORY_HAS_PRODUCTS",
          `У категорії ${category._count.products} товар(ів), зокрема архівні. Перенесіть їх в іншу категорію або вимкніть категорію.`,
          { products: category._count.products },
        );
      }
      await tx.category.delete({ where: { id } });
      return category;
    });
    await this.deleteImageFile(removed);
  }

  private async deleteImageFile(category: Category): Promise<void> {
    const base = this.storage.baseFromUrl(category.imageUrl);
    if (base) await this.storage.deleteImages([base]);
  }

  async setImage(id: string, file: UploadedFile | undefined): Promise<AdminCategory> {
    if (!isUuid(id)) throw categoryNotFound();
    this.storage.assertAvailable();
    if (!file) throw fieldError("file", "Оберіть зображення");
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw categoryNotFound();
    const processed = await processImage(file.buffer, file.originalname.slice(0, 80));
    const stored = await this.storage.saveImage("categories", id, processed);
    try {
      await this.prisma.category.update({ where: { id }, data: { imageUrl: stored.urls.medium } });
    } catch (error) {
      await this.storage.deleteImages([stored.storageKey]);
      throw error;
    }
    await this.deleteImageFile(category);
    return this.one(id);
  }

  async removeImage(id: string): Promise<AdminCategory> {
    if (!isUuid(id)) throw categoryNotFound();
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw categoryNotFound();
    await this.prisma.category.update({ where: { id }, data: { imageUrl: null } });
    await this.deleteImageFile(category);
    return this.one(id);
  }
}
