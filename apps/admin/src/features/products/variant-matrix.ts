import type { AdminVariant, AdminVariantInput } from "@ss13/shared";
import { ADMIN_PRODUCT_LIMITS as LIMITS, kopecksToUahInput, parseUahToKopecks } from "@ss13/shared";

/**
 * Клітинка матриці колір × розмір:
 * active — варіант продається; inactive — є, але вимкнений; absent — такого варіанту немає.
 */
export interface MatrixCell {
  mode: "active" | "inactive" | "absent";
  /** id наявного варіанту (для швидкої зміни залишку); null — новий. */
  variantId: string | null;
  stock: string;
  sku: string;
  priceOverride: string;
  /** Залишок із сервера на момент завантаження (для наявних варіантів). */
  originalStock: number | null;
  hasHistory: boolean;
}

export interface MatrixState {
  colorIds: string[];
  sizeIds: string[];
  cells: Record<string, MatrixCell>;
}

export const cellKey = (colorId: string, sizeId: string) => `${colorId}/${sizeId}`;

const newCell = (): MatrixCell => ({
  mode: "active",
  variantId: null,
  stock: "0",
  sku: "",
  priceOverride: "",
  originalStock: null,
  hasHistory: false,
});

export const emptyMatrix = (): MatrixState => ({ colorIds: [], sizeIds: [], cells: {} });

/** Порядок осей — як у довідниках (sortOrder), а не як прийшли варіанти. */
export function matrixFromVariants(
  variants: AdminVariant[],
  order: { colorIds: string[]; sizeIds: string[] },
): MatrixState {
  const colors = new Set(variants.map((v) => v.colorId));
  const sizes = new Set(variants.map((v) => v.sizeId));
  const cells: Record<string, MatrixCell> = {};
  for (const variant of variants) {
    cells[cellKey(variant.colorId, variant.sizeId)] = {
      mode: variant.isActive ? "active" : "inactive",
      variantId: variant.id,
      stock: String(variant.stock),
      sku: variant.sku ?? "",
      priceOverride: variant.priceOverride === null ? "" : kopecksToUahInput(variant.priceOverride),
      originalStock: variant.stock,
      hasHistory: variant.hasHistory,
    };
  }
  return {
    colorIds: order.colorIds.filter((id) => colors.has(id)),
    sizeIds: order.sizeIds.filter((id) => sizes.has(id)),
    cells,
  };
}

/** Копія матриці для дублювання: ті самі пари, але залишки 0 і без історії. */
export function matrixForDuplicate(state: MatrixState): MatrixState {
  const cells: Record<string, MatrixCell> = {};
  for (const [key, cell] of Object.entries(state.cells)) {
    cells[key] = {
      ...cell,
      variantId: null,
      stock: "0",
      sku: "",
      originalStock: null,
      hasHistory: false,
    };
  }
  return { ...state, cells };
}

export function getCell(state: MatrixState, colorId: string, sizeId: string): MatrixCell {
  return state.cells[cellKey(colorId, sizeId)] ?? { ...newCell(), mode: "absent" };
}

/**
 * Новий рядок/стовпець: усі його перетини одразу стають варіантами із залишком 0.
 * Якщо колір/розмір прибрали й повернули — наявні варіанти знову активні.
 */
function fillAxis(
  state: MatrixState,
  colorIds: string[],
  sizeIds: string[],
  isNew: (colorId: string, sizeId: string) => boolean,
): MatrixState {
  const cells = { ...state.cells };
  for (const colorId of colorIds) {
    for (const sizeId of sizeIds) {
      if (!isNew(colorId, sizeId)) continue;
      const key = cellKey(colorId, sizeId);
      const cell = cells[key];
      if (!cell) cells[key] = newCell();
      else if (cell.mode === "absent") cells[key] = { ...cell, mode: "active" };
    }
  }
  return { colorIds, sizeIds, cells };
}

export function addColor(state: MatrixState, colorId: string, order: string[]): MatrixState {
  if (state.colorIds.includes(colorId)) return state;
  const colorIds = order.filter((id) => id === colorId || state.colorIds.includes(id));
  return fillAxis(state, colorIds, state.sizeIds, (c) => c === colorId);
}

export function addSize(state: MatrixState, sizeId: string, order: string[]): MatrixState {
  if (state.sizeIds.includes(sizeId)) return state;
  const sizeIds = order.filter((id) => id === sizeId || state.sizeIds.includes(id));
  return fillAxis(state, state.colorIds, sizeIds, (_, s) => s === sizeId);
}

/** Прибрати колір/розмір: його клітинки стають «немає» (на сервері — видалення або вимкнення). */
export function removeColor(state: MatrixState, colorId: string): MatrixState {
  const cells = { ...state.cells };
  for (const sizeId of state.sizeIds) {
    const key = cellKey(colorId, sizeId);
    if (cells[key]?.originalStock === null) delete cells[key];
    else if (cells[key]) cells[key] = { ...cells[key], mode: "absent" };
  }
  return { ...state, colorIds: state.colorIds.filter((id) => id !== colorId), cells };
}

export function removeSize(state: MatrixState, sizeId: string): MatrixState {
  const cells = { ...state.cells };
  for (const colorId of state.colorIds) {
    const key = cellKey(colorId, sizeId);
    if (cells[key]?.originalStock === null) delete cells[key];
    else if (cells[key]) cells[key] = { ...cells[key], mode: "absent" };
  }
  return { ...state, sizeIds: state.sizeIds.filter((id) => id !== sizeId), cells };
}

export function updateCell(
  state: MatrixState,
  colorId: string,
  sizeId: string,
  patch: Partial<MatrixCell>,
): MatrixState {
  const key = cellKey(colorId, sizeId);
  const current = state.cells[key] ?? { ...newCell(), mode: "absent" as const };
  return { ...state, cells: { ...state.cells, [key]: { ...current, ...patch } } };
}

/** Чи змінився хоч один залишок (тоді потрібна причина). */
export function stockChanged(state: MatrixState): boolean {
  return payloadCells(state).some(({ cell }) => {
    const stock = Number(cell.stock);
    return cell.originalStock === null ? stock > 0 : stock !== cell.originalStock;
  });
}

function payloadCells(state: MatrixState) {
  const result: Array<{ colorId: string; sizeId: string; cell: MatrixCell }> = [];
  for (const colorId of state.colorIds) {
    for (const sizeId of state.sizeIds) {
      const cell = state.cells[cellKey(colorId, sizeId)];
      if (cell && cell.mode !== "absent") result.push({ colorId, sizeId, cell });
    }
  }
  return result;
}

export function matrixIsDirty(state: MatrixState, initial: MatrixState): boolean {
  return (
    JSON.stringify(toVariantPayload(state).variants) !==
    JSON.stringify(toVariantPayload(initial).variants)
  );
}

/** Матриця → тіло PUT /variants; помилки — за ключем клітинки. */
export function toVariantPayload(state: MatrixState): {
  variants: AdminVariantInput[];
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};
  const variants: AdminVariantInput[] = [];
  for (const { colorId, sizeId, cell } of payloadCells(state)) {
    const key = cellKey(colorId, sizeId);
    const stock = Number(cell.stock.trim());
    if (
      cell.stock.trim() === "" ||
      !Number.isInteger(stock) ||
      stock < 0 ||
      stock > LIMITS.maxStock
    ) {
      errors[key] = "Залишок — ціле число ≥ 0";
      continue;
    }
    let priceOverride: number | null = null;
    if (cell.priceOverride.trim()) {
      priceOverride = parseUahToKopecks(cell.priceOverride);
      if (priceOverride === null) {
        errors[key] = "Ціна варіанту в гривнях або порожньо";
        continue;
      }
    }
    variants.push({
      colorId,
      sizeId,
      sku: cell.sku.trim() || null,
      priceOverride,
      isActive: cell.mode === "active",
      stock,
      ...(cell.originalStock !== null ? { expectedStock: cell.originalStock } : {}),
    });
  }
  return { variants, errors };
}
