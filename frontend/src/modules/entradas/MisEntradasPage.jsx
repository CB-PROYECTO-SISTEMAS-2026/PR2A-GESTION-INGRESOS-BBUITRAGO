import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getMisEntradas } from '../../api/entradas.api'
import Modal from '../../components/ui/Modal'
import { IconCalendar, IconDownload, IconMapPin, IconQr, IconTicket } from '../../components/ui/icons'
import { eventImage, formatDateTime, formatDay, formatDayRange, formatHorario, getErrorMessage } from '../../utils/format'
import { estadoBadgeClass, estadoLabel, tipoAccesoLabel } from '../../utils/labels'

const DIA_LARGO = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }

const capitalizar = (texto) => texto.charAt(0).toUpperCase() + texto.slice(1)

function diaDeLaEntrada(entrada) {
  if (entrada.fecha) return capitalizar(formatDay(entrada.fecha.fecha, DIA_LARGO))
  const fechas = entrada.evento.fechas
  if (!fechas.length) return '—'
  if (fechas.length === 1) return capitalizar(formatDay(fechas[0].fecha, DIA_LARGO))
  return `Todos los días: ${formatDayRange(fechas[0].fecha, fechas[fechas.length - 1].fecha)}`
}

function horarioDeLaEntrada(entrada) {
  const ref = entrada.fecha ?? entrada.evento.fechas[0]
  return ref ? formatHorario(ref.horaInicio, ref.horaFin) : ''
}

/** HU-055: entradas aprobadas del usuario con su QR digital o el QR para recoger la manilla. */
export default function MisEntradasPage() {
  const [entradas, setEntradas] = useState(null)
  const [error, setError] = useState('')
  const [ampliada, setAmpliada] = useState(null)

  useEffect(() => {
    let alive = true
    getMisEntradas()
      .then(({ data }) => alive && setEntradas(data.entradas ?? []))
      .catch((err) => alive && setError(getErrorMessage(err, 'No se pudieron cargar tus entradas.')))
    return () => {
      alive = false
    }
  }, [])

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-10">
      <div>
        <h1 className="font-display text-3xl font-bold text-ink">Mis entradas</h1>
        <p className="mt-1 text-sm text-muted">
          Aquí aparecen tus entradas en cuanto se aprueba tu compra, cada una con su propio código QR.
        </p>
      </div>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      )}
      {!entradas && !error && <p className="text-sm text-muted">Cargando…</p>}

      {entradas && !entradas.length && (
        <div className="card-surface flex flex-col items-center gap-3 p-10 text-center">
          <IconTicket className="h-10 w-10 text-slate-300" />
          <p className="font-semibold text-ink">Todavía no tienes entradas aprobadas</p>
          <Link to="/eventos" className="btn-primary">
            Ver eventos
          </Link>
        </div>
      )}

      <ul className="space-y-4">
        {(entradas ?? []).map((e) => (
          <li key={e.id} className="card-surface overflow-hidden">
            <div className="grid gap-0 sm:grid-cols-[1fr_auto]">
              <div className="flex min-w-0 flex-col gap-4 p-5">
                <div className="flex items-start gap-4">
                  <img src={eventImage(e.evento)} alt="" className="h-16 w-24 shrink-0 rounded-md object-cover" />
                  <div className="min-w-0">
                    <Link
                      to={`/eventos/${e.evento.id}`}
                      className="font-display text-lg font-bold text-ink hover:text-teal-dark"
                    >
                      {e.evento.titulo}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className="badge bg-teal/10 text-teal-dark">{e.categoria}</span>
                      <span className={`badge ${estadoBadgeClass(e.estado)}`}>{estadoLabel(e.estado)}</span>
                      <span className="text-xs text-muted">{tipoAccesoLabel(e.evento.tipoAcceso)}</span>
                    </div>
                  </div>
                </div>

                <dl className="grid gap-2 text-sm text-slate-700">
                  <div className="flex items-start gap-2">
                    <IconCalendar className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                    <dd>
                      <span className="font-semibold">{diaDeLaEntrada(e)}</span>
                      {horarioDeLaEntrada(e) && <span className="text-muted"> · {horarioDeLaEntrada(e)}</span>}
                    </dd>
                  </div>
                  <div className="flex items-start gap-2">
                    <IconMapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                    <dd>{e.evento.ubicacion}</dd>
                  </div>
                  <div className="flex items-start gap-2">
                    <IconQr className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                    <dd className="font-mono text-xs tracking-wide">{e.codigo}</dd>
                  </div>
                </dl>

                {e.manilla && (
                  <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                    Manilla <strong className="font-mono">{e.manilla.codigo}</strong> entregada
                    {e.manilla.puntoRetiro ? ` en ${e.manilla.puntoRetiro.nombre}` : ''} el {formatDateTime(e.manilla.entregadaAt)}.
                    Desde ahora usa tu manilla para ingresar y moverte en el evento.
                  </p>
                )}

                {e.qrUso === 'RETIRO_MANILLA' && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    <p className="font-semibold">Recoge tu manilla antes de ingresar</p>
                    <p className="mt-1">Muestra este QR en un punto de entrega para que te vinculen tu manilla.</p>
                    {e.puntosRetiro.length > 0 ? (
                      <ul className="mt-2 space-y-1">
                        {e.puntosRetiro.map((p) => (
                          <li key={p.id}>
                            <strong>{p.nombre}</strong>
                            {p.ubicacion ? ` · ${p.ubicacion}` : ''}
                            {p.horario ? ` · ${p.horario}` : ''}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-amber-800">El organizador aún no publicó los puntos de entrega.</p>
                    )}
                  </div>
                )}
              </div>

              {e.qr && (
                <div className="flex flex-col items-center justify-center gap-2 border-t border-border bg-page/60 p-5 sm:w-56 sm:border-l sm:border-t-0">
                  <button
                    type="button"
                    onClick={() => setAmpliada(e)}
                    className="rounded-md border border-border bg-white p-2 transition hover:border-teal"
                    aria-label={`Ampliar QR de la entrada ${e.codigo}`}
                  >
                    <img src={e.qr} alt={`QR de la entrada ${e.codigo}`} className="h-36 w-36" />
                  </button>
                  <p className="text-center text-xs font-semibold text-muted">
                    {e.qrUso === 'ACCESO' ? 'Tu QR digital del evento' : 'QR para recoger tu manilla'}
                  </p>
                  <a href={e.qr} download={`${e.codigo}.png`} className="btn-secondary btn-sm">
                    <IconDownload />
                    Descargar
                  </a>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>

      <Modal
        open={Boolean(ampliada)}
        onClose={() => setAmpliada(null)}
        title={ampliada?.evento.titulo}
        size="sm"
        labelledBy="qr-entrada-title"
      >
        {ampliada && (
          <div className="px-6 pb-6 pt-4 text-center">
            <img src={ampliada.qr} alt={`QR de la entrada ${ampliada.codigo}`} className="mx-auto w-72" />
            <p className="mt-3 font-mono text-lg font-bold tracking-wide text-ink">{ampliada.codigo}</p>
            <p className="mt-1 text-sm text-muted">
              {ampliada.categoria} · {diaDeLaEntrada(ampliada)}
            </p>
          </div>
        )}
      </Modal>
    </div>
  )
}
