import type { ReactNode } from "react";
import { createContext, use, useCallback, useEffect, useId, useRef, useState } from "react";

import { Button } from "./Button";

/** Модальне вікно на нативному <dialog>: фокус усередині, Esc закриває. */
export function Dialog({
  open,
  title,
  onClose,
  children,
  footer,
  wide = false,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className={`m-auto w-[calc(100%-2rem)] ${wide ? "max-w-2xl" : "max-w-md"} border border-line bg-panel p-0 text-fg backdrop:bg-black/50`}
    >
      {open && (
        <div className="flex max-h-[85dvh] flex-col">
          <h2 id={titleId} className="border-b border-line px-5 py-4 text-base font-semibold">
            {title}
          </h2>
          <div className="overflow-y-auto px-5 py-4 text-sm">{children}</div>
          {footer && (
            <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>
          )}
        </div>
      )}
    </dialog>
  );
}

interface ConfirmRequest {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
}

type ConfirmFn = (request: ConfirmRequest) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/** Підтвердження небезпечних дій: const ok = await confirm({...}). */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmRequest & { resolve: (ok: boolean) => void }) | null>(
    null,
  );

  const confirm = useCallback<ConfirmFn>(
    (request) => new Promise<boolean>((resolve) => setState({ ...request, resolve })),
    [],
  );
  const close = (ok: boolean) => {
    state?.resolve(ok);
    setState(null);
  };

  return (
    <ConfirmContext value={confirm}>
      {children}
      <Dialog
        open={state !== null}
        title={state?.title ?? ""}
        onClose={() => close(false)}
        footer={
          <>
            <Button onClick={() => close(false)}>Скасувати</Button>
            <Button variant={state?.danger ? "danger" : "primary"} onClick={() => close(true)}>
              {state?.confirmLabel ?? "Підтвердити"}
            </Button>
          </>
        }
      >
        <div className="text-muted">{state?.message}</div>
      </Dialog>
    </ConfirmContext>
  );
}

export function useConfirm(): ConfirmFn {
  const confirm = use(ConfirmContext);
  if (!confirm) throw new Error("useConfirm без ConfirmProvider");
  return confirm;
}
