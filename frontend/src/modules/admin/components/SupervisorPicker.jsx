import { useEffect, useState } from 'react'
import { getCandidatosSupervisor } from '../../../api/manillas.api'
import { IconPlus, IconSearch, IconX } from '../../../components/ui/icons'
import { getErrorMessage } from '../../../utils/format'

const SEARCH_DELAY_MS = 300

/** Busca usuarios con rol Encargado de acceso que aún no atienden el punto y permite asignar uno. */
export default function SupervisorPicker({ puntoId, onPick, disabled }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [candidatos, setCandidatos] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return undefined
    let alive = true
    setLoading(true)
    const timer = setTimeout(() => {
      getCandidatosSupervisor(puntoId, q.trim())
        .then(({ data }) => {
          if (!alive) return
          setCandidatos(data.candidatos ?? [])
          setError('')
        })
        .catch((err) => alive && setError(getErrorMessage(err)))
        .finally(() => alive && setLoading(false))
    }, SEARCH_DELAY_MS)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [open, q, puntoId])

  if (!open) {
    return (
      <button type="button" className="btn-secondary btn-sm" onClick={() => setOpen(true)} disabled={disabled}>
        <IconPlus />
        Asignar supervisor
      </button>
    )
  }

  return (
    <div className="rounded-md border border-border bg-page/60 p-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            className="input !pl-9"
            placeholder="Buscar por nombre o correo"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            maxLength={100}
            autoFocus
            aria-label="Buscar supervisor"
          />
        </div>
        <button
          type="button"
          className="rounded-md p-2 text-muted hover:bg-slate-100 hover:text-ink"
          onClick={() => {
            setOpen(false)
            setQ('')
          }}
          aria-label="Cerrar búsqueda"
        >
          <IconX />
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <ul className={`mt-2 max-h-52 overflow-y-auto ${loading ? 'opacity-60' : ''}`}>
        {candidatos.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 rounded px-2 py-2 text-left text-sm hover:bg-white"
              onClick={async () => {
                const ok = await onPick(c)
                if (ok) {
                  setOpen(false)
                  setQ('')
                }
              }}
              disabled={disabled}
            >
              <span className="min-w-0">
                <span className="block truncate font-semibold text-ink">{c.nombre}</span>
                <span className="block truncate text-xs text-muted">{c.email}</span>
              </span>
              <IconPlus className="h-4 w-4 shrink-0 text-teal-dark" />
            </button>
          </li>
        ))}
        {!loading && !candidatos.length && !error && (
          <li className="px-2 py-3 text-sm text-muted">
            No hay encargados de acceso disponibles. Invítalos desde Usuarios con el rol Encargado de acceso.
          </li>
        )}
      </ul>
    </div>
  )
}
