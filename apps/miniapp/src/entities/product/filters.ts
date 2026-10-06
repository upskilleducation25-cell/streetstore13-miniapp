// Фільтри каталогу. Джерело правди — URL (?brand=nike,acne&sort=price_asc), тож «назад»
// і поділитися посиланням зберігають вибір. Ціни — копійки, як і в API.
import { PRODUCT_SORTS, type ProductSort } from "@ss13/shared";

import type { QueryValue } from "../../shared/api/client";

export interface CatalogFilters {
  category?: string;
  brand: string[];
  color: string[];
  size: string[];
  /** Копійки. */
  minPrice?: number;
  /** Копійки. */
  maxPrice?: number;
  inStock: boolean;
  isNew: boolean;
  isPopular: boolean;
  isSale: boolean;
  sort: ProductSort;
}

export const DEFAULT_SORT: ProductSort = "new";

export const emptyFilters = (category?: string): CatalogFilters => ({
  category,
  brand: [],
  color: [],
  size: [],
  minPrice: undefined,
  maxPrice: undefined,
  inStock: false,
  isNew: false,
  isPopular: false,
  isSale: false,
  sort: DEFAULT_SORT,
});

const MAX_PRICE_KOPECKS = 100_000_000;

const list = (value: string | null): string[] =>
  value
    ? [
        ...new Set(
          value
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
        ),
      ].slice(0, 20)
    : [];

const flag = (value: string | null): boolean => value === "true" || value === "1";

function price(value: string | null): number | undefined {
  if (value === null || !/^\d+$/.test(value)) return undefined;
  const kopecks = Number(value);
  return kopecks <= MAX_PRICE_KOPECKS ? kopecks : undefined;
}

/** Розбирає URL; некоректні значення відкидаються, щоб API не повертав 400. */
export function parseFilters(params: URLSearchParams): CatalogFilters {
  const sort = params.get("sort");
  let minPrice = price(params.get("minPrice"));
  let maxPrice = price(params.get("maxPrice"));
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    [minPrice, maxPrice] = [maxPrice, minPrice];
  }
  return {
    category: params.get("category") || undefined,
    brand: list(params.get("brand")),
    color: list(params.get("color")),
    size: list(params.get("size")),
    minPrice,
    maxPrice,
    inStock: flag(params.get("inStock")),
    isNew: flag(params.get("isNew")),
    isPopular: flag(params.get("isPopular")),
    isSale: flag(params.get("isSale")),
    sort: (PRODUCT_SORTS as readonly string[]).includes(sort ?? "")
      ? (sort as ProductSort)
      : DEFAULT_SORT,
  };
}

/** Параметри запиту до GET /products. Вимкнені позначки не передаються зовсім. */
export function filtersToApiQuery(filters: CatalogFilters): Record<string, QueryValue> {
  return {
    category: filters.category,
    brand: filters.brand,
    color: filters.color,
    size: filters.size,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    inStock: filters.inStock || undefined,
    isNew: filters.isNew || undefined,
    isPopular: filters.isPopular || undefined,
    isSale: filters.isSale || undefined,
    sort: filters.sort,
  };
}

/** URL-параметри: тільки те, що відрізняється від значень за замовчуванням. */
export function filtersToSearchParams(filters: CatalogFilters): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filtersToApiQuery(filters))) {
    if (key === "sort" && value === DEFAULT_SORT) continue;
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      if (value.length > 0) params.set(key, value.join(","));
    } else {
      params.set(key, String(value));
    }
  }
  return params;
}

/** Скільки фільтрів увімкнено (без категорії й сортування) — для лічильника на кнопці. */
export function countActiveFilters(filters: CatalogFilters): number {
  return (
    filters.brand.length +
    filters.color.length +
    filters.size.length +
    (filters.minPrice !== undefined || filters.maxPrice !== undefined ? 1 : 0) +
    Number(filters.inStock) +
    Number(filters.isNew) +
    Number(filters.isPopular) +
    Number(filters.isSale)
  );
}

export const toggleValue = (values: string[], value: string): string[] =>
  values.includes(value) ? values.filter((item) => item !== value) : [...values, value];

/** Поле «Ціна, ₴»: тільки цілі гривні → копійки. Порожнє або некоректне — undefined. */
export function hryvniasToKopecks(input: string): number | undefined {
  const digits = input.replace(/\s/g, "");
  if (!/^\d{1,7}$/.test(digits)) return undefined;
  return Number(digits) * 100;
}

export const kopecksToHryvniaInput = (kopecks: number | undefined): string =>
  kopecks === undefined ? "" : String(Math.floor(kopecks / 100));
