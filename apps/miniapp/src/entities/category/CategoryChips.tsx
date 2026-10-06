import type { CategoryItem } from "@ss13/shared";
import { Link } from "react-router";

import { t } from "../../shared/strings";

/** Горизонтальний ряд категорій. Порожні категорії не показуємо. */
export function CategoryChips({
  categories,
  active,
  hrefFor,
  showAll = false,
}: {
  categories: CategoryItem[];
  active?: string;
  hrefFor: (slug: string | undefined) => string;
  showAll?: boolean;
}) {
  const visible = categories.filter((category) => category.productCount > 0);
  const chip = (selected: boolean) =>
    `flex min-h-11 shrink-0 items-center border px-4 text-sm whitespace-nowrap ${
      selected ? "border-fg bg-fg text-bg" : "border-line"
    }`;
  return (
    <nav aria-label={t.home.categories}>
      <ul className="no-scrollbar flex gap-2 overflow-x-auto px-4">
        {showAll && (
          <li>
            <Link
              to={hrefFor(undefined)}
              className={chip(!active)}
              aria-current={!active ? "page" : undefined}
            >
              {t.catalog.allCategories}
            </Link>
          </li>
        )}
        {visible.map((category) => (
          <li key={category.id}>
            <Link
              to={hrefFor(category.slug)}
              className={chip(active === category.slug)}
              aria-current={active === category.slug ? "page" : undefined}
            >
              {category.name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
