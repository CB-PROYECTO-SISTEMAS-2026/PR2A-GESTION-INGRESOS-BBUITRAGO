import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getAllEventsAdmin, getSolicitudes } from '../../api/events.api'
import { getUsuarios } from '../../api/adminUsers.api'
import { IconChevronRight } from '../../components/ui/icons'
import { eventDayRange, formatDate, getErrorMessage } from '../../utils/format'
import { estadoBadgeClass, estadoLabel } from '../../utils/labels'
import { formatNumber } from '../../utils/validation'

function Stat({ to, label, value }) {
  return (
    <Link to={to} className="card-surface block p-5 transition hover:border-slate-300">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 font-display text-3xl font-bold text-ink">{formatNumber(value)}</p>
    </Link>
  )
}

function pendientesDe(e) {
  const faltas = []
  if (!e.fotoUrl) faltas.push('imagen')
  if (!e.categorias?.length) faltas.push('categorías')
  return faltas
}

export default function AdminDashboardPage() {
  const [eventos, setEventos] = useState([])
  const [solicitudes, setSolicitudes] = useState([])
  const [totalUsuarios, setTotalUsuarios] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    Promise.all([getAllEventsAdmin(), getSolicitudes({ estado: 'PENDIENTE' }), getUsuarios({ page: 1 })])
      .then(([ev, sol, us]) => {
        if (!alive) return
        setEventos(Array.isArray(ev.data) ? ev.data : [])
        setSolicitudes(Array.isArray(sol.data) ? sol.data : [])
        setTotalUsuarios(us.data?.total ?? 0)
      })
      .catch((err) => alive && setError(getErrorMessage(err)))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [])

  const publicados = eventos.filter((e) => e.estado === 'PUBLICADO').length
  const porCompletar = eventos.filter((e) => e.estado === 'BORRADOR' && pendientesDe(e).length)

  return (
    <div className="p-8">
      <h1 className="font-display text-3xl font-bold text-ink">Panel Administrador</h1>
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="mt-6 text-muted">Cargando…</p>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat to="/admin/solicitudes" label="Solicitudes por revisar" value={solicitudes.length} />
            <Stat to="/admin/eventos" label="Eventos publicados" value={publicados} />
            <Stat to="/admin/eventos" label="Eventos en total" value={eventos.length} />
            <Stat to="/admin/usuarios" label="Usuarios" value={totalUsuarios} />
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <section className="card-surface p-6">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-bold text-ink">Solicitudes por revisar</h2>
                <Link to="/admin/solicitudes" className="text-sm font-semibold text-teal-dark hover:underline">
                  Ver todas
                </Link>
              </div>
              <ul className="mt-4 divide-y divide-border">
                {solicitudes.slice(0, 5).map((s) => (
                  <li key={s.id}>
                    <Link to={`/admin/solicitudes/${s.id}`} className="flex items-center justify-between gap-3 py-3 hover:text-teal-dark">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{s.nombreEvento}</p>
                        <p className="text-xs text-muted">
                          {[s.organizador?.nombre, s.organizador?.apellido].filter(Boolean).join(' ')} · enviada el {formatDate(s.createdAt)}
                        </p>
                      </div>
                      <IconChevronRight className="h-4 w-4 shrink-0 text-muted" />
                    </Link>
                  </li>
                ))}
                {!solicitudes.length && <p className="py-3 text-sm text-muted">No hay solicitudes pendientes.</p>}
              </ul>
            </section>

            <section className="card-surface p-6">
              <h2 className="font-display text-lg font-bold text-ink">Eventos por completar</h2>
              <ul className="mt-4 divide-y divide-border">
                {porCompletar.slice(0, 5).map((e) => (
                  <li key={e.id}>
                    <Link to={`/admin/eventos/${e.id}`} className="flex items-center justify-between gap-3 py-3 hover:text-teal-dark">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-semibold">{e.titulo}</p>
                          <span className={`shrink-0 badge ${estadoBadgeClass(e.estado)}`}>
                            {estadoLabel(e.estado)}
                          </span>
                        </div>
                        <p className="text-xs text-muted">
                          {eventDayRange(e)} · falta {pendientesDe(e).join(' y ')}
                        </p>
                      </div>
                      <IconChevronRight className="h-4 w-4 shrink-0 text-muted" />
                    </Link>
                  </li>
                ))}
                {!porCompletar.length && <p className="py-3 text-sm text-muted">Todos los borradores están completos.</p>}
              </ul>
            </section>
          </div>
        </>
      )}
    </div>
  )
}
