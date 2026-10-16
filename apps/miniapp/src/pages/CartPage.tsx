import type { CartItemView } from "@ss13/shared";
import { formatUah, MAX_CART_LINE_QUANTITY } from "@ss13/shared";
import { Link, useNavigate } from "react-router";

import { PageHeader } from "../app/PageHeader";
import { useCart, useCartAvailable, useCartMutations } from "../features/cart/cart";
import { blockingItems, maxQuantityFor } from "../features/cart/cart-utils";
import { t } from "../shared/strings";
import { MainButton } from "../shared/telegram/MainButton";
import { haptic } from "../shared/telegram/telegram";
import { CloseIcon, MinusIcon, PlusIcon } from "../shared/ui/icons";
import { Image } from "../shared/ui/Image";
import { Skeleton } from "../shared/ui/Skeleton";
import { EmptyState, ErrorState, errorMessage } from "../shared/ui/States";
import { showToast } from "../shared/ui/Toast";

const toCatalog = (
  <Link
    to="/catalog"
    className="inline-flex min-h-11 items-center border border-fg px-5 text-sm font-medium"
  >
    {t.search.toCatalog}
  </Link>
);

function CartItemRow({ item }: { item: CartItemView }) {
  const { update, remove } = useCartMutations();
  const busy = update.isPending || remove.isPending;
  const max = maxQuantityFor(item, MAX_CART_LINE_QUANTITY);

  const setQuantity = (quantity: number) =>
    update.mutate(
      { id: item.id, quantity },
      {
        onError: (error) => {
          haptic.error();
          showToast(errorMessage(error));
        },
      },
    );
  const removeItem = () =>
    remove.mutate(item.id, {
      onSuccess: () => showToast(t.cart.removed),
      onError: (error) => showToast(errorMessage(error)),
    });

  return (
    <li className={`flex gap-3 py-4 ${busy ? "opacity-60" : ""}`}>
      <Link to={`/p/${item.productId}`} className="w-20 shrink-0">
        <Image
          urls={item.image ? { thumb: item.image } : null}
          alt={`${item.brand} ${item.name}`}
          sizes="80px"
        />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-[0.12em] text-hint">{item.brand}</p>
            <Link to={`/p/${item.productId}`} className="mt-0.5 line-clamp-2 text-sm leading-snug">
              {item.name}
            </Link>
            <p className="mt-1 text-xs text-hint">
              {item.colorName} · {item.sizeLabel}
            </p>
          </div>
          <button
            type="button"
            aria-label={`${t.cart.remove}: ${item.name}`}
            disabled={busy}
            onClick={removeItem}
            className="-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center text-hint"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        {item.status === "UNAVAILABLE" && (
          <p className="mt-2 text-xs text-sale">{t.cart.unavailable}</p>
        )}
        {item.status === "INSUFFICIENT_STOCK" && (
          <p className="mt-2 text-xs text-sale">
            {t.cart.insufficient(item.stock)}{" "}
            <button
              type="button"
              className="underline"
              disabled={busy}
              onClick={() => setQuantity(item.stock)}
            >
              {t.cart.setAvailable(item.stock)}
            </button>
          </p>
        )}

        <div className="mt-3 flex items-center justify-between gap-2">
          {item.status === "UNAVAILABLE" ? (
            <span />
          ) : (
            <div className="flex items-center border border-line">
              <button
                type="button"
                aria-label="Менше"
                disabled={busy || item.quantity <= 1}
                onClick={() => setQuantity(Math.min(item.quantity - 1, max))}
                className="flex h-11 w-11 items-center justify-center disabled:opacity-30"
              >
                <MinusIcon size={16} />
              </button>
              <output aria-live="polite" className="w-7 text-center text-sm tabular-nums">
                {item.quantity}
              </output>
              <button
                type="button"
                aria-label="Більше"
                disabled={busy || item.quantity >= max}
                onClick={() => setQuantity(item.quantity + 1)}
                className="flex h-11 w-11 items-center justify-center disabled:opacity-30"
              >
                <PlusIcon size={16} />
              </button>
            </div>
          )}
          <div className="text-right">
            <p className="text-sm font-medium tabular-nums">{formatUah(item.lineTotal)}</p>
            {item.quantity > 1 && (
              <p className="text-xs text-hint tabular-nums">
                {t.cart.each(formatUah(item.unitPrice))}
              </p>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

function CartSkeleton() {
  return (
    <div className="space-y-6 px-4 pt-4" aria-hidden="true">
      {[0, 1].map((i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="aspect-[3/4] w-20" />
          <div className="flex-1">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-2 h-4 w-3/4" />
            <Skeleton className="mt-6 h-11 w-32" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function CartPage() {
  const available = useCartAvailable();
  const cart = useCart({ fresh: true });
  const navigate = useNavigate();

  if (!available) {
    return (
      <>
        <PageHeader title={t.cart.title} />
        <EmptyState title={t.cart.empty} hint={t.cart.notInTelegram} action={toCatalog} />
      </>
    );
  }

  return (
    <>
      <PageHeader title={t.cart.title} />
      {cart.isPending ? (
        <CartSkeleton />
      ) : cart.isError ? (
        <ErrorState error={cart.error} onRetry={() => void cart.refetch()} />
      ) : cart.data.items.length === 0 ? (
        <EmptyState title={t.cart.empty} hint={t.cart.emptyHint} action={toCatalog} />
      ) : (
        <div className="px-4 pb-24">
          {blockingItems(cart.data).length > 0 && (
            <p role="alert" className="mt-2 bg-surface px-3 py-2.5 text-sm">
              {t.cart.blocked}
            </p>
          )}
          <ul className="divide-y divide-line">
            {cart.data.items.map((item) => (
              <CartItemRow key={item.id} item={item} />
            ))}
          </ul>
          <dl className="mt-2 space-y-2 border-t border-line pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-hint">{t.cart.subtotal}</dt>
              <dd className="tabular-nums">{formatUah(cart.data.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-hint">{t.cart.delivery}</dt>
              <dd className="text-hint">{t.cart.deliveryByCarrier}</dd>
            </div>
            <div className="flex justify-between pt-2 text-base font-medium">
              <dt>{t.cart.total}</dt>
              <dd className="tabular-nums">{formatUah(cart.data.total)}</dd>
            </div>
          </dl>
          <MainButton
            aboveNav
            text={
              cart.data.canCheckout
                ? t.cart.checkout(formatUah(cart.data.total))
                : t.cart.checkoutDisabled
            }
            disabled={!cart.data.canCheckout}
            onClick={() => navigate("/checkout")}
          />
        </div>
      )}
    </>
  );
}
