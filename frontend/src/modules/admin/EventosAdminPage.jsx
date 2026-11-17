import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getAllEventsAdmin } from '../../api/events.api'
import { IconEye, IconPencil, IconPlus, IconTicket } from '../../components/ui/icons'
import EventoDetalleModal from './components/EventoDetalleModal'
import { eventDayRange, eventImage, getErrorMessage } from '../../utils/format'
import { estadoBadgeClass, estadoLabel, tipoAccesoLabel } from '../../utils/labels'
import { formatNumber } from '../../utils/validation'

export default function EventosAdminPage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detalleId, setDetalleId] = useState(null)

  useEffect(() => {
    let alive = true
    getAllEventsAdmin()
      .then(({ data }) => alive && setItems(Array.isArray(data) ? data : data?.data ?? []))
      .catch((err) => alive && setError(getErrorMessage(err)))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [])

  return (
    <div className="p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold text-ink">Eventos</h1>
        <Link to="/admin/eventos/nuevo" className="btn-primary">
          <IconPlus />
          Nuevo evento
        </Link>
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
                <th className="px-4 py-3 font-semibold">Fecha</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 font-semibold">Acceso</th>
                <th className="px-4 py-3 font-semibold">Capacidad</th>
                <th className="px-4 py-3 text-right font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((e) => {
                const organizador = e.organizador ? [e.organizador.nombre, e.organizador.apellido].filter(Boolean).join(' ') : ''
                return (
                  <tr key={e.id} className="border-t border-border hover:bg-page/60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={eventImage(e)}
                          alt=""
                          className="h-12 w-20 shrink-0 rounded-lg bg-page object-cover"
                          loading="lazy"
                        />
                        <div className="min-w-0">
                          <p className="font-semibold text-ink">{e.titulo}</p>
                          <p className="truncate text-xs text-muted">
                            {e.ubicacion}
                            {organizador ? ` · ${organizador}` : ''}
                          </p>
                          {!e.fotoUrl && (
                            <span className="mt-1 inline-block badge bg-amber-100 text-amber-800">
                              Falta imagen
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{eventDayRange(e)}</td>
                    <td className="px-4 py-3">
                      <span className={`whitespace-nowrap badge ${estadoBadgeClass(e.estado)}`}>
                        {estadoLabel(e.estado)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{tipoAccesoLabel(e.tipoAcceso)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {e.capacidad ? formatNumber(e.capacidad) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button type="button" className="btn-secondary btn-sm" onClick={() => setDetalleId(e.id)}>
                          <IconEye />
                          Ver
                        </button>
                        <Link to={`/admin/eventos/${e.id}`} className="btn-secondary btn-sm">
                          <IconPencil />
                          Editar
                        </Link>
                        <Link to={`/admin/eventos/${e.id}/categorias`} className="btn-secondary btn-sm">
                          <IconTicket />
                          Categorías
                        </Link>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {!items.length && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted">
                    No hay eventos registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <EventoDetalleModal eventoId={detalleId} onClose={() => setDetalleId(null)} />
    </div>
  )
}
