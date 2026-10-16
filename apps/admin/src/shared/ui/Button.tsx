import type { ButtonHTMLAttributes, ReactNode } from "react";

import { Spinner } from "./Spinner";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const STYLES: Record<Variant, string> = {
  primary: "bg-fg text-bg border border-fg hover:opacity-90",
  secondary: "bg-panel text-fg border border-line hover:border-fg",
  ghost: "text-fg border border-transparent hover:bg-soft",
  danger: "bg-panel text-danger border border-line hover:border-danger",
};

export function Button({
  variant = "secondary",
  loading = false,
  size = "md",
  children,
  className = "",
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  loading?: boolean;
  size?: "sm" | "md";
  children: ReactNode;
}) {
  const sizing = size === "sm" ? "min-h-8 px-3 text-xs" : "min-h-10 px-4 text-sm";
  return (
    <button
      type="button"
      {...props}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-2 font-medium tracking-wide whitespace-nowrap transition disabled:cursor-not-allowed disabled:opacity-50 ${sizing} ${STYLES[variant]} ${className}`}
    >
      {loading && <Spinner small />}
      {children}
    </button>
  );
}
