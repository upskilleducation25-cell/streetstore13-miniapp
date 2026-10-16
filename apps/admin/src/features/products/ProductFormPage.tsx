import type { AdminCatalogDictionaries, AdminProductDetail, ProductStatus } from "@ss13/shared";
import { formatUah, PRODUCT_STATUS_LABELS, parseUahToKopecks } from "@ss13/shared";
import { useEffect, useMemo, useState } from "react";
import { Link, useBlocker, useNavigate, useParams, useSearchParams } from "react-router";

import { ApiError, errorMessage, fieldErrors } from "../../shared/api";
import { formatDateTime } from "../../shared/lib/format";
import { Button } from "../../shared/ui/Button";
import { useConfirm } from "../../shared/ui/Dialog";
import { Checkbox, Field, Select, TextArea, TextInput } from "../../shared/ui/Field";
import { PageSpinner } from "../../shared/ui/Spinner";
import { ErrorState, Section } from "../../shared/ui/States";
import { useToast } from "../../shared/ui/Toast";
import { useDictionaries, useProduct, useProductMutations } from "./api";
import { ImageManager } from "./ImageManager";
import { MovementsLog } from "./MovementsLog";
import type { FormErrors, ProductFormState } from "./product-form";
import {
  duplicateForm,
  emptyProductForm,
  formFromProduct,
  previewDiscount,
  validateProductForm,
} from "./product-form";
import { StatusBadge } from "./StatusBadge";
import { type AdjustTarget, StockAdjustDialog } from "./StockAdjustDialog";
import type { MatrixState } from "./variant-matrix";
import {
  emptyMatrix,
  matrixForDuplicate,
  matrixFromVariants,
  matrixIsDirty,
  stockChanged,
  toVariantPayload,
  updateCell,
} from "./variant-matrix";
import { type StockNoteState, stockNoteValue, VariantMatrix } from "./VariantMatrix";

const EDITABLE_STATUSES: ProductStatus[] = ["DRAFT", "ACTIVE", "HIDDEN"];
const STATUS_HINTS: Record<ProductStatus, string> = {
  DRAFT: "Заповнюється, на вітрині не видно",
  ACTIVE: "Видно покупцям; потрібен хоча б один увімкнений варіант",
  HIDDEN: "Тимчасово прихований з вітрини",
  ARCHIVED: "В архіві: на вітрині не видно, історія замовлень зберігається",
};

export function ProductFormPage({ mode }: { mode: "create" | "edit" }) {
  const { id } = useParams();
  const [params] = useSearchParams();
  const sourceId = mode === "create" ? (params.get("from") ?? undefined) : id;
  const dictionaries = useDictionaries();
  const source = useProduct(sourceId);

  if (dictionaries.isPending || (sourceId && source.isPending)) return <PageSpinner />;
  if (dictionaries.isError)
    return <ErrorState error={dictionaries.error} onRetry={() => void dictionaries.refetch()} />;
  if (sourceId && source.isError) {
    return source.error instanceof ApiError && source.error.status === 404 ? (
      <ErrorState
        error={new ApiError(404, "PRODUCT_NOT_FOUND", "Товар не знайдено. Можливо, його видалили.")}
      />
    ) : (
      <ErrorState error={source.error} onRetry={() => void source.refetch()} />
    );
  }
  return (
    <ProductForm
      // Новий ключ — новий стан форми при переході між товарами.
      key={`${mode}-${sourceId ?? "new"}`}
      mode={mode}
      dictionaries={dictionaries.data}
      product={mode === "edit" ? source.data : undefined}
      duplicateOf={mode === "create" ? source.data : undefined}
    />
  );
}

function ProductForm({
  mode,
  dictionaries,
  product,
  duplicateOf,
}: {
  mode: "create" | "edit";
  dictionaries: AdminCatalogDictionaries;
  product?: AdminProductDetail;
  duplicateOf?: AdminProductDetail;
}) {
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const mutations = useProductMutations();
  const live = useProduct(product?.id);
  const order = useMemo(
    () => ({
      colorIds: dictionaries.colors.map((c) => c.id),
      sizeIds: dictionaries.sizes.map((s) => s.id),
    }),
    [dictionaries],
  );

  const initialForm = useMemo(
    () =>
      product
        ? formFromProduct(product)
        : duplicateOf
          ? duplicateForm(duplicateOf)
          : emptyProductForm(),
    [product, duplicateOf],
  );
  const initialMatrix = useMemo(() => {
    if (product) return matrixFromVariants(product.variants, order);
    if (duplicateOf) return matrixForDuplicate(matrixFromVariants(duplicateOf.variants, order));
    return emptyMatrix();
  }, [product, duplicateOf, order]);

  const [form, setForm] = useState<ProductFormState>(initialForm);
  const [baseForm, setBaseForm] = useState(initialForm);
  const [matrix, setMatrix] = useState<MatrixState>(initialMatrix);
  const [baseMatrix, setBaseMatrix] = useState(initialMatrix);
  const [note, setNote] = useState<StockNoteState>({ preset: "", text: "" });
  const [errors, setErrors] = useState<FormErrors & { stockNote?: string }>({});
  const [matrixErrors, setMatrixErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [copyImages, setCopyImages] = useState(Boolean(duplicateOf?.images.length));
  const [adjust, setAdjust] = useState<AdjustTarget | null>(null);
  const [saving, setSaving] = useState(false);

  const formDirty = JSON.stringify(form) !== JSON.stringify(baseForm);
  const variantsDirty = matrixIsDirty(matrix, baseMatrix);
  const dirty = formDirty || variantsDirty || (mode === "create" && duplicateOf !== undefined);

  // Незбережені зміни: попередження при переході і закритті вкладки.
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && !saving && currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect(() => {
    if (blocker.state !== "blocked") return;
    void confirm({
      title: "Вийти без збереження?",
      message: "Зміни в товарі буде втрачено.",
      confirmLabel: "Вийти",
      danger: true,
    }).then((ok) => (ok ? blocker.proceed() : blocker.reset()));
  }, [blocker, confirm]);
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const set = <K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const resetFrom = (next: AdminProductDetail) => {
    const nextForm = formFromProduct(next);
    const nextMatrix = matrixFromVariants(next.variants, order);
    setForm(nextForm);
    setBaseForm(nextForm);
    setMatrix(nextMatrix);
    setBaseMatrix(nextMatrix);
    setNote({ preset: "", text: "" });
  };

  const handleError = (error: unknown) => {
    const byField = fieldErrors(error);
    if (Object.keys(byField).length > 0) setErrors((current) => ({ ...current, ...byField }));
    if (error instanceof ApiError && error.code === "STOCK_CHANGED") {
      setFormError(
        "Залишки змінилися, поки форма була відкрита (можливо, був продаж). Натисніть «Оновити залишки» і повторіть.",
      );
    } else {
      setFormError(errorMessage(error));
    }
    toast(errorMessage(error), "error");
  };

  const save = async () => {
    setFormError(null);
    const validated = validateProductForm(form);
    const variants = toVariantPayload(matrix);
    const needNote = stockChanged(matrix);
    const stockNote = stockNoteValue(note);
    const nextErrors: FormErrors & { stockNote?: string } = { ...validated.errors };
    if (needNote && !note.preset) nextErrors.stockNote = "Оберіть причину зміни залишків";
    setErrors(nextErrors);
    setMatrixErrors(variants.errors);
    if (
      !validated.payload ||
      Object.keys(nextErrors).length > 0 ||
      Object.keys(variants.errors).length > 0
    ) {
      setFormError("Виправте помилки у формі");
      return;
    }
    const activeVariants = variants.variants.filter((v) => v.isActive).length;
    if (form.status === "ACTIVE" && activeVariants === 0) {
      setFormError("Активний товар має мати хоча б один увімкнений варіант (колір і розмір).");
      return;
    }

    setSaving(true);
    try {
      if (mode === "create") {
        const created = await mutations.create.mutateAsync({
          ...validated.payload,
          variants: variants.variants,
          ...(needNote ? { stockNote } : {}),
          ...(duplicateOf && copyImages ? { copyImagesFromId: duplicateOf.id } : {}),
        });
        toast("Товар створено");
        setBaseForm(form);
        setBaseMatrix(matrix);
        navigate(`/products/${created.id}`, { replace: true });
        return;
      }

      const id = product!.id;
      let latest: AdminProductDetail | undefined;
      // Активація потребує варіантів, тож тоді спершу зберігаємо матрицю, а потім поля.
      const variantsFirst = form.status === "ACTIVE";
      const saveVariants = async () => {
        if (!variantsDirty) return;
        latest = await mutations.saveVariants.mutateAsync({
          id,
          input: { variants: variants.variants, ...(needNote ? { stockNote } : {}) },
        });
      };
      const saveFields = async () => {
        if (!formDirty) return;
        latest = await mutations.update.mutateAsync({ id, input: validated.payload! });
      };
      if (variantsFirst) {
        await saveVariants();
        await saveFields();
      } else {
        await saveFields();
        await saveVariants();
      }
      if (latest) resetFrom(latest);
      toast("Зміни збережено");
    } catch (error) {
      handleError(error);
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (status: ProductStatus, message: string) => {
    if (!product) return;
    if (dirty) {
      toast("Спершу збережіть або скасуйте зміни", "error");
      return;
    }
    try {
      const next = await mutations.update.mutateAsync({ id: product.id, input: { status } });
      resetFrom(next);
      toast(message);
    } catch (error) {
      handleError(error);
    }
  };

  const archive = async () => {
    const ok = await confirm({
      title: "Перенести товар в архів?",
      message:
        "Товар зникне з вітрини й зі списку товарів. Історія замовлень збережеться, товар можна відновити.",
      confirmLabel: "В архів",
      danger: true,
    });
    if (ok) await setStatus("ARCHIVED", "Товар перенесено в архів");
  };

  const remove = async () => {
    if (!product) return;
    const ok = await confirm({
      title: "Видалити товар назавжди?",
      message:
        "Буде видалено товар, його варіанти, фото і журнал складу. Дію не можна скасувати. Якщо товар може знадобитися — краще перенести в архів.",
      confirmLabel: "Видалити назавжди",
      danger: true,
    });
    if (!ok) return;
    try {
      setSaving(true);
      await mutations.remove.mutateAsync(product.id);
      toast("Товар видалено");
      navigate("/products", { replace: true });
    } catch (error) {
      setSaving(false);
      handleError(error);
    }
  };

  const discount = previewDiscount(form);
  const price = parseUahToKopecks(form.price);
  const categories = dictionaries.categories
    .filter((c) => c.parentId === null)
    .flatMap((root) => [root, ...dictionaries.categories.filter((c) => c.parentId === root.id)]);
  const title =
    mode === "create" ? (duplicateOf ? "Копія товару" : "Новий товар") : (product?.name ?? "");

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
      className="pb-24"
    >
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link to="/products" className="text-xs tracking-wide text-muted uppercase hover:text-fg">
            ← Товари
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight break-words">{title}</h1>
          {product && (
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
              <StatusBadge status={product.status} />
              <span>Залишок: {product.totalStock} шт.</span>
              <span>· Змінено {formatDateTime(product.updatedAt)}</span>
            </p>
          )}
          {duplicateOf && (
            <p className="mt-1 text-sm text-muted">
              Копія «{duplicateOf.name}». Перевірте артикул і дані — нічого не збережеться, доки ви
              не натиснете «Створити».
            </p>
          )}
        </div>
        {product && (
          <div className="flex flex-wrap gap-2">
            <Link
              to={`/products/new?from=${product.id}`}
              className="inline-flex min-h-10 items-center border border-line bg-panel px-4 text-sm hover:border-fg"
            >
              Дублювати
            </Link>
            {product.status === "ARCHIVED" ? (
              <Button onClick={() => void setStatus("DRAFT", "Товар відновлено як чернетку")}>
                Відновити з архіву
              </Button>
            ) : (
              <Button onClick={() => void archive()}>В архів</Button>
            )}
            {product.orderItemCount === 0 ? (
              <Button variant="danger" onClick={() => void remove()}>
                Видалити
              </Button>
            ) : (
              <span className="self-center text-xs text-muted" title="Товар є в замовленнях">
                Є в замовленнях: видалити не можна, тільки архів
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-5">
        <Section title="Основне">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Назва" error={errors.name} required className="sm:col-span-2">
              {(props) => (
                <TextInput
                  {...props}
                  value={form.name}
                  maxLength={200}
                  onChange={(e) => set("name", e.target.value)}
                />
              )}
            </Field>
            <Field label="Артикул" error={errors.sku} required hint="Унікальний, напр. SS13-0001">
              {(props) => (
                <TextInput
                  {...props}
                  value={form.sku}
                  maxLength={64}
                  onChange={(e) => set("sku", e.target.value)}
                />
              )}
            </Field>
            <Field
              label="Slug (адреса)"
              error={errors.slug}
              hint={
                mode === "create" ? "Порожньо — згенерується з назви" : "Латиниця, цифри, дефіси"
              }
            >
              {(props) => (
                <TextInput
                  {...props}
                  value={form.slug}
                  maxLength={120}
                  placeholder="pukhovyk-maya"
                  onChange={(e) => set("slug", e.target.value)}
                />
              )}
            </Field>
            <Field label="Бренд" error={errors.brandId} required>
              {(props) => (
                <Select
                  {...props}
                  value={form.brandId}
                  onChange={(e) => set("brandId", e.target.value)}
                >
                  <option value="">Оберіть…</option>
                  {dictionaries.brands.map((brand) => (
                    <option key={brand.id} value={brand.id}>
                      {brand.name}
                      {brand.isActive ? "" : " (вимкнений)"}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Категорія" error={errors.categoryId} required>
              {(props) => (
                <Select
                  {...props}
                  value={form.categoryId}
                  onChange={(e) => set("categoryId", e.target.value)}
                >
                  <option value="">Оберіть…</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.parentId ? `— ${category.name}` : category.name}
                      {category.isActive ? "" : " (вимкнена)"}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Опис" error={errors.description} className="sm:col-span-2">
              {(props) => (
                <TextArea
                  {...props}
                  value={form.description}
                  maxLength={5000}
                  onChange={(e) => set("description", e.target.value)}
                />
              )}
            </Field>
            <Field
              label="Матеріал"
              error={errors.material}
              hint="Тільки перевірені дані; порожньо, якщо невідомо"
              className="sm:col-span-2"
            >
              {(props) => (
                <TextInput
                  {...props}
                  value={form.material}
                  maxLength={300}
                  onChange={(e) => set("material", e.target.value)}
                />
              )}
            </Field>
          </div>
        </Section>

        <Section title="Ціна і позначки">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              label="Ціна, ₴"
              error={errors.price}
              required
              hint={price !== null ? formatUah(price) : undefined}
            >
              {(props) => (
                <TextInput
                  {...props}
                  inputMode="decimal"
                  placeholder="4999"
                  value={form.price}
                  onChange={(e) => set("price", e.target.value)}
                />
              )}
            </Field>
            <Field
              label="Стара ціна, ₴"
              error={errors.oldPrice}
              hint={
                discount !== null
                  ? `Знижка ${discount}% — покупець побачить перекреслену ціну`
                  : "Порожньо — без знижки"
              }
            >
              {(props) => (
                <TextInput
                  {...props}
                  inputMode="decimal"
                  value={form.oldPrice}
                  onChange={(e) => set("oldPrice", e.target.value)}
                />
              )}
            </Field>
            <Field
              label="Пріоритет"
              error={errors.sortWeight}
              hint="Більше — вище в рекомендованих"
            >
              {(props) => (
                <TextInput
                  {...props}
                  inputMode="numeric"
                  value={form.sortWeight}
                  onChange={(e) => set("sortWeight", e.target.value)}
                />
              )}
            </Field>
          </div>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3">
            <Checkbox label="Новинка" checked={form.isNew} onChange={(v) => set("isNew", v)} />
            <Checkbox
              label="Популярне"
              checked={form.isPopular}
              onChange={(v) => set("isPopular", v)}
            />
            <Checkbox
              label="Акція"
              checked={form.isSale}
              onChange={(v) => set("isSale", v)}
              hint={form.isSale && !form.oldPrice.trim() ? "Порада: вкажіть стару ціну" : undefined}
            />
          </div>
        </Section>

        <Section title="Статус">
          {form.status === "ARCHIVED" ? (
            <p className="text-sm text-muted">
              {STATUS_HINTS.ARCHIVED}. Щоб змінити — «Відновити з архіву».
            </p>
          ) : (
            <fieldset className="grid gap-2 sm:grid-cols-3">
              <legend className="sr-only">Статус товару</legend>
              {EDITABLE_STATUSES.map((status) => (
                <label
                  key={status}
                  className={`flex cursor-pointer flex-col gap-1 border p-3 text-sm ${form.status === status ? "border-fg" : "border-line"}`}
                >
                  <span className="flex items-center gap-2 font-medium">
                    <input
                      type="radio"
                      name="status"
                      value={status}
                      checked={form.status === status}
                      onChange={() => set("status", status)}
                      className="accent-[var(--c-fg)]"
                    />
                    {PRODUCT_STATUS_LABELS[status]}
                  </span>
                  <span className="text-xs text-muted">{STATUS_HINTS[status]}</span>
                </label>
              ))}
            </fieldset>
          )}
        </Section>

        <Section
          title="Кольори, розміри і залишки"
          description="Кожна пара колір + розмір має свій залишок. Вимкнені й відсутні варіанти покупцю не пропонуються."
          actions={
            product && variantsDirty ? (
              <Button size="sm" variant="ghost" onClick={() => setMatrix(baseMatrix)}>
                Скасувати зміни матриці
              </Button>
            ) : undefined
          }
        >
          <VariantMatrix
            state={matrix}
            onChange={(next) => {
              setMatrix(next);
              setMatrixErrors({});
            }}
            colors={dictionaries.colors}
            sizes={dictionaries.sizes}
            errors={matrixErrors}
            note={note}
            onNoteChange={(next) => {
              setNote(next);
              setErrors((current) => ({ ...current, stockNote: undefined }));
            }}
            noteError={errors.stockNote}
            onAdjust={
              product
                ? (variantId, label, stock) => setAdjust({ variantId, label, stock })
                : undefined
            }
          />
        </Section>

        <Section
          title="Фото"
          description="Перше фото — головне в каталозі. Фото можна прив'язати до кольору."
        >
          {product ? (
            <ImageManager
              productId={product.id}
              images={product.images}
              colors={dictionaries.colors}
            />
          ) : duplicateOf && duplicateOf.images.length > 0 ? (
            <Checkbox
              label={`Скопіювати фото з «${duplicateOf.name}» (${duplicateOf.images.length})`}
              checked={copyImages}
              onChange={setCopyImages}
              hint="Ті самі файли; нові фото можна додати після створення"
            />
          ) : (
            <p className="text-sm text-muted">Фото можна додати одразу після створення товару.</p>
          )}
        </Section>

        {product && (
          <Section
            title="Журнал руху складу"
            description="Замовлення, скасування і ручні зміни залишків"
          >
            <MovementsLog productId={product.id} />
          </Section>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-panel/95 backdrop-blur lg:left-[232px]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-10">
          <p
            role={formError ? "alert" : undefined}
            className={`text-sm ${formError ? "text-danger" : "text-muted"}`}
          >
            {formError ?? (dirty ? "Є незбережені зміни" : "Усі зміни збережено")}
          </p>
          <div className="flex gap-2">
            {formError?.startsWith("Залишки змінилися") && product && (
              <Button
                onClick={() =>
                  void live.refetch().then((result) => {
                    if (!result.data) return;
                    // Свіжі залишки з сервера; інші зміни у формі лишаються.
                    const fresh = matrixFromVariants(result.data.variants, order);
                    setMatrix(fresh);
                    setBaseMatrix(fresh);
                    setFormError(null);
                  })
                }
              >
                Оновити залишки
              </Button>
            )}
            <Button
              type="submit"
              variant="primary"
              loading={saving}
              disabled={!dirty && mode === "edit"}
            >
              {mode === "create" ? "Створити товар" : "Зберегти"}
            </Button>
          </div>
        </div>
      </div>

      {product && (
        <StockAdjustDialog
          productId={product.id}
          target={adjust}
          onClose={() => setAdjust(null)}
          onDone={(variantId, stock) => {
            // Оновлюємо клітинку і базу порівняння: зміна вже збережена на сервері.
            const update = (state: MatrixState) => {
              const entry = Object.entries(state.cells).find(
                ([, cell]) => cell.variantId === variantId,
              );
              if (!entry) return state;
              const [colorId, sizeId] = entry[0].split("/") as [string, string];
              return updateCell(state, colorId, sizeId, {
                stock: String(stock),
                originalStock: stock,
              });
            };
            setMatrix(update);
            setBaseMatrix(update);
          }}
        />
      )}
    </form>
  );
}
