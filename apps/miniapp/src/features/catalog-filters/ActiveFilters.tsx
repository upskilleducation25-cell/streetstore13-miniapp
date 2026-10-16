import { formatUah } from "@ss13/shared";

import { useFilterOptions } from "../../entities/product/api";
import type { CatalogFilters } from "../../entities/product/filters";
import { t } from "../../shared/strings";
import { CloseIcon } from "../../shared/ui/icons";

interface ActiveChip {
  key: string;
  label: string;
  remove: (filters: CatalogFilters) => CatalogFilters;
}

/** Чіпи увімкнених фільтрів; натискання прибирає фільтр. */
export function ActiveFilters({
  filters,
  onChange,
}: {
  filters: CatalogFilters;
  onChange: (filters: CatalogFilters) => void;
}) {
  const { brands, colors } = useFilterOptions();
  const brandName = (slug: string) => brands.data?.find((b) => b.slug === slug)?.name ?? slug;
  const colorName = (slug: string) => colors.data?.find((c) => c.slug === slug)?.name ?? slug;

  const chips: ActiveChip[] = [
    ...filters.brand.map((slug) => ({
      key: `brand-${slug}`,
      label: brandName(slug),
      remove: (f: CatalogFilters) => ({ ...f, brand: f.brand.filter((x) => x !== slug) }),
    })),
    ...filters.color.map((slug) => ({
      key: `color-${slug}`,
      label: colorName(slug),
      remove: (f: CatalogFilters) => ({ ...f, color: f.color.filter((x) => x !== slug) }),
    })),
    ...filters.size.map((label) => ({
      key: `size-${label}`,
      label: `${t.filters.size} ${label}`,
      remove: (f: CatalogFilters) => ({ ...f, size: f.size.filter((x) => x !== label) }),
    })),
  ];
  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    const from =
      filters.minPrice !== undefined ? `${t.filters.priceFrom} ${formatUah(filters.minPrice)}` : "";
    const to =
      filters.maxPrice !== undefined ? `${t.filters.priceTo} ${formatUah(filters.maxPrice)}` : "";
    chips.push({
      key: "price",
      label: [from, to].filter(Boolean).join(" "),
      remove: (f) => ({ ...f, minPrice: undefined, maxPrice: undefined }),
    });
  }
  const flags = [
    ["inStock", t.filters.inStock],
    ["isNew", t.filters.isNew],
    ["isPopular", t.filters.isPopular],
    ["isSale", t.filters.isSale],
  ] as const;
  for (const [key, label] of flags) {
    if (filters[key]) chips.push({ key, label, remove: (f) => ({ ...f, [key]: false }) });
  }

  if (chips.length === 0) return null;
  return (
    <ul className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-1">
      {chips.map((chip) => (
        <li key={chip.key}>
          <button
            type="button"
            onClick={() => onChange(chip.remove(filters))}
            className="flex min-h-11 items-center"
            aria-label={`Прибрати фільтр: ${chip.label}`}
          >
            <span className="flex h-8 items-center gap-1.5 whitespace-nowrap bg-surface pl-3 pr-2 text-[13px]">
              {chip.label}
              <CloseIcon size={14} />
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
