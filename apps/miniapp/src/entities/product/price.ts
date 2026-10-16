import { formatUah } from "@ss13/shared";

export interface PriceView {
  current: string;
  old: string | null;
  discount: string | null;
}

/** Ціни приходять у копійках; у гривні — тільки через formatUah з @ss13/shared. */
export function priceView(product: {
  price: number;
  oldPrice: number | null;
  discountPercent: number | null;
}): PriceView {
  const hasOld = product.oldPrice !== null && product.oldPrice > product.price;
  return {
    current: formatUah(product.price),
    old: hasOld ? formatUah(product.oldPrice!) : null,
    discount: hasOld && product.discountPercent ? `−${product.discountPercent}%` : null,
  };
}
