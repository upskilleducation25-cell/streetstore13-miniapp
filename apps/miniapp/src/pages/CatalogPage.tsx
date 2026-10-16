import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";

import { PageHeader } from "../app/PageHeader";
import { CategoryChips } from "../entities/category/CategoryChips";
import { useCategories, useProducts } from "../entities/product/api";
import {
  type CatalogFilters,
  countActiveFilters,
  emptyFilters,
  filtersToSearchParams,
  parseFilters,
} from "../entities/product/filters";
import { ProductGrid } from "../entities/product/ui/ProductGrid";
import { CartButton } from "../features/cart/CartButton";
import { ActiveFilters } from "../features/catalog-filters/ActiveFilters";
import { FilterSheet } from "../features/catalog-filters/FilterSheet";
import { SortSheet } from "../features/catalog-filters/SortSheet";
import { t } from "../shared/strings";
import { SlidersIcon, SortIcon } from "../shared/ui/icons";
import { ProductGridSkeleton } from "../shared/ui/Skeleton";
import { Button, EmptyState, ErrorState } from "../shared/ui/States";

export default function CatalogPage() {
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => parseFilters(params), [params]);
  const [sheet, setSheet] = useState<"filters" | "sort" | null>(null);

  const categories = useCategories();
  const products = useProducts(filters);

  const setFilters = (next: CatalogFilters) =>
    setParams(filtersToSearchParams(next), { replace: true });
  const categoryName = categories.data
    ?.flatMap((c) => [c, ...c.children])
    .find((c) => c.slug === filters.category)?.name;
  const activeCount = countActiveFilters(filters);
  const items = products.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <>
      <PageHeader title={categoryName ?? t.catalog.title} right={<CartButton />}>
        {categories.data && (
          <CategoryChips
            categories={categories.data}
            active={filters.category}
            showAll
            hrefFor={(slug) =>
              `/catalog?${filtersToSearchParams({ ...filters, category: slug }).toString()}`
            }
          />
        )}
        <div className="mt-2 flex border-y border-line">
          <button
            type="button"
            onClick={() => setSheet("filters")}
            className="flex min-h-11 flex-1 items-center justify-center gap-2 border-r border-line text-sm"
          >
            <SlidersIcon size={18} />
            {t.catalog.filters}
            {activeCount > 0 && <span className="text-hint">({activeCount})</span>}
          </button>
          <button
            type="button"
            onClick={() => setSheet("sort")}
            className="flex min-h-11 flex-1 items-center justify-center gap-2 text-sm"
          >
            <SortIcon size={18} />
            {t.catalog.sorts[filters.sort]}
          </button>
        </div>
        <div className="pt-2">
          <ActiveFilters filters={filters} onChange={setFilters} />
        </div>
      </PageHeader>

      <div
        className={`px-4 pt-3 transition-opacity ${products.isPlaceholderData ? "opacity-50" : ""}`}
      >
        {products.isPending ? (
          <ProductGridSkeleton />
        ) : products.isError && items.length === 0 ? (
          <ErrorState error={products.error} onRetry={() => void products.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState
            title={t.catalog.empty}
            hint={t.catalog.emptyHint}
            action={
              <Button
                variant="outline"
                onClick={() =>
                  setFilters({ ...emptyFilters(filters.category), sort: filters.sort })
                }
              >
                {t.catalog.resetFilters}
              </Button>
            }
          />
        ) : (
          <>
            <ProductGrid
              products={items}
              hasMore={Boolean(products.hasNextPage) && !products.isFetchNextPageError}
              loadingMore={products.isFetchingNextPage}
              onLoadMore={() => {
                if (!products.isFetchingNextPage) void products.fetchNextPage();
              }}
            />
            {products.isFetchNextPageError && (
              <ErrorState error={products.error} onRetry={() => void products.fetchNextPage()} />
            )}
            {!products.hasNextPage && items.length > 6 && (
              <p className="py-8 text-center text-xs text-hint">{t.catalog.end}</p>
            )}
          </>
        )}
      </div>

      <FilterSheet
        open={sheet === "filters"}
        value={filters}
        onApply={setFilters}
        onClose={() => setSheet(null)}
      />
      <SortSheet
        open={sheet === "sort"}
        value={filters.sort}
        onChange={(sort) => setFilters({ ...filters, sort })}
        onClose={() => setSheet(null)}
      />
    </>
  );
}
