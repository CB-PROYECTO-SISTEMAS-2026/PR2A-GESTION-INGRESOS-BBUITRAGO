export default function CronogramaView({ cronograma, dark = false }) {
  if (!cronograma) return null
  const rows = [
    { hora: cronograma.apertura, actividad: 'Apertura de puertas', fixed: true },
    ...cronograma.actividades.map((a) => ({ ...a, fixed: false })),
    { hora: cronograma.cierre, actividad: 'Cierre del evento', fixed: true },
  ]

  return (
    <ol className="relative space-y-3">
      <span
        className={`absolute bottom-2 left-[calc(4.875rem-0.5px)] top-2 w-px ${dark ? 'bg-white/15' : 'bg-border'}`}
        aria-hidden="true"
      />
      {rows.map((r, i) => (
        <li key={`${r.hora}-${i}`} className="relative flex items-center gap-4">
          <span className={`w-14 shrink-0 text-right font-mono text-sm font-semibold ${dark ? 'text-teal' : 'text-teal-dark'}`}>
            {r.hora}
          </span>
          <span
            className={`relative z-10 h-3 w-3 shrink-0 rounded-full ${
              r.fixed ? (dark ? 'bg-white' : 'bg-navy') : `border-2 border-teal ${dark ? 'bg-navy' : 'bg-white'}`
            }`}
          />
          <span className={`text-sm ${r.fixed ? 'font-semibold' : ''} ${dark ? 'text-white' : 'text-ink'}`}>{r.actividad}</span>
        </li>
      ))}
    </ol>
  )
}
