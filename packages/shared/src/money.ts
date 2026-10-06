// Усі суми в системі зберігаються цілими числами в копійках.

const uahFormatter = new Intl.NumberFormat("uk-UA", {
  style: "decimal",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** 299900 → "2 999 ₴" */
export function formatUah(kopecks: number): string {
  return `${uahFormatter.format(kopecks / 100)} ₴`;
}

/** Відсоток знижки, округлений вниз; null, якщо знижки немає. */
export function discountPercent(price: number, oldPrice: number | null | undefined): number | null {
  if (!oldPrice || oldPrice <= price) return null;
  return Math.floor(((oldPrice - price) / oldPrice) * 100);
}
