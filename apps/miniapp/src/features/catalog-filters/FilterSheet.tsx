import { type ReactNode, useEffect, useState } from "react";

import { useFilterOptions } from "../../entities/product/api";
import {
  type CatalogFilters,
  emptyFilters,
  hryvniasToKopecks,
  kopecksToHryvniaInput,
  toggleValue,
} from "../../entities/product/filters";
import { t } from "../../shared/strings";
import { BottomSheet } from "../../shared/ui/BottomSheet";
import { Chip } from "../../shared/ui/Chip";
import { CheckIcon } from "../../shared/ui/icons";
import { Skeleton } from "../../shared/ui/Skeleton";
import { Button } from "../../shared/ui/States";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="mb-7 last:mb-2">
      <legend className="mb-3 text-xs uppercase tracking-[0.12em] text-hint">{title}</legend>
      {children}
    </fieldset>
  );
}

const ChipsSkeleton = () => (
  <div className="flex gap-2">
    <Skeleton className="h-11 w-20" />
    <Skeleton className="h-11 w-24" />
    <Skeleton className="h-11 w-16" />
  </div>
);

/** Фільтри в нижньому листі. Зміни застосовуються кнопкою «Показати». */
export function FilterSheet({
  open,
  value,
  onApply,
  onClose,
}: {
  open: boolean;
  value: CatalogFilters;
  onApply: (filters: CatalogFilters) => void;
  onClose: () => void;
}) {
  const options = useFilterOptions();
  const [draft, setDraft] = useState(value);
  const [minInput, setMinInput] = useState("");
  const [maxInput, setMaxInput] = useState("");

  useEffect(() => {
    if (!open) return;
    setDraft(value);
    setMinInput(kopecksToHryvniaInput(value.minPrice));
    setMaxInput(kopecksToHryvniaInput(value.maxPrice));
  }, [open, value]);

  const minPrice = hryvniasToKopecks(minInput);
  const maxPrice = hryvniasToKopecks(maxInput);
  const rangeError = minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice;

  const toggle = (key: "brand" | "color" | "size", item: string) =>
    setDraft((current) => ({ ...current, [key]: toggleValue(current[key], item) }));
  const flip = (key: "inStock" | "isNew" | "isPopular" | "isSale") =>
    setDraft((current) => ({ ...current, [key]: !current[key] }));

  const footer = (
    <div className="flex gap-3">
      <Button
        variant="outline"
        className="flex-1"
        onClick={() => {
          setDraft({ ...emptyFilters(value.category), sort: value.sort });
          setMinInput("");
          setMaxInput("");
        }}
      >
        {t.common.reset}
      </Button>
      <Button
        className="flex-[2]"
        disabled={rangeError}
        onClick={() => {
          onApply({ ...draft, minPrice, maxPrice });
          onClose();
        }}
      >
        {t.common.apply}
      </Button>
    </div>
  );

  return (
    <BottomSheet open={open} title={t.catalog.filters} onClose={onClose} footer={footer}>
      <Section title={t.filters.flags}>
        <div className="flex flex-wrap gap-2">
          <Chip selected={draft.inStock} onClick={() => flip("inStock")}>
            {t.filters.inStock}
          </Chip>
          <Chip selected={draft.isNew} onClick={() => flip("isNew")}>
            {t.filters.isNew}
          </Chip>
          <Chip selected={draft.isPopular} onClick={() => flip("isPopular")}>
            {t.filters.isPopular}
          </Chip>
          <Chip selected={draft.isSale} onClick={() => flip("isSale")}>
            {t.filters.isSale}
          </Chip>
        </div>
      </Section>

      <Section title={t.filters.price}>
        <div className="flex items-center gap-3">
          {[
            { label: t.filters.priceFrom, value: minInput, set: setMinInput },
            { label: t.filters.priceTo, value: maxInput, set: setMaxInput },
          ].map((field) => (
            <label
              key={field.label}
              className="flex min-h-11 flex-1 items-center gap-2 border border-line px-3"
            >
              <span className="text-sm text-hint">{field.label}</span>
              <input
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={7}
                value={field.value}
                onChange={(event) => field.set(event.target.value.replace(/\D/g, ""))}
                className="w-full min-w-0 bg-transparent text-sm outline-none"
                aria-label={`${t.filters.price} ${field.label}`}
              />
            </label>
          ))}
        </div>
        {rangeError && <p className="mt-2 text-xs text-sale">{t.filters.priceRangeError}</p>}
      </Section>

      <Section title={t.filters.brand}>
        {options.brands.data ? (
          <div className="flex flex-wrap gap-2">
            {options.brands.data.map((brand) => (
              <Chip
                key={brand.slug}
                selected={draft.brand.includes(brand.slug)}
                onClick={() => toggle("brand", brand.slug)}
              >
                {brand.name}
              </Chip>
            ))}
          </div>
        ) : (
          <ChipsSkeleton />
        )}
      </Section>

      <Section title={t.filters.color}>
        {options.colors.data ? (
          <div className="flex flex-wrap gap-2">
            {options.colors.data.map((color) => {
              const selected = draft.color.includes(color.slug);
              return (
                <button
                  key={color.slug}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggle("color", color.slug)}
                  className={`flex min-h-11 items-center gap-2 border pl-2.5 pr-3.5 text-sm ${selected ? "border-fg" : "border-line"}`}
                >
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-full border border-line"
                    style={{ background: color.hex }}
                  >
                    {selected && (
                      <CheckIcon size={14} className="mix-blend-difference text-white" />
                    )}
                  </span>
                  {color.name}
                </button>
              );
            })}
          </div>
        ) : (
          <ChipsSkeleton />
        )}
      </Section>

      <Section title={t.filters.size}>
        {options.sizes.data ? (
          <div className="flex flex-wrap gap-2">
            {options.sizes.data.map((size) => (
              <Chip
                key={`${size.system}-${size.label}`}
                selected={draft.size.includes(size.label)}
                onClick={() => toggle("size", size.label)}
              >
                {size.label}
              </Chip>
            ))}
          </div>
        ) : (
          <ChipsSkeleton />
        )}
      </Section>
    </BottomSheet>
  );
}
