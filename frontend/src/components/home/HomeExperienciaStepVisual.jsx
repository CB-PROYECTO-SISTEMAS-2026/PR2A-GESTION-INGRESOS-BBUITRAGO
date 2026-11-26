export default function StepVisual({ stepId, compact = false }) {
  const compactCls = compact ? 'scale-[0.85] origin-center' : ''

  switch (stepId) {
    case 'descubre':
      return (
        <div className={`grid grid-cols-2 gap-1.5 ${compactCls}`} aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="aspect-[4/3] rounded-md border border-border bg-primary-soft/60" />
          ))}
        </div>
      )
    case 'elige':
      return (
        <div
          className={`rounded-lg border border-border bg-surface p-2 shadow-sm ${compactCls}`}
          aria-hidden="true"
        >
          <div className="h-14 rounded-md bg-primary-soft" />
          <div className="mt-2 h-2 w-2/3 rounded bg-border" />
          <div className="mt-1 h-2 w-1/3 rounded bg-primary/30" />
        </div>
      )
    case 'paga':
      return (
        <div className={`flex items-center gap-2 ${compactCls}`} aria-hidden="true">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-dashed border-primary bg-primary-soft">
            <span className="font-display text-[8px] font-bold text-primary">QR</span>
          </div>
          <div className="min-w-0 flex-1 rounded-md border border-border bg-surface p-1.5">
            <div className="h-1.5 w-full rounded bg-border" />
            <div className="mt-1 h-4 rounded bg-primary/15" />
          </div>
        </div>
      )
    case 'tu-qr':
      return (
        <div
          className={`mx-auto flex h-20 w-20 items-center justify-center rounded-xl border border-border bg-surface ${compactCls}`}
          aria-hidden="true"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-md bg-ink text-[7px] font-semibold text-surface">
            QR
          </div>
        </div>
      )
    case 'entra':
      return (
        <div
          className={`flex items-center justify-center gap-2 rounded-lg border border-success/30 bg-success-soft px-3 py-4 ${compactCls}`}
          aria-hidden="true"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-success text-xs font-bold text-surface">
            ✓
          </span>
          <span className="text-xs font-semibold text-ink">Válido</span>
        </div>
      )
    case 'cashless':
      return (
        <div className={`flex gap-1.5 ${compactCls}`} aria-hidden="true">
          <div className="flex-1 rounded-lg border border-border bg-sidebar px-2 py-3 text-center">
            <div className="mx-auto h-2 w-10 rounded-full bg-primary-focus/80" />
          </div>
          <div className="flex flex-1 flex-col justify-center rounded-lg border border-border bg-surface p-2">
            <div className="rounded bg-primary px-1 py-1 text-center text-[8px] font-semibold text-surface">POS</div>
          </div>
        </div>
      )
    case 'cierra':
      return (
        <div
          className={`rounded-lg border border-border bg-surface px-3 py-4 text-center ${compactCls}`}
          aria-hidden="true"
        >
          <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-primary-soft font-display text-sm font-bold text-primary">
            ↩
          </div>
        </div>
      )
    default:
      return null
  }
}