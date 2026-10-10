import { localDay } from '../../utils/format'

/** Filtro por día o rango de días de los historiales del personal (ventas, recargas). */
export default function RangoDiasFiltro({ desde, hasta, onChange }) {
  const rapidos = [
    ['Hoy', localDay(), localDay()],
    ['Ayer', localDay(-1), localDay(-1)],
    ['7 días', localDay(-6), localDay()],
  ]

  return (
    <div className="grid gap-2 rounded-xl border border-border bg-white p-3">
      <div className="flex gap-2">
        {rapidos.map(([label, d, h]) => {
          const activo = desde === d && hasta === h
          return (
            <button
              key={label}
              type="button"
              className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-semibold ${
                activo ? 'border-teal bg-teal/10 text-teal-dark' : 'border-border text-muted'
              }`}
              onClick={() => onChange(d, h)}
            >
              {label}
            </button>
          )
        })}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-muted">
          Desde
          <input type="date" className="input mt-1 !py-1.5 text-sm" value={desde} max={hasta} onChange={(e) => onChange(e.target.value, hasta)} />
        </label>
        <label className="text-xs text-muted">
          Hasta
          <input type="date" className="input mt-1 !py-1.5 text-sm" value={hasta} min={desde} max={localDay()} onChange={(e) => onChange(desde, e.target.value)} />
        </label>
      </div>
    </div>
  )
}
