export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

export function ProductCardSkeleton() {
  return (
    <div aria-hidden="true">
      <Skeleton className="aspect-[3/4] w-full" />
      <Skeleton className="mt-3 h-3 w-1/3" />
      <Skeleton className="mt-2 h-3.5 w-4/5" />
      <Skeleton className="mt-2 h-3.5 w-1/2" />
    </div>
  );
}

export function ProductGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-6" role="status" aria-label="Завантаження">
      {Array.from({ length: count }, (_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}
