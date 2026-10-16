import { ORDER_STATUS_LABELS } from "@ss13/shared";

// Каркас адмін-панелі. Вхід, розділи і таблиці з'являться на Етапах 4–5.
export function App() {
  return (
    <main className="min-h-dvh bg-neutral-50 p-6 text-neutral-900">
      <h1 className="text-xl font-semibold">STREETSTORE.13 — Адмін</h1>
      <p className="mt-2 text-sm text-neutral-500">
        Каркас Етапу 0. Статуси замовлень: {Object.values(ORDER_STATUS_LABELS).join(" · ")}
      </p>
    </main>
  );
}
