import type { ProductStatus } from "@ss13/shared";
import { PRODUCT_STATUS_LABELS } from "@ss13/shared";

import { Badge } from "../../shared/ui/States";

const TONES = { ACTIVE: "ok", DRAFT: "neutral", HIDDEN: "warn", ARCHIVED: "danger" } as const;

export function StatusBadge({ status }: { status: ProductStatus }) {
  return <Badge tone={TONES[status]}>{PRODUCT_STATUS_LABELS[status]}</Badge>;
}
