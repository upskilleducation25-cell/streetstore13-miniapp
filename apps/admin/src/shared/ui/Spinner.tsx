export function Spinner({ small = false, label }: { small?: boolean; label?: string }) {
  const size = small ? "h-3.5 w-3.5" : "h-6 w-6";
  return (
    <span role="status" className="inline-flex items-center gap-2 text-sm text-muted">
      <span
        className={`${size} animate-spin rounded-full border-2 border-current border-t-transparent`}
      />
      {label ? <span>{label}</span> : <span className="sr-only">Завантаження</span>}
    </span>
  );
}

export function PageSpinner() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Spinner label="Завантаження…" />
    </div>
  );
}
