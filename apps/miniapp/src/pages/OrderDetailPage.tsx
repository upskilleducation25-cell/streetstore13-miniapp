import type { OrderDetail } from "@ss13/shared";
import { formatUah, formatUaPhone } from "@ss13/shared";
import type { ReactNode } from "react";
import { useParams } from "react-router";

import { PageHeader } from "../app/PageHeader";
import { useCancelOrder, useOrder } from "../entities/order/api";
import { formatOrderDate, orderStatusLabel } from "../entities/order/format";
import { OrderStatusBadge } from "../entities/order/ui/OrderStatusBadge";
import { useCartAvailable } from "../features/cart/cart";
import { errorKind } from "../shared/api";
import { t } from "../shared/strings";
import { confirmAction, haptic } from "../shared/telegram/telegram";
import { Image } from "../shared/ui/Image";
import { Skeleton } from "../shared/ui/Skeleton";
import { Button, EmptyState, ErrorState, errorMessage } from "../shared/ui/States";
import { showToast } from "../shared/ui/Toast";

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-line pt-5">
      <h2 className="mb-3 text-xs uppercase tracking-[0.12em] text-hint">{title}</h2>
      {children}
    </section>
  );
}

function OrderView({ order }: { order: OrderDetail }) {
  const cancel = useCancelOrder(order.number);

  const onCancel = async () => {
    if (!(await confirmAction(t.orders.cancelConfirm))) return;
    cancel.mutate(undefined, {
      onSuccess: () => showToast(t.orders.cancelled),
      onError: (error) => {
        haptic.error();
        showToast(errorMessage(error));
      },
    });
  };

  return (
    <div className="space-y-6 px-4 pb-10 pt-2">
      <div>
        <OrderStatusBadge status={order.status} />
        <p className="mt-2 text-xs text-hint">{formatOrderDate(order.createdAt)}</p>
      </div>

      <Block title={t.orders.composition}>
        <ul className="space-y-4">
          {order.items.map((item) => (
            <li key={item.id} className="flex gap-3">
              <div className="w-16 shrink-0">
                <Image
                  urls={item.image ? { thumb: item.image } : null}
                  alt={`${item.brand} ${item.name}`}
                  sizes="64px"
                />
              </div>
              <div className="min-w-0 flex-1 text-sm">
                <p className="text-[11px] uppercase tracking-[0.12em] text-hint">{item.brand}</p>
                <p className="leading-snug">{item.name}</p>
                <p className="mt-1 text-xs text-hint">
                  {item.colorName} · {item.sizeLabel} · {item.quantity} ×{" "}
                  {formatUah(item.unitPrice)}
                </p>
              </div>
              <p className="shrink-0 text-sm tabular-nums">{formatUah(item.lineTotal)}</p>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-hint">{t.orders.subtotal}</dt>
            <dd className="tabular-nums">{formatUah(order.subtotal)}</dd>
          </div>
          {order.discountTotal > 0 && (
            <div className="flex justify-between">
              <dt className="text-hint">{t.orders.discount}</dt>
              <dd className="tabular-nums">−{formatUah(order.discountTotal)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-hint">{t.orders.deliveryCost}</dt>
            <dd className="text-hint">
              {order.deliveryCost > 0 ? formatUah(order.deliveryCost) : t.cart.deliveryByCarrier}
            </dd>
          </div>
          <div className="flex justify-between text-base font-medium">
            <dt>{t.orders.total}</dt>
            <dd className="tabular-nums">{formatUah(order.total)}</dd>
          </div>
        </dl>
      </Block>

      <Block title={t.orders.delivery}>
        <p className="text-sm">{order.deliveryService.name}</p>
        <p className="text-sm">
          {order.city}, {order.deliveryPoint}
        </p>
        {order.trackingNumber && (
          <p className="mt-2 text-sm">
            {t.orders.tracking}: <span className="tabular-nums">{order.trackingNumber}</span>
          </p>
        )}
      </Block>

      <Block title={t.orders.recipient}>
        <p className="text-sm">{order.customerName}</p>
        <p className="text-sm tabular-nums">{formatUaPhone(order.customerPhone)}</p>
        {order.comment && (
          <p className="mt-2 whitespace-pre-line text-sm text-hint">
            {t.orders.comment}: {order.comment}
          </p>
        )}
      </Block>

      {order.paymentMethod && (
        <Block title={t.orders.payment}>
          <p className="text-sm">{order.paymentMethod.name}</p>
        </Block>
      )}

      <Block title={t.orders.history}>
        <ol className="space-y-2 text-sm">
          {order.history.map((entry, index) => (
            <li key={`${entry.status}-${index}`} className="flex justify-between gap-3">
              <span>{orderStatusLabel(entry.status)}</span>
              <span className="text-xs text-hint">{formatOrderDate(entry.createdAt)}</span>
            </li>
          ))}
        </ol>
      </Block>

      {order.canCancel && (
        <div className="border-t border-line pt-5">
          <Button
            variant="outline"
            className="w-full"
            disabled={cancel.isPending}
            onClick={() => void onCancel()}
          >
            {cancel.isPending ? t.common.loading : t.orders.cancel}
          </Button>
          <p className="mt-2 text-center text-xs text-hint">{t.orders.cancelHint}</p>
        </div>
      )}
    </div>
  );
}

export default function OrderDetailPage() {
  const { number = "" } = useParams();
  const available = useCartAvailable();
  const order = useOrder(number);

  return (
    <>
      <PageHeader title={t.orders.number(number)} />
      {!available ? (
        <EmptyState title={t.orders.notFound} hint={t.cart.notInTelegram} />
      ) : order.isPending ? (
        <div className="space-y-4 px-4 pt-4" aria-hidden="true">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : order.isError ? (
        errorKind(order.error) === "notFound" ? (
          <EmptyState title={t.orders.notFound} />
        ) : (
          <ErrorState error={order.error} onRetry={() => void order.refetch()} />
        )
      ) : (
        <OrderView order={order.data} />
      )}
    </>
  );
}
