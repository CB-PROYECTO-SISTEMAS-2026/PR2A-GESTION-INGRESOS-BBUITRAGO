import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getEventById } from '../../api/events.api'
import { useAuth } from '../../context/AuthContext'
import CronogramaView from '../../components/event/CronogramaView'
import { IconCalendar, IconCheck, IconChevronLeft, IconClock, IconExternal, IconMapPin, IconTicket } from '../../components/ui/icons'
import {
  asCronograma,
  asList,
  eventDayRange,
  eventImage,
  formatBs,
  formatDay,
  formatHorario,
  getErrorMessage,
} from '../../utils/format'
import { tipoAccesoLabel } from '../../utils/labels'

function Info({ icon: Icon, children }) {
  return (
    <div className="flex items-start gap-3 text-sm text-slate-700">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-teal-dark" />
      <div>{children}</div>
    </div>
  )
}

export default function EventDetailPage() {
  const { id } = useParams()
  const { isAuthenticated } = useAuth()
  const [evento, setEvento] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    getEventById(id)
      .then(({ data }) => alive && setEvento(data?.data ?? data))
      .catch((err) => alive && setError(getErrorMessage(err, 'Evento no encontrado')))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [id])

  if (loading) {
    return <div className="mx-auto max-w-6xl px-4 py-12 text-muted">Cargando evento…</div>
  }

  if (error || !evento) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12">
        <p className="text-red-600">{error || 'Evento no encontrado'}</p>
        <Link to="/eventos" className="mt-4 inline-block font-semibold text-teal-dark">
          Volver a eventos
        </Link>
      </div>
    )
  }

  const categorias = evento.categorias ?? []
  const fechas = evento.fechas ?? []
  const cronograma = asCronograma(evento.cronograma)
  const servicios = asList(evento.servicios)
  const multiDia = fechas.length > 1

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link to="/eventos" className="inline-flex items-center gap-1 text-sm font-semibold text-teal-dark hover:underline">
        <IconChevronLeft />
        Eventos
      </Link>

      <div className="mt-4 overflow-hidden rounded-lg border border-border bg-white">
        <div className="grid lg:grid-cols-2">
          <img src={eventImage(evento)} alt={evento.titulo} className="h-64 min-h-[16rem] w-full object-cover lg:h-full" />
          <div className="space-y-5 p-6 md:p-8">
            <h1 className="font-display text-3xl font-bold text-ink md:text-4xl">{evento.titulo}</h1>
            <p className="whitespace-pre-line text-slate-600">{evento.descripcion}</p>
            <div className="space-y-3">
              <Info icon={IconCalendar}>{eventDayRange(evento)}</Info>
              {fechas[0] && <Info icon={IconClock}>{formatHorario(fechas[0].horaInicio, fechas[0].horaFin)}</Info>}
              <Info icon={IconMapPin}>
                <p>{evento.ubicacion}</p>
                {evento.ubicacionUrl && (
                  <a
                    href={evento.ubicacionUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-0.5 inline-flex items-center gap-1 font-semibold text-teal-dark hover:underline"
                  >
                    Cómo llegar
                    <IconExternal className="h-3.5 w-3.5" />
                  </a>
                )}
              </Info>
              {evento.tipoAcceso && <Info icon={IconTicket}>Acceso: {tipoAccesoLabel(evento.tipoAcceso)}</Info>}
            </div>
            {isAuthenticated ? (
              <a href="#entradas" className="btn-primary">
                Ver entradas
              </a>
            ) : (
              <Link to={`/login?redirect=/eventos/${id}`} className="btn-primary">
                Inicia sesión para comprar
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {cronograma && (
            <section className="card-surface p-6">
              <h2 className="font-display text-xl font-semibold text-ink">Cronograma</h2>
              <div className="mt-5">
                <CronogramaView cronograma={cronograma} />
              </div>
            </section>
          )}

          {servicios.length > 0 && (
            <section className="card-surface p-6">
              <h2 className="font-display text-xl font-semibold text-ink">Servicios</h2>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {servicios.map((s) => (
                  <li key={s} className="flex items-center gap-2 text-sm text-slate-700">
                    <IconCheck className="h-4 w-4 shrink-0 text-teal" />
                    {s}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <section id="entradas" className="card-surface scroll-mt-24 p-6">
          <h2 className="font-display text-xl font-semibold text-ink">Entradas</h2>
          <div className="mt-4 space-y-3">
            {categorias.map((c) => {
              const beneficios = asList(c.beneficios)
              const dias = multiDia
                ? (c.fechasDisponibles || [])
                    .map((fd) => fechas.find((f) => f.id === fd.fechaId))
                    .filter(Boolean)
                : []
              return (
                <div key={c.id} className="rounded-md border border-border p-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="font-semibold text-ink">{c.nombre}</p>
                    <p className="font-bold text-teal-dark">{formatBs(c.precio)}</p>
                  </div>
                  {dias.length > 0 && dias.length < fechas.length && (
                    <p className="mt-1 text-xs font-medium text-muted">
                      {dias.map((f) => formatDay(f.fecha, { weekday: 'short', day: 'numeric', month: 'short' })).join(' · ')}
                    </p>
                  )}
                  {beneficios.length > 0 && (
                    <ul className="mt-3 space-y-1.5">
                      {beneficios.map((b) => (
                        <li key={b} className="flex items-start gap-2 text-sm text-slate-600">
                          <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal" />
                          {b}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
            {!categorias.length && <p className="text-sm text-muted">Las entradas estarán disponibles pronto.</p>}
          </div>
        </section>
      </div>
    </div>
  )
}
