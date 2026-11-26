import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { getEventById } from '../../api/events.api'
import { useAuth } from '../../context/AuthContext'
import CronogramaView from '../../components/event/CronogramaView'
import MapaPreview from '../../components/MapaPreview'
import ShareSheet from '../../components/ui/ShareSheet'
import SpotifyEmbed, { parseSpotifyEmbed } from '../../components/ui/SpotifyEmbed'
import TicketPricing from '../../components/ui/TicketPricing'
import { Skeleton } from '../../components/ui/Skeleton'
import CompraEntradasModal from '../compras/CompraEntradasModal'
import { IconCalendar, IconCheck, IconChevronLeft, IconClock, IconExternal, IconMapPin, IconTicket } from '../../components/ui/icons'
import {
  asCronograma,
  asList,
  eventDayRange,
  eventImage,
  formatHorario,
  getErrorMessage,
} from '../../utils/format'
import { tipoAccesoLabel } from '../../utils/labels'

function Info({ icon: Icon, children }) {
  return (
    <div className="flex items-start gap-3 text-sm text-slate-700">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      <div>{children}</div>
    </div>
  )
}

export default function EventDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, hasRole } = useAuth()
  const [evento, setEvento] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [compraOpen, setCompraOpen] = useState(false)

  useEffect(() => {
    let alive = true
    setLoading(true)
    getEventById(id)
      .then(({ data }) => alive && setEvento(data?.data ?? data))
      .catch((err) => alive && setError(getErrorMessage(err, 'Evento no encontrado')))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [id])

  useEffect(() => {
    if (location.state?.openCompra && isAuthenticated && hasRole('CLIENTE')) {
      setCompraOpen(true)
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [location.state, location.pathname, isAuthenticated, hasRole, navigate])

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-12" aria-busy="true">
        <span className="sr-only">Cargando…</span>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-72 w-full rounded-lg" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-40 lg:col-span-2" />
          <Skeleton className="h-40" />
        </div>
      </div>
    )
  }

  if (error || !evento) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12">
        <p className="text-danger">{error || 'Evento no encontrado'}</p>
        <Link to="/eventos" className="mt-4 inline-block font-semibold text-primary">
          Volver a eventos
        </Link>
      </div>
    )
  }

  const categorias = evento.categorias ?? []
  const tematicas = (evento.categoriasEvento ?? [])
    .map((r) => r.categoriaEvento)
    .filter(Boolean)
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
  const fechas = evento.fechas ?? []
  const cronograma = asCronograma(evento.cronograma)
  const servicios = asList(evento.servicios)
  const canBuy = isAuthenticated && hasRole('CLIENTE') && categorias.length > 0
  const productora = evento.organizador?.nombreProductora?.trim()

  const onBuy = () => {
    if (!isAuthenticated) {
      navigate(`/login?redirect=/eventos/${id}`)
      return
    }
    if (canBuy) setCompraOpen(true)
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/eventos" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
          <IconChevronLeft />
          Eventos
        </Link>
        <ShareSheet
          url={typeof window !== 'undefined' ? window.location.href : ''}
          title={evento.titulo}
        />
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-border bg-surface">
        <div className="grid lg:grid-cols-2">
          <img
            src={eventImage(evento)}
            alt={evento.titulo}
            className="h-64 min-h-[16rem] w-full object-cover lg:h-full"
            width={800}
            height={600}
            fetchPriority="high"
          />
          <div className="space-y-5 p-6 md:p-8">
            <h1 className="text-balance font-display text-3xl font-bold text-ink md:text-4xl">{evento.titulo}</h1>
            {tematicas.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {tematicas.map((t) => (
                  <li
                    key={t.id || t.slug}
                    className="rounded-md border border-border bg-bg px-2.5 py-1 text-xs font-semibold text-slate-700"
                  >
                    {t.nombre}
                  </li>
                ))}
              </ul>
            )}
            {productora && <p className="text-sm text-muted">{productora}</p>}
            <p className="whitespace-pre-line text-pretty text-slate-600">{evento.descripcion}</p>
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
                    className="mt-0.5 inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                  >
                    Cómo llegar
                    <IconExternal className="h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                )}
              </Info>
              {evento.tipoAcceso && <Info icon={IconTicket}>Acceso: {tipoAccesoLabel(evento.tipoAcceso)}</Info>}
            </div>
            {canBuy ? (
              <button type="button" className="btn-primary" onClick={onBuy}>
                <IconTicket />
                Comprar entrada
              </button>
            ) : isAuthenticated ? (
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

      {evento.mapaUrl && (
        <section className="mt-6 card-surface p-6">
          <h2 className="font-display text-xl font-semibold text-ink">Mapa</h2>
          <div className="mt-4">
            <MapaPreview url={evento.mapaUrl} nombre={evento.mapaNombre} className="max-h-96" />
          </div>
        </section>
      )}

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
                    <IconCheck className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    {s}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {parseSpotifyEmbed(evento.spotifyUrl) && (
            <section className="card-surface p-6">
              <h2 className="font-display text-xl font-semibold text-ink">Música</h2>
              <div className="mt-4">
                <SpotifyEmbed url={evento.spotifyUrl} title={`${evento.titulo} en Spotify`} />
              </div>
            </section>
          )}
        </div>

        <section id="entradas" className="card-surface scroll-mt-24 p-6">
          <TicketPricing categorias={categorias} canBuy={canBuy} onBuy={onBuy} />
        </section>
      </div>

      <CompraEntradasModal open={compraOpen} onClose={() => setCompraOpen(false)} eventoId={id} />
    </div>
  )
}
