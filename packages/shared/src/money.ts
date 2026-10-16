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

/**
 * Введена людиною сума в гривнях → копійки. Приймає «1299», «1 299,50», «1299.5»
 * (пробіли, зокрема нерозривні, і знак ₴ ігноруються).
 * Повертає null для порожнього рядка, від'ємних чисел, більш ніж 2 знаків після коми
 * і всього, що не є числом.
 */
export function parseUahToKopecks(input: string): number | null {
  const normalized = input.replace(/[\s\u00a0\u202f₴]/g, "").replace(",", ".");
  const match = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(normalized);
  if (!match) return null;
  const hryvnias = Number(match[1]);
  const kopecks = Number((match[2] ?? "").padEnd(2, "0"));
  return hryvnias * 100 + kopecks;
}

/** 129950 → "1299,50", 129900 → "1299": значення для поля вводу. */
export function kopecksToUahInput(kopecks: number): string {
  const hryvnias = Math.trunc(kopecks / 100);
  const rest = kopecks % 100;
  return rest === 0 ? String(hryvnias) : `${hryvnias},${String(rest).padStart(2, "0")}`;
}
