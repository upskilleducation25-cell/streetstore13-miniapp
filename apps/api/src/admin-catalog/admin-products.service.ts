import { Injectable } from "@nestjs/common";
import type {
  AdminInventoryMovement,
  AdminProductDetail,
  AdminProductListResponse,
  AdminProductSort,
} from "@ss13/shared";

import { notFound } from "../common/app-exception.js";
import { isUuid } from "../common/uuid.js";
import type { Prisma } from "../generated/prisma/client.js";
import { InventoryReason, ProductStatus } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { StorageService } from "../storage/storage.service.js";
import {
  adminProductDetailInclude,
  adminProductListInclude,
  movementInclude,
  toAdminDetail,
  toAdminListItem,
  toAdminMovement,
} from "./admin-mappers.js";
import { conflict, fieldError, isUniqueViolation, resolveSlug } from "./catalog-errors.js";
import type {
  AdminMovementsQueryDto,
  AdminProductCreateDto,
  AdminProductsQueryDto,
  AdminProductUpdateDto,
  AdminSaveVariantsDto,
  AdminStockAdjustDto,
  AdminVariantDto,
} from "./dto.js";

type Tx = Prisma.TransactionClient;

const productNotFound = () => notFound("PRODUCT_NOT_FOUND", "Товар не знайдено");
const variantNotFound = () => notFound("VARIANT_NOT_FOUND", "Варіант не знайдено");

const SORTS: Record<AdminProductSort, Prisma.ProductOrderByWithRelationInput[]> = {
  updated_desc: [{ updatedAt: "desc" }, { id: "desc" }],
  created_desc: [{ createdAt: "desc" }, { id: "desc" }],
  name_asc: [{ name: "asc" }, { id: "asc" }],
  price_asc: [{ price: "asc" }, { id: "asc" }],
  price_desc: [{ price: "desc" }, { id: "desc" }],
  stock_asc: [{ totalStock: "asc" }, { id: "asc" }],
  stock_desc: [{ totalStock: "desc" }, { id: "desc" }],
};

const DEFAULT_LOW_STOCK_THRESHOLD = 2;

function assertOldPrice(price: number, oldPrice: number | null): void {
  if (oldPrice !== null && oldPrice <= price) {
    throw fieldError("oldPrice", "Стара ціна має бути більшою за ціну");
  }
}

const notReady = () =>
  conflict(
    "PRODUCT_NOT_READY",
    "Щоб зробити товар активним, додайте хоча б один увімкнений варіант (колір і розмір).",
  );

interface LockedVariant {
  id: string;
  colorId: string;
  sizeId: string;
  stock: number;
  keep: boolean;
}

const pairKey = (colorId: string, sizeId: string) => `${colorId}/${sizeId}`;

@Injectable()
export class AdminProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async lowStockThreshold(): Promise<number> {
    const setting = await this.prisma.setting.findUnique({
      where: { key: "inventory.lowStockThreshold" },
    });
    const value = setting?.value;
    return typeof value === "number" && Number.isInteger(value) && value >= 0
      ? value
      : DEFAULT_LOW_STOCK_THRESHOLD;
  }

  async list(query: AdminProductsQueryDto): Promise<AdminProductListResponse> {
    const and: Prisma.ProductWhereInput[] = [
      query.status ? { status: query.status } : { status: { not: ProductStatus.ARCHIVED } },
    ];
    if (query.q) {
      const contains = { contains: query.q, mode: "insensitive" as const };
      and.push({
        OR: [{ name: contains }, { sku: contains }, { variants: { some: { sku: contains } } }],
      });
    }
    if (query.categoryId) {
      and.push({
        OR: [{ categoryId: query.categoryId }, { category: { parentId: query.categoryId } }],
      });
    }
    if (query.brandId) and.push({ brandId: query.brandId });
    if (query.flag === "new") and.push({ isNew: true });
    if (query.flag === "popular") and.push({ isPopular: true });
    if (query.flag === "sale") and.push({ isSale: true });
    if (query.stock === "out") and.push({ totalStock: 0 });
    if (query.stock === "in") and.push({ totalStock: { gt: 0 } });
    if (query.stock === "low") {
      and.push({ totalStock: { gte: 1, lte: await this.lowStockThreshold() } });
    }

    const where: Prisma.ProductWhereInput = { AND: and };
    const [total, rows] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        include: adminProductListInclude,
        orderBy: SORTS[query.sort],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);
    return { items: rows.map(toAdminListItem), total, page: query.page, limit: query.limit };
  }

  async get(id: string, client: Tx | PrismaService = this.prisma): Promise<AdminProductDetail> {
    if (!isUuid(id)) throw productNotFound();
    const row = await client.product.findUnique({
      where: { id },
      include: adminProductDetailInclude,
    });
    if (!row) throw productNotFound();
    return toAdminDetail(row);
  }

  private async assertReferences(
    tx: Tx,
    refs: { brandId?: string; categoryId?: string },
  ): Promise<void> {
    if (refs.brandId && !(await tx.brand.findUnique({ where: { id: refs.brandId } }))) {
      throw fieldError("brandId", "Бренд не знайдено");
    }
    if (refs.categoryId && !(await tx.category.findUnique({ where: { id: refs.categoryId } }))) {
      throw fieldError("categoryId", "Категорію не знайдено");
    }
  }

  private async assertSkuFree(tx: Tx, sku: string, exceptId?: string): Promise<void> {
    const other = await tx.product.findFirst({
      where: {
        sku: { equals: sku, mode: "insensitive" },
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      select: { id: true },
    });
    if (other) {
      throw conflict("SKU_TAKEN", "Товар з таким артикулом уже є", [
        { field: "sku", errors: ["артикул зайнятий"] },
      ]);
    }
  }

  private productSlug(
    tx: Tx,
    requested: string | undefined,
    name: string,
    sku: string,
    exceptId?: string,
  ) {
    return resolveSlug({
      requested,
      sources: [name, sku],
      fallback: "product",
      isTaken: async (slug) =>
        Boolean(
          await tx.product.findFirst({
            where: { slug, ...(exceptId ? { id: { not: exceptId } } : {}) },
            select: { id: true },
          }),
        ),
    });
  }

  /** Блокує варіанти товару (FOR UPDATE, у порядку id) і повертає їх з ознакою «є історія». */
  private async lockVariants(tx: Tx, productId: string): Promise<LockedVariant[]> {
    await tx.$queryRaw`
      SELECT id FROM product_variants WHERE product_id = ${productId}::uuid ORDER BY id FOR UPDATE
    `;
    const variants = await tx.productVariant.findMany({
      where: { productId },
      include: { _count: { select: { orderItems: true, inventoryMovements: true } } },
    });
    return variants.map((variant) => ({
      id: variant.id,
      colorId: variant.colorId,
      sizeId: variant.sizeId,
      stock: variant.stock,
      keep:
        variant._count.orderItems > 0 || variant._count.inventoryMovements > 0 || variant.stock > 0,
    }));
  }

  /**
   * Зберігає матрицю варіантів. Залишок змінюється тільки якщо адмін бачив актуальне
   * значення (expectedStock), кожна зміна пише рух складу MANUAL з причиною і адміном.
   * Пари, яких немає в запиті, видаляються, а з історією чи залишком — вимикаються.
   */
  private async applyVariants(
    tx: Tx,
    productId: string,
    existing: LockedVariant[],
    payload: AdminVariantDto[],
    stockNote: string | null | undefined,
    adminId: string,
  ): Promise<void> {
    const seen = new Set<string>();
    for (const variant of payload) {
      const key = pairKey(variant.colorId, variant.sizeId);
      if (seen.has(key)) throw fieldError("variants", "Пара колір + розмір повторюється");
      seen.add(key);
    }

    const colorIds = [...new Set(payload.map((v) => v.colorId))];
    const sizeIds = [...new Set(payload.map((v) => v.sizeId))];
    // Послідовно: в одній транзакції запити не можна запускати паралельно.
    const colors = await tx.color.count({ where: { id: { in: colorIds } } });
    const sizes = await tx.size.count({ where: { id: { in: sizeIds } } });
    if (colors !== colorIds.length) throw fieldError("variants", "Невідомий колір у варіантах");
    if (sizes !== sizeIds.length) throw fieldError("variants", "Невідомий розмір у варіантах");

    const byPair = new Map(
      existing.map((variant) => [pairKey(variant.colorId, variant.sizeId), variant]),
    );
    const stale: Array<{
      colorId: string;
      sizeId: string;
      expected: number | null;
      actual: number;
    }> = [];
    let stockChanged = false;
    for (const variant of payload) {
      const current = byPair.get(pairKey(variant.colorId, variant.sizeId));
      if (!current) {
        if (variant.stock > 0) stockChanged = true;
        continue;
      }
      if (variant.stock !== current.stock) {
        stockChanged = true;
        if (variant.expectedStock !== current.stock) {
          stale.push({
            colorId: variant.colorId,
            sizeId: variant.sizeId,
            expected: variant.expectedStock ?? null,
            actual: current.stock,
          });
        }
      }
    }
    if (stale.length > 0) {
      throw conflict(
        "STOCK_CHANGED",
        "Залишки змінилися, поки форма була відкрита (можливо, був продаж). Оновіть дані й повторіть.",
        stale,
      );
    }
    if (stockChanged && !stockNote) {
      throw fieldError("stockNote", "Вкажіть причину зміни залишків", "STOCK_NOTE_REQUIRED");
    }

    const movements: Prisma.InventoryMovementCreateManyInput[] = [];
    for (const variant of payload) {
      const current = byPair.get(pairKey(variant.colorId, variant.sizeId));
      const data = {
        sku: variant.sku,
        priceOverride: variant.priceOverride,
        isActive: variant.isActive,
        stock: variant.stock,
      };
      if (current) {
        await tx.productVariant.update({ where: { id: current.id }, data });
        const delta = variant.stock - current.stock;
        if (delta !== 0)
          movements.push({
            variantId: current.id,
            delta,
            reason: InventoryReason.MANUAL,
            note: stockNote!,
            adminId,
          });
      } else {
        const created = await tx.productVariant.create({
          data: { ...data, productId, colorId: variant.colorId, sizeId: variant.sizeId },
        });
        if (variant.stock > 0) {
          movements.push({
            variantId: created.id,
            delta: variant.stock,
            reason: InventoryReason.MANUAL,
            note: stockNote!,
            adminId,
          });
        }
      }
    }

    const removed = existing.filter(
      (variant) => !seen.has(pairKey(variant.colorId, variant.sizeId)),
    );
    const toDisable = removed.filter((variant) => variant.keep).map((variant) => variant.id);
    const toDelete = removed.filter((variant) => !variant.keep).map((variant) => variant.id);
    if (toDisable.length > 0) {
      await tx.productVariant.updateMany({
        where: { id: { in: toDisable } },
        data: { isActive: false },
      });
    }
    if (toDelete.length > 0)
      await tx.productVariant.deleteMany({ where: { id: { in: toDelete } } });
    if (movements.length > 0) await tx.inventoryMovement.createMany({ data: movements });
  }

  private async assertActiveReady(tx: Tx, productId: string, status: ProductStatus): Promise<void> {
    if (status !== ProductStatus.ACTIVE) return;
    const active = await tx.productVariant.count({ where: { productId, isActive: true } });
    if (active === 0) throw notReady();
  }

  async create(dto: AdminProductCreateDto, adminId: string): Promise<AdminProductDetail> {
    assertOldPrice(dto.price, dto.oldPrice);
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.assertReferences(tx, dto);
        await this.assertSkuFree(tx, dto.sku);
        const slug = await this.productSlug(tx, dto.slug, dto.name, dto.sku);

        const product = await tx.product.create({
          data: {
            sku: dto.sku,
            slug,
            name: dto.name,
            brandId: dto.brandId,
            categoryId: dto.categoryId,
            description: dto.description,
            material: dto.material,
            price: dto.price,
            oldPrice: dto.oldPrice,
            status: dto.status,
            isNew: dto.isNew,
            isPopular: dto.isPopular,
            isSale: dto.isSale,
            sortWeight: dto.sortWeight ?? 0,
          },
        });

        if (dto.variants && dto.variants.length > 0) {
          await this.applyVariants(
            tx,
            product.id,
            [],
            dto.variants,
            dto.stockNote ?? "Початковий залишок",
            adminId,
          );
        }

        if (dto.copyImagesFromId) {
          // Ті самі файли у сховищі: файл видаляється, лише коли на нього не посилається жодне фото.
          const images = await tx.productImage.findMany({
            where: { productId: dto.copyImagesFromId },
          });
          if (
            images.length === 0 &&
            !(await tx.product.findUnique({ where: { id: dto.copyImagesFromId } }))
          ) {
            throw fieldError("copyImagesFromId", "Товар для копіювання фото не знайдено");
          }
          if (images.length > 0) {
            await tx.productImage.createMany({
              data: images.map((image) => ({
                productId: product.id,
                colorId: image.colorId,
                storageKey: image.storageKey,
                urls: image.urls as Prisma.InputJsonValue,
                width: image.width,
                height: image.height,
                alt: image.alt,
                sortOrder: image.sortOrder,
              })),
            });
          }
        }

        await this.assertActiveReady(tx, product.id, dto.status);
        return this.get(product.id, tx);
      });
    } catch (error) {
      if (isUniqueViolation(error))
        throw conflict("SKU_OR_SLUG_TAKEN", "Артикул або slug уже зайнятий");
      throw error;
    }
  }

  async update(id: string, dto: AdminProductUpdateDto): Promise<AdminProductDetail> {
    if (!isUuid(id)) throw productNotFound();
    try {
      return await this.prisma.$transaction(async (tx) => {
        const current = await tx.product.findUnique({ where: { id } });
        if (!current) throw productNotFound();

        const price = dto.price ?? current.price;
        const oldPrice = dto.oldPrice !== undefined ? dto.oldPrice : current.oldPrice;
        assertOldPrice(price, oldPrice);
        await this.assertReferences(tx, dto);
        if (dto.sku !== undefined && dto.sku !== current.sku)
          await this.assertSkuFree(tx, dto.sku, id);
        const slug =
          dto.slug !== undefined && dto.slug !== current.slug
            ? await this.productSlug(tx, dto.slug, current.name, current.sku, id)
            : undefined;

        await tx.product.update({
          where: { id },
          data: {
            ...(dto.sku !== undefined ? { sku: dto.sku } : {}),
            ...(slug !== undefined ? { slug } : {}),
            ...(dto.name !== undefined ? { name: dto.name } : {}),
            ...(dto.brandId !== undefined ? { brandId: dto.brandId } : {}),
            ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
            ...(dto.description !== undefined ? { description: dto.description } : {}),
            ...(dto.material !== undefined ? { material: dto.material } : {}),
            price,
            oldPrice,
            ...(dto.status !== undefined ? { status: dto.status } : {}),
            ...(dto.isNew !== undefined ? { isNew: dto.isNew } : {}),
            ...(dto.isPopular !== undefined ? { isPopular: dto.isPopular } : {}),
            ...(dto.isSale !== undefined ? { isSale: dto.isSale } : {}),
            ...(dto.sortWeight !== undefined ? { sortWeight: dto.sortWeight } : {}),
          },
        });
        await this.assertActiveReady(tx, id, dto.status ?? current.status);
        return this.get(id, tx);
      });
    } catch (error) {
      if (isUniqueViolation(error))
        throw conflict("SKU_OR_SLUG_TAKEN", "Артикул або slug уже зайнятий");
      throw error;
    }
  }

  async saveVariants(
    id: string,
    dto: AdminSaveVariantsDto,
    adminId: string,
  ): Promise<AdminProductDetail> {
    if (!isUuid(id)) throw productNotFound();
    return this.prisma.$transaction(async (tx) => {
      const [product] = await tx.$queryRaw<Array<{ id: string; status: ProductStatus }>>`
        SELECT id, status FROM products WHERE id = ${id}::uuid FOR UPDATE
      `;
      if (!product) throw productNotFound();
      const existing = await this.lockVariants(tx, id);
      await this.applyVariants(tx, id, existing, dto.variants, dto.stockNote, adminId);
      await this.assertActiveReady(tx, id, product.status);
      return this.get(id, tx);
    });
  }

  /** Швидка зміна залишку одного варіанту: атомарно, без від'ємних значень, з журналом. */
  async adjustStock(
    variantId: string,
    dto: AdminStockAdjustDto,
    adminId: string,
  ): Promise<{ id: string; stock: number }> {
    if (!isUuid(variantId)) throw variantNotFound();
    return this.prisma.$transaction(async (tx) => {
      const [row] = await tx.$queryRaw<Array<{ id: string; stock: number }>>`
        UPDATE product_variants SET stock = stock + ${dto.delta}
        WHERE id = ${variantId}::uuid AND stock + ${dto.delta} >= 0
        RETURNING id, stock
      `;
      if (!row) {
        const variant = await tx.productVariant.findUnique({ where: { id: variantId } });
        if (!variant) throw variantNotFound();
        throw conflict(
          "NEGATIVE_STOCK",
          `Не можна списати більше, ніж є: зараз ${variant.stock} шт.`,
          {
            stock: variant.stock,
          },
        );
      }
      await tx.inventoryMovement.create({
        data: {
          variantId,
          delta: dto.delta,
          reason: InventoryReason.MANUAL,
          note: dto.note,
          adminId,
        },
      });
      return { id: row.id, stock: row.stock };
    });
  }

  async movements(
    productId: string,
    query: AdminMovementsQueryDto,
  ): Promise<AdminInventoryMovement[]> {
    if (!isUuid(productId)) throw productNotFound();
    if (
      !(await this.prisma.product.findUnique({ where: { id: productId }, select: { id: true } }))
    ) {
      throw productNotFound();
    }
    const rows = await this.prisma.inventoryMovement.findMany({
      where: { variant: { productId } },
      include: movementInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: query.limit,
    });
    return rows.map(toAdminMovement);
  }

  /**
   * Фізичне видалення — тільки для товару, якого немає в жодному замовленні.
   * Інакше 409: такий товар архівують (статус ARCHIVED), історія замовлень лишається цілою.
   */
  async remove(id: string): Promise<void> {
    if (!isUuid(id)) throw productNotFound();
    const storageKeys = await this.prisma.$transaction(async (tx) => {
      const [product] = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM products WHERE id = ${id}::uuid FOR UPDATE
      `;
      if (!product) throw productNotFound();
      const orderItems = await tx.orderItem.count({ where: { productId: id } });
      if (orderItems > 0) {
        throw conflict(
          "PRODUCT_HAS_ORDERS",
          "Товар є в замовленнях, тому його не можна видалити. Перенесіть його в архів.",
          { orderItems },
        );
      }
      const images = await tx.productImage.findMany({
        where: { productId: id },
        select: { storageKey: true },
      });
      await tx.product.delete({ where: { id } });
      const keys = [...new Set(images.map((image) => image.storageKey))];
      const stillUsed = await tx.productImage.findMany({
        where: { storageKey: { in: keys } },
        select: { storageKey: true },
      });
      const used = new Set(stillUsed.map((image) => image.storageKey));
      return keys.filter((key) => !used.has(key));
    });
    await this.storage.deleteImages(storageKeys);
  }
}
