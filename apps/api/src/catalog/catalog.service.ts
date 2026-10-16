import { HttpStatus, Injectable } from "@nestjs/common";
import type {
  CategoryItem,
  HomeResponse,
  Paginated,
  ProductCard,
  ProductDetail,
} from "@ss13/shared";

import { AppException, notFound } from "../common/app-exception.js";
import type { Prisma } from "../generated/prisma/client.js";
import { ProductStatus } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";
import type { ProductsQueryDto, SearchQueryDto } from "./dto/query.dto.js";
import { productInclude, toProductCard, toProductDetail } from "./product.mapper.js";

const HOME_SECTION_LIMIT = 10;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Видимий на вітрині: активний, не видалений, активні бренд, категорія і її батьківська. */
export const visibleProductWhere = {
  status: ProductStatus.ACTIVE,
  deletedAt: null,
  brand: { isActive: true },
  category: { isActive: true, OR: [{ parentId: null }, { parent: { isActive: true } }] },
} satisfies Prisma.ProductWhereInput;

const visibleCategoryWhere = {
  isActive: true,
  OR: [{ parentId: null }, { parent: { isActive: true } }],
} satisfies Prisma.CategoryWhereInput;

const SORTS: Record<ProductsQueryDto["sort"], Prisma.ProductOrderByWithRelationInput[]> = {
  new: [{ createdAt: "desc" }, { id: "desc" }],
  price_asc: [{ price: "asc" }, { id: "asc" }],
  price_desc: [{ price: "desc" }, { id: "desc" }],
};

/** Токени для to_tsquery: тільки літери й цифри, кожен — префіксний пошук. */
export function toPrefixTsQuery(q: string): string | null {
  const tokens = q.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  const unique = [...new Set(tokens)].slice(0, 8);
  return unique.length > 0 ? unique.map((token) => `${token}:*`).join(" & ") : null;
}

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async getCategories(): Promise<CategoryItem[]> {
    const [categories, counts] = await Promise.all([
      this.prisma.category.findMany({
        where: visibleCategoryWhere,
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      this.prisma.product.groupBy({
        by: ["categoryId"],
        where: visibleProductWhere,
        _count: { _all: true },
      }),
    ]);
    const countById = new Map(counts.map((row) => [row.categoryId, row._count._all]));

    const items = new Map<string, CategoryItem>(
      categories.map((category) => [
        category.id,
        {
          id: category.id,
          slug: category.slug,
          name: category.name,
          imageUrl: category.imageUrl,
          icon: category.icon,
          sortOrder: category.sortOrder,
          productCount: countById.get(category.id) ?? 0,
          children: [],
        },
      ]),
    );

    const roots: CategoryItem[] = [];
    for (const category of categories) {
      const item = items.get(category.id)!;
      const parent = category.parentId ? items.get(category.parentId) : undefined;
      if (parent) {
        parent.children.push(item);
        parent.productCount += item.productCount;
      } else if (!category.parentId) {
        roots.push(item);
      }
    }
    return roots;
  }

  buildProductsWhere(query: ProductsQueryDto): Prisma.ProductWhereInput {
    if (
      query.minPrice !== undefined &&
      query.maxPrice !== undefined &&
      query.minPrice > query.maxPrice
    ) {
      throw new AppException(
        "VALIDATION_ERROR",
        "minPrice не може бути більшим за maxPrice",
        HttpStatus.BAD_REQUEST,
        [{ field: "minPrice", errors: ["minPrice > maxPrice"] }],
      );
    }

    const and: Prisma.ProductWhereInput[] = [visibleProductWhere];

    if (query.category) {
      and.push({
        category: { OR: [{ slug: query.category }, { parent: { slug: query.category } }] },
      });
    }
    if (query.brand) and.push({ brand: { slug: { in: query.brand } } });
    if (query.minPrice !== undefined) and.push({ price: { gte: query.minPrice } });
    if (query.maxPrice !== undefined) and.push({ price: { lte: query.maxPrice } });
    if (query.isNew !== undefined) and.push({ isNew: query.isNew });
    if (query.isPopular !== undefined) and.push({ isPopular: query.isPopular });
    if (query.isSale !== undefined) and.push({ isSale: query.isSale });

    // Колір і розмір мають збігатися в ОДНОМУ варіанті (чорний саме в розмірі L).
    if (query.color || query.size || query.inStock !== undefined) {
      const variant: Prisma.ProductVariantWhereInput = { isActive: true };
      if (query.color) variant.color = { slug: { in: query.color } };
      if (query.size) variant.size = { label: { in: query.size } };
      if (query.inStock === true) variant.stock = { gt: 0 };

      if (query.inStock === false && !query.color && !query.size) {
        and.push({ variants: { none: { isActive: true, stock: { gt: 0 } } } });
      } else if (query.inStock === false) {
        and.push({ variants: { some: variant } });
        and.push({ variants: { none: { ...variant, stock: { gt: 0 } } } });
      } else {
        and.push({ variants: { some: variant } });
      }
    }

    return { AND: and };
  }

  async getProducts(query: ProductsQueryDto): Promise<Paginated<ProductCard>> {
    const rows = await this.prisma.product.findMany({
      where: this.buildProductsWhere(query),
      include: productInclude,
      orderBy: SORTS[query.sort],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    return {
      items: page.map(toProductCard),
      nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
    };
  }

  async getProduct(id: string): Promise<ProductDetail> {
    // Неіснуючий, прихований і некоректний id відповідають однаково — 404.
    const product = UUID_RE.test(id)
      ? await this.prisma.product.findFirst({
          where: { AND: [visibleProductWhere, { id }] },
          include: productInclude,
        })
      : null;
    if (!product) throw notFound("PRODUCT_NOT_FOUND", "Товар не знайдено");
    return toProductDetail(product);
  }

  async search(query: SearchQueryDto): Promise<Paginated<ProductCard>> {
    const q = query.q.trim();
    const tsQuery = toPrefixTsQuery(q);
    if (!tsQuery) return { items: [], nextCursor: null };

    const offset = query.cursor ? Number(query.cursor) : 0;
    const like = `%${q.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;

    // Повнотекстовий пошук (назва, артикул, бренд, категорія, опис) + нечіткий за назвою
    // + підрядок в артикулі, бренді й категорії. Видимість — ті самі правила, що й у каталозі.
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT p.id
      FROM products p
      JOIN brands b ON b.id = p.brand_id
      JOIN categories c ON c.id = p.category_id
      LEFT JOIN categories pc ON pc.id = c.parent_id
      WHERE p.status = 'ACTIVE'
        AND p.deleted_at IS NULL
        AND b.is_active
        AND c.is_active
        AND (c.parent_id IS NULL OR pc.is_active)
        AND (
          p.search_vector @@ to_tsquery('simple', ${tsQuery})
          OR p.name % ${q}
          OR p.sku ILIKE ${like}
          OR b.name ILIKE ${like}
          OR c.name ILIKE ${like}
        )
      ORDER BY
        (lower(p.sku) = lower(${q})) DESC,
        ts_rank(p.search_vector, to_tsquery('simple', ${tsQuery})) DESC,
        similarity(p.name, ${q}) DESC,
        p.created_at DESC,
        p.id
      LIMIT ${query.limit + 1}
      OFFSET ${offset}
    `;

    const hasMore = rows.length > query.limit;
    const ids = rows.slice(0, query.limit).map((row) => row.id);
    const products = await this.prisma.product.findMany({
      where: { id: { in: ids } },
      include: productInclude,
    });
    const byId = new Map(products.map((product) => [product.id, product]));
    return {
      items: ids.flatMap((id) => {
        const product = byId.get(id);
        return product ? [toProductCard(product)] : [];
      }),
      nextCursor: hasMore ? String(offset + query.limit) : null,
    };
  }

  async getHome(): Promise<HomeResponse> {
    const section = (where: Prisma.ProductWhereInput) =>
      this.prisma.product
        .findMany({
          where: { AND: [visibleProductWhere, where] },
          include: productInclude,
          orderBy: SORTS.new,
          take: HOME_SECTION_LIMIT,
        })
        .then((rows) => rows.map(toProductCard));

    const [categories, newArrivals, popular, sale] = await Promise.all([
      this.getCategories(),
      section({ isNew: true }),
      section({ isPopular: true }),
      section({ isSale: true }),
    ]);
    return { categories, newArrivals, popular, sale };
  }
}
