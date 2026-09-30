import { useEffect, useState } from 'react'
import { getEventAdminById } from '../../../api/events.api'
import Modal from '../../../components/ui/Modal'
import MapaPreview from '../../../components/MapaPreview'
import CronogramaView from '../../../components/event/CronogramaView'
import { IconCheck, IconExternal } from '../../../components/ui/icons'
import {
  asCronograma,
  asList,
  eventDayRange,
  eventImage,
  formatBs,
  formatDay,
  formatHorario,
  getErrorMessage,
} from '../../../utils/format'
import { estadoBadgeClass, estadoLabel, tipoAccesoLabel } from '../../../utils/labels'
import { formatNumber } from '../../../utils/validation'

function Info({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{children}</dd>
    </div>
  )
}

function Bloque({ title, children }) {
  return (
    <section className="border-t border-border px-6 py-5">
      <h3 className="mb-3 font-display text-base font-bold text-ink">{title}</h3>
      {children}
    </section>
  )
}

export default function EventoDetalleModal({ eventoId, onClose }) {
  const [evento, setEvento] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!eventoId) return undefined
    let alive = true
    setEvento(null)
    setError('')
    getEventAdminById(eventoId)
      .then(({ data }) => alive && setEvento(data?.data ?? data))
      .catch((err) => alive && setError(getErrorMessage(err)))
    return () => {
      alive = false
    }
  }, [eventoId])

  const fechas = evento?.fechas ?? []
  const cronograma = asCronograma(evento?.cronograma)
  const servicios = asList(evento?.servicios)
  const categorias = evento?.categorias ?? []
  const organizador = evento?.organizador
  const mapaNombre = evento?.mapHistory?.find((h) => h.mapaUrl === evento.mapaUrl)?.mapaNombre

  return (
    <Modal
      open={Boolean(eventoId)}
      onClose={onClose}
      title="Detalle del evento"
      size="lg"
      labelledBy="evento-detalle-title"
      footer={
        <button type="button" className="btn-secondary" onClick={onClose}>
          Cerrar
        </button>
      }
    >
      {error && <p className="px-6 py-8 text-sm text-red-600">{error}</p>}
      {!evento && !error && <p className="px-6 py-8 text-sm text-muted">Cargando…</p>}
      {evento && (
        <>
          <img src={eventImage(evento)} alt={evento.titulo} className="aspect-[21/9] w-full object-cover" />

          <div className="px-6 py-5">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="font-display text-2xl font-bold text-ink">{evento.titulo}</h3>
              <span className={`badge ${estadoBadgeClass(evento.estado)}`}>
                {estadoLabel(evento.estado)}
              </span>
            </div>
            {!evento.fotoUrl && <p className="mt-1 text-sm text-amber-700">Todavía no tiene imagen propia.</p>}
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-700">{evento.descripcion}</p>

            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              <Info label={fechas.length > 1 ? 'Fechas' : 'Fecha'}>{eventDayRange(evento)}</Info>
              <Info label="Horario">{formatHorario(fechas[0]?.horaInicio, fechas[0]?.horaFin) || '—'}</Info>
              <Info label="Ubicación">
                <p>{evento.ubicacion}</p>
                {evento.ubicacionUrl && (
                  <a
                    href={evento.ubicacionUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-0.5 inline-flex items-center gap-1 text-teal-dark hover:underline"
                  >
                    Ver en Google Maps
                    <IconExternal className="h-3.5 w-3.5" />
                  </a>
                )}
              </Info>
              <Info label="Capacidad máxima">
                {evento.capacidad ? `${formatNumber(evento.capacidad)} personas` : '—'}
              </Info>
              <Info label="Tipo de acceso">{tipoAccesoLabel(evento.tipoAcceso)}</Info>
              {organizador && (
                <Info label="Organizador">
                  <p>{[organizador.nombre, organizador.apellido].filter(Boolean).join(' ')}</p>
                  <p className="text-xs text-muted">{organizador.email}</p>
                </Info>
              )}
            </dl>
          </div>

          <Bloque title="Cronograma">
            {cronograma ? <CronogramaView cronograma={cronograma} /> : <p className="text-sm text-muted">Sin cronograma.</p>}
          </Bloque>

          <Bloque title="Servicios">
            {servicios.length ? (
              <ul className="flex flex-wrap gap-2">
                {servicios.map((s) => (
                  <li key={s} className="rounded border border-border bg-page px-2.5 py-1 text-sm text-ink">
                    {s}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Sin servicios registrados.</p>
            )}
          </Bloque>

          <Bloque title="Categorías de entrada">
            {categorias.length ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {categorias.map((c) => {
                  const beneficios = asList(c.beneficios)
                  return (
                    <div key={c.id} className="rounded-md border border-border p-4">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-ink">{c.nombre}</p>
                        <p className="font-bold text-teal-dark">{formatBs(c.precio)}</p>
                      </div>
                      <p className="mt-0.5 text-xs text-muted">{formatNumber(c.cupo)} entradas</p>
                      {fechas.length > 1 && (
                        <p className="mt-1 text-xs text-muted">
                          {(c.fechasDisponibles || [])
                            .map((fd) => formatDay(fechas.find((f) => f.id === fd.fechaId)?.fecha, { day: 'numeric', month: 'short' }))
                            .join(' · ')}
                        </p>
                      )}
                      {beneficios.length > 0 && (
                        <ul className="mt-3 space-y-1">
                          {beneficios.map((b) => (
                            <li key={b} className="flex items-start gap-1.5 text-xs text-slate-700">
                              <IconCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal" />
                              {b}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-muted">Aún no tiene categorías.</p>
            )}
          </Bloque>

          <Bloque title="Mapa del evento">
            <MapaPreview url={evento.mapaUrl} nombre={mapaNombre} className="max-h-[26rem]" />
          </Bloque>
        </>
      )}
    </Modal>
  )
}
