import { formatUah } from "@ss13/shared";
import { Link, useParams } from "react-router";

import { PageHeader } from "../app/PageHeader";
import { useOrder } from "../entities/order/api";
import { t } from "../shared/strings";
import { CheckIcon } from "../shared/ui/icons";

/** Екран після оформлення. Номер — з адреси, сума — з уже завантаженого замовлення. */
export default function OrderSuccessPage() {
  const { number = "" } = useParams();
  const order = useOrder(number);

  return (
    <>
      <PageHeader back={false} />
      <div className="flex flex-col items-center px-6 pt-10 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-fg text-bg">
          <CheckIcon />
        </div>
        <h1 className="mt-6 text-xl font-medium tracking-tight">{t.success.title(number)}</h1>
        {order.data && (
          <p className="mt-2 text-sm tabular-nums">
            {t.success.total(formatUah(order.data.total))}
          </p>
        )}
        <p className="mt-4 max-w-xs text-sm text-hint">{t.success.next}</p>
        <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
          <Link
            to={`/orders/${encodeURIComponent(number)}`}
            replace
            className="inline-flex min-h-11 items-center justify-center bg-fg px-5 text-sm font-medium text-bg"
          >
            {t.success.myOrders}
          </Link>
          <Link
            to="/"
            replace
            className="inline-flex min-h-11 items-center justify-center border border-fg px-5 text-sm font-medium"
          >
            {t.success.home}
          </Link>
        </div>
      </div>
    </>
  );
}
