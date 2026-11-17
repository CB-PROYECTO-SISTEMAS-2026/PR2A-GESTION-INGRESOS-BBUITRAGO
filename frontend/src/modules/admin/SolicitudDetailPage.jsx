import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getSolicitudById, revisarSolicitud } from '../../api/events.api'
import { toast } from '../../components/Toast'
import { confirmDialog } from '../../components/ui/ConfirmDialog'
import { IconChevronLeft, IconExternal } from '../../components/ui/icons'
import MapaPreview from '../../components/MapaPreview'
import { formatDateTime, formatDayRange, formatHorario, getErrorMessage } from '../../utils/format'
import { estadoBadgeClass, estadoLabel, mapaCambioLabel } from '../../utils/labels'
import { formatNumber } from '../../utils/validation'

function Dato({ label, children }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 text-sm text-ink">{children || '—'}</dd>
    </div>
  )
}

export default function SolicitudDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [solicitud, setSolicitud] = useState(null)
  const [observaciones, setObservaciones] = useState('')
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    getSolicitudById(id)
      .then(({ data }) => alive && setSolicitud(data?.data ?? data))
      .catch((err) => alive && setError(getErrorMessage(err)))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [id])

  const onReview = async (estado) => {
    if (estado === 'RECHAZADA') {
      const ok = await confirmDialog({
        title: 'Rechazar solicitud',
        message: `La solicitud "${solicitud.nombreEvento}" quedará rechazada y el organizador verá las observaciones que escribiste.`,
        confirmText: 'Rechazar',
        cancelText: 'Cancelar',
        tone: 'danger',
      })
      if (ok !== true) return
    }
    setActing(true)
    try {
      const { data } = await revisarSolicitud(id, { estado, observaciones: observaciones.trim() || undefined })
      const accion = estado === 'APROBADA' ? 'Solicitud aprobada' : 'Solicitud rechazada'
      if (data?.correoEnviado === false) {
        toast(`${accion}, pero no se pudo enviar el correo al organizador.`, 'error')
      } else {
        toast(`${accion}. Se notificó al organizador por correo.`, 'success')
      }
      navigate(estado === 'APROBADA' ? `/admin/eventos/nuevo?solicitudId=${id}` : '/admin/solicitudes')
    } catch (err) {
      toast(getErrorMessage(err), 'error')
    } finally {
      setActing(false)
    }
  }

  if (loading) return <div className="p-8 text-muted">Cargando…</div>
  if (error || !solicitud) {
    return (
      <div className="p-8">
        <p className="text-red-600">{error || 'Solicitud no encontrada.'}</p>
        <Link to="/admin/solicitudes" className="mt-3 inline-block font-semibold text-teal-dark">
          Volver a solicitudes
        </Link>
      </div>
    )
  }

  const historial = solicitud.mapHistory ?? []
  const pendiente = solicitud.estado === 'PENDIENTE'
  const org = solicitud.organizador

  return (
    <div className="p-8">
      <Link
        to="/admin/solicitudes"
        className="inline-flex items-center gap-1 text-sm font-semibold text-teal-dark hover:text-teal"
      >
        <IconChevronLeft />
        Solicitudes
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-bold text-ink">{solicitud.nombreEvento}</h1>
        <span className={`badge ${estadoBadgeClass(solicitud.estado)}`}>
          {estadoLabel(solicitud.estado)}
        </span>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card-surface p-6">
          <dl className="grid gap-4 sm:grid-cols-2">
            <Dato label="Organizador">
              {org ? (
                <>
                  <p>{[org.nombre, org.apellido].filter(Boolean).join(' ')}</p>
                  <p className="text-xs text-muted">{org.email}</p>
                  {org.telefono && <p className="text-xs text-muted">{org.telefono}</p>}
                </>
              ) : null}
            </Dato>
            <Dato label="Empresa">{solicitud.empresa}</Dato>
            <Dato label={solicitud.fechaFin ? 'Fechas' : 'Fecha'}>{formatDayRange(solicitud.fechaInicio, solicitud.fechaFin)}</Dato>
            <Dato label="Horario">{formatHorario(solicitud.horaInicio, solicitud.horaFin)}</Dato>
            <Dato label="Ubicación">
              <p>{solicitud.ubicacion}</p>
              {solicitud.ubicacionUrl && (
                <a
                  href={solicitud.ubicacionUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-0.5 inline-flex items-center gap-1 font-semibold text-teal-dark hover:underline"
                >
                  Ver en Google Maps
                  <IconExternal className="h-3.5 w-3.5" />
                </a>
              )}
            </Dato>
            <Dato label="Capacidad máxima">{solicitud.capacidad ? formatNumber(solicitud.capacidad) : ''}</Dato>
            <div className="sm:col-span-2">
              <Dato label="Descripción">
                <span className="whitespace-pre-line">{solicitud.descripcion}</span>
              </Dato>
            </div>
            {!pendiente && solicitud.observaciones && (
              <div className="sm:col-span-2">
                <Dato label="Observaciones">
                  <span className="whitespace-pre-line">{solicitud.observaciones}</span>
                </Dato>
              </div>
            )}
          </dl>

          {pendiente && (
            <div className="mt-6 border-t border-border pt-5">
              <label className="label" htmlFor="observaciones">
                Observaciones
              </label>
              <textarea
                id="observaciones"
                className="input min-h-24"
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                maxLength={2000}
              />
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-3">
            {pendiente && (
              <>
                <button type="button" className="btn-primary" disabled={acting} onClick={() => onReview('APROBADA')}>
                  Aprobar y crear evento
                </button>
                <button type="button" className="btn-danger" disabled={acting} onClick={() => onReview('RECHAZADA')}>
                  Rechazar
                </button>
              </>
            )}
            {solicitud.estado === 'APROBADA' && !solicitud.evento && (
              <Link to={`/admin/eventos/nuevo?solicitudId=${id}`} className="btn-primary">
                Crear evento
              </Link>
            )}
            {solicitud.evento && (
              <Link to={`/admin/eventos/${solicitud.evento.id}`} className="btn-secondary">
                Ir al evento
              </Link>
            )}
          </div>
        </section>

        <section className="card-surface p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-bold text-ink">Mapa del evento</h2>
            <Link to={`/admin/mapa/${id}`} className="text-sm font-semibold text-teal-dark hover:underline">
              Ver en grande
            </Link>
          </div>
          <div className="mt-4">
            <MapaPreview url={solicitud.mapaUrl} nombre={solicitud.mapaNombre} />
          </div>

          <h3 className="mt-6 text-xs font-semibold uppercase tracking-wide text-muted">Historial del mapa</h3>
          {historial.length ? (
            <ul className="mt-3 space-y-2 text-sm">
              {historial.map((h) => (
                <li key={h.id} className="rounded-lg bg-page px-3 py-2">
                  <span className="font-semibold">{mapaCambioLabel(h.tipo)}</span> · {formatDateTime(h.createdAt)}
                  {h.nota ? <span className="block text-muted">{h.nota}</span> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted">Sin cambios registrados.</p>
          )}
        </section>
      </div>
    </div>
  )
}
