import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { slugify } from "@ss13/shared";

import { AppException } from "../common/app-exception.js";
import type { Prisma } from "../generated/prisma/client.js";
import { InventoryReason, ProductStatus, SizeSystem } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";
import type { EasyDropFeedPreview, EasyDropFeedVariant } from "./easydrop-feed.parser.js";
import { EasyDropImportService } from "./easydrop-import.service.js";

type Tx = Prisma.TransactionClient;

interface ModelGroup {
  groupId: string;
  name: string;
  categoryId: string;
  categoryName: string;
  imageUrl: string;
  variants: EasyDropFeedVariant[];
}

interface ApplySummary {
  totalItems: number;
  distinctModels: number;
  createdProducts: number;
  createdVariants: number;
  stockChanges: number;
  absentVariants: number;
  hiddenProducts: number;
}

const SUPPLIER = "EASYDROP";
const RUNNING = "RUNNING";
const STALE_RUN_MS = 15 * 60 * 1000;
const ADVISORY_LOCK_A = 721340128;
const ADVISORY_LOCK_B = 13;
const IMPORT_NOTE = "Автоматична синхронізація EasyDrop";

function feedFailure(message: string): AppException {
  return new AppException("EASYDROP_FEED_INVALID", message, HttpStatus.BAD_GATEWAY);
}

function prepareGroups(feed: EasyDropFeedPreview): ModelGroup[] {
  const groups = new Map<string, ModelGroup>();
  const externalIds = new Set<string>();
  for (const variant of feed.shoeVariants) {
    if (externalIds.has(variant.externalId)) {
      throw feedFailure("У фіді повторюється ID позиції.");
    }
    externalIds.add(variant.externalId);

    const match = /\s+(\d{2})$/.exec(variant.name);
    if (match && match[1] !== variant.size) {
      throw feedFailure("Назва товару та поле розміру не узгоджуються; синхронізацію скасовано.");
    }
    const name = match ? variant.name.slice(0, match.index).trim() : variant.name.trim();
    if (!name) throw feedFailure("У фіді є позиція без назви моделі.");

    let group = groups.get(variant.groupId);
    if (!group) {
      group = {
        groupId: variant.groupId,
        name,
        categoryId: variant.categoryId,
        categoryName: variant.categoryName,
        imageUrl: variant.imageUrl,
        variants: [],
      };
      groups.set(variant.groupId, group);
    } else if (
      group.name !== name ||
      group.categoryId !== variant.categoryId ||
      group.categoryName !== variant.categoryName ||
      group.imageUrl !== variant.imageUrl
    ) {
      throw feedFailure(
        "У межах однієї моделі відрізняються назва, бренд або фото; синхронізацію скасовано.",
      );
    }

    if (group.variants.some((entry) => entry.size === variant.size)) {
      throw feedFailure("У фіді повторюється розмір однієї моделі.");
    }
    group.variants.push(variant);
  }
  return [...groups.values()];
}

@Injectable()
export class EasyDropSyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly importer: EasyDropImportService,
  ) {}

  async sync() {
    const run = await this.startRun();
    try {
      const feed = await this.importer.loadValidatedFeed();
      const groups = prepareGroups(feed);
      const summary = await this.applyFeed(run.id, feed, groups);
      return {
        status: "SUCCESS",
        runId: run.id,
        ...summary,
        message: "Синхронізацію EasyDrop завершено. Залишки оновлено через журнал складу.",
      };
    } catch (error) {
      await this.prisma.supplierSyncRun
        .update({
          where: { id: run.id },
          data: {
            status: "FAILED",
            finishedAt: new Date(),
            errorMessage: "Синхронізацію не завершено; каталог не змінено.",
            summary: { stage: "failed" },
          },
        })
        .catch(() => undefined);

      if (error instanceof HttpException) throw error;
      throw new AppException(
        "EASYDROP_SYNC_FAILED",
        "Не вдалося завершити синхронізацію EasyDrop. Каталог не змінено.",
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  async history() {
    return this.prisma.supplierSyncRun.findMany({
      where: { supplier: SUPPLIER },
      orderBy: { startedAt: "desc" },
      take: 20,
      select: {
        id: true,
        status: true,
        startedAt: true,
        finishedAt: true,
        importedCount: true,
        hiddenCount: true,
        errorMessage: true,
        summary: true,
      },
    });
  }

  private async startRun(): Promise<{ id: string }> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(${ADVISORY_LOCK_A}, ${ADVISORY_LOCK_B})`;
      const staleBefore = new Date(Date.now() - STALE_RUN_MS);
      await tx.supplierSyncRun.updateMany({
        where: {
          supplier: SUPPLIER,
          status: RUNNING,
          startedAt: { lte: staleBefore },
        },
        data: {
          status: "FAILED",
          finishedAt: new Date(),
          errorMessage: "Попередній запуск перевищив допустимий час.",
          summary: { stage: "stale-run" },
        },
      });
      const active = await tx.supplierSyncRun.findFirst({
        where: { supplier: SUPPLIER, status: RUNNING },
        select: { id: true },
      });
      if (active) {
        throw new AppException(
          "EASYDROP_SYNC_IN_PROGRESS",
          "Синхронізація EasyDrop вже виконується. Спробуйте пізніше.",
          HttpStatus.CONFLICT,
        );
      }
      return tx.supplierSyncRun.create({
        data: { supplier: SUPPLIER, status: RUNNING, summary: { stage: "validating-feed" } },
        select: { id: true },
      });
    });
  }

  private async ensureBrand(tx: Tx, name: string, categoryId: string): Promise<string> {
    const existing = await tx.brand.findUnique({ where: { name }, select: { id: true } });
    if (existing) return existing.id;

    const base = slugify(name).slice(0, 80) || "easydrop-brand";
    let slug = base;
    const occupied = await tx.brand.findUnique({ where: { slug }, select: { id: true } });
    if (occupied) slug = `${base}-easydrop-${categoryId}`;
    const brand = await tx.brand.create({
      data: { name, slug, sortOrder: 900, isActive: true },
      select: { id: true },
    });
    return brand.id;
  }

  private async ensureColor(tx: Tx): Promise<string> {
    const bySlug = await tx.color.findUnique({
      where: { slug: "easydrop-default" },
      select: { id: true },
    });
    if (bySlug) return bySlug.id;
    const byName = await tx.color.findUnique({
      where: { name: "Основний" },
      select: { id: true },
    });
    if (byName) return byName.id;
    const color = await tx.color.create({
      data: {
        name: "Основний",
        slug: "easydrop-default",
        hex: "#808080",
        sortOrder: 900,
      },
      select: { id: true },
    });
    return color.id;
  }

  private async ensureSize(tx: Tx, label: string): Promise<string> {
    const size = await tx.size.upsert({
      where: { sizeSystem_label: { sizeSystem: SizeSystem.SHOES_EU, label } },
      update: {},
      create: {
        sizeSystem: SizeSystem.SHOES_EU,
        label,
        sortOrder: Number(label) * 10,
      },
      select: { id: true },
    });
    return size.id;
  }

  private async ensureProduct(
    tx: Tx,
    group: ModelGroup,
    brandId: string,
    categoryId: string,
    basePrice: number,
  ): Promise<{ id: string; created: boolean }> {
    const sku = `EASYDROP-${group.groupId}`;
    const slugBase = slugify(group.name).slice(0, 90) || "easydrop-product";
    const slug = `${slugBase}-${group.groupId}`;
    const existing = await tx.product.findUnique({
      where: { sku },
      include: { variants: { include: { supplierFeedItem: { select: { isPresent: true } } } } },
    });

    let reactivate = false;
    if (existing?.status === ProductStatus.HIDDEN) {
      const mappings = existing.variants
        .map((variant) => variant.supplierFeedItem)
        .filter((mapping) => mapping !== null);
      reactivate = mappings.length > 0 && mappings.every((mapping) => !mapping.isPresent);
    }

    const product = await tx.product.upsert({
      where: { sku },
      update: {
        name: group.name,
        slug,
        brandId,
        categoryId,
        price: basePrice,
        oldPrice: null,
        ...(reactivate ? { status: ProductStatus.ACTIVE } : {}),
      },
      create: {
        sku,
        name: group.name,
        slug,
        brandId,
        categoryId,
        description: "",
        price: basePrice,
        status: ProductStatus.ACTIVE,
      },
      select: { id: true },
    });
    return { id: product.id, created: !existing };
  }

  private async upsertRemoteImage(tx: Tx, productId: string, group: ModelGroup): Promise<void> {
    const storageKey = `easydrop:${group.groupId}`;
    const urls: Prisma.InputJsonValue = {
      thumb: group.imageUrl,
      medium: group.imageUrl,
      large: group.imageUrl,
    };
    const supplierImage = await tx.productImage.findFirst({
      where: { productId, storageKey },
      select: { id: true },
    });
    if (supplierImage) {
      await tx.productImage.update({
        where: { id: supplierImage.id },
        data: { urls, alt: group.name, width: 0, height: 0 },
      });
      return;
    }
    const anyImage = await tx.productImage.findFirst({
      where: { productId },
      select: { id: true },
    });
    if (anyImage) return;
    await tx.productImage.create({
      data: {
        productId,
        storageKey,
        urls,
        width: 0,
        height: 0,
        alt: group.name,
        sortOrder: 0,
      },
    });
  }

  private async applyFeed(
    runId: string,
    feed: EasyDropFeedPreview,
    groups: ModelGroup[],
  ): Promise<ApplySummary> {
    return this.prisma.$transaction(
      async (tx) => {
        const now = new Date();
        const category = await tx.category.upsert({
          where: { slug: "krosivky" },
          update: {},
          create: {
            name: "Кросівки",
            slug: "krosivky",
            sortOrder: 80,
            isActive: true,
          },
          select: { id: true },
        });
        const colorId = await this.ensureColor(tx);
        const brandIds = new Map<string, string>();
        const sizeIds = new Map<string, string>();
        let createdProducts = 0;
        let createdVariants = 0;
        let stockChanges = 0;

        for (const group of groups) {
          let brandId = brandIds.get(group.categoryName);
          if (!brandId) {
            brandId = await this.ensureBrand(tx, group.categoryName, group.categoryId);
            brandIds.set(group.categoryName, brandId);
          }
          const basePrice = Math.min(...group.variants.map((variant) => variant.priceUah * 100));
          const product = await this.ensureProduct(tx, group, brandId, category.id, basePrice);
          if (product.created) createdProducts++;
          await this.upsertRemoteImage(tx, product.id, group);

          for (const variant of group.variants) {
            let sizeId = sizeIds.get(variant.size);
            if (!sizeId) {
              sizeId = await this.ensureSize(tx, variant.size);
              sizeIds.set(variant.size, sizeId);
            }
            const price = variant.priceUah * 100;
            const priceOverride = price === basePrice ? null : price;
            const current = await tx.productVariant.findUnique({
              where: {
                productId_colorId_sizeId: {
                  productId: product.id,
                  colorId,
                  sizeId,
                },
              },
            });
            let variantId: string;
            if (!current) {
              const created = await tx.productVariant.create({
                data: {
                  productId: product.id,
                  colorId,
                  sizeId,
                  sku: variant.vendorCode,
                  stock: variant.quantity,
                  priceOverride,
                  isActive: true,
                },
                select: { id: true },
              });
              variantId = created.id;
              createdVariants++;
              if (variant.quantity > 0) {
                await tx.inventoryMovement.create({
                  data: {
                    variantId,
                    delta: variant.quantity,
                    reason: InventoryReason.IMPORT,
                    note: IMPORT_NOTE,
                  },
                });
                stockChanges++;
              }
            } else {
              const delta = variant.quantity - current.stock;
              variantId = current.id;
              await tx.productVariant.update({
                where: { id: current.id },
                data: {
                  sku: variant.vendorCode,
                  stock: variant.quantity,
                  priceOverride,
                  isActive: true,
                },
              });
              if (delta !== 0) {
                await tx.inventoryMovement.create({
                  data: {
                    variantId,
                    delta,
                    reason: InventoryReason.IMPORT,
                    note: IMPORT_NOTE,
                  },
                });
                stockChanges++;
              }
            }

            const mapping = await tx.supplierFeedItem.findUnique({
              where: {
                supplier_externalId: { supplier: SUPPLIER, externalId: variant.externalId },
              },
              select: { id: true, groupId: true, productVariantId: true },
            });
            if (mapping?.groupId && mapping.groupId !== variant.groupId) {
              throw feedFailure(
                "Постачальник змінив group_id наявної позиції; потрібна перевірка.",
              );
            }
            if (mapping?.productVariantId && mapping.productVariantId !== variantId) {
              throw feedFailure(
                "Зіставлення позиції постачальника змінилося; синхронізацію скасовано.",
              );
            }
            const otherMapping = await tx.supplierFeedItem.findUnique({
              where: { productVariantId: variantId },
              select: { externalId: true },
            });
            if (otherMapping && otherMapping.externalId !== variant.externalId) {
              throw feedFailure("Дві позиції постачальника зіставляються з одним варіантом.");
            }
            await tx.supplierFeedItem.upsert({
              where: {
                supplier_externalId: { supplier: SUPPLIER, externalId: variant.externalId },
              },
              update: {
                vendorCode: variant.vendorCode,
                groupId: variant.groupId,
                productVariantId: variantId,
                isPresent: true,
                lastSeenAt: now,
              },
              create: {
                supplier: SUPPLIER,
                externalId: variant.externalId,
                vendorCode: variant.vendorCode,
                groupId: variant.groupId,
                productVariantId: variantId,
                isPresent: true,
                lastSeenAt: now,
              },
            });
          }
        }

        const currentIds = feed.shoeVariants.map((variant) => variant.externalId);
        const absent = await tx.supplierFeedItem.findMany({
          where: {
            supplier: SUPPLIER,
            isPresent: true,
            externalId: { notIn: currentIds },
          },
          include: { variant: true },
        });
        let absentVariants = 0;
        for (const mapping of absent) {
          if (mapping.variant) {
            const variant = mapping.variant;
            if (variant.stock > 0) {
              await tx.productVariant.update({
                where: { id: variant.id },
                data: { stock: 0, isActive: false },
              });
              await tx.inventoryMovement.create({
                data: {
                  variantId: variant.id,
                  delta: -variant.stock,
                  reason: InventoryReason.IMPORT,
                  note: "Позиція відсутня у валідованому фіді EasyDrop",
                },
              });
              stockChanges++;
            } else {
              await tx.productVariant.update({
                where: { id: variant.id },
                data: { isActive: false },
              });
            }
            absentVariants++;
          }
          await tx.supplierFeedItem.update({
            where: { id: mapping.id },
            data: { isPresent: false },
          });
        }

        const importedProducts = await tx.product.findMany({
          where: { sku: { startsWith: "EASYDROP-" } },
          include: { variants: { include: { supplierFeedItem: { select: { isPresent: true } } } } },
        });
        let hiddenProducts = 0;
        for (const product of importedProducts) {
          const mappings = product.variants
            .map((variant) => variant.supplierFeedItem)
            .filter((mapping) => mapping !== null);
          if (
            mappings.length > 0 &&
            mappings.every((mapping) => !mapping.isPresent) &&
            product.status !== ProductStatus.HIDDEN &&
            product.status !== ProductStatus.ARCHIVED
          ) {
            await tx.product.update({
              where: { id: product.id },
              data: { status: ProductStatus.HIDDEN },
            });
            hiddenProducts++;
          }
        }

        const summary: ApplySummary = {
          totalItems: feed.totalItems,
          distinctModels: feed.distinctModels,
          createdProducts,
          createdVariants,
          stockChanges,
          absentVariants,
          hiddenProducts,
        };
        await tx.supplierSyncRun.update({
          where: { id: runId },
          data: {
            status: "SUCCESS",
            finishedAt: new Date(),
            importedCount: feed.shoeVariants.length,
            hiddenCount: hiddenProducts,
            errorMessage: null,
            summary: summary as unknown as Prisma.InputJsonValue,
          },
        });
        return summary;
      },
      { maxWait: 10_000, timeout: 120_000 },
    );
  }
}
