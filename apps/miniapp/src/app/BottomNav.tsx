import type { ComponentType } from "react";
import { NavLink } from "react-router";

import { CartCounter } from "../features/cart/CartButton";
import { useCartCount } from "../features/cart/cart";
import { t } from "../shared/strings";
import { BagIcon, GridIcon, HomeIcon, SearchIcon, UserIcon } from "../shared/ui/icons";

const ITEMS: Array<{
  to: string;
  label: string;
  Icon: ComponentType<{ size?: number }>;
  end?: boolean;
}> = [
  { to: "/", label: t.nav.home, Icon: HomeIcon, end: true },
  { to: "/catalog", label: t.nav.catalog, Icon: GridIcon },
  { to: "/search", label: t.nav.search, Icon: SearchIcon },
  { to: "/cart", label: t.nav.cart, Icon: BagIcon },
  { to: "/profile", label: t.nav.profile, Icon: UserIcon },
];

export function BottomNav() {
  const count = useCartCount();
  return (
    <nav
      aria-label="Основна навігація"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg pb-[var(--safe-bottom)]"
    >
      <ul className="mx-auto flex h-[var(--nav-height)] max-w-xl">
        {ITEMS.map(({ to, label, Icon, end }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex h-full flex-col items-center justify-center gap-0.5 text-[10px] ${isActive ? "text-fg" : "text-hint"}`
              }
            >
              <span className="relative">
                <Icon size={22} />
                {to === "/cart" && <CartCounter count={count} />}
              </span>
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
