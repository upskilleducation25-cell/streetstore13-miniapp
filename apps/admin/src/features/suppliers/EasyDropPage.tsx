import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, errorMessage } from "../../shared/api";
import { Button } from "../../shared/ui/Button";
import { useConfirm } from "../../shared/ui/Dialog";
import { PageSpinner } from "../../shared/ui/Spinner";
import { Badge, ErrorState, PageHeader, Section } from "../../shared/ui/States";
import { useToast } from "../../shared/ui/Toast";

interface EasyDropSample {
  externalId: string;
  groupId: string;
  vendorCode: string;
  name: string;
  categoryName: string;
  size: string;
  priceUah: number;
  available: boolean;
  quantity: number;
}

interface EasyDropPreview {
  status: "PREVIEW";
  totalItems: number;
  shoeVariants: number;
  distinctModels: number;
  sample: EasyDropSample[];
  applied: false;
  message: string;
}

interface EasyDropSyncResult {
  status: "SUCCESS";
  runId: string;
  totalItems: number;
  distinctModels: number;
  createdProducts: number;
  createdVariants: number;
  stockChanges: number;
  absentVariants: number;
  hiddenProducts: number;
  message: string;
}

interface EasyDropRun {
  id: string;
  status: "RUNNING" | "SUCCESS" | "FAILED" | string;
  startedAt: string;
  finishedAt: string | null;
  importedCount: number;
  hiddenCount: number;
  errorMessage: string | null;
}

const PREVIEW_KEY = ["easydrop", "preview"] as const;
const RUNS_KEY = ["easydrop", "runs"] as const;
const PRICE = new Intl.NumberFormat("uk-UA", {
  style: "currency",
  currency: "UAH",
  maximumFractionDigits: 2,
});

const dateTime = (value: string | null) =>
  value ? new Date(value).toLocaleString("uk-UA") : "—";

function RunStatus({ status }: { status: EasyDropRun["status"] }) {
  const tone = status === "SUCCESS" ? "ok" : status === "FAILED" ? "danger" : "warn";
  const label =
    status === "SUCCESS" ? "Успішно" : status === "FAILED" ? "Помилка" : "Виконується";
  return <Badge tone={tone}>{label}</Badge>;
}

export function EasyDropPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const toast = useToast();

  const preview = useQuery({
    queryKey: PREVIEW_KEY,
    queryFn: () => api<EasyDropPreview>("/admin/suppliers/easydrop/preview"),
    enabled: false,
    retry: false,
  });
  const runs = useQuery({
    queryKey: RUNS_KEY,
    queryFn: () => api<EasyDropRun[]>("/admin/suppliers/easydrop/runs"),
    staleTime: 10_000,
  });
  const sync = useMutation({
    mutationFn: () =>
      api<EasyDropSyncResult>("/admin/suppliers/easydrop/sync", { method: "POST" }),
    onSuccess: async () => {
      toast("Синхронізацію EasyDrop завершено");
      queryClient.removeQueries({ queryKey: PREVIEW_KEY });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: RUNS_KEY }),
        queryClient.invalidateQueries({ queryKey: ["products"] }),
        queryClient.invalidateQueries({ queryKey: ["dictionaries"] }),
      ]);
    },
    onError: (error) => toast(errorMessage(error), "error"),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: RUNS_KEY }),
  });

  const runSync = async () => {
    if (!preview.data || preview.isFetching || preview.isError || sync.isPending) return;
    const accepted = await confirm({
      title: "Синхронізувати каталог EasyDrop?",
      message:
        "Сервер повторно завантажить і перевірить фід, після чого оновить ціни та залишки. Позиції, відсутні у валідованому фіді, будуть вимкнені; якщо не залишиться жодної присутньої позиції, товар буде приховано. Зміни каталогу застосовуються однією транзакцією.",
      confirmLabel: "Синхронізувати",
      danger: true,
    });
    if (accepted) sync.mutate();
  };

  return (
    <>
      <PageHeader
        title="Постачальники"
        subtitle="EasyDrop · каталог взуття та складські залишки"
        actions={
          <Button
            variant="secondary"
            loading={runs.isFetching}
            onClick={() => void runs.refetch()}
          >
            Оновити історію
          </Button>
        }
      />

      <div className="mb-6 border border-line bg-panel p-4 sm:p-5">
        <h2 className="text-sm font-semibold">1. Перевірити фід</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Спочатку перевір фід без змін у базі. Сервер перевіряє XML, ID, EU-розміри, ціни,
          залишки, категорії та HTTPS-посилання на фото. До успішної перевірки синхронізація
          нічого не змінює.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="primary"
            loading={preview.isFetching}
            onClick={() => void preview.refetch()}
          >
            Перевірити фід
          </Button>
          <Button
            variant="danger"
            disabled={!preview.data || preview.isFetching || preview.isError || sync.isPending}
            loading={sync.isPending}
            onClick={() => void runSync()}
          >
            Синхронізувати каталог
          </Button>
        </div>
        {preview.error && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {errorMessage(preview.error)}
          </p>
        )}
        {sync.error && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {errorMessage(sync.error)}
          </p>
        )}
        {preview.data && (
          <>
            <p className="mt-4 text-sm text-ok">{preview.data.message}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="border border-line p-3">
                <p className="text-xs text-muted">Позицій у фіді</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">
                  {preview.data.totalItems}
                </p>
              </div>
              <div className="border border-line p-3">
                <p className="text-xs text-muted">Варіантів взуття</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">
                  {preview.data.shoeVariants}
                </p>
              </div>
              <div className="border border-line p-3">
                <p className="text-xs text-muted">Модельних карток</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">
                  {preview.data.distinctModels}
                </p>
              </div>
            </div>
            {preview.data.sample.length > 0 && (
              <div className="mt-4 overflow-x-auto border border-line">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-soft text-xs text-muted">
                    <tr>
                      <th className="px-3 py-2 font-medium">Модель</th>
                      <th className="px-3 py-2 font-medium">Бренд</th>
                      <th className="px-3 py-2 font-medium">Розмір</th>
                      <th className="px-3 py-2 font-medium">Ціна</th>
                      <th className="px-3 py-2 font-medium">Залишок</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.data.sample.map((item) => (
                      <tr key={item.externalId} className="border-t border-line">
                        <td className="px-3 py-2">{item.name}</td>
                        <td className="px-3 py-2">{item.categoryName}</td>
                        <td className="px-3 py-2 tabular-nums">{item.size}</td>
                        <td className="px-3 py-2 tabular-nums">{PRICE.format(item.priceUah)}</td>
                        <td className="px-3 py-2 tabular-nums">
                          {item.available ? item.quantity : 0} шт.
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="px-3 py-2 text-xs text-muted">
                  Показано до 20 позицій для перевірки. Перегляд не змінює каталог.
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {sync.data && (
        <Section title="Останній результат" description={sync.data.message}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="text-xs text-muted">Створено товарів</p>
              <p className="text-lg font-semibold tabular-nums">{sync.data.createdProducts}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Створено варіантів</p>
              <p className="text-lg font-semibold tabular-nums">{sync.data.createdVariants}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Змін залишків</p>
              <p className="text-lg font-semibold tabular-nums">{sync.data.stockChanges}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Відсутніх варіантів</p>
              <p className="text-lg font-semibold tabular-nums">{sync.data.absentVariants}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Приховано товарів</p>
              <p className="text-lg font-semibold tabular-nums">{sync.data.hiddenProducts}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Позицій оброблено</p>
              <p className="text-lg font-semibold tabular-nums">{sync.data.totalItems}</p>
            </div>
          </div>
        </Section>
      )}

      <div className="mt-6">
        <Section
          title="Історія синхронізацій"
          description="Останні 20 запусків; помилки зберігаються без URL фіду чи ключів доступу."
        >
          {runs.isPending ? (
            <PageSpinner />
          ) : runs.isError ? (
            <ErrorState error={runs.error} onRetry={() => void runs.refetch()} />
          ) : runs.data.length === 0 ? (
            <p className="text-sm text-muted">Запусків ще не було.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead className="bg-soft text-xs text-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">Початок</th>
                    <th className="px-3 py-2 font-medium">Статус</th>
                    <th className="px-3 py-2 font-medium">Позицій</th>
                    <th className="px-3 py-2 font-medium">Приховано товарів</th>
                    <th className="px-3 py-2 font-medium">Повідомлення</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.data.map((run) => (
                    <tr key={run.id} className="border-t border-line align-top">
                      <td className="px-3 py-2 whitespace-nowrap">{dateTime(run.startedAt)}</td>
                      <td className="px-3 py-2">
                        <RunStatus status={run.status} />
                      </td>
                      <td className="px-3 py-2 tabular-nums">{run.importedCount}</td>
                      <td className="px-3 py-2 tabular-nums">{run.hiddenCount}</td>
                      <td className="max-w-xs px-3 py-2 text-muted">
                        {run.errorMessage ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </div>
    </>
  );
}
