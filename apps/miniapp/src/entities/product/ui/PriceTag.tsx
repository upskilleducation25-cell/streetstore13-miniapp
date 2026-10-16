import { priceView } from "../price";

export function PriceTag({
  product,
  size = "sm",
}: {
  product: { price: number; oldPrice: number | null; discountPercent: number | null };
  size?: "sm" | "lg";
}) {
  const view = priceView(product);
  const big = size === "lg";
  return (
    <div className={`flex flex-wrap items-baseline gap-x-2 ${big ? "text-xl" : "text-sm"}`}>
      <span className={`font-medium ${view.old ? "text-sale" : ""}`}>{view.current}</span>
      {view.old && (
        <s
          className={`text-hint ${big ? "text-base" : "text-xs"}`}
          aria-label={`Стара ціна ${view.old}`}
        >
          {view.old}
        </s>
      )}
      {big && view.discount && <span className="text-sm text-sale">{view.discount}</span>}
    </div>
  );
}
