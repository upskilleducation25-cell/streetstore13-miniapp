import { Link } from "react-router";

import { t } from "../../shared/strings";
import { BagIcon } from "../../shared/ui/icons";
import { useCartCount } from "./cart";

export function CartCounter({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -right-1.5 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-fg px-1 text-[10px] font-medium text-bg">
      {count > 99 ? "99+" : count}
    </span>
  );
}

/** Кнопка кошика в шапці з лічильником. */
export function CartButton() {
  const count = useCartCount();
  return (
    <Link
      to="/cart"
      aria-label={`${t.cart.open}. ${t.cart.count(count)}`}
      className="relative -mr-2 flex h-11 w-11 items-center justify-center"
    >
      <span className="relative">
        <BagIcon />
        <CartCounter count={count} />
      </span>
    </Link>
  );
}
