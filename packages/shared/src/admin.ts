// Контракти адмін-API (/api/v1/admin/*). Гроші — цілі копійки (UAH).

import type { ImageUrls } from "./api.js";
import type { AdminRole, InventoryReason, ProductStatus, SizeSystem } from "./enums.js";

// ─── Доступ ─────────────────────────────────────────────────────────────────

export const ADMIN_ROLE_LABELS: Record<AdminRole, string> = {
  OWNER: "Власник",
  MANAGER: "Менеджер",
};

/** Заголовок, у якому клієнт повертає CSRF-токен сесії для POST/PUT/PATCH/DELETE. */
export const ADMIN_CSRF_HEADER = "x-csrf-token";

export const ADMIN_PASSWORD_LIMITS = { min: 10, max: 200 } as const;

export interface AdminProfile {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
}

export interface AdminSessionResponse {
  admin: AdminProfile;
  /** Передається в заголовку X-CSRF-Token у кожному запиті, що змінює дані. */
  csrfToken: string;
  expiresAt: string;
}

export interface AdminLoginInput {
  email: string;
  password: string;
}

export interface AdminAccount extends AdminProfile {
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  activeSessions: number;
}

export interface AdminCreateInput {
  email: string;
  name: string;
  role: AdminRole;
  password: string;
}

export interface AdminUpdateInput {
  name?: string;
  role?: AdminRole;
  isActive?: boolean;
  /** Новий пароль; усі сесії цього адміна завершуються. */
  password?: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

// ─── Товари ─────────────────────────────────────────────────────────────────

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  DRAFT: "Чернетка",
  ACTIVE: "Активний",
  HIDDEN: "Прихований",
  ARCHIVED: "В архіві",
};

export const ADMIN_PRODUCT_SORTS = [
  "updated_desc",
  "created_desc",
  "name_asc",
  "price_asc",
  "price_desc",
  "stock_asc",
  "stock_desc",
] as const;
export type AdminProductSort = (typeof ADMIN_PRODUCT_SORTS)[number];

export const ADMIN_PRODUCT_SORT_LABELS: Record<AdminProductSort, string> = {
  updated_desc: "Нещодавно змінені",
  created_desc: "Нещодавно додані",
  name_asc: "Назва А→Я",
  price_asc: "Ціна ↑",
  price_desc: "Ціна ↓",
  stock_asc: "Залишок ↑",
  stock_desc: "Залишок ↓",
};

/** Фільтр залишку в списку товарів: немає / мало (≤ порогу) / є. */
export const ADMIN_STOCK_FILTERS = ["out", "low", "in"] as const;
export type AdminStockFilter = (typeof ADMIN_STOCK_FILTERS)[number];

export const ADMIN_PRODUCT_LIMITS = {
  sku: 64,
  name: 200,
  description: 5000,
  material: 300,
  variantSku: 64,
  pageSizeMax: 100,
  /** Максимальна ціна: 10 млн грн у копійках. */
  maxPrice: 1_000_000_000,
  maxStock: 100_000,
} as const;

export interface AdminRef {
  id: string;
  name: string;
}

export interface AdminProductListItem {
  id: string;
  sku: string;
  name: string;
  slug: string;
  status: ProductStatus;
  brand: AdminRef;
  category: AdminRef;
  price: number;
  oldPrice: number | null;
  discountPercent: number | null;
  isNew: boolean;
  isPopular: boolean;
  isSale: boolean;
  totalStock: number;
  variantCount: number;
  image: ImageUrls | null;
  updatedAt: string;
}

export interface AdminProductListResponse {
  items: AdminProductListItem[];
  total: number;
  page: number;
  limit: number;
}

export interface AdminVariant {
  id: string;
  colorId: string;
  sizeId: string;
  sku: string | null;
  stock: number;
  priceOverride: number | null;
  isActive: boolean;
  /** Є замовлення або рух складу: такий варіант не видаляється, а вимикається. */
  hasHistory: boolean;
}

export interface AdminProductImage {
  id: string;
  colorId: string | null;
  urls: ImageUrls;
  width: number;
  height: number;
  alt: string | null;
  sortOrder: number;
}

export interface AdminProductDetail {
  id: string;
  sku: string;
  name: string;
  slug: string;
  brandId: string;
  categoryId: string;
  description: string;
  material: string | null;
  price: number;
  oldPrice: number | null;
  discountPercent: number | null;
  status: ProductStatus;
  isNew: boolean;
  isPopular: boolean;
  isSale: boolean;
  sortWeight: number;
  totalStock: number;
  /** Скільки позицій замовлень посилаються на товар; > 0 — фізично видалити не можна. */
  orderItemCount: number;
  createdAt: string;
  updatedAt: string;
  variants: AdminVariant[];
  images: AdminProductImage[];
}

export interface AdminProductInput {
  sku: string;
  name: string;
  /** Порожньо — згенерується з назви. */
  slug?: string;
  brandId: string;
  categoryId: string;
  description: string;
  material: string | null;
  price: number;
  oldPrice: number | null;
  status: ProductStatus;
  isNew: boolean;
  isPopular: boolean;
  isSale: boolean;
  sortWeight?: number;
}

export interface AdminVariantInput {
  /** Наявний варіант; без id — новий. */
  id?: string;
  colorId: string;
  sizeId: string;
  sku: string | null;
  priceOverride: number | null;
  isActive: boolean;
  stock: number;
  /** Залишок, який бачив адмін при завантаженні форми (для наявних варіантів). */
  expectedStock?: number;
}

export interface AdminSaveVariantsInput {
  variants: AdminVariantInput[];
  /** Причина зміни залишків; обов'язкова, якщо хоча б один залишок змінено. */
  stockNote?: string;
}

export interface AdminProductCreateInput extends AdminProductInput {
  variants?: AdminVariantInput[];
  stockNote?: string;
  /** Дублювання: скопіювати фото з цього товару (ті самі файли у сховищі). */
  copyImagesFromId?: string;
}

export interface AdminStockAdjustInput {
  /** Зміна залишку: +5 надходження, −2 списання. */
  delta: number;
  note: string;
}

export const STOCK_NOTE_PRESETS = [
  "Надходження",
  "Інвентаризація",
  "Повернення",
  "Брак / списання",
  "Виправлення помилки",
] as const;

export const INVENTORY_REASON_LABELS: Record<InventoryReason, string> = {
  ORDER: "Замовлення",
  CANCEL: "Скасування",
  MANUAL: "Вручну",
  IMPORT: "Імпорт",
};

export interface AdminInventoryMovement {
  id: string;
  variantId: string;
  colorName: string;
  sizeLabel: string;
  delta: number;
  reason: InventoryReason;
  note: string | null;
  orderNumber: string | null;
  adminName: string | null;
  createdAt: string;
}

// ─── Фото ───────────────────────────────────────────────────────────────────

export const IMAGE_UPLOAD_LIMITS = {
  maxFileBytes: 10 * 1024 * 1024,
  maxFilesPerRequest: 10,
  maxImagesPerProduct: 30,
  /** Що приймає поле вибору файлу; сервер однаково перевіряє вміст файлу. */
  accept: "image/jpeg,image/png,image/webp,image/avif",
} as const;

export interface AdminImageUpdateInput {
  colorId?: string | null;
  alt?: string | null;
}

// ─── Категорії та довідники ─────────────────────────────────────────────────

export interface AdminCategory {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  icon: string | null;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  /** Товари (без архіву) безпосередньо в цій категорії. */
  productCount: number;
  childCount: number;
}

export interface AdminCategoryInput {
  name: string;
  slug?: string;
  parentId: string | null;
  icon: string | null;
  isActive: boolean;
  sortOrder?: number;
}

export interface AdminSortOrderItem {
  id: string;
  sortOrder: number;
}

export interface AdminBrand {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  productCount: number;
}

export interface AdminBrandInput {
  name: string;
  slug?: string;
  logoUrl: string | null;
  isActive: boolean;
  sortOrder?: number;
}

export interface AdminColor {
  id: string;
  name: string;
  slug: string;
  hex: string;
  sortOrder: number;
  variantCount: number;
}

export interface AdminColorInput {
  name: string;
  slug?: string;
  hex: string;
  sortOrder?: number;
}

export const SIZE_SYSTEM_LABELS: Record<SizeSystem, string> = {
  CLOTHING: "Одяг",
  SHOES_EU: "Взуття (EU)",
  ONE_SIZE: "Один розмір",
  OTHER: "Інше",
};

export interface AdminSize {
  id: string;
  label: string;
  sizeSystem: SizeSystem;
  sortOrder: number;
  variantCount: number;
}

export interface AdminSizeInput {
  label: string;
  sizeSystem: SizeSystem;
  sortOrder?: number;
}

/** Усе, що потрібно формі товару: довідники одним запитом. */
export interface AdminCatalogDictionaries {
  categories: AdminCategory[];
  brands: AdminBrand[];
  colors: AdminColor[];
  sizes: AdminSize[];
  lowStockThreshold: number;
}
