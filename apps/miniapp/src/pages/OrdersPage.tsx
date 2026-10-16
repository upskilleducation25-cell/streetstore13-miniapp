import { formatUah } from "@ss13/shared";
import { Link } from "react-router";

import { PageHeader } from "../app/PageHeader";
import { useOrders } from "../entities/order/api";
import { formatOrderDate } from "../entities/order/format";
import { OrderStatusBadge } from "../entities/order/ui/OrderStatusBadge";
import { useCartAvailable } from "../features/cart/cart";
import { t } from "../shared/strings";
import { ChevronRightIcon } from "../shared/ui/icons";
import { Image } from "../shared/ui/Image";
import { Skeleton } from "../shared/ui/Skeleton";
import { Button, EmptyState, ErrorState } from "../shared/ui/States";

export default function OrdersPage() {
  const available = useCartAvailable();
  const orders = useOrders();
  const items = orders.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <>
      <PageHeader title={t.orders.title} />
      {!available ? (
        <EmptyState title={t.orders.empty} hint={t.cart.notInTelegram} />
      ) : orders.isPending ? (
        <div className="space-y-4 px-4 pt-4" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : orders.isError ? (
        <ErrorState error={orders.error} onRetry={() => void orders.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          title={t.orders.empty}
          hint={t.orders.emptyHint}
          action={
            <Link
              to="/catalog"
              className="inline-flex min-h-11 items-center border border-fg px-5 text-sm font-medium"
            >
              {t.search.toCatalog}
            </Link>
          }
        />
      ) : (
        <div className="px-4">
          <ul className="divide-y divide-line">
            {items.map((order) => (
              <li key={order.number}>
                <Link
                  to={`/orders/${encodeURIComponent(order.number)}`}
                  className="flex items-center gap-3 py-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{t.orders.number(order.number)}</span>
                      <OrderStatusBadge status={order.status} />
                    </div>
                    <p className="mt-1 text-xs text-hint">{formatOrderDate(order.createdAt)}</p>
                    <p className="mt-1 text-sm tabular-nums">
                      {formatUah(order.total)}
                      <span className="text-hint"> · {t.orders.items(order.itemsCount)}</span>
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {order.images.map((url, index) => (
                      <div key={`${url}-${index}`} className="w-10">
                        <Image urls={{ thumb: url }} alt="" sizes="40px" />
                      </div>
                    ))}
                  </div>
                  <ChevronRightIcon size={18} className="shrink-0 text-hint" />
                </Link>
              </li>
            ))}
          </ul>
          {orders.hasNextPage && (
            <Button
              variant="outline"
              className="mt-4 w-full"
              disabled={orders.isFetchingNextPage}
              onClick={() => void orders.fetchNextPage()}
            >
              {orders.isFetchingNextPage ? t.common.loading : t.orders.more}
            </Button>
          )}
        </div>
      )}
    </>
  );
}
