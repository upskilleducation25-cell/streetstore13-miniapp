import { t } from "../../../shared/strings";
import { priceView } from "../price";

/** «−N%» або «Новинка» поверх фото; знижка має пріоритет. */
export function ProductBadge({
  product,
}: {
  product: {
    price: number;
    oldPrice: number | null;
    discountPercent: number | null;
    isNew: boolean;
  };
}) {
  const discount = priceView(product).discount;
  if (!discount && !product.isNew) return null;
  return (
    <span
      className={`absolute left-2 top-2 px-2 py-1 text-[11px] font-medium uppercase tracking-wider ${
        discount ? "bg-sale text-white" : "bg-bg text-fg"
      }`}
    >
      {discount ?? t.badges.new}
    </span>
  );
}
