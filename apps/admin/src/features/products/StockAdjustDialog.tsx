import { STOCK_NOTE_PRESETS } from "@ss13/shared";
import { useState } from "react";

import { errorMessage, fieldErrors } from "../../shared/api";
import { Button } from "../../shared/ui/Button";
import { Dialog } from "../../shared/ui/Dialog";
import { Field, Select, TextInput } from "../../shared/ui/Field";
import { useToast } from "../../shared/ui/Toast";
import { useProductMutations } from "./api";
import { stockNoteValue } from "./VariantMatrix";

export interface AdjustTarget {
  variantId: string;
  label: string;
  stock: number;
}

/** Швидка зміна залишку одного варіанту (+надходження / −списання) з причиною. */
export function StockAdjustDialog({
  productId,
  target,
  onClose,
  onDone,
}: {
  productId: string;
  target: AdjustTarget | null;
  onClose: () => void;
  onDone: (variantId: string, stock: number) => void;
}) {
  const { adjustStock } = useProductMutations();
  const toast = useToast();
  const [delta, setDelta] = useState("");
  const [preset, setPreset] = useState<string>(STOCK_NOTE_PRESETS[0]);
  const [text, setText] = useState("");
  const value = Number(delta);
  const valid = delta.trim() !== "" && Number.isInteger(value) && value !== 0;
  const result = target ? target.stock + (valid ? value : 0) : 0;
  const errors = fieldErrors(adjustStock.error);

  const close = () => {
    setDelta("");
    setText("");
    adjustStock.reset();
    onClose();
  };

  const submit = () => {
    if (!target || !valid || result < 0) return;
    adjustStock.mutate(
      {
        productId,
        variantId: target.variantId,
        input: { delta: value, note: stockNoteValue({ preset, text }) },
      },
      {
        onSuccess: (variant) => {
          toast(`Залишок ${target.label}: ${variant.stock} шт.`);
          onDone(variant.id, variant.stock);
          close();
        },
      },
    );
  };

  return (
    <Dialog
      open={target !== null}
      title={`Залишок: ${target?.label ?? ""}`}
      onClose={close}
      footer={
        <>
          <Button onClick={close}>Скасувати</Button>
          <Button
            variant="primary"
            loading={adjustStock.isPending}
            disabled={!valid || result < 0 || !preset}
            onClick={submit}
          >
            Зберегти
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <p className="text-muted">
          Зараз: <span className="text-fg tabular-nums">{target?.stock} шт.</span>
          {valid && (
            <>
              {" "}
              → після зміни:{" "}
              <span className={`tabular-nums ${result < 0 ? "text-danger" : "text-fg"}`}>
                {result} шт.
              </span>
            </>
          )}
        </p>
        <Field
          label="Зміна, шт."
          error={errors.delta ?? (result < 0 ? "Залишок не може стати від'ємним" : undefined)}
          hint="+5 — надходження, −2 — списання"
          required
        >
          {(props) => (
            <TextInput
              {...props}
              inputMode="numeric"
              autoFocus
              placeholder="+5 або -2"
              value={delta}
              onChange={(event) => setDelta(event.target.value.replace(/^\+/, ""))}
            />
          )}
        </Field>
        <Field label="Причина" required error={errors.note}>
          {(props) => (
            <Select {...props} value={preset} onChange={(event) => setPreset(event.target.value)}>
              {STOCK_NOTE_PRESETS.map((item) => (
                <option key={item} value={item}>
                  {item}
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
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
          )}
        </Field>
        {adjustStock.error && Object.keys(errors).length === 0 && (
          <p role="alert" className="text-danger">
            {errorMessage(adjustStock.error)}
          </p>
        )}
      </form>
    </Dialog>
  );
}
