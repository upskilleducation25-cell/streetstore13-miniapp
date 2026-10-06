import type { ProductCard as ProductCardData } from "@ss13/shared";
import { useEffect, useRef } from "react";

import { ProductCardSkeleton } from "../../../shared/ui/Skeleton";
import { ProductCard } from "./ProductCard";

/** Сітка 2 колонки з нескінченною прокруткою: наступна сторінка — коли низ близько. */
export function ProductGrid({
  products,
  hasMore,
  loadingMore,
  onLoadMore,
}: {
  products: ProductCardData[];
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
}) {
  const sentinel = useRef<HTMLDivElement>(null);
  const loadMore = useRef(onLoadMore);
  useEffect(() => {
    loadMore.current = onLoadMore;
  });

  useEffect(() => {
    const node = sentinel.current;
    if (!node || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMore.current();
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, products.length]);

  return (
    <>
      <div className="grid grid-cols-2 gap-x-3 gap-y-6">
        {products.map((product, index) => (
          <ProductCard key={product.id} product={product} eager={index < 4} />
        ))}
        {loadingMore && (
          <>
            <ProductCardSkeleton />
            <ProductCardSkeleton />
          </>
        )}
      </div>
      {hasMore && <div ref={sentinel} className="h-px" />}
    </>
  );
}
