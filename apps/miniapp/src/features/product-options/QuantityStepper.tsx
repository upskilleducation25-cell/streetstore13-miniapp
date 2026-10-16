import { t } from "../../shared/strings";
import { MinusIcon, PlusIcon } from "../../shared/ui/icons";

export function QuantityStepper({
  value,
  max,
  onChange,
}: {
  value: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const disabled = max < 1;
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-hint">{t.product.quantity}</span>
      <div className="flex items-center border border-line">
        <button
          type="button"
          aria-label="Менше"
          disabled={disabled || value <= 1}
          onClick={() => onChange(value - 1)}
          className="flex h-11 w-11 items-center justify-center disabled:opacity-30"
        >
          <MinusIcon size={18} />
        </button>
        <output aria-live="polite" className="w-8 text-center text-sm tabular-nums">
          {disabled ? 0 : value}
        </output>
        <button
          type="button"
          aria-label="Більше"
          disabled={disabled || value >= max}
          onClick={() => onChange(value + 1)}
          className="flex h-11 w-11 items-center justify-center disabled:opacity-30"
        >
          <PlusIcon size={18} />
        </button>
      </div>
    </div>
  );
}
