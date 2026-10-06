import type { ProductColorOption } from "@ss13/shared";

import { t } from "../../shared/strings";

/** Кружечки кольорів. Недоступний колір перекреслений і не вибирається. */
export function ColorPicker({
  colors,
  value,
  onChange,
}: {
  colors: ProductColorOption[];
  value: string | null;
  onChange: (slug: string) => void;
}) {
  const selected = colors.find((color) => color.slug === value);
  return (
    <fieldset>
      <legend className="text-sm">
        <span className="text-hint">{t.product.color}:</span>{" "}
        {selected?.name ?? t.product.chooseColor}
      </legend>
      <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label={t.product.color}>
        {colors.map((color) => {
          const active = color.slug === value;
          return (
            <button
              key={color.slug}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={color.available ? color.name : `${color.name}: ${t.product.unavailable}`}
              disabled={!color.available}
              onClick={() => onChange(color.slug)}
              className={`relative flex h-11 w-11 items-center justify-center rounded-full border ${
                active ? "border-fg" : "border-transparent"
              } disabled:cursor-not-allowed`}
            >
              <span
                className={`block h-8 w-8 rounded-full border border-line ${color.available ? "" : "opacity-35"}`}
                style={{ background: color.hex }}
              />
              {!color.available && (
                <span className="absolute h-px w-9 rotate-45 bg-fg" aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
