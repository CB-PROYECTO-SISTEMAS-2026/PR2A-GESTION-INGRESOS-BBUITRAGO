import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getAccesosHoy } from '../../api/acceso.api'
import { IconCalendar, IconMapPin } from '../../components/ui/icons'
import AforoResumen from '../../components/acceso/AforoResumen'
import { eventImage, formatDay, getErrorMessage } from '../../utils/format'
import { tipoAccesoLabel } from '../../utils/labels'

const REFRESH_MS = 20_000

/** HU-017: aforo en tiempo real de los eventos que se realizan hoy. */
export default function AccesosAdminPage() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    const load = () =>
      getAccesosHoy()
        .then(({ data: res }) => {
          if (!alive) return
          setData(res)
          setError('')
        })
        .catch((err) => alive && setError(getErrorMessage(err)))
    load()
    const timer = setInterval(load, REFRESH_MS)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [])

  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="font-display text-3xl font-bold text-ink">Accesos</h1>
        <p className="mt-1 text-sm text-muted">
          Aforo en tiempo real de los eventos de hoy{data ? ` (${formatDay(data.hoy, { weekday: 'long', day: 'numeric', month: 'long' })})` : ''}. Para asignar
          supervisores o ver el registro completo entra a la pestaña Control de acceso de cada evento.
        </p>
      </div>

      {error && <p className="text-red-600">{error}</p>}
      {!data && !error && <p className="text-muted">Cargando…</p>}

      {data && !data.eventos.length && (
        <div className="card-surface flex flex-col items-center gap-2 p-10 text-center">
          <IconCalendar className="h-10 w-10 text-slate-300" />
          <p className="font-semibold text-ink">Hoy no se realiza ningún evento publicado</p>
          <Link to="/admin/eventos" className="text-sm font-semibold text-teal-dark hover:underline">
            Ver eventos
          </Link>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {data?.eventos.map(({ evento, aforo }) => (
          <article key={evento.id} className="card-surface overflow-hidden">
            <div className="flex items-center gap-4 border-b border-border p-4">
              <img src={eventImage(evento)} alt="" className="h-14 w-20 rounded-md object-cover" />
              <div className="min-w-0 flex-1">
                <h2 className="truncate font-display text-lg font-bold text-ink">{evento.titulo}</h2>
                <p className="flex flex-wrap gap-x-3 text-xs text-muted">
                  <span className="inline-flex items-center gap-1">
                    <IconMapPin className="h-3.5 w-3.5" />
                    {evento.ubicacion}
                  </span>
                  <span>{tipoAccesoLabel(evento.tipoAcceso)}</span>
                  {aforo.fecha && (
                    <span>
                      {aforo.fecha.horaInicio} – {aforo.fecha.horaFin}
                    </span>
                  )}
                </p>
              </div>
              <Link to={`/admin/eventos/${evento.id}/acceso`} className="btn-secondary btn-sm">
                Detalle
              </Link>
            </div>
            <div className="p-4">
              <AforoResumen aforo={aforo} />
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
