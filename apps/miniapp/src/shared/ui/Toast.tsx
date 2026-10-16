import { useEffect, useState } from "react";

type Listener = (message: string) => void;
const listeners = new Set<Listener>();

/** Коротке повідомлення внизу екрана («Додано в кошик»). */
export function showToast(message: string): void {
  for (const listener of listeners) listener(message);
}

export function ToastHost() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const listener: Listener = (next) => {
      setMessage(next);
      clearTimeout(timer);
      timer = setTimeout(() => setMessage(null), 2200);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
      clearTimeout(timer);
    };
  }, []);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 z-50 flex justify-center px-4"
      style={{ bottom: "calc(var(--nav-height) + var(--safe-bottom) + 16px)" }}
    >
      {message && <div className="bg-fg px-4 py-3 text-sm text-bg shadow-sm">{message}</div>}
    </div>
  );
}
