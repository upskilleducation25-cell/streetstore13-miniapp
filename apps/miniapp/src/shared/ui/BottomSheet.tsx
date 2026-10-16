import { type ReactNode, useEffect, useId } from "react";
import { createPortal } from "react-dom";

import { t } from "../strings";
import { CloseIcon } from "./icons";

/** Нижній лист замість модальних вікон (фільтри, сортування). */
export function BottomSheet({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[85dvh] flex-col bg-bg pb-[var(--safe-bottom)]"
      >
        <div className="flex items-center justify-between border-b border-line px-4">
          <h2 id={titleId} className="py-4 text-base font-medium">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.common.close}
            className="-mr-2 flex h-11 w-11 items-center justify-center"
          >
            <CloseIcon size={22} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
        {footer && <div className="border-t border-line px-4 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
