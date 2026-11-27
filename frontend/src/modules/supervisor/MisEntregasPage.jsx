import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getMisEntregas, getMisPuntos } from '../../api/manillas.api'
import PendingRegion from '../../components/ui/PendingRegion'
import { formatDateTime, formatDay, getErrorMessage } from '../../utils/format'

/** Historial de manillas que entregó el supervisor, con el punto de cada entrega. */
export default function MisEntregasPage() {
  const [puntos, setPuntos] = useState([])
  const [puntoId, setPuntoId] = useState('')
  const [entregas, setEntregas] = useState(null)
  const [error, setError] = useState('')
  const [actualizando, setActualizando] = useState(false)

  useEffect(() => {
    getMisPuntos()
      .then(({ data }) => setPuntos(data.puntos ?? []))
      .catch(() => setPuntos([]))
  }, [])

  useEffect(() => {
    let alive = true
    setActualizando(true)
    getMisEntregas(puntoId)
      .then(({ data }) => {
        if (!alive) return
        setEntregas(data.entregas ?? [])
        setError('')
      })
      .catch((err) => alive && setError(getErrorMessage(err)))
      .finally(() => {
        if (alive) setActualizando(false)
      })
    return () => {
      alive = false
    }
  }, [puntoId])

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-xl font-bold text-ink">Mis entregas</h1>
        <Link to="/supervisor/manillas" className="text-sm font-semibold text-primary">
          Volver
        </Link>
      </div>

      {puntos.length > 1 && (
        <label className="label">
          Punto
          <select
            className="input"
            value={puntoId}
            onChange={(e) => {
              setPuntoId(e.target.value)
              setActualizando(true)
            }}
            aria-label="Filtrar por punto"
          >
            <option value="">Todos los puntos</option>
            {puntos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.evento.titulo} — {p.nombre}
              </option>
            ))}
          </select>
        </label>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}
      {!entregas && !error && (
        <p className="text-sm text-muted" role="status">
          Cargando entregas…
        </p>
      )}

      {entregas && (
        <PendingRegion pending={actualizando} >
          <ul className="grid gap-2">
            {entregas.map((m) => (
              <li key={m.id} className="rounded-xl border border-border bg-white p-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 truncate font-semibold text-ink">{m.cliente?.nombre ?? '—'}</p>
                  <p className="shrink-0 text-xs text-muted">{formatDateTime(m.entregadaAt)}</p>
                </div>
                {m.cliente?.email && <p className="truncate text-xs text-muted">{m.cliente.email}</p>}
                <p className="mt-2 font-mono text-xs text-ink">{m.codigoManilla}</p>
                <p className="text-sm text-ink">
                  {m.entrada?.categoria}
                  <span className="text-muted">
                    {' '}
                    · {m.entrada?.fecha ? formatDay(m.entrada.fecha) : 'Todos los días'}
                  </span>
                </p>
                <p className="text-xs text-muted">{m.puntoRetiro?.nombre ?? '—'}</p>
              </li>
            ))}
            {!entregas.length && (
              <li className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">
                Aún no entregaste ninguna manilla.
              </li>
            )}
          </ul>
        </PendingRegion>
      )}
    </div>
  )
}
