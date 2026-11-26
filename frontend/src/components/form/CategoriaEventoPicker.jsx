/** Selector de temáticas del evento (CategoriaEvento). No confundir con categorías de entrada. */
const MAX = 3

export default function CategoriaEventoPicker({
  options = [],
  value = [],
  onChange,
  error,
  id = 'categoriaEventoIds',
}) {
  const selected = new Set(value)

  const toggle = (optId) => {
    const next = new Set(selected)
    if (next.has(optId)) next.delete(optId)
    else if (next.size < MAX) next.add(optId)
    onChange([...next])
  }

  return (
    <div id={id}>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = selected.has(opt.id)
          const disabled = !active && selected.size >= MAX
          return (
            <button
              key={opt.id}
              type="button"
              disabled={disabled}
              aria-pressed={active}
              onClick={() => toggle(opt.id)}
              className={[
                'rounded-lg border px-3 py-1.5 text-sm font-semibold transition',
                active
                  ? 'border-teal bg-teal/10 text-teal-dark'
                  : 'border-border bg-surface text-ink hover:border-teal/50',
                disabled ? 'cursor-not-allowed opacity-40' : '',
              ].join(' ')}
            >
              {opt.nombre}
            </button>
          )
        })}
      </div>
      <p className="mt-1 text-xs text-muted">
        Elegí de 1 a {MAX} categorías del evento (temática). Esto no son las categorías de entrada (VIP/General).
      </p>
      {error && <p className="field-error mt-1">{error}</p>}
    </div>
  )
}

export function selectionIsMusical(options, selectedIds) {
  const set = new Set(selectedIds)
  return options.some((o) => set.has(o.id) && o.esMusical)
}
