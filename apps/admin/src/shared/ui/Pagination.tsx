import { Button } from "./Button";

export function Pagination({
  page,
  limit,
  total,
  onPage,
}: {
  page: number;
  limit: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (total === 0) return null;
  const from = (page - 1) * limit + 1;
  const to = Math.min(total, page * limit);
  return (
    <nav
      aria-label="Сторінки"
      className="flex flex-wrap items-center justify-between gap-3 text-sm"
    >
      <span className="text-muted">
        {from}–{to} з {total}
      </span>
      <div className="flex items-center gap-2">
        <Button size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          ← Назад
        </Button>
        <span className="tabular-nums">
          {page} / {pages}
        </span>
        <Button size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Далі →
        </Button>
      </div>
    </nav>
  );
}
