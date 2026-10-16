import { INVENTORY_REASON_LABELS } from "@ss13/shared";

import { formatDateTime } from "../../shared/lib/format";
import { Spinner } from "../../shared/ui/Spinner";
import { ErrorState } from "../../shared/ui/States";
import { useMovements } from "./api";

/** Журнал руху складу товару: хто, коли, на скільки і чому змінив залишок. */
export function MovementsLog({ productId }: { productId: string }) {
  const movements = useMovements(productId);
  if (movements.isPending) return <Spinner label="Завантаження журналу…" />;
  if (movements.isError)
    return <ErrorState error={movements.error} onRetry={() => void movements.refetch()} />;
  if (movements.data.length === 0)
    return <p className="text-sm text-muted">Змін залишків ще не було.</p>;
  return (
    <div className="max-h-96 overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-panel">
          <tr className="text-left">
            {["Коли", "Варіант", "Зміна", "Причина", "Хто"].map((title) => (
              <th key={title} scope="col" className="ss-label py-2 pr-3 font-normal">
                {title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {movements.data.map((movement) => (
            <tr key={movement.id} className="border-t border-line align-top">
              <td className="py-2 pr-3 whitespace-nowrap text-muted tabular-nums">
                {formatDateTime(movement.createdAt)}
              </td>
              <td className="py-2 pr-3 whitespace-nowrap">
                {movement.colorName} / {movement.sizeLabel}
              </td>
              <td
                className={`py-2 pr-3 font-medium tabular-nums ${movement.delta > 0 ? "text-ok" : "text-danger"}`}
              >
                {movement.delta > 0 ? `+${movement.delta}` : movement.delta}
              </td>
              <td className="py-2 pr-3">
                {INVENTORY_REASON_LABELS[movement.reason]}
                {movement.orderNumber && (
                  <span className="text-muted"> · {movement.orderNumber}</span>
                )}
                {movement.note && <span className="block text-xs text-muted">{movement.note}</span>}
              </td>
              <td className="py-2 text-muted">
                {movement.adminName ?? (movement.orderNumber ? "Покупець" : "—")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
