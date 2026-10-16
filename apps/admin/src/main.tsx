import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";

import { router } from "./app/router";
import { SESSION_KEY } from "./features/auth/session";
import "./index.css";
import { ApiError, onUnauthorized, setCsrfToken } from "./shared/api";
import { ConfirmProvider } from "./shared/ui/Dialog";
import { ToastProvider } from "./shared/ui/Toast";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // 4xx не повторюємо: від повтору відповідь не зміниться.
      retry: (failureCount, error) =>
        failureCount < 2 &&
        !(error instanceof ApiError && error.status >= 400 && error.status < 500),
    },
  },
});

// Сесія закінчилась або її завершив власник — повертаємо на вхід.
onUnauthorized(() => {
  setCsrfToken(null);
  queryClient.setQueryData(SESSION_KEY, null);
});

const root = document.getElementById("root");
if (!root) throw new Error("#root не знайдено");

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ConfirmProvider>
          <RouterProvider router={router} />
        </ConfirmProvider>
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
);
