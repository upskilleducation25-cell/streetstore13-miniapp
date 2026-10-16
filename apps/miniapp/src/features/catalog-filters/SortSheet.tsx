import { PRODUCT_SORTS, type ProductSort } from "@ss13/shared";

import { t } from "../../shared/strings";
import { BottomSheet } from "../../shared/ui/BottomSheet";
import { CheckIcon } from "../../shared/ui/icons";

export function SortSheet({
  open,
  value,
  onChange,
  onClose,
}: {
  open: boolean;
  value: ProductSort;
  onChange: (sort: ProductSort) => void;
  onClose: () => void;
}) {
  return (
    <BottomSheet open={open} title={t.catalog.sort} onClose={onClose}>
      <ul className="-my-2">
        {PRODUCT_SORTS.map((sort) => (
          <li key={sort}>
            <button
              type="button"
              aria-pressed={sort === value}
              onClick={() => {
                onChange(sort);
                onClose();
              }}
              className="flex min-h-12 w-full items-center justify-between text-left text-[15px]"
            >
              {t.catalog.sorts[sort]}
              {sort === value && <CheckIcon size={20} />}
            </button>
          </li>
        ))}
      </ul>
    </BottomSheet>
  );
}
