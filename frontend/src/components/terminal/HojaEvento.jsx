import { useState } from 'react'
import { IconCheck, IconSearch } from '../ui/icons'

/** Hoja para elegir el evento del puesto. `descripcion` arma la línea de fecha. */
export default function HojaEvento({ abierto, eventos, seleccionadoId, descripcion, onElegir, onCerrar }) {
  const [q, setQ] = useState('')

  if (!abierto) return null

  const texto = q.trim().toLowerCase()
  const lista = texto ? eventos.filter((e) => e.titulo.toLowerCase().includes(texto)) : eventos

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center" onClick={onCerrar}>
      <div
        className="max-h-[85vh] w-full max-w-md overflow-auto rounded-t-xl bg-surface p-4 sm:rounded-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="hoja-evento-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="hoja-evento-titulo" className="font-display text-lg font-bold text-ink">
          Selecciona un evento
        </h2>
        <div className="relative mt-3">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            className="input !pl-9"
            value={q}
            placeholder="Buscar evento"
            autoComplete="off"
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <ul className="mt-3 divide-y divide-border">
          {lista.map((evento) => {
            const activo = evento.id === seleccionadoId
            return (
              <li key={evento.id}>
                <button
                  type="button"
                  className="flex w-full items-start justify-between gap-3 py-3 text-left"
                  onClick={() => onElegir(evento.id)}
                >
                  <span className="min-w-0">
                    <span className={`block font-semibold ${activo ? 'text-primary' : 'text-ink'}`}>{evento.titulo}</span>
                    {descripcion && <span className="mt-0.5 block text-xs text-muted">{descripcion(evento)}</span>}
                  </span>
                  {activo && <IconCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />}
                </button>
              </li>
            )
          })}
          {!lista.length && <li className="py-6 text-center text-sm text-muted">Ningún evento con ese nombre.</li>}
        </ul>
        <button type="button" className="btn-secondary mt-2 w-full" onClick={onCerrar}>
          Cerrar
        </button>
      </div>
    </div>
  )
}
