import { formatNumber } from '../../utils/validation'

function Dato({ label, value, tone = 'text-ink' }) {
  return (
    <div className="rounded-md border border-border bg-white p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-0.5 font-display text-2xl font-bold ${tone}`}>{formatNumber(value)}</p>
    </div>
  )
}

/** HU-017: personas dentro del evento ahora y movimientos registrados en el día. */
export default function AforoResumen({ aforo, compacto = false }) {
  if (!aforo) return null
  const capacidad = aforo.capacidad || 0
  const porcentaje = capacidad ? Math.min(100, Math.round((aforo.dentro / capacidad) * 100)) : 0
  return (
    <div className="space-y-3">
      <div className="rounded-md bg-navy p-4 text-white">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Dentro del evento ahora</p>
        <p className="mt-1 font-display text-4xl font-bold">
          {formatNumber(aforo.dentro)}
          {capacidad > 0 && <span className="text-lg font-semibold text-slate-300"> / {formatNumber(capacidad)}</span>}
        </p>
        {capacidad > 0 && (
          <div className="mt-2 h-2 overflow-hidden rounded-sm bg-white/15">
            <div className={`h-full ${porcentaje >= 90 ? 'bg-red-400' : 'bg-teal'}`} style={{ width: `${porcentaje}%` }} />
          </div>
        )}
      </div>
      <div className={`grid gap-2 ${compacto ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'}`}>
        <Dato label="Ingresos" value={aforo.ingresos} tone="text-emerald-700" />
        <Dato label="Reingresos" value={aforo.reingresos} tone="text-teal-dark" />
        <Dato label="Salidas" value={aforo.salidas} tone="text-slate-700" />
        {!compacto && <Dato label="Entradas del día" value={aforo.entradasDelDia} />}
      </div>
    </div>
  )
}
