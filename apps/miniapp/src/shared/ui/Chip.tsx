import type { ReactNode } from "react";

/** Перемикач-«пігулка»: бренд, розмір, добірка. Ціль натискання ≥ 44 px по висоті. */
export function Chip({
  selected,
  disabled,
  onClick,
  children,
  className = "",
  ...aria
}: {
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center border px-4 text-sm transition-colors ${
        selected ? "border-fg bg-fg text-bg" : "border-line text-fg"
      } disabled:cursor-not-allowed disabled:text-hint disabled:line-through disabled:opacity-60 ${className}`}
      {...aria}
    >
      {children}
    </button>
  );
}
