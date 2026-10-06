// Контракти відповідей публічного API (/api/v1). Гроші — цілі копійки (UAH).

/** Єдиний формат помилки для всіх ендпоїнтів. */
export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

export interface Paginated<T> {
  items: T[];
  /** Курсор наступної сторінки; null — це остання сторінка. */
  nextCursor: string | null;
}

export const PRODUCT_SORTS = ["new", "price_asc", "price_desc"] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

export interface BrandRef {
  slug: string;
  name: string;
}

export interface CategoryRef {
  slug: string;
  name: string;
}

export interface CategoryItem extends CategoryRef {
  id: string;
  imageUrl: string | null;
  icon: string | null;
  sortOrder: number;
  /** Кількість товарів, видимих на вітрині, включно з підкатегоріями. */
  productCount: number;
  children: CategoryItem[];
}

export interface ColorRef {
  slug: string;
  name: string;
  hex: string;
}

export interface ImageUrls {
  thumb?: string;
  medium?: string;
  large?: string;
}

export interface ProductCard {
  id: string;
  slug: string;
  sku: string;
  name: string;
  brand: BrandRef;
  category: CategoryRef;
  price: number;
  oldPrice: number | null;
  discountPercent: number | null;
  isNew: boolean;
  isPopular: boolean;
  isSale: boolean;
  inStock: boolean;
  image: ImageUrls | null;
  /** Кольори, у яких є хоча б один розмір у наявності. */
  colors: ColorRef[];
  /** Розміри, доступні хоча б в одному кольорі, у порядку розмірної сітки. */
  availableSizes: string[];
}

export interface ProductImage {
  id: string;
  colorSlug: string | null;
  urls: ImageUrls;
  width: number;
  height: number;
  alt: string | null;
}

export interface ProductColorOption extends ColorRef {
  available: boolean;
}

export interface ProductSizeOption {
  label: string;
  system: string;
  available: boolean;
}

/** Одиниця складу: колір + розмір. */
export interface ProductVariantInfo {
  id: string;
  colorSlug: string;
  sizeLabel: string;
  stock: number;
  available: boolean;
  /** Ціна варіанту в копійках (може відрізнятися від ціни товару). */
  price: number;
}

export interface ProductDetail extends Omit<ProductCard, "image" | "colors" | "availableSizes"> {
  description: string;
  material: string | null;
  images: ProductImage[];
  colors: ProductColorOption[];
  sizes: ProductSizeOption[];
  variants: ProductVariantInfo[];
}

export interface HomeResponse {
  categories: CategoryItem[];
  newArrivals: ProductCard[];
  popular: ProductCard[];
  sale: ProductCard[];
}

export interface AuthUser {
  id: string;
  /** Telegram ID рядком: BigInt не серіалізується в JSON. */
  telegramId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
}

export interface AuthResponse {
  token: string;
  /** Час життя токена в секундах. */
  expiresIn: number;
  user: AuthUser;
}
