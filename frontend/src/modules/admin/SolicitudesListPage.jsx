import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getSolicitudes } from '../../api/events.api'
import { IconEye } from '../../components/ui/icons'
import { formatDayRange, getErrorMessage } from '../../utils/format'
import { estadoBadgeClass, estadoLabel } from '../../utils/labels'

const FILTERS = [
  ['PENDIENTE', 'Pendientes'],
  ['APROBADA', 'Aprobadas'],
  ['EVENTO_CREADO', 'Con evento creado'],
  ['RECHAZADA', 'Rechazadas'],
  ['TODAS', 'Todas'],
]

export default function SolicitudesListPage() {
  const [estado, setEstado] = useState('PENDIENTE')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    setLoading(true)
    getSolicitudes(estado === 'TODAS' ? {} : { estado })
      .then(({ data }) => {
        if (!alive) return
        setItems(Array.isArray(data) ? data : data?.data ?? [])
        setError('')
      })
      .catch((err) => alive && setError(getErrorMessage(err)))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [estado])

  return (
    <div className="p-8">
      <h1 className="font-display text-3xl font-bold text-ink">Solicitudes de evento</h1>
      <div className="mt-6 flex flex-wrap gap-6 border-b border-border">
        {FILTERS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setEstado(key)}
            className={`-mb-px border-b-2 px-1 pb-3 text-sm font-semibold transition ${
              estado === key ? 'border-teal text-ink' : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {loading ? (
        <p className="mt-6 text-muted">Cargando…</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-md border border-border">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-page text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Evento</th>
                <th className="px-4 py-3 font-semibold">Organizador</th>
                <th className="px-4 py-3 font-semibold">Fechas</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id} className="border-t border-border hover:bg-page/60">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-ink">{s.nombreEvento}</p>
                    <p className="text-xs text-muted">{s.ubicacion}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {[s.organizador?.nombre, s.organizador?.apellido].filter(Boolean).join(' ') || '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDayRange(s.fechaInicio, s.fechaFin)}</td>
                  <td className="px-4 py-3">
                    <span className={`whitespace-nowrap badge ${estadoBadgeClass(s.estado)}`}>
                      {estadoLabel(s.estado)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/admin/solicitudes/${s.id}`} className="btn-secondary btn-sm">
                      <IconEye />
                      Ver
                    </Link>
                  </td>
                </tr>
              ))}
              {!items.length && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted">
                    No hay solicitudes en esta lista.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
