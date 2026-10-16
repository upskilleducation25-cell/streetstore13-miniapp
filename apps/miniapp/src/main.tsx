import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";

import { LaunchModeContext } from "./app/launch";
import { router } from "./app/router";
import "./index.css";
import { auth, errorKind, setInitDataProvider } from "./shared/api";
import { resolveLaunchMode } from "./shared/telegram/launch-mode";
import { getWebApp, initTelegram } from "./shared/telegram/telegram";

const webApp = getWebApp();
const mode = resolveLaunchMode({ isDev: import.meta.env.DEV, initData: webApp?.initData });

if (mode === "telegram") {
  setInitDataProvider(async () => getWebApp()?.initData ?? null);
} else if (import.meta.env.DEV && mode === "dev-mock") {
  // Гілка вирізається з production-збірки разом із dev-mock.ts.
  setInitDataProvider(() => import("./shared/telegram/dev-mock").then((m) => m.loadDevInitData()));
}

initTelegram();
// Тихий вхід на старті: каталог публічний, тож помилка входу не блокує вітрину.
void auth.getSession().catch(() => undefined);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: false,
      // 4xx не повторюємо: від повтору відповідь не зміниться.
      retry: (failureCount, error) => {
        const kind = errorKind(error);
        return failureCount < 2 && (kind === "network" || kind === "server");
      },
    },
  },
});

const root = document.getElementById("root");
if (!root) throw new Error("#root не знайдено");

createRoot(root).render(
  <StrictMode>
    <LaunchModeContext value={mode}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </LaunchModeContext>
  </StrictMode>,
);
