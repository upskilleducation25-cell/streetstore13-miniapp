import type { ReactNode } from "react";
import { createContext, use, useCallback, useState } from "react";

type Tone = "ok" | "error";
interface Toast {
  id: number;
  text: string;
  tone: Tone;
}

const ToastContext = createContext<((text: string, tone?: Tone) => void) | null>(null);

let nextId = 1;

/** Короткі повідомлення «Збережено» / «Помилка» внизу екрана; зчитуються скрінрідером. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const show = useCallback((text: string, tone: Tone = "ok") => {
    const id = nextId++;
    setToasts((list) => [...list.slice(-2), { id, text, tone }]);
    setTimeout(
      () => setToasts((list) => list.filter((toast) => toast.id !== id)),
      tone === "error" ? 6000 : 3000,
    );
  }, []);
  return (
    <ToastContext value={show}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.tone === "error" ? "alert" : "status"}
            className={`pointer-events-auto max-w-md border px-4 py-3 text-sm shadow-lg ${
              toast.tone === "error"
                ? "border-danger bg-panel text-danger"
                : "border-fg bg-fg text-bg"
            }`}
          >
            {toast.text}
          </div>
        ))}
      </div>
    </ToastContext>
  );
}

export function useToast() {
  const show = use(ToastContext);
  if (!show) throw new Error("useToast без ToastProvider");
  return show;
}
