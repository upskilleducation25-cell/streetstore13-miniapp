import type {
  ImageUrls,
  ProductCard,
  ProductColorOption,
  ProductDetail,
  ProductSizeOption,
} from "@ss13/shared";
import { discountPercent } from "@ss13/shared";

import type { Prisma } from "../generated/prisma/client.js";

/** Що підвантажуємо для картки і сторінки товару. */
export const productInclude = {
  brand: true,
  category: true,
  images: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }], include: { color: true } },
  variants: { where: { isActive: true }, include: { color: true, size: true } },
} satisfies Prisma.ProductInclude;

export type ProductWithRelations = Prisma.ProductGetPayload<{ include: typeof productInclude }>;
type Variant = ProductWithRelations["variants"][number];

const byColorThenSize = (a: Variant, b: Variant) =>
  a.color.sortOrder - b.color.sortOrder ||
  a.size.sortOrder - b.size.sortOrder ||
  a.size.label.localeCompare(b.size.label);

function uniqueBy<T, K>(items: T[], key: (item: T) => K): T[] {
  const seen = new Set<K>();
  return items.filter((item) => {
    const k = key(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function base(product: ProductWithRelations) {
  const variants = [...product.variants].sort(byColorThenSize);
  return {
    variants,
    inStockVariants: variants.filter((variant) => variant.stock > 0),
    fields: {
      id: product.id,
      slug: product.slug,
      sku: product.sku,
      name: product.name,
      brand: { slug: product.brand.slug, name: product.brand.name },
      category: { slug: product.category.slug, name: product.category.name },
      price: product.price,
      oldPrice: product.oldPrice && product.oldPrice > product.price ? product.oldPrice : null,
      discountPercent: discountPercent(product.price, product.oldPrice),
      isNew: product.isNew,
      isPopular: product.isPopular,
      isSale: product.isSale,
      inStock: variants.some((variant) => variant.stock > 0),
    },
  };
}

const colorRef = (color: Variant["color"]) => ({
  slug: color.slug,
  name: color.name,
  hex: color.hex,
});

export function toProductCard(product: ProductWithRelations): ProductCard {
  const { fields, inStockVariants } = base(product);
  const sizes = uniqueBy(
    [...inStockVariants].sort(
      (a, b) => a.size.sortOrder - b.size.sortOrder || a.size.label.localeCompare(b.size.label),
    ),
    (variant) => variant.size.label,
  );
  return {
    ...fields,
    image: (product.images[0]?.urls as ImageUrls | undefined) ?? null,
    colors: uniqueBy(inStockVariants, (variant) => variant.colorId).map((v) => colorRef(v.color)),
    availableSizes: sizes.map((variant) => variant.size.label),
  };
}

export function toProductDetail(product: ProductWithRelations): ProductDetail {
  const { fields, variants } = base(product);

  const colors: ProductColorOption[] = uniqueBy(variants, (v) => v.colorId).map((v) => ({
    ...colorRef(v.color),
    available: variants.some((other) => other.colorId === v.colorId && other.stock > 0),
  }));

  const sizes: ProductSizeOption[] = uniqueBy(
    [...variants].sort(
      (a, b) => a.size.sortOrder - b.size.sortOrder || a.size.label.localeCompare(b.size.label),
    ),
    (v) => v.sizeId,
  ).map((v) => ({
    label: v.size.label,
    system: v.size.sizeSystem,
    available: variants.some((other) => other.sizeId === v.sizeId && other.stock > 0),
  }));

  return {
    ...fields,
    description: product.description,
    material: product.material,
    images: product.images.map((image) => ({
      id: image.id,
      colorSlug: image.color?.slug ?? null,
      urls: image.urls as ImageUrls,
      width: image.width,
      height: image.height,
      alt: image.alt,
    })),
    colors,
    sizes,
    variants: variants.map((v) => ({
      id: v.id,
      colorSlug: v.color.slug,
      sizeLabel: v.size.label,
      stock: v.stock,
      available: v.stock > 0,
      price: v.priceOverride ?? product.price,
    })),
  };
}
