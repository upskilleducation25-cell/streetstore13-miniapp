import { Suspense } from "react";
import { Outlet, ScrollRestoration, useMatches } from "react-router";

import { ProductGridSkeleton } from "../shared/ui/Skeleton";
import { ToastHost } from "../shared/ui/Toast";
import { BackButtonController } from "./BackButtonController";
import { BottomNav } from "./BottomNav";

interface RouteHandle {
  /** Сторінка має власну нижню дію (MainButton) і не показує нижню навігацію. */
  hideNav?: boolean;
}

export function AppShell() {
  const matches = useMatches();
  const hideNav = matches.some((match) => (match.handle as RouteHandle | undefined)?.hideNav);
  return (
    <div className="mx-auto min-h-dvh max-w-xl pl-[var(--safe-left)] pr-[var(--safe-right)]">
      <BackButtonController />
      <main
        className={
          hideNav
            ? "pb-[calc(88px+var(--safe-bottom))]"
            : "pb-[calc(var(--nav-height)+var(--safe-bottom)+24px)]"
        }
      >
        <Suspense
          fallback={
            <div className="px-4 pt-[calc(var(--safe-top)+72px)]">
              <ProductGridSkeleton count={4} />
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </main>
      {!hideNav && <BottomNav />}
      <ToastHost />
      <ScrollRestoration />
    </div>
  );
}
