import type { ReactNode } from "react";

import { t } from "../shared/strings";
import { getWebApp } from "../shared/telegram/telegram";
import { ChevronLeftIcon } from "../shared/ui/icons";
import { useGoBack } from "./navigation";

/**
 * Шапка сторінки. У Telegram «назад» — системна BackButton, тож HTML-стрілка
 * показується тільки поза Telegram.
 */
export function PageHeader({
  title,
  back = true,
  right,
  children,
}: {
  title?: ReactNode;
  back?: boolean;
  right?: ReactNode;
  children?: ReactNode;
}) {
  const goBack = useGoBack();
  const showBack = back && !getWebApp();
  return (
    <header className="sticky top-0 z-20 bg-bg pt-[var(--safe-top)]">
      <div className="flex min-h-14 items-center gap-1 px-4">
        {showBack && (
          <button
            type="button"
            onClick={goBack}
            aria-label={t.common.back}
            className="-ml-3 flex h-11 w-11 items-center justify-center"
          >
            <ChevronLeftIcon />
          </button>
        )}
        <div className="min-w-0 flex-1 truncate text-lg font-medium tracking-tight">{title}</div>
        {right}
      </div>
      {children}
    </header>
  );
}
