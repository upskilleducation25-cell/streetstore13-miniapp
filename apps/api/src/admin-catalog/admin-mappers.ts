import type {
  AdminInventoryMovement,
  AdminProductDetail,
  AdminProductImage,
  AdminProductListItem,
  ImageUrls,
} from "@ss13/shared";
import { discountPercent } from "@ss13/shared";

import type { Prisma } from "../generated/prisma/client.js";

export const adminProductListInclude = {
  brand: { select: { id: true, name: true } },
  category: { select: { id: true, name: true } },
  images: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }], take: 1 },
  _count: { select: { variants: true } },
} satisfies Prisma.ProductInclude;

export const adminProductDetailInclude = {
  images: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
  variants: {
    include: {
      color: true,
      size: true,
      _count: { select: { orderItems: true, inventoryMovements: true } },
    },
  },
  _count: { select: { orderItems: true } },
} satisfies Prisma.ProductInclude;

type ListRow = Prisma.ProductGetPayload<{ include: typeof adminProductListInclude }>;
type DetailRow = Prisma.ProductGetPayload<{ include: typeof adminProductDetailInclude }>;
type ImageRow = DetailRow["images"][number];

export function toAdminListItem(row: ListRow): AdminProductListItem {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    slug: row.slug,
    status: row.status,
    brand: row.brand,
    category: row.category,
    price: row.price,
    oldPrice: row.oldPrice,
    discountPercent: discountPercent(row.price, row.oldPrice),
    isNew: row.isNew,
    isPopular: row.isPopular,
    isSale: row.isSale,
    totalStock: row.totalStock,
    variantCount: row._count.variants,
    image: (row.images[0]?.urls as ImageUrls | undefined) ?? null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export const toAdminImage = (image: ImageRow): AdminProductImage => ({
  id: image.id,
  colorId: image.colorId,
  urls: image.urls as ImageUrls,
  width: image.width,
  height: image.height,
  alt: image.alt,
  sortOrder: image.sortOrder,
});

export function toAdminDetail(row: DetailRow): AdminProductDetail {
  const variants = [...row.variants].sort(
    (a, b) =>
      a.color.sortOrder - b.color.sortOrder ||
      a.color.name.localeCompare(b.color.name) ||
      a.size.sortOrder - b.size.sortOrder ||
      a.size.label.localeCompare(b.size.label),
  );
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    slug: row.slug,
    brandId: row.brandId,
    categoryId: row.categoryId,
    description: row.description,
    material: row.material,
    price: row.price,
    oldPrice: row.oldPrice,
    discountPercent: discountPercent(row.price, row.oldPrice),
    status: row.status,
    isNew: row.isNew,
    isPopular: row.isPopular,
    isSale: row.isSale,
    sortWeight: row.sortWeight,
    totalStock: row.totalStock,
    orderItemCount: row._count.orderItems,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    variants: variants.map((variant) => ({
      id: variant.id,
      colorId: variant.colorId,
      sizeId: variant.sizeId,
      sku: variant.sku,
      stock: variant.stock,
      priceOverride: variant.priceOverride,
      isActive: variant.isActive,
      hasHistory:
        variant._count.orderItems > 0 || variant._count.inventoryMovements > 0 || variant.stock > 0,
    })),
    images: row.images.map(toAdminImage),
  };
}

export const movementInclude = {
  variant: { select: { color: { select: { name: true } }, size: { select: { label: true } } } },
  order: { select: { number: true } },
  admin: { select: { name: true } },
} satisfies Prisma.InventoryMovementInclude;

type MovementRow = Prisma.InventoryMovementGetPayload<{ include: typeof movementInclude }>;

export const toAdminMovement = (row: MovementRow): AdminInventoryMovement => ({
  id: row.id,
  variantId: row.variantId,
  colorName: row.variant.color.name,
  sizeLabel: row.variant.size.label,
  delta: row.delta,
  reason: row.reason,
  note: row.note,
  orderNumber: row.order?.number ?? null,
  adminName: row.admin?.name ?? null,
  createdAt: row.createdAt.toISOString(),
});
