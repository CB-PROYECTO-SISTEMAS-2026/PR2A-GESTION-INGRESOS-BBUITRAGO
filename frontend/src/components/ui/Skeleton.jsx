/** Placeholders de carga. Usar en todas las vistas cliente al esperar datos. */
export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-md bg-border/80 ${className}`} aria-hidden="true" />
}

export function SkeletonText({ lines = 3, className = '' }) {
  return (
    <div className={`space-y-2 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={`h-3 ${i === lines - 1 ? 'w-[66%]' : 'w-full'}`} />
      ))}
    </div>
  )
}

export function SkeletonCard({ className = '' }) {
  return (
    <div className={`overflow-hidden rounded-2xl border border-border bg-surface ${className}`} aria-busy="true">
      <Skeleton className="aspect-[4/5] w-full rounded-none" />
      <div className="space-y-2 p-4">
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-3 w-2/5" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  )
}

export function SkeletonGrid({ count = 6, className = '' }) {
  return (
    <div
      className={`grid gap-5 sm:grid-cols-2 lg:grid-cols-3 ${className}`}
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Cargando…</span>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}

export default Skeleton
