import { Link } from "react-router";

import { PageHeader } from "../app/PageHeader";
import { useCartCount } from "../features/cart/cart";
import { t } from "../shared/strings";
import { EmptyState } from "../shared/ui/States";

/** Заглушка Етапу 2: лише лічильник. Повний кошик і оформлення — Етап 3. */
export default function CartPage() {
  const count = useCartCount();
  return (
    <>
      <PageHeader title={t.cart.title} />
      <EmptyState
        title={count > 0 ? t.cart.count(count) : t.cart.empty}
        hint={t.cart.stage3}
        action={
          <Link
            to="/catalog"
            className="inline-flex min-h-11 items-center border border-fg px-5 text-sm font-medium"
          >
            {t.search.toCatalog}
          </Link>
        }
      />
    </>
  );
}
