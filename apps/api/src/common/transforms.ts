import type { TransformFnParams } from "class-transformer";

/** `?brand=nike&brand=acne` або `?brand=nike,acne` → ["nike", "acne"]. */
export function toStringArray({ value }: TransformFnParams): string[] | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const list = (Array.isArray(value) ? value : [value])
    .flatMap((item) => String(item).split(","))
    .map((item) => item.trim())
    .filter(Boolean);
  return list.length > 0 ? list : undefined;
}

/** "true"/"1" → true, "false"/"0" → false; інше лишається як є, і валідатор його відхилить. */
export function toBoolean({ value }: TransformFnParams): unknown {
  if (value === "true" || value === "1" || value === true) return true;
  if (value === "false" || value === "0" || value === false) return false;
  return value;
}
