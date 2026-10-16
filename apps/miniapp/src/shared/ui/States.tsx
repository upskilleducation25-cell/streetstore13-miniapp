import type { ButtonHTMLAttributes, ReactNode } from "react";

import { errorKind } from "../api/errors";
import { t } from "../strings";

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <p className="text-base font-medium">{title}</p>
      {hint && <p className="mt-2 max-w-xs text-sm text-hint">{hint}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function errorMessage(error: unknown): string {
  switch (errorKind(error)) {
    case "network":
      return t.errors.network;
    case "server":
      return t.errors.server;
    case "notFound":
      return t.errors.productNotFound;
    default:
      return error instanceof Error && error.message ? error.message : t.errors.generic;
  }
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center px-6 py-16 text-center">
      <p className="max-w-xs text-sm text-hint">{errorMessage(error)}</p>
      {onRetry && errorKind(error) !== "notFound" && (
        <Button className="mt-6" variant="outline" onClick={onRetry}>
          {t.common.retry}
        </Button>
      )}
    </div>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "solid" | "outline" | "ghost";
};

export function Button({ variant = "solid", className = "", ...props }: ButtonProps) {
  const styles = {
    solid: "bg-fg text-bg disabled:opacity-40",
    outline: "border border-fg text-fg disabled:opacity-40",
    ghost: "text-fg",
  }[variant];
  return (
    <button
      type="button"
      className={`inline-flex min-h-11 items-center justify-center px-5 text-sm font-medium tracking-wide ${styles} ${className}`}
      {...props}
    />
  );
}
