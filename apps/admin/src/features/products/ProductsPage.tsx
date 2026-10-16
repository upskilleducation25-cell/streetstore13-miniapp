import type { AdminProductListItem, AdminProductSort, ProductStatus } from "@ss13/shared";
import {
  ADMIN_PRODUCT_SORT_LABELS,
  ADMIN_PRODUCT_SORTS,
  formatUah,
  PRODUCT_STATUS_LABELS,
} from "@ss13/shared";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";

import { plural } from "../../shared/lib/format";
import { useDebounced } from "../../shared/lib/use-debounced";
import { Field, Select, TextInput } from "../../shared/ui/Field";
import { Pagination } from "../../shared/ui/Pagination";
import { PageSpinner } from "../../shared/ui/Spinner";
import { Badge, EmptyState, ErrorState, PageHeader } from "../../shared/ui/States";
import { Thumb } from "../../shared/ui/Thumb";
import { useDictionaries, useProducts } from "./api";
import { StatusBadge } from "./StatusBadge";

const PAGE_SIZE = 25;
const FILTER_KEYS = ["q", "status", "categoryId", "brandId", "stock", "flag"] as const;

function Price({ product }: { product: AdminProductListItem }) {
  return (
    <span className="tabular-nums">
      {formatUah(product.price)}
      {product.oldPrice !== null && (
        <span className="ml-1.5 text-xs text-muted line-through">
          {formatUah(product.oldPrice)}
        </span>
      )}
    </span>
  );
}

function Flags({ product }: { product: AdminProductListItem }) {
  return (
    <span className="flex flex-wrap gap-1">
      {product.isNew && <Badge>Новинка</Badge>}
      {product.isPopular && <Badge>Популярне</Badge>}
      {product.isSale && <Badge>Акція</Badge>}
    </span>
  );
}

function Stock({ value, threshold }: { value: number; threshold: number }) {
  const tone = value === 0 ? "text-danger" : value <= threshold ? "text-warn" : "";
  return <span className={`tabular-nums ${tone}`}>{value} шт.</span>;
}

export function ProductsPage() {
  const [params, setParams] = useSearchParams();
  const dictionaries = useDictionaries();
  const [search, setSearch] = useState(params.get("q") ?? "");
  const [showFilters, setShowFilters] = useState(false);
  const debounced = useDebounced(search.trim());

  const page = Math.max(1, Number(params.get("page")) || 1);
  const sort = (ADMIN_PRODUCT_SORTS as readonly string[]).includes(params.get("sort") ?? "")
    ? (params.get("sort") as AdminProductSort)
    : "updated_desc";

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (!("page" in patch)) next.delete("page");
    setParams(next, { replace: true });
  };

  useEffect(() => {
    if ((params.get("q") ?? "") !== debounced) update({ q: debounced || null });
  }, [debounced]);

  const query = {
    ...Object.fromEntries(FILTER_KEYS.map((key) => [key, params.get(key)])),
    sort,
    page,
    limit: PAGE_SIZE,
  };
  const products = useProducts(query);
  const threshold = dictionaries.data?.lowStockThreshold ?? 2;
  const hasFilters = FILTER_KEYS.some((key) => params.get(key));
  const activeFilters = FILTER_KEYS.filter((key) => key !== "q" && params.get(key)).length;

  const categoryOptions = (dictionaries.data?.categories ?? [])
    .filter((c) => c.parentId === null)
    .flatMap((root) => [
      root,
      ...(dictionaries.data?.categories ?? []).filter((c) => c.parentId === root.id),
    ]);

  return (
    <>
      <PageHeader
        title="Товари"
        subtitle={
          products.data ? plural(products.data.total, "товар", "товари", "товарів") : undefined
        }
        actions={
          <Link
            to="/products/new"
            className="inline-flex min-h-10 items-center bg-fg px-4 text-sm font-medium text-bg"
          >
            + Додати товар
          </Link>
        }
      />

      <div className="mb-5 grid gap-3 border border-line bg-panel p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Пошук" className="sm:col-span-2">
          {(props) => (
            <TextInput
              {...props}
              type="search"
              placeholder="Назва або артикул"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          )}
        </Field>
        <button
          type="button"
          aria-expanded={showFilters}
          onClick={() => setShowFilters(!showFilters)}
          className="min-h-10 border border-line text-sm sm:hidden"
        >
          {showFilters ? "Сховати фільтри" : `Фільтри${activeFilters ? ` (${activeFilters})` : ""}`}
        </button>
        {/* На телефоні фільтри згорнуті, щоб список товарів було видно одразу. */}
        <div className={`${showFilters ? "grid gap-3" : "hidden"} sm:contents`}>
          <Field label="Статус">
            {(props) => (
              <Select
                {...props}
                value={params.get("status") ?? ""}
                onChange={(e) => update({ status: e.target.value })}
              >
                <option value="">Усі, крім архіву</option>
                {(Object.keys(PRODUCT_STATUS_LABELS) as ProductStatus[]).map((status) => (
                  <option key={status} value={status}>
                    {PRODUCT_STATUS_LABELS[status]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Сортування">
            {(props) => (
              <Select {...props} value={sort} onChange={(e) => update({ sort: e.target.value })}>
                {ADMIN_PRODUCT_SORTS.map((value) => (
                  <option key={value} value={value}>
                    {ADMIN_PRODUCT_SORT_LABELS[value]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Категорія">
            {(props) => (
              <Select
                {...props}
                value={params.get("categoryId") ?? ""}
                onChange={(e) => update({ categoryId: e.target.value })}
              >
                <option value="">Усі</option>
                {categoryOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.parentId ? `— ${c.name}` : c.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Бренд">
            {(props) => (
              <Select
                {...props}
                value={params.get("brandId") ?? ""}
                onChange={(e) => update({ brandId: e.target.value })}
              >
                <option value="">Усі</option>
                {dictionaries.data?.brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Залишок">
            {(props) => (
              <Select
                {...props}
                value={params.get("stock") ?? ""}
                onChange={(e) => update({ stock: e.target.value })}
              >
                <option value="">Будь-який</option>
                <option value="in">Є в наявності</option>
                <option value="low">Мало (≤ {threshold})</option>
                <option value="out">Немає</option>
              </Select>
            )}
          </Field>
          <Field label="Позначка">
            {(props) => (
              <Select
                {...props}
                value={params.get("flag") ?? ""}
                onChange={(e) => update({ flag: e.target.value })}
              >
                <option value="">Будь-яка</option>
                <option value="new">Новинка</option>
                <option value="popular">Популярне</option>
                <option value="sale">Акція</option>
              </Select>
            )}
          </Field>
        </div>
      </div>

      {products.isPending ? (
        <PageSpinner />
      ) : products.isError ? (
        <ErrorState error={products.error} onRetry={() => void products.refetch()} />
      ) : products.data.items.length === 0 ? (
        hasFilters ? (
          <EmptyState
            title="Нічого не знайдено"
            text="Змініть пошук або фільтри."
            action={
              <button
                type="button"
                className="text-sm underline"
                onClick={() => {
                  setSearch("");
                  setParams({});
                }}
              >
                Скинути фільтри
              </button>
            }
          />
        ) : (
          <EmptyState
            title="Товарів ще немає"
            text="Додайте перший товар: основні дані, ціна, кольори й розміри, фото."
            action={
              <Link
                to="/products/new"
                className="inline-flex min-h-10 items-center bg-fg px-4 text-sm text-bg"
              >
                + Додати товар
              </Link>
            }
          />
        )
      ) : (
        <div
          className={`flex flex-col gap-4 transition-opacity ${products.isPlaceholderData ? "opacity-60" : ""}`}
        >
          {/* Таблиця на ПК і планшеті */}
          <div className="hidden overflow-x-auto border border-line bg-panel md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  {["", "Товар", "Ціна", "Залишок", "Статус", ""].map((title, index) => (
                    <th key={index} scope="col" className="ss-label px-3 py-2.5 font-normal">
                      {title}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {products.data.items.map((product) => (
                  <tr key={product.id} className="border-b border-line last:border-0 hover:bg-soft">
                    <td className="w-16 px-3 py-2">
                      <Thumb urls={product.image} alt="" />
                    </td>
                    <td className="px-3 py-2">
                      <Link to={`/products/${product.id}`} className="font-medium hover:underline">
                        {product.name}
                      </Link>
                      <div className="mt-0.5 text-xs text-muted">
                        {product.sku} · {product.brand.name} · {product.category.name}
                      </div>
                      <div className="mt-1">
                        <Flags product={product} />
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <Price product={product} />
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <Stock value={product.totalStock} threshold={threshold} />
                      <div className="text-xs text-muted">
                        {plural(product.variantCount, "варіант", "варіанти", "варіантів")}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={product.status} />
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <Link
                        to={`/products/${product.id}`}
                        className="text-xs underline-offset-4 hover:underline"
                      >
                        Редагувати
                      </Link>
                      <Link
                        to={`/products/new?from=${product.id}`}
                        className="ml-3 text-xs text-muted underline-offset-4 hover:text-fg hover:underline"
                      >
                        Дублювати
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Картки на телефоні */}
          <ul className="flex flex-col gap-2 md:hidden">
            {products.data.items.map((product) => (
              <li key={product.id}>
                <Link
                  to={`/products/${product.id}`}
                  className="flex gap-3 border border-line bg-panel p-3"
                >
                  <Thumb urls={product.image} alt="" className="w-16" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate font-medium">{product.name}</p>
                      <StatusBadge status={product.status} />
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted">
                      {product.sku} · {product.brand.name}
                    </p>
                    <div className="mt-2 flex items-center justify-between text-sm">
                      <Price product={product} />
                      <Stock value={product.totalStock} threshold={threshold} />
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          <Pagination
            page={products.data.page}
            limit={products.data.limit}
            total={products.data.total}
            onPage={(next) => update({ page: next === 1 ? null : String(next) })}
          />
        </div>
      )}
    </>
  );
}
