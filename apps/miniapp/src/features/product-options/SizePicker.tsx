import type { SizeOption } from "../../entities/product/options";
import { t } from "../../shared/strings";
import { Chip } from "../../shared/ui/Chip";

/** Розміри для вибраного кольору; недоступні перекреслені й неактивні. */
export function SizePicker({
  sizes,
  value,
  onChange,
}: {
  sizes: SizeOption[];
  value: string | null;
  onChange: (label: string) => void;
}) {
  return (
    <fieldset>
      <legend className="text-sm">
        <span className="text-hint">{t.product.size}:</span> {value ?? t.product.chooseSize}
      </legend>
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={t.product.size}>
        {sizes.map((size) => (
          <Chip
            key={size.label}
            selected={size.label === value}
            disabled={!size.available}
            onClick={() => onChange(size.label)}
            aria-label={size.available ? size.label : `${size.label}: ${t.product.unavailable}`}
          >
            {size.label}
          </Chip>
        ))}
      </div>
    </fieldset>
  );
}
