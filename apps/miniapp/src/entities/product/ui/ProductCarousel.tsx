import type { ProductCard as ProductCardData } from "@ss13/shared";
import { Link } from "react-router";

import { t } from "../../../shared/strings";
import { ChevronRightIcon } from "../../../shared/ui/icons";
import { ProductCard } from "./ProductCard";

/** Горизонтальна добірка на головній з посиланням «Усі». */
export function ProductCarousel({
  title,
  products,
  allHref,
  eager = false,
}: {
  title: string;
  products: ProductCardData[];
  allHref: string;
  eager?: boolean;
}) {
  if (products.length === 0) return null;
  return (
    <section className="mt-9">
      <div className="flex items-center justify-between px-4">
        <h2 className="text-lg font-medium tracking-tight">{title}</h2>
        <Link
          to={allHref}
          className="-mr-2 flex min-h-11 items-center gap-0.5 px-2 text-sm text-hint"
        >
          {t.common.all}
          <ChevronRightIcon size={16} />
        </Link>
      </div>
      <ul className="no-scrollbar mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4">
        {products.map((product, index) => (
          <li key={product.id} className="w-[42%] max-w-[200px] shrink-0 snap-start">
            <ProductCard product={product} eager={eager && index < 3} />
          </li>
        ))}
      </ul>
    </section>
  );
}
