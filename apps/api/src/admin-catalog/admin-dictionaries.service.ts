import { Injectable } from "@nestjs/common";
import type { AdminBrand, AdminCatalogDictionaries, AdminColor, AdminSize } from "@ss13/shared";

import { notFound } from "../common/app-exception.js";
import { isUuid } from "../common/uuid.js";
import { ProductStatus } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { AdminCategoriesService } from "./admin-categories.service.js";
import { AdminProductsService } from "./admin-products.service.js";
import { conflict, fieldError, isUniqueViolation, resolveSlug } from "./catalog-errors.js";
import type { AdminBrandDto, AdminColorDto, AdminSizeDto, AdminSortOrderDto } from "./dto.js";

const brandNotFound = () => notFound("BRAND_NOT_FOUND", "Бренд не знайдено");
const colorNotFound = () => notFound("COLOR_NOT_FOUND", "Колір не знайдено");
const sizeNotFound = () => notFound("SIZE_NOT_FOUND", "Розмір не знайдено");

/** Унікальність назви / slug / розміру → зрозумілий 409 замість 500. */
async function uniqueOr409<T>(action: () => Promise<T>, message: string): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (isUniqueViolation(error)) throw conflict("ALREADY_EXISTS", message);
    throw error;
  }
}

/** Довідники бренди / кольори / розміри. Використаний запис видалити не можна (409). */
@Injectable()
export class AdminDictionariesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categories: AdminCategoriesService,
    private readonly products: AdminProductsService,
  ) {}

  async all(): Promise<AdminCatalogDictionaries> {
    const [categories, brands, colors, sizes, lowStockThreshold] = await Promise.all([
      this.categories.list(),
      this.brands(),
      this.colors(),
      this.sizes(),
      this.products.lowStockThreshold(),
    ]);
    return { categories, brands, colors, sizes, lowStockThreshold };
  }

  /** Порядок у фільтрах і на картці товару: одним запитом, у транзакції. */
  async reorder(kind: "brand" | "color" | "size", dto: AdminSortOrderDto): Promise<void> {
    const ids = dto.items.map((item) => item.id);
    if (new Set(ids).size !== ids.length) throw fieldError("items", "id повторюється");
    const missing = { brand: brandNotFound, color: colorNotFound, size: sizeNotFound }[kind];
    await this.prisma.$transaction(async (tx) => {
      // Окремі виклики замість динамічного делегата — так Prisma лишається типізованою.
      const count = (where: { id: { in: string[] } }) =>
        kind === "brand"
          ? tx.brand.count({ where })
          : kind === "color"
            ? tx.color.count({ where })
            : tx.size.count({ where });
      if ((await count({ id: { in: ids } })) !== ids.length) throw missing();
      for (const { id, sortOrder } of dto.items) {
        if (kind === "brand") await tx.brand.update({ where: { id }, data: { sortOrder } });
        else if (kind === "color") await tx.color.update({ where: { id }, data: { sortOrder } });
        else await tx.size.update({ where: { id }, data: { sortOrder } });
      }
    });
  }

  // ─── Бренди ───

  async brands(): Promise<AdminBrand[]> {
    const brands = await this.prisma.brand.findMany({
      include: {
        _count: { select: { products: { where: { status: { not: ProductStatus.ARCHIVED } } } } },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    return brands.map((brand) => ({
      id: brand.id,
      name: brand.name,
      slug: brand.slug,
      logoUrl: brand.logoUrl,
      sortOrder: brand.sortOrder,
      isActive: brand.isActive,
      productCount: brand._count.products,
    }));
  }

  private brandSlug(requested: string | undefined, name: string, exceptId?: string) {
    return resolveSlug({
      requested,
      sources: [name],
      fallback: "brand",
      isTaken: async (slug) =>
        Boolean(
          await this.prisma.brand.findFirst({
            where: { slug, ...(exceptId ? { id: { not: exceptId } } : {}) },
          }),
        ),
    });
  }

  async createBrand(dto: AdminBrandDto): Promise<AdminBrand> {
    const slug = await this.brandSlug(dto.slug, dto.name);
    const last = await this.prisma.brand.aggregate({ _max: { sortOrder: true } });
    const brand = await uniqueOr409(
      () =>
        this.prisma.brand.create({
          data: {
            name: dto.name,
            slug,
            logoUrl: dto.logoUrl,
            isActive: dto.isActive,
            sortOrder: dto.sortOrder ?? (last._max.sortOrder ?? 0) + 10,
          },
        }),
      "Бренд з такою назвою або slug уже є",
    );
    return (await this.brands()).find((item) => item.id === brand.id)!;
  }

  async updateBrand(id: string, dto: AdminBrandDto): Promise<AdminBrand> {
    if (!isUuid(id)) throw brandNotFound();
    const current = await this.prisma.brand.findUnique({ where: { id } });
    if (!current) throw brandNotFound();
    const slug =
      dto.slug !== undefined && dto.slug !== current.slug
        ? await this.brandSlug(dto.slug, dto.name, id)
        : current.slug;
    await uniqueOr409(
      () =>
        this.prisma.brand.update({
          where: { id },
          data: {
            name: dto.name,
            slug,
            logoUrl: dto.logoUrl,
            isActive: dto.isActive,
            ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
          },
        }),
      "Бренд з такою назвою або slug уже є",
    );
    return (await this.brands()).find((item) => item.id === id)!;
  }

  async removeBrand(id: string): Promise<void> {
    if (!isUuid(id)) throw brandNotFound();
    const brand = await this.prisma.brand.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });
    if (!brand) throw brandNotFound();
    if (brand._count.products > 0) {
      throw conflict(
        "BRAND_IN_USE",
        `Бренд використовується в ${brand._count.products} товар(ах), зокрема архівних. Вимкніть його замість видалення.`,
      );
    }
    await this.prisma.brand.delete({ where: { id } });
  }

  // ─── Кольори ───

  async colors(): Promise<AdminColor[]> {
    const colors = await this.prisma.color.findMany({
      include: { _count: { select: { variants: true } } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    return colors.map((color) => ({
      id: color.id,
      name: color.name,
      slug: color.slug,
      hex: color.hex,
      sortOrder: color.sortOrder,
      variantCount: color._count.variants,
    }));
  }

  private colorSlug(requested: string | undefined, name: string, exceptId?: string) {
    return resolveSlug({
      requested,
      sources: [name],
      fallback: "color",
      isTaken: async (slug) =>
        Boolean(
          await this.prisma.color.findFirst({
            where: { slug, ...(exceptId ? { id: { not: exceptId } } : {}) },
          }),
        ),
    });
  }

  async createColor(dto: AdminColorDto): Promise<AdminColor> {
    const slug = await this.colorSlug(dto.slug, dto.name);
    const last = await this.prisma.color.aggregate({ _max: { sortOrder: true } });
    const color = await uniqueOr409(
      () =>
        this.prisma.color.create({
          data: {
            name: dto.name,
            slug,
            hex: dto.hex,
            sortOrder: dto.sortOrder ?? (last._max.sortOrder ?? 0) + 10,
          },
        }),
      "Колір з такою назвою або slug уже є",
    );
    return (await this.colors()).find((item) => item.id === color.id)!;
  }

  async updateColor(id: string, dto: AdminColorDto): Promise<AdminColor> {
    if (!isUuid(id)) throw colorNotFound();
    const current = await this.prisma.color.findUnique({ where: { id } });
    if (!current) throw colorNotFound();
    const slug =
      dto.slug !== undefined && dto.slug !== current.slug
        ? await this.colorSlug(dto.slug, dto.name, id)
        : current.slug;
    await uniqueOr409(
      () =>
        this.prisma.color.update({
          where: { id },
          data: {
            name: dto.name,
            slug,
            hex: dto.hex,
            ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
          },
        }),
      "Колір з такою назвою або slug уже є",
    );
    return (await this.colors()).find((item) => item.id === id)!;
  }

  async removeColor(id: string): Promise<void> {
    if (!isUuid(id)) throw colorNotFound();
    const color = await this.prisma.color.findUnique({
      where: { id },
      include: { _count: { select: { variants: true } } },
    });
    if (!color) throw colorNotFound();
    if (color._count.variants > 0) {
      throw conflict(
        "COLOR_IN_USE",
        `Колір використовується у ${color._count.variants} варіант(ах)`,
      );
    }
    await this.prisma.color.delete({ where: { id } });
  }

  // ─── Розміри ───

  async sizes(): Promise<AdminSize[]> {
    const sizes = await this.prisma.size.findMany({
      include: { _count: { select: { variants: true } } },
      orderBy: [{ sizeSystem: "asc" }, { sortOrder: "asc" }, { label: "asc" }],
    });
    return sizes.map((size) => ({
      id: size.id,
      label: size.label,
      sizeSystem: size.sizeSystem,
      sortOrder: size.sortOrder,
      variantCount: size._count.variants,
    }));
  }

  async createSize(dto: AdminSizeDto): Promise<AdminSize> {
    const last = await this.prisma.size.aggregate({
      where: { sizeSystem: dto.sizeSystem },
      _max: { sortOrder: true },
    });
    const size = await uniqueOr409(
      () =>
        this.prisma.size.create({
          data: {
            label: dto.label,
            sizeSystem: dto.sizeSystem,
            sortOrder: dto.sortOrder ?? (last._max.sortOrder ?? 0) + 10,
          },
        }),
      "Такий розмір у цій сітці вже є",
    );
    return (await this.sizes()).find((item) => item.id === size.id)!;
  }

  async updateSize(id: string, dto: AdminSizeDto): Promise<AdminSize> {
    if (!isUuid(id)) throw sizeNotFound();
    if (!(await this.prisma.size.findUnique({ where: { id } }))) throw sizeNotFound();
    await uniqueOr409(
      () =>
        this.prisma.size.update({
          where: { id },
          data: {
            label: dto.label,
            sizeSystem: dto.sizeSystem,
            ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
          },
        }),
      "Такий розмір у цій сітці вже є",
    );
    return (await this.sizes()).find((item) => item.id === id)!;
  }

  async removeSize(id: string): Promise<void> {
    if (!isUuid(id)) throw sizeNotFound();
    const size = await this.prisma.size.findUnique({
      where: { id },
      include: { _count: { select: { variants: true } } },
    });
    if (!size) throw sizeNotFound();
    if (size._count.variants > 0) {
      throw conflict(
        "SIZE_IN_USE",
        `Розмір використовується у ${size._count.variants} варіант(ах)`,
      );
    }
    await this.prisma.size.delete({ where: { id } });
  }
}
