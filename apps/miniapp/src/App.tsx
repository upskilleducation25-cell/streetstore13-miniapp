import { formatUah } from "@ss13/shared";

// Каркас вітрини. Сторінки, Telegram SDK і навігація з'являться на Етапі 2.
export function App() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-2 bg-white px-4 text-neutral-900">
      <h1 className="text-2xl font-semibold tracking-tight">STREETSTORE.13</h1>
      <p className="text-sm text-neutral-500">Mini App: каркас Етапу 0 · {formatUah(299900)}</p>
    </main>
  );
}
