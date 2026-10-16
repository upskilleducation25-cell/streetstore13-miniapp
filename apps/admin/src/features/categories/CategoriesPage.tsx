import type { AdminCategory, AdminCategoryInput, AdminSortOrderItem } from "@ss13/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { api, errorMessage, fieldErrors } from "../../shared/api";
import { plural } from "../../shared/lib/format";
import { Button } from "../../shared/ui/Button";
import { Dialog, useConfirm } from "../../shared/ui/Dialog";
import { Checkbox, Field, Select, TextInput } from "../../shared/ui/Field";
import { PageSpinner } from "../../shared/ui/Spinner";
import { Badge, EmptyState, ErrorState, PageHeader } from "../../shared/ui/States";
import { useToast } from "../../shared/ui/Toast";
import { DICTIONARIES_KEY, useDictionaries } from "../products/api";
import { checkFile } from "../products/ImageManager";
import { buildTree, moveCategory, parentOptions } from "./category-tree";

function useCategoryMutations() {
  const queryClient = useQueryClient();
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: DICTIONARIES_KEY });
    void queryClient.invalidateQueries({ queryKey: ["products"] });
  };
  return {
    save: useMutation({
      mutationFn: ({ id, input }: { id?: string; input: AdminCategoryInput }) =>
        id
          ? api<AdminCategory>(`/admin/categories/${id}`, { method: "PATCH", body: input })
          : api<AdminCategory>("/admin/categories", { method: "POST", body: input }),
      onSuccess: refresh,
    }),
    reorder: useMutation({
      mutationFn: (items: AdminSortOrderItem[]) =>
        api<AdminCategory[]>("/admin/categories/order", { method: "PATCH", body: { items } }),
      onSettled: refresh,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api<void>(`/admin/categories/${id}`, { method: "DELETE" }),
      onSuccess: refresh,
    }),
    setImage: useMutation({
      mutationFn: ({ id, file }: { id: string; file: File | null }) => {
        if (!file) return api<AdminCategory>(`/admin/categories/${id}/image`, { method: "DELETE" });
        const form = new FormData();
        form.append("file", file, file.name);
        return api<AdminCategory>(`/admin/categories/${id}/image`, { method: "POST", form });
      },
      onSuccess: refresh,
    }),
  };
}

interface EditState {
  category: AdminCategory | null;
  parentId: string | null;
}

function CategoryDialog({
  edit,
  categories,
  onClose,
}: {
  edit: EditState | null;
  categories: AdminCategory[];
  onClose: () => void;
}) {
  const mutations = useCategoryMutations();
  const toast = useToast();
  const category = edit?.category ?? null;
  const [name, setName] = useState(category?.name ?? "");
  const [slug, setSlug] = useState(category?.slug ?? "");
  const [parentId, setParentId] = useState(
    category ? (category.parentId ?? "") : (edit?.parentId ?? ""),
  );
  const [icon, setIcon] = useState(category?.icon ?? "");
  const [isActive, setIsActive] = useState(category?.isActive ?? true);
  const [imageError, setImageError] = useState<string | null>(null);
  const errors = fieldErrors(mutations.save.error);
  const parents = parentOptions(categories, category);

  const submit = () => {
    if (!name.trim()) return;
    mutations.save.mutate(
      {
        id: category?.id,
        input: {
          name: name.trim(),
          ...(slug.trim() ? { slug: slug.trim().toLowerCase() } : {}),
          parentId: parentId || null,
          icon: icon.trim() || null,
          isActive,
        },
      },
      {
        onSuccess: () => {
          toast(category ? "Категорію збережено" : "Категорію створено");
          onClose();
        },
      },
    );
  };

  const upload = (file: File | null) => {
    if (!category) return;
    if (file) {
      const problem = checkFile(file);
      if (problem) {
        setImageError(problem);
        return;
      }
    }
    setImageError(null);
    mutations.setImage.mutate(
      { id: category.id, file },
      {
        onSuccess: () => toast(file ? "Зображення оновлено" : "Зображення прибрано"),
        onError: (error) => setImageError(errorMessage(error)),
      },
    );
  };
  const current = categories.find((c) => c.id === category?.id) ?? category;

  return (
    <Dialog
      open
      title={category ? `Категорія «${category.name}»` : "Нова категорія"}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Скасувати</Button>
          <Button
            variant="primary"
            loading={mutations.save.isPending}
            disabled={!name.trim()}
            onClick={submit}
          >
            {category ? "Зберегти" : "Створити"}
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
          label="Розділ"
          error={errors.parentId}
          hint={
            category && category.childCount > 0
              ? "Категорія з підкатегоріями може бути тільки розділом"
              : "Два рівні: розділ → підкатегорія"
          }
        >
          {(props) => (
            <Select
              {...props}
              value={parentId}
              disabled={parents.length === 0}
              onChange={(e) => setParentId(e.target.value)}
            >
              <option value="">— Верхній рівень (розділ) —</option>
              {parents.map((parent) => (
                <option key={parent.id} value={parent.id}>
                  {parent.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Іконка" error={errors.icon} hint="Емодзі або коротка назва, до 32 символів">
          {(props) => (
            <TextInput
              {...props}
              maxLength={32}
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
            />
          )}
        </Field>
        <Checkbox
          label="Показувати на вітрині"
          checked={isActive}
          onChange={setIsActive}
          hint="Вимкнена категорія ховає і свої товари"
        />
        {current && (
          <div className="flex flex-col gap-2 border-t border-line pt-4">
            <span className="ss-label">Зображення</span>
            {current.imageUrl ? (
              <img src={current.imageUrl} alt="" className="h-24 w-24 object-cover" />
            ) : (
              <p className="text-xs text-muted">Немає зображення</p>
            )}
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex min-h-8 cursor-pointer items-center border border-line px-3 text-xs hover:border-fg">
                {mutations.setImage.isPending ? "Завантаження…" : "Обрати файл…"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  className="sr-only"
                  onChange={(e) => upload(e.target.files?.[0] ?? null)}
                />
              </label>
              {current.imageUrl && (
                <Button size="sm" variant="ghost" onClick={() => upload(null)}>
                  Прибрати
                </Button>
              )}
            </div>
            {imageError && (
              <p role="alert" className="text-xs text-danger">
                {imageError}
              </p>
            )}
          </div>
        )}
        {mutations.save.error && Object.keys(errors).length === 0 && (
          <p role="alert" className="text-danger">
            {errorMessage(mutations.save.error)}
          </p>
        )}
      </form>
    </Dialog>
  );
}

export function CategoriesPage() {
  const dictionaries = useDictionaries();
  const mutations = useCategoryMutations();
  const toast = useToast();
  const confirm = useConfirm();
  const [edit, setEdit] = useState<EditState | null>(null);

  if (dictionaries.isPending) return <PageSpinner />;
  if (dictionaries.isError)
    return <ErrorState error={dictionaries.error} onRetry={() => void dictionaries.refetch()} />;
  const categories = dictionaries.data.categories;
  const tree = buildTree(categories);

  const move = (id: string, delta: -1 | 1) => {
    const items = moveCategory(categories, id, delta);
    if (items)
      mutations.reorder.mutate(items, { onError: (error) => toast(errorMessage(error), "error") });
  };

  const remove = async (category: AdminCategory) => {
    const ok = await confirm({
      title: `Видалити «${category.name}»?`,
      message:
        "Видалити можна лише порожню категорію без підкатегорій. Якщо категорія тимчасово не потрібна — вимкніть її.",
      confirmLabel: "Видалити",
      danger: true,
    });
    if (!ok) return;
    mutations.remove.mutate(category.id, {
      onSuccess: () => toast("Категорію видалено"),
      onError: (error) => toast(errorMessage(error), "error"),
    });
  };

  const Row = ({
    category,
    index,
    total,
    child = false,
  }: {
    category: AdminCategory;
    index: number;
    total: number;
    child?: boolean;
  }) => (
    <div
      className={`flex flex-wrap items-center gap-3 border-b border-line px-3 py-2.5 last:border-0 ${child ? "bg-soft/50 pl-8" : ""}`}
    >
      <span className="w-6 text-center text-lg" aria-hidden>
        {category.icon ?? ""}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`truncate ${child ? "" : "font-medium"}`}>{category.name}</p>
        <p className="truncate text-xs text-muted">
          /{category.slug} · {plural(category.productCount, "товар", "товари", "товарів")}
        </p>
      </div>
      {!category.isActive && <Badge tone="warn">Вимкнена</Badge>}
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          disabled={index === 0 || mutations.reorder.isPending}
          onClick={() => move(category.id, -1)}
          aria-label={`Вище: ${category.name}`}
        >
          ↑
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={index === total - 1 || mutations.reorder.isPending}
          onClick={() => move(category.id, 1)}
          aria-label={`Нижче: ${category.name}`}
        >
          ↓
        </Button>
        {!child && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setEdit({ category: null, parentId: category.id })}
          >
            + підкатегорія
          </Button>
        )}
        <Button size="sm" onClick={() => setEdit({ category, parentId: category.parentId })}>
          Змінити
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-danger"
          onClick={() => void remove(category)}
        >
          ×
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <PageHeader
        title="Категорії"
        subtitle="Порядок тут — порядок на головній і в каталозі Mini App"
        actions={
          <Button variant="primary" onClick={() => setEdit({ category: null, parentId: null })}>
            + Додати розділ
          </Button>
        }
      />
      {tree.length === 0 ? (
        <EmptyState
          title="Категорій ще немає"
          action={
            <Button onClick={() => setEdit({ category: null, parentId: null })}>
              Додати розділ
            </Button>
          }
        />
      ) : (
        <div className="border border-line bg-panel">
          {tree.map((root, index) => (
            <div key={root.id}>
              <Row category={root} index={index} total={tree.length} />
              {root.children.map((child, childIndex) => (
                <Row
                  key={child.id}
                  category={child}
                  index={childIndex}
                  total={root.children.length}
                  child
                />
              ))}
            </div>
          ))}
        </div>
      )}
      {edit && (
        <CategoryDialog
          key={edit.category?.id ?? `new-${edit.parentId}`}
          edit={edit}
          categories={categories}
          onClose={() => setEdit(null)}
        />
      )}
    </>
  );
}
