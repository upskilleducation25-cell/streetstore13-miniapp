import type { AdminProductDetail, AdminProductInput, ProductStatus } from "@ss13/shared";
import {
  ADMIN_PRODUCT_LIMITS as LIMITS,
  discountPercent,
  kopecksToUahInput,
  parseUahToKopecks,
  SLUG_PATTERN,
} from "@ss13/shared";

/** Стан форми товару: гроші — рядки в гривнях, як їх вводить людина. */
export interface ProductFormState {
  sku: string;
  name: string;
  slug: string;
  brandId: string;
  categoryId: string;
  description: string;
  material: string;
  price: string;
  oldPrice: string;
  status: ProductStatus;
  isNew: boolean;
  isPopular: boolean;
  isSale: boolean;
  sortWeight: string;
}

export const emptyProductForm = (): ProductFormState => ({
  sku: "",
  name: "",
  slug: "",
  brandId: "",
  categoryId: "",
  description: "",
  material: "",
  price: "",
  oldPrice: "",
  status: "DRAFT",
  isNew: false,
  isPopular: false,
  isSale: false,
  sortWeight: "0",
});

export function formFromProduct(product: AdminProductDetail): ProductFormState {
  return {
    sku: product.sku,
    name: product.name,
    slug: product.slug,
    brandId: product.brandId,
    categoryId: product.categoryId,
    description: product.description,
    material: product.material ?? "",
    price: kopecksToUahInput(product.price),
    oldPrice: product.oldPrice === null ? "" : kopecksToUahInput(product.oldPrice),
    status: product.status,
    isNew: product.isNew,
    isPopular: product.isPopular,
    isSale: product.isSale,
    sortWeight: String(product.sortWeight),
  };
}

/**
 * Копія для дублювання: новий артикул і slug, статус «Чернетка», щоб копія не з'явилась
 * на вітрині до перевірки. Нічого не зберігається, доки адмін не натисне «Створити».
 */
export function duplicateForm(product: AdminProductDetail): ProductFormState {
  return {
    ...formFromProduct(product),
    sku: `${product.sku}-COPY`.slice(0, LIMITS.sku),
    name: `${product.name} (копія)`.slice(0, LIMITS.name),
    slug: "",
    status: "DRAFT",
  };
}

export type FormErrors = Partial<Record<keyof ProductFormState, string>>;

/** Та сама перевірка, що й на сервері: користувач бачить помилку одразу біля поля. */
export function validateProductForm(state: ProductFormState): {
  errors: FormErrors;
  payload: AdminProductInput | null;
} {
  const errors: FormErrors = {};
  const sku = state.sku.trim();
  const name = state.name.trim();
  const slug = state.slug.trim().toLowerCase();

  if (!sku) errors.sku = "Вкажіть артикул";
  else if (sku.length > LIMITS.sku) errors.sku = `Не довше ${LIMITS.sku} символів`;
  else if (!/^[\p{L}\p{N}._/-]+$/u.test(sku)) errors.sku = "Літери, цифри, . _ / - без пробілів";

  if (!name) errors.name = "Вкажіть назву";
  else if (name.length > LIMITS.name) errors.name = `Не довше ${LIMITS.name} символів`;

  if (slug && !SLUG_PATTERN.test(slug)) errors.slug = "Латинські літери, цифри й дефіси";
  if (!state.brandId) errors.brandId = "Оберіть бренд";
  if (!state.categoryId) errors.categoryId = "Оберіть категорію";
  if (state.description.length > LIMITS.description) errors.description = "Задовгий опис";
  if (state.material.trim().length > LIMITS.material) errors.material = "Задовгий текст";

  const price = parseUahToKopecks(state.price);
  if (price === null) errors.price = "Ціна в гривнях, напр. 4999 або 4999,50";
  else if (price > LIMITS.maxPrice) errors.price = "Занадто велика ціна";

  let oldPrice: number | null = null;
  if (state.oldPrice.trim()) {
    oldPrice = parseUahToKopecks(state.oldPrice);
    if (oldPrice === null || oldPrice === 0) errors.oldPrice = "Сума в гривнях або порожньо";
    else if (price !== null && oldPrice <= price)
      errors.oldPrice = "Стара ціна має бути більшою за ціну";
  }

  const sortWeight = Number(state.sortWeight.trim() || "0");
  if (!Number.isInteger(sortWeight) || Math.abs(sortWeight) > 1000) {
    errors.sortWeight = "Ціле число від −1000 до 1000";
  }

  if (Object.keys(errors).length > 0) return { errors, payload: null };
  return {
    errors,
    payload: {
      sku,
      name,
      ...(slug ? { slug } : {}),
      brandId: state.brandId,
      categoryId: state.categoryId,
      description: state.description.trim(),
      material: state.material.trim() || null,
      price: price!,
      oldPrice,
      status: state.status,
      isNew: state.isNew,
      isPopular: state.isPopular,
      isSale: state.isSale,
      sortWeight,
    },
  };
}

/** Знижка для підказки біля ціни; null — якщо стара ціна не задана або некоректна. */
export function previewDiscount(
  state: Pick<ProductFormState, "price" | "oldPrice">,
): number | null {
  const price = parseUahToKopecks(state.price);
  const oldPrice = parseUahToKopecks(state.oldPrice);
  return price === null || oldPrice === null ? null : discountPercent(price, oldPrice);
}
