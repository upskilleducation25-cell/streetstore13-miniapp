import type {
  AdminBrand,
  AdminColor,
  AdminSize,
  AdminSortOrderItem,
  SizeSystem,
} from "@ss13/shared";
import { SIZE_SYSTEM_LABELS } from "@ss13/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useState } from "react";
import { useSearchParams } from "react-router";

import { api, errorMessage, fieldErrors } from "../../shared/api";
import { plural } from "../../shared/lib/format";
import { moveAmong } from "../../shared/lib/reorder";
import { Button } from "../../shared/ui/Button";
import { Dialog, useConfirm } from "../../shared/ui/Dialog";
import { Checkbox, Field, Select, TextInput } from "../../shared/ui/Field";
import { PageSpinner } from "../../shared/ui/Spinner";
import { Badge, EmptyState, ErrorState, PageHeader } from "../../shared/ui/States";
import { useToast } from "../../shared/ui/Toast";
import { DICTIONARIES_KEY, useDictionaries } from "../products/api";

type Kind = "brands" | "colors" | "sizes";

const TABS: Array<{ kind: Kind; label: string }> = [
  { kind: "brands", label: "Бренди" },
  { kind: "colors", label: "Кольори" },
  { kind: "sizes", label: "Розміри" },
];

const HEX = /^#[0-9a-f]{6}$/i;

function useDictionaryMutations(kind: Kind) {
  const queryClient = useQueryClient();
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: DICTIONARIES_KEY });
    void queryClient.invalidateQueries({ queryKey: ["products"] });
  };
  return {
    save: useMutation({
      mutationFn: ({ id, input }: { id?: string; input: object }) =>
        id
          ? api(`/admin/${kind}/${id}`, { method: "PATCH", body: input })
          : api(`/admin/${kind}`, { method: "POST", body: input }),
      onSuccess: refresh,
    }),
    reorder: useMutation({
      mutationFn: (items: AdminSortOrderItem[]) =>
        api(`/admin/${kind}/order`, { method: "PATCH", body: { items } }),
      onSettled: refresh,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api<void>(`/admin/${kind}/${id}`, { method: "DELETE" }),
      onSuccess: refresh,
    }),
  };
}

function EditDialog({
  kind,
  title,
  id,
  build,
  valid,
  onClose,
  children,
}: {
  kind: Kind;
  title: string;
  id?: string;
  build: () => object;
  valid: boolean;
  onClose: () => void;
  children: (errors: Record<string, string>) => ReactNode;
}) {
  const { save } = useDictionaryMutations(kind);
  const toast = useToast();
  const errors = fieldErrors(save.error);
  const submit = () => {
    if (!valid) return;
    save.mutate(
      { id, input: build() },
      {
        onSuccess: () => {
          toast(id ? "Збережено" : "Додано");
          onClose();
        },
      },
    );
  };
  return (
    <Dialog
      open
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Скасувати</Button>
          <Button variant="primary" loading={save.isPending} disabled={!valid} onClick={submit}>
            {id ? "Зберегти" : "Додати"}
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
        {children(errors)}
        {save.error && Object.keys(errors).length === 0 && (
          <p role="alert" className="text-danger">
            {errorMessage(save.error)}
          </p>
        )}
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}

function BrandDialog({ brand, onClose }: { brand: AdminBrand | null; onClose: () => void }) {
  const [name, setName] = useState(brand?.name ?? "");
  const [slug, setSlug] = useState(brand?.slug ?? "");
  const [logoUrl, setLogoUrl] = useState(brand?.logoUrl ?? "");
  const [isActive, setIsActive] = useState(brand?.isActive ?? true);
  return (
    <EditDialog
      kind="brands"
      title={brand ? `Бренд «${brand.name}»` : "Новий бренд"}
      id={brand?.id}
      valid={name.trim().length > 0}
      build={() => ({
        name: name.trim(),
        ...(slug.trim() ? { slug: slug.trim().toLowerCase() } : {}),
        logoUrl: logoUrl.trim() || null,
        isActive,
      })}
      onClose={onClose}
    >
      {(errors) => (
        <>
          <Field label="Назва" required error={errors.name}>
            {(props) => (
              <TextInput
                {...props}
                autoFocus
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            )}
          </Field>
          <Field label="Slug" error={errors.slug} hint="Порожньо — з назви">
            {(props) => (
              <TextInput
                {...props}
                maxLength={120}
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
              />
            )}
          </Field>
          <Field
            label="Посилання на логотип"
            error={errors.logoUrl}
            hint="https://…, необов'язково"
          >
            {(props) => (
              <TextInput
                {...props}
                type="url"
                maxLength={500}
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
              />
            )}
          </Field>
          <Checkbox
            label="Показувати у фільтрах вітрини"
            checked={isActive}
            onChange={setIsActive}
          />
        </>
      )}
    </EditDialog>
  );
}

function ColorDialog({ color, onClose }: { color: AdminColor | null; onClose: () => void }) {
  const [name, setName] = useState(color?.name ?? "");
  const [slug, setSlug] = useState(color?.slug ?? "");
  const [hex, setHex] = useState(color?.hex ?? "#000000");
  const hexOk = HEX.test(hex.trim());
  return (
    <EditDialog
      kind="colors"
      title={color ? `Колір «${color.name}»` : "Новий колір"}
      id={color?.id}
      valid={name.trim().length > 0 && hexOk}
      build={() => ({
        name: name.trim(),
        ...(slug.trim() ? { slug: slug.trim().toLowerCase() } : {}),
        hex: hex.trim().toLowerCase(),
      })}
      onClose={onClose}
    >
      {(errors) => (
        <>
          <Field label="Назва" required error={errors.name}>
            {(props) => (
              <TextInput
                {...props}
                autoFocus
                maxLength={50}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            )}
          </Field>
          <Field label="Slug" error={errors.slug} hint="Порожньо — з назви">
            {(props) => (
              <TextInput
                {...props}
                maxLength={60}
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
              />
            )}
          </Field>
          <Field
            label="Колір (HEX)"
            required
            error={errors.hex ?? (hexOk ? undefined : "Формат #RRGGBB")}
          >
            {(props) => (
              <div className="flex gap-2">
                <input
                  type="color"
                  aria-label="Вибрати колір"
                  value={hexOk ? hex : "#000000"}
                  onChange={(e) => setHex(e.target.value)}
                  className="h-10 w-12 cursor-pointer border border-line bg-panel"
                />
                <TextInput
                  {...props}
                  maxLength={7}
                  value={hex}
                  onChange={(e) => setHex(e.target.value)}
                />
              </div>
            )}
          </Field>
        </>
      )}
    </EditDialog>
  );
}

function SizeDialog({ size, onClose }: { size: AdminSize | null; onClose: () => void }) {
  const [label, setLabel] = useState(size?.label ?? "");
  const [sizeSystem, setSizeSystem] = useState<SizeSystem>(size?.sizeSystem ?? "CLOTHING");
  return (
    <EditDialog
      kind="sizes"
      title={size ? `Розмір «${size.label}»` : "Новий розмір"}
      id={size?.id}
      valid={label.trim().length > 0}
      build={() => ({ label: label.trim(), sizeSystem })}
      onClose={onClose}
    >
      {(errors) => (
        <>
          <Field label="Позначення" required error={errors.label} hint="Напр. M, XL, 42">
            {(props) => (
              <TextInput
                {...props}
                autoFocus
                maxLength={20}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            )}
          </Field>
          <Field label="Розмірна сітка" error={errors.sizeSystem}>
            {(props) => (
              <Select
                {...props}
                value={sizeSystem}
                onChange={(e) => setSizeSystem(e.target.value as SizeSystem)}
              >
                {Object.entries(SIZE_SYSTEM_LABELS).map(([value, text]) => (
                  <option key={value} value={value}>
                    {text}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </>
      )}
    </EditDialog>
  );
}

interface Row {
  id: string;
  sortOrder: number;
  /** Межі перестановки: у розмірів — сітка. */
  group?: string;
  title: ReactNode;
  meta: string;
  used: number;
  badge?: ReactNode;
}

function DictionaryList({
  kind,
  rows,
  usedLabel,
  onEdit,
}: {
  kind: Kind;
  rows: Row[];
  usedLabel: string;
  onEdit: (id: string) => void;
}) {
  const { reorder, remove } = useDictionaryMutations(kind);
  const toast = useToast();
  const confirm = useConfirm();

  const move = (row: Row, delta: -1 | 1) => {
    // Розміри показуються групами за сіткою — переставляємо тільки в межах групи.
    const siblings = rows.filter((other) => other.group === row.group);
    const items = moveAmong(siblings, row.id, delta);
    if (items) reorder.mutate(items, { onError: (error) => toast(errorMessage(error), "error") });
  };

  const del = async (row: Row) => {
    const ok = await confirm({
      title: "Видалити запис?",
      message:
        row.used > 0
          ? "Запис використовується — сервер не дасть його видалити."
          : "Цю дію не можна скасувати.",
      confirmLabel: "Видалити",
      danger: true,
    });
    if (!ok) return;
    remove.mutate(row.id, {
      onSuccess: () => toast("Видалено"),
      onError: (error) => toast(errorMessage(error), "error"),
    });
  };

  if (rows.length === 0) return <EmptyState title="Записів ще немає" />;
  return (
    <ul className="border border-line bg-panel">
      {rows.map((row) => {
        const siblings = rows.filter((other) => other.group === row.group);
        const index = siblings.indexOf(row);
        return (
          <li
            key={row.id}
            className="flex flex-wrap items-center gap-3 border-b border-line px-3 py-2.5 last:border-0"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate">{row.title}</div>
              <p className="truncate text-xs text-muted">
                {row.meta} · {usedLabel}: {row.used}
              </p>
            </div>
            {row.badge}
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                disabled={index === 0 || reorder.isPending}
                onClick={() => move(row, -1)}
                aria-label="Вище"
              >
                ↑
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={index === siblings.length - 1 || reorder.isPending}
                onClick={() => move(row, 1)}
                aria-label="Нижче"
              >
                ↓
              </Button>
              <Button size="sm" onClick={() => onEdit(row.id)}>
                Змінити
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-danger"
                aria-label="Видалити"
                onClick={() => void del(row)}
              >
                ×
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function DictionariesPage() {
  const dictionaries = useDictionaries();
  const [params, setParams] = useSearchParams();
  const kind = (TABS.find((tab) => tab.kind === params.get("tab"))?.kind ?? "brands") as Kind;
  const [editing, setEditing] = useState<{ kind: Kind; id: string | null } | null>(null);

  if (dictionaries.isPending) return <PageSpinner />;
  if (dictionaries.isError)
    return <ErrorState error={dictionaries.error} onRetry={() => void dictionaries.refetch()} />;
  const { brands, colors, sizes } = dictionaries.data;

  const list = (() => {
    const edit = (id: string) => setEditing({ kind, id });
    if (kind === "brands") {
      return (
        <DictionaryList
          kind="brands"
          usedLabel="товарів"
          onEdit={edit}
          rows={brands.map((b) => ({
            id: b.id,
            sortOrder: b.sortOrder,
            title: b.name,
            meta: `/${b.slug}`,
            used: b.productCount,
            badge: b.isActive ? undefined : <Badge tone="warn">Прихований</Badge>,
          }))}
        />
      );
    }
    if (kind === "colors") {
      return (
        <DictionaryList
          kind="colors"
          usedLabel="варіантів"
          onEdit={edit}
          rows={colors.map((c) => ({
            id: c.id,
            sortOrder: c.sortOrder,
            title: (
              <span className="flex items-center gap-2">
                <span
                  className="inline-block h-4 w-4 border border-line"
                  style={{ background: c.hex }}
                />
                {c.name}
              </span>
            ),
            meta: c.hex,
            used: c.variantCount,
          }))}
        />
      );
    }
    return (
      <DictionaryList
        kind="sizes"
        usedLabel="варіантів"
        onEdit={edit}
        rows={sizes.map((s) => ({
          id: s.id,
          sortOrder: s.sortOrder,
          group: s.sizeSystem,
          title: s.label,
          meta: SIZE_SYSTEM_LABELS[s.sizeSystem],
          used: s.variantCount,
        }))}
      />
    );
  })();

  const count = { brands: brands.length, colors: colors.length, sizes: sizes.length }[kind];
  const close = () => setEditing(null);

  return (
    <>
      <PageHeader
        title="Довідники"
        subtitle={`${plural(count, "запис", "записи", "записів")}. Порядок тут — порядок у фільтрах і на картці товару.`}
        actions={
          <Button variant="primary" onClick={() => setEditing({ kind, id: null })}>
            + Додати
          </Button>
        }
      />
      <div role="tablist" className="mb-4 flex gap-1 border-b border-line">
        {TABS.map((tab) => (
          <button
            key={tab.kind}
            type="button"
            role="tab"
            aria-selected={tab.kind === kind}
            onClick={() => setParams({ tab: tab.kind }, { replace: true })}
            className={`-mb-px border-b-2 px-4 py-2 text-sm ${tab.kind === kind ? "border-fg font-medium" : "border-transparent text-muted hover:text-fg"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {list}
      {editing?.kind === "brands" && (
        <BrandDialog
          key={editing.id ?? "new"}
          brand={brands.find((b) => b.id === editing.id) ?? null}
          onClose={close}
        />
      )}
      {editing?.kind === "colors" && (
        <ColorDialog
          key={editing.id ?? "new"}
          color={colors.find((c) => c.id === editing.id) ?? null}
          onClose={close}
        />
      )}
      {editing?.kind === "sizes" && (
        <SizeDialog
          key={editing.id ?? "new"}
          size={sizes.find((s) => s.id === editing.id) ?? null}
          onClose={close}
        />
      )}
    </>
  );
}
