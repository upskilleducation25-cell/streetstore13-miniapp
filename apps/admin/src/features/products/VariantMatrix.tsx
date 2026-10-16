import type { AdminColor, AdminSize, SizeSystem } from "@ss13/shared";
import { SIZE_SYSTEM_LABELS, STOCK_NOTE_PRESETS } from "@ss13/shared";
import { useState } from "react";

import { Button } from "../../shared/ui/Button";
import { Field, Select, TextInput } from "../../shared/ui/Field";
import type { MatrixCell, MatrixState } from "./variant-matrix";
import {
  addColor,
  addSize,
  cellKey,
  getCell,
  removeColor,
  removeSize,
  stockChanged,
  updateCell,
} from "./variant-matrix";

export interface StockNoteState {
  preset: string;
  text: string;
}

/** Причина для журналу: обраний варіант + уточнення. */
export function stockNoteValue(note: StockNoteState): string {
  return [note.preset, note.text.trim()].filter(Boolean).join(": ").slice(0, 200);
}

function Swatch({ hex }: { hex: string }) {
  return (
    <span
      className="inline-block h-3.5 w-3.5 shrink-0 border border-line"
      style={{ background: hex }}
    />
  );
}

function CellView({
  cell,
  label,
  error,
  onChange,
  onAdjust,
}: {
  cell: MatrixCell;
  label: string;
  error?: string;
  onChange: (patch: Partial<MatrixCell>) => void;
  onAdjust?: () => void;
}) {
  if (cell.mode === "absent") {
    return (
      <button
        type="button"
        onClick={() => onChange({ mode: "active" })}
        aria-label={`Додати варіант ${label}`}
        className="flex h-10 w-full min-w-16 items-center justify-center border border-dashed border-line text-muted hover:border-fg hover:text-fg"
      >
        +
      </button>
    );
  }
  const changed = cell.originalStock !== null && cell.stock !== String(cell.originalStock);
  // Варіант з історією не видаляється — тільки вимикається.
  const canRemove = !cell.hasHistory;
  return (
    <div className={`flex flex-col gap-1 ${cell.mode === "inactive" ? "opacity-60" : ""}`}>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        aria-label={`Залишок ${label}`}
        aria-invalid={error ? true : undefined}
        title={error}
        value={cell.stock}
        onChange={(event) => onChange({ stock: event.target.value })}
        className={`ss-input h-10 min-w-16 text-center tabular-nums ${changed ? "font-semibold" : ""}`}
      />
      <div className="flex items-center justify-between gap-1 text-[10px] tracking-wide uppercase">
        <button
          type="button"
          onClick={() =>
            onChange({
              mode:
                cell.mode === "active"
                  ? canRemove && cell.originalStock === null
                    ? "absent"
                    : "inactive"
                  : "active",
            })
          }
          className="text-muted hover:text-fg"
          title={
            cell.mode === "active"
              ? "Вимкнути варіант (покупець його не побачить)"
              : "Увімкнути варіант"
          }
        >
          {cell.mode === "active" ? "вимк." : "увімк."}
        </button>
        {onAdjust && cell.variantId && !changed && (
          <button
            type="button"
            onClick={onAdjust}
            className="text-muted hover:text-fg"
            title="Швидко змінити залишок"
          >
            ±
          </button>
        )}
        {cell.mode === "inactive" && canRemove && (
          <button
            type="button"
            onClick={() => onChange({ mode: "absent" })}
            className="text-muted hover:text-danger"
            title="Прибрати варіант"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Матриця залишків: рядки — кольори, стовпці — розміри, клітинка — залишок варіанту.
 * Порожня клітинка (+) — такого варіанту немає; «вимк.» — є, але покупцю не пропонується.
 */
export function VariantMatrix({
  state,
  onChange,
  colors,
  sizes,
  errors,
  note,
  onNoteChange,
  noteError,
  onAdjust,
}: {
  state: MatrixState;
  onChange: (state: MatrixState) => void;
  colors: AdminColor[];
  sizes: AdminSize[];
  errors: Record<string, string>;
  note: StockNoteState;
  onNoteChange: (note: StockNoteState) => void;
  noteError?: string;
  onAdjust?: (variantId: string, label: string, stock: number) => void;
}) {
  const [system, setSystem] = useState<SizeSystem | "">("");
  const colorById = new Map(colors.map((c) => [c.id, c]));
  const sizeById = new Map(sizes.map((s) => [s.id, s]));
  const colorOrder = colors.map((c) => c.id);
  const sizeOrder = sizes.map((s) => s.id);
  const freeColors = colors.filter((c) => !state.colorIds.includes(c.id));
  const systems = [...new Set(sizes.map((s) => s.sizeSystem))];
  const freeSizes = sizes.filter(
    (s) => !state.sizeIds.includes(s.id) && (!system || s.sizeSystem === system),
  );
  const changed = stockChanged(state);
  const errorList = Object.entries(errors);

  const addAllSizes = () => {
    let next = state;
    for (const size of freeSizes) next = addSize(next, size.id, sizeOrder);
    onChange(next);
  };

  const included: Array<{ colorId: string; sizeId: string; cell: MatrixCell }> = [];
  for (const colorId of state.colorIds) {
    for (const sizeId of state.sizeIds) {
      const cell = getCell(state, colorId, sizeId);
      if (cell.mode !== "absent") included.push({ colorId, sizeId, cell });
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr_auto] sm:items-end">
        <Field label="Додати колір">
          {(props) => (
            <Select
              {...props}
              value=""
              onChange={(event) =>
                event.target.value && onChange(addColor(state, event.target.value, colorOrder))
              }
            >
              <option value="">
                {freeColors.length ? "Оберіть колір…" : "Усі кольори додано"}
              </option>
              {freeColors.map((color) => (
                <option key={color.id} value={color.id}>
                  {color.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <span className="hidden sm:block" />
        <Field label="Додати розмір">
          {(props) => (
            <div className="flex gap-2">
              <Select
                {...props}
                value={system}
                onChange={(event) => setSystem(event.target.value as SizeSystem | "")}
                className="max-w-36"
              >
                <option value="">Усі сітки</option>
                {systems.map((value) => (
                  <option key={value} value={value}>
                    {SIZE_SYSTEM_LABELS[value]}
                  </option>
                ))}
              </Select>
              <Select
                aria-label="Розмір"
                value=""
                onChange={(event) =>
                  event.target.value && onChange(addSize(state, event.target.value, sizeOrder))
                }
              >
                <option value="">{freeSizes.length ? "Розмір…" : "—"}</option>
                {freeSizes.map((size) => (
                  <option key={size.id} value={size.id}>
                    {size.label} · {SIZE_SYSTEM_LABELS[size.sizeSystem]}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </Field>
        <Button
          size="sm"
          onClick={addAllSizes}
          disabled={!system || freeSizes.length === 0}
          className="min-h-10"
        >
          Усі розміри сітки
        </Button>
      </div>

      {state.colorIds.length === 0 || state.sizeIds.length === 0 ? (
        <p className="border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
          Додайте хоча б один колір і один розмір — з'явиться таблиця залишків.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="border-separate border-spacing-1.5 text-sm">
            <thead>
              <tr>
                <th scope="col" className="ss-label min-w-32 text-left font-normal">
                  Колір \ розмір
                </th>
                {state.sizeIds.map((sizeId) => (
                  <th key={sizeId} scope="col" className="min-w-16 font-medium">
                    <span className="flex items-center justify-center gap-1">
                      {sizeById.get(sizeId)?.label ?? "?"}
                      <button
                        type="button"
                        onClick={() => onChange(removeSize(state, sizeId))}
                        aria-label={`Прибрати розмір ${sizeById.get(sizeId)?.label}`}
                        className="text-xs text-muted hover:text-danger"
                      >
                        ×
                      </button>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {state.colorIds.map((colorId) => {
                const color = colorById.get(colorId);
                return (
                  <tr key={colorId}>
                    <th scope="row" className="text-left font-normal">
                      <span className="flex items-center gap-2">
                        <Swatch hex={color?.hex ?? "#999"} />
                        <span className="truncate">{color?.name ?? "?"}</span>
                        <button
                          type="button"
                          onClick={() => onChange(removeColor(state, colorId))}
                          aria-label={`Прибрати колір ${color?.name}`}
                          className="text-xs text-muted hover:text-danger"
                        >
                          ×
                        </button>
                      </span>
                    </th>
                    {state.sizeIds.map((sizeId) => {
                      const cell = getCell(state, colorId, sizeId);
                      const label = `${color?.name ?? ""} / ${sizeById.get(sizeId)?.label ?? ""}`;
                      return (
                        <td key={sizeId} className="align-top">
                          <CellView
                            cell={cell}
                            label={label}
                            error={errors[cellKey(colorId, sizeId)]}
                            onChange={(patch) =>
                              onChange(updateCell(state, colorId, sizeId, patch))
                            }
                            onAdjust={
                              onAdjust && cell.variantId
                                ? () => onAdjust(cell.variantId!, label, cell.originalStock ?? 0)
                                : undefined
                            }
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {errorList.length > 0 && (
        <p role="alert" className="text-xs text-danger">
          Перевірте клітинки з помилками: {errorList[0]![1]}
        </p>
      )}

      {changed && (
        <div className="grid gap-3 border border-fg/30 bg-soft p-3 sm:grid-cols-2">
          <Field
            label="Причина зміни залишків"
            error={noteError}
            required
            hint="Потрапить у журнал руху складу"
          >
            {(props) => (
              <Select
                {...props}
                value={note.preset}
                onChange={(event) => onNoteChange({ ...note, preset: event.target.value })}
              >
                <option value="">Оберіть…</option>
                {STOCK_NOTE_PRESETS.map((preset) => (
                  <option key={preset} value={preset}>
                    {preset}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Уточнення (необов'язково)">
            {(props) => (
              <TextInput
                {...props}
                maxLength={150}
                placeholder="Напр. накладна № 12"
                value={note.text}
                onChange={(event) => onNoteChange({ ...note, text: event.target.value })}
              />
            )}
          </Field>
        </div>
      )}

      {included.length > 0 && (
        <details className="border border-line">
          <summary className="cursor-pointer px-3 py-2.5 text-sm">
            Артикули та окремі ціни варіантів ({included.length})
          </summary>
          <div className="overflow-x-auto px-3 pb-3">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th scope="col" className="ss-label py-2 font-normal">
                    Варіант
                  </th>
                  <th scope="col" className="ss-label py-2 font-normal">
                    Артикул варіанту
                  </th>
                  <th scope="col" className="ss-label py-2 font-normal">
                    Своя ціна, ₴
                  </th>
                </tr>
              </thead>
              <tbody>
                {included.map(({ colorId, sizeId, cell }) => (
                  <tr key={cellKey(colorId, sizeId)}>
                    <td className="py-1 pr-3 whitespace-nowrap">
                      {colorById.get(colorId)?.name} / {sizeById.get(sizeId)?.label}
                    </td>
                    <td className="py-1 pr-3">
                      <TextInput
                        aria-label="Артикул варіанту"
                        maxLength={64}
                        value={cell.sku}
                        onChange={(event) =>
                          onChange(updateCell(state, colorId, sizeId, { sku: event.target.value }))
                        }
                      />
                    </td>
                    <td className="py-1">
                      <TextInput
                        aria-label="Своя ціна варіанту"
                        inputMode="decimal"
                        placeholder="як у товару"
                        value={cell.priceOverride}
                        onChange={(event) =>
                          onChange(
                            updateCell(state, colorId, sizeId, {
                              priceOverride: event.target.value,
                            }),
                          )
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}
