import type { ProductCard as ProductCardData } from "@ss13/shared";
import { Link } from "react-router";

import { t } from "../../../shared/strings";
import { Image } from "../../../shared/ui/Image";
import { ProductBadge } from "./Badges";
import { PriceTag } from "./PriceTag";

export function ProductCard({
  product,
  eager = false,
}: {
  product: ProductCardData;
  eager?: boolean;
}) {
  return (
    <Link
      to={`/p/${product.id}`}
      className="group block"
      aria-label={`${product.brand.name} ${product.name}`}
    >
      <div className="relative">
        <Image
          urls={product.image}
          alt={product.name}
          eager={eager}
          sizes="(max-width: 480px) 50vw, 240px"
        />
        <ProductBadge product={product} />
        {!product.inStock && (
          <span className="absolute inset-x-0 bottom-0 bg-bg/85 py-1.5 text-center text-xs text-hint">
            {t.product.outOfStock}
          </span>
        )}
      </div>
      <p className="mt-2.5 text-[11px] uppercase tracking-[0.12em] text-hint">
        {product.brand.name}
      </p>
      <p className="mt-1 line-clamp-2 text-sm leading-snug">{product.name}</p>
      <div className="mt-1.5">
        <PriceTag product={product} />
      </div>
    </Link>
  );
}
