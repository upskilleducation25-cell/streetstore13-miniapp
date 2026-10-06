import type { ProductDetail, ProductVariantInfo } from "@ss13/shared";

type Matrix = Record<string, Record<string, number>>;

/** Товар для тестів: матриця «колір → розмір → залишок», як у demo-seed. */
export function makeProduct(matrix: Matrix, sizeOrder: string[]): ProductDetail {
  const variants: ProductVariantInfo[] = Object.entries(matrix).flatMap(([colorSlug, bySize]) =>
    Object.entries(bySize).map(([sizeLabel, stock]) => ({
      id: `${colorSlug}-${sizeLabel}`,
      colorSlug,
      sizeLabel,
      stock,
      available: stock > 0,
      price: 6_499_900,
    })),
  );
  const colors = Object.keys(matrix).map((slug) => ({
    slug,
    name: slug,
    hex: "#000000",
    available: variants.some((v) => v.colorSlug === slug && v.available),
  }));
  const sizes = sizeOrder
    .filter((label) => variants.some((v) => v.sizeLabel === label))
    .map((label) => ({
      label,
      system: "CLOTHING",
      available: variants.some((v) => v.sizeLabel === label && v.available),
    }));
  return {
    id: "p1",
    slug: "p1",
    sku: "TEST-1",
    name: "Тестовий товар",
    brand: { slug: "b", name: "B" },
    category: { slug: "c", name: "C" },
    price: 6_499_900,
    oldPrice: null,
    discountPercent: null,
    isNew: false,
    isPopular: false,
    isSale: false,
    inStock: variants.some((v) => v.available),
    description: "",
    material: null,
    images: Object.keys(matrix).flatMap((slug) => [
      {
        id: `${slug}-1`,
        colorSlug: slug,
        urls: { medium: `/${slug}-1.svg` },
        width: 600,
        height: 800,
        alt: null,
      },
      {
        id: `${slug}-2`,
        colorSlug: slug,
        urls: { medium: `/${slug}-2.svg` },
        width: 600,
        height: 800,
        alt: null,
      },
    ]),
    colors,
    sizes,
    variants,
  };
}
