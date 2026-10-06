import { Link } from "react-router";

import { CategoryChips } from "../entities/category/CategoryChips";
import { useHome } from "../entities/product/api";
import { ProductCarousel } from "../entities/product/ui/ProductCarousel";
import { CartButton } from "../features/cart/CartButton";
import { PageHeader } from "../app/PageHeader";
import { t } from "../shared/strings";
import { SearchIcon } from "../shared/ui/icons";
import { Skeleton } from "../shared/ui/Skeleton";
import { ErrorState } from "../shared/ui/States";

function HomeSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="flex gap-2 px-4">
        {["w-20", "w-24", "w-16", "w-24"].map((width, i) => (
          <Skeleton key={i} className={`h-11 shrink-0 ${width}`} />
        ))}
      </div>
      {[0, 1].map((section) => (
        <div key={section} className="mt-9 px-4">
          <Skeleton className="h-5 w-32" />
          <div className="mt-3 flex gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="w-[42%] shrink-0">
                <Skeleton className="aspect-[3/4] w-full" />
                <Skeleton className="mt-3 h-3 w-1/2" />
                <Skeleton className="mt-2 h-3.5 w-4/5" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function HomePage() {
  const home = useHome();

  return (
    <>
      <PageHeader
        back={false}
        title={<span className="text-[17px] font-semibold tracking-[0.18em]">{t.brand}</span>}
        right={<CartButton />}
      >
        <div className="px-4 pb-3">
          <Link
            to="/search"
            className="flex min-h-11 items-center gap-2 bg-surface px-3 text-sm text-hint"
          >
            <SearchIcon size={18} />
            {t.home.searchPlaceholder}
          </Link>
        </div>
      </PageHeader>

      {home.isPending ? (
        <HomeSkeleton />
      ) : home.isError ? (
        <ErrorState error={home.error} onRetry={() => void home.refetch()} />
      ) : (
        <>
          <CategoryChips
            categories={home.data.categories}
            hrefFor={(slug) => (slug ? `/catalog?category=${slug}` : "/catalog")}
          />
          <ProductCarousel
            title={t.home.newArrivals}
            products={home.data.newArrivals}
            allHref="/catalog?isNew=true"
            eager
          />
          <ProductCarousel
            title={t.home.popular}
            products={home.data.popular}
            allHref="/catalog?isPopular=true"
          />
          <ProductCarousel
            title={t.home.sale}
            products={home.data.sale}
            allHref="/catalog?isSale=true"
          />
        </>
      )}
    </>
  );
}
