import type { AdminSessionResponse } from "@ss13/shared";
import { ADMIN_ROLE_LABELS } from "@ss13/shared";
import { useEffect, useState } from "react";
import { Navigate, NavLink, Outlet, useLocation } from "react-router";

import { useLogout, useSession } from "../features/auth/session";
import { ErrorState } from "../shared/ui/States";
import { PageSpinner } from "../shared/ui/Spinner";

const NAV = [
  { to: "/products", label: "Товари" },
  { to: "/categories", label: "Категорії" },
  { to: "/dictionaries", label: "Довідники" },
  { to: "/admins", label: "Адміністратори", ownerOnly: true },
  { to: "/account", label: "Мій акаунт" },
];

function Nav({ session, onNavigate }: { session: AdminSessionResponse; onNavigate?: () => void }) {
  const logout = useLogout();
  return (
    <div className="flex h-full flex-col">
      <nav aria-label="Розділи" className="flex flex-col gap-0.5">
        {NAV.filter((item) => !item.ownerOnly || session.admin.role === "OWNER").map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              `px-3 py-2.5 text-sm transition ${isActive ? "bg-fg text-bg" : "hover:bg-soft"}`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto border-t border-line pt-4 text-sm">
        <p className="truncate font-medium">{session.admin.name}</p>
        <p className="truncate text-xs text-muted">
          {session.admin.email} · {ADMIN_ROLE_LABELS[session.admin.role]}
        </p>
        <button
          type="button"
          onClick={() => logout.mutate()}
          className="mt-3 text-xs tracking-wide text-muted uppercase underline-offset-4 hover:text-fg hover:underline"
        >
          Вийти
        </button>
      </div>
    </div>
  );
}

const Logo = () => <span className="text-sm font-semibold tracking-[0.25em]">STREETSTORE.13</span>;

/** Каркас адмінки: сайдбар на ПК і планшеті, верхня панель із меню на телефоні. */
export function AdminLayout() {
  const session = useSession();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => setMenuOpen(false), [location.pathname]);

  if (session.isPending) return <PageSpinner />;
  if (session.isError) {
    return (
      <div className="p-6">
        <ErrorState error={session.error} onRetry={() => void session.refetch()} />
      </div>
    );
  }
  if (!session.data) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[232px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-8 border-r border-line bg-panel px-4 py-6 lg:flex">
        <Logo />
        <Nav session={session.data} />
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-panel px-4 py-3 lg:hidden">
        <Logo />
        <button
          type="button"
          aria-expanded={menuOpen}
          aria-controls="mobile-nav"
          onClick={() => setMenuOpen((open) => !open)}
          className="min-h-10 px-3 text-xs tracking-widest uppercase"
        >
          {menuOpen ? "Закрити" : "Меню"}
        </button>
      </header>
      {menuOpen && (
        <div
          id="mobile-nav"
          className="fixed inset-x-0 top-[57px] bottom-0 z-20 bg-panel px-4 py-4 lg:hidden"
        >
          <Nav session={session.data} onNavigate={() => setMenuOpen(false)} />
        </div>
      )}

      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        <Outlet />
      </main>
    </div>
  );
}

/** Сторінка тільки для власника. Сервер однаково перевіряє роль — це лише зручність UI. */
export function OwnerOnly({ children }: { children: React.ReactNode }) {
  const session = useSession();
  if (session.data?.admin.role !== "OWNER") return <Navigate to="/products" replace />;
  return children;
}
