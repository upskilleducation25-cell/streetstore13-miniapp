import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";

import { PageHeader } from "../app/PageHeader";
import { useSearch } from "../entities/product/api";
import { ProductGrid } from "../entities/product/ui/ProductGrid";
import { t } from "../shared/strings";
import { CloseIcon, SearchIcon } from "../shared/ui/icons";
import { ProductGridSkeleton } from "../shared/ui/Skeleton";
import { EmptyState, ErrorState } from "../shared/ui/States";

const DEBOUNCE_MS = 300;

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const urlQuery = params.get("q") ?? "";
  const [input, setInput] = useState(urlQuery);

  // Запит у URL — щоб «назад» з картки товару повертав ті самі результати.
  useEffect(() => {
    const timer = setTimeout(() => {
      const q = input.trim().slice(0, 100);
      if (q !== urlQuery) setParams(q ? { q } : {}, { replace: true });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [input, urlQuery, setParams]);

  const q = urlQuery.trim();
  const search = useSearch(q);
  const items = search.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <>
      <PageHeader title={t.nav.search}>
        <form
          role="search"
          className="px-4 pb-3"
          onSubmit={(event) => {
            event.preventDefault();
            (document.activeElement as HTMLElement | null)?.blur();
          }}
        >
          <label className="flex min-h-11 items-center gap-2 bg-surface px-3">
            <SearchIcon size={18} className="shrink-0 text-hint" />
            <input
              type="search"
              enterKeyHint="search"
              autoFocus
              maxLength={100}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={t.search.placeholder}
              aria-label={t.search.placeholder}
              className="w-full min-w-0 bg-transparent text-[15px] outline-none placeholder:text-hint [&::-webkit-search-cancel-button]:hidden"
            />
            {input && (
              <button
                type="button"
                onClick={() => setInput("")}
                aria-label={t.search.clear}
                className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center text-hint"
              >
                <CloseIcon size={18} />
              </button>
            )}
          </label>
        </form>
      </PageHeader>

      <div className="px-4 pt-2">
        {!q ? (
          <p className="py-10 text-center text-sm text-hint">{t.search.hint}</p>
        ) : search.isPending ? (
          <ProductGridSkeleton count={4} />
        ) : search.isError && items.length === 0 ? (
          <ErrorState error={search.error} onRetry={() => void search.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState
            title={t.search.emptyTitle(q)}
            hint={t.search.emptyHint}
            action={
              <Link
                to="/catalog"
                className="inline-flex min-h-11 items-center border border-fg px-5 text-sm font-medium"
              >
                {t.search.toCatalog}
              </Link>
            }
          />
        ) : (
          <ProductGrid
            products={items}
            hasMore={Boolean(search.hasNextPage) && !search.isFetchNextPageError}
            loadingMore={search.isFetchingNextPage}
            onLoadMore={() => {
              if (!search.isFetchingNextPage) void search.fetchNextPage();
            }}
          />
        )}
      </div>
    </>
  );
}
