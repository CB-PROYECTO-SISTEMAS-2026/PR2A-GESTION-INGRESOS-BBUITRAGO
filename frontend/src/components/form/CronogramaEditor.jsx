import { IconPlus, IconTrash } from '../ui/icons'

export const MAX_ACTIVIDADES = 30

let nextKey = 1
const newActividad = (hora = '', actividad = '') => ({ key: nextKey++, hora, actividad })

/** Actividades guardadas en la forma editable (con claves para React). */
export function toEditableActividades(cronograma) {
  return (cronograma?.actividades || []).map((a) => newActividad(a.hora, a.actividad))
}

/** La apertura y el cierre los fija el backend con la hora de inicio y fin del evento. */
export function toCronogramaPayload(actividades) {
  return {
    actividades: actividades
      .map((a) => ({ hora: a.hora, actividad: a.actividad.trim().replace(/\s+/g, ' ') }))
      .sort((a, b) => a.hora.localeCompare(b.hora)),
  }
}

export function fueraDeHorario(hora, apertura, cierre) {
  return Boolean(hora && apertura && cierre && (hora < apertura || hora > cierre))
}

/** Por hora; las filas sin hora quedan al final en el orden en que se agregaron. */
function ordenar(actividades) {
  return [...actividades].sort((a, b) => {
    if (!a.hora) return b.hora ? 1 : 0
    if (!b.hora) return -1
    return a.hora.localeCompare(b.hora)
  })
}

function FilaFija({ hora, label }) {
  return (
    <li className="flex items-center gap-3 bg-page px-4 py-3">
      <span className="w-32 shrink-0 pl-2.5 font-semibold tabular-nums text-ink">{hora || '--:--'}</span>
      <span className="font-semibold text-ink">{label}</span>
    </li>
  )
}

/**
 * Apertura y cierre reflejan el horario del evento; entre ambos van las actividades,
 * ordenadas por hora.
 */
export default function CronogramaEditor({ id, actividades, apertura, cierre, onChange }) {
  const update = (key, patch) => onChange(actividades.map((a) => (a.key === key ? { ...a, ...patch } : a)))

  const reordenar = () => {
    const sorted = ordenar(actividades)
    if (sorted.some((a, i) => a !== actividades[i])) onChange(sorted)
  }

  const agregar = () => {
    if (actividades.length >= MAX_ACTIVIDADES) return
    onChange([...ordenar(actividades), newActividad()])
  }

  return (
    <div id={id} tabIndex={-1} className="outline-none">
      <ol className="divide-y divide-border overflow-hidden rounded-md border border-border">
        <FilaFija hora={apertura} label="Apertura de puertas" />

        {actividades.map((a, index) => {
          const fuera = fueraDeHorario(a.hora, apertura, cierre)
          return (
            <li key={a.key} className="px-4 py-2.5">
              <div className="flex items-center gap-3">
                <input
                  type="time"
                  className={`input w-32 shrink-0 px-2.5 tabular-nums ${fuera ? 'border-red-500' : ''}`}
                  value={a.hora}
                  onChange={(e) => update(a.key, { hora: e.target.value })}
                  onBlur={reordenar}
                  aria-label={`Hora de la actividad ${index + 1}`}
                  aria-invalid={fuera}
                  required
                />
                <input
                  className="input min-w-0 flex-1"
                  value={a.actividad}
                  maxLength={120}
                  placeholder="Actividad"
                  onChange={(e) => update(a.key, { actividad: e.target.value })}
                  aria-label={`Descripción de la actividad ${index + 1}`}
                  required
                />
                <button
                  type="button"
                  onClick={() => onChange(actividades.filter((x) => x.key !== a.key))}
                  className="shrink-0 rounded p-2 text-muted transition hover:bg-red-50 hover:text-red-600"
                  aria-label={`Quitar actividad ${index + 1}`}
                >
                  <IconTrash />
                </button>
              </div>
              {fuera && (
                <p className="field-error mt-1.5">
                  Debe estar entre {apertura} y {cierre}.
                </p>
              )}
            </li>
          )
        })}

        <li className="px-4 py-2.5">
          <button
            type="button"
            onClick={agregar}
            disabled={actividades.length >= MAX_ACTIVIDADES}
            className="inline-flex items-center gap-2 py-1.5 text-sm font-semibold text-teal-dark transition hover:text-navy disabled:cursor-not-allowed disabled:opacity-50"
          >
            <IconPlus />
            Agregar actividad
          </button>
        </li>

        <FilaFija hora={cierre} label="Cierre del evento" />
      </ol>
    </div>
  )
}
