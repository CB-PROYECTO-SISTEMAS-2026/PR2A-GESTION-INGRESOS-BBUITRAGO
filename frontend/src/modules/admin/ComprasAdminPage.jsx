import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getComprasAdmin } from '../../api/compras.api'
import { getAllEventsAdmin } from '../../api/events.api'
import { IconSearch, IconTicket } from '../../components/ui/icons'
import CompraRevisionModal from './components/CompraRevisionModal'
import { formatBs, formatDateTime, getErrorMessage } from '../../utils/format'
import { formatNumber } from '../../utils/validation'
import { compraEstadoBadge, compraEstadoLabel } from '../compras/compraEstado'

const TABS = [
  { estado: 'PENDIENTE', label: 'Pendientes' },
  { estado: 'APROBADA', label: 'Aprobadas' },
  { estado: 'RECHAZADA', label: 'Rechazadas' },
  { estado: 'CANCELADA', label: 'Canceladas' },
  { estado: '', label: 'Todas' },
]
const SEARCH_DELAY_MS = 300

/** HU-013: verificación de los comprobantes de pago de las compras de entradas. */
export default function ComprasAdminPage() {
  const [params, setParams] = useSearchParams()
  const estado = params.get('estado') ?? 'PENDIENTE'
  const eventoId = params.get('evento') ?? ''
  const [q, setQ] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [eventos, setEventos] = useState([])
  const [res, setRes] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [abierta, setAbierta] = useState(null)

  useEffect(() => {
    getAllEventsAdmin()
      .then(({ data }) => setEventos(Array.isArray(data) ? data : data?.data ?? []))
      .catch(() => setEventos([]))
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => setBusqueda(q.trim()), SEARCH_DELAY_MS)
    return () => clearTimeout(timer)
  }, [q])

  const load = useCallback(async () => {
    const { data } = await getComprasAdmin({
      ...(estado ? { estado } : {}),
      ...(eventoId ? { eventoId } : {}),
      ...(busqueda ? { q: busqueda } : {}),
    })
    setRes(data)
    setError('')
  }, [estado, eventoId, busqueda])

  useEffect(() => {
    let alive = true
    setLoading(true)
    load()
      .catch((err) => alive && setError(getErrorMessage(err)))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [load])

  const setParam = (key, value) => {
    const next = new URLSearchParams(params)
    if (value === null) next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }

  const conteo = res?.conteo ?? {}
  const totalTodas = Object.values(conteo).reduce((s, n) => s + n, 0)

  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="font-display text-3xl font-bold text-ink">Pagos de entradas</h1>
        <p className="mt-1 text-sm text-muted">
          Verifica cada comprobante contra el monto de la compra. Al aprobar se emiten las entradas con su QR; al rechazar, el
          comprador recibe el motivo.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-56">
          <label className="label" htmlFor="filtro-evento">
            Evento
          </label>
          <select id="filtro-evento" className="input" value={eventoId} onChange={(e) => setParam('evento', e.target.value || null)}>
            <option value="">Todos los eventos</option>
            {eventos.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.titulo}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-64 flex-1">
          <label className="label" htmlFor="filtro-q">
            Comprador
          </label>
          <div className="relative">
            <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              id="filtro-q"
              className="input !pl-9"
              value={q}
              maxLength={100}
              placeholder="Buscar por nombre o correo"
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>
      </div>

      <nav className="flex flex-wrap gap-2" aria-label="Estado de las compras">
        {TABS.map((t) => {
          const activo = estado === t.estado
          const n = t.estado ? conteo[t.estado] ?? 0 : totalTodas
          return (
            <button
              key={t.label}
              type="button"
              onClick={() => setParam('estado', t.estado)}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
                activo ? 'border-teal bg-teal text-white' : 'border-border bg-white text-slate-600 hover:border-slate-300'
              }`}
              aria-pressed={activo}
            >
              {t.label}
              <span className={`rounded-full px-2 text-xs ${activo ? 'bg-white/20' : 'bg-slate-100'}`}>{formatNumber(n)}</span>
            </button>
          )
        })}
      </nav>

      {error && <p className="text-red-600">{error}</p>}

      <div className={`overflow-x-auto rounded-lg border border-border bg-white ${loading ? 'opacity-60' : ''}`}>
        <table className="min-w-full text-left text-sm">
          <thead className="bg-page text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Fecha</th>
              <th className="px-4 py-3 font-semibold">Comprador</th>
              <th className="px-4 py-3 font-semibold">Evento</th>
              <th className="px-4 py-3 text-right font-semibold">Entradas</th>
              <th className="px-4 py-3 text-right font-semibold">Total</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {(res?.compras ?? []).map((c) => (
              <tr key={c.id} className="border-t border-border hover:bg-page/60">
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDateTime(c.createdAt)}</td>
                <td className="px-4 py-3">
                  <p className="font-semibold text-ink">{c.comprador.nombre}</p>
                  <p className="text-xs text-muted">{c.comprador.email}</p>
                </td>
                <td className="px-4 py-3 text-slate-700">{c.evento.titulo}</td>
                <td className="px-4 py-3 text-right text-slate-700">
                  {c.totalEntradas}
                  {c.items.some((i) => i.paraNombre) && <span className="block text-xs text-muted">con terceros</span>}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-ink">{formatBs(c.montoTotal)}</td>
                <td className="px-4 py-3">
                  <span className={`badge ${compraEstadoBadge(c.estado)}`}>{compraEstadoLabel(c.estado)}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button type="button" className={c.estado === 'PENDIENTE' ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'} onClick={() => setAbierta(c)}>
                    {c.estado === 'PENDIENTE' ? 'Revisar' : 'Ver'}
                  </button>
                </td>
              </tr>
            ))}
            {res && !res.compras.length && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center">
                  <IconTicket className="mx-auto h-10 w-10 text-slate-300" />
                  <p className="mt-2 font-semibold text-ink">
                    {estado === 'PENDIENTE' ? 'No hay pagos pendientes de verificación' : 'No hay compras con este filtro'}
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {res && res.total > res.compras.length && (
        <p className="text-sm text-muted">
          Se muestran {formatNumber(res.compras.length)} de {formatNumber(res.total)} compras. Filtra por evento o comprador para
          ver las demás.
        </p>
      )}

      {abierta && (
        <CompraRevisionModal
          compra={abierta}
          onClose={() => setAbierta(null)}
          onRevisada={() => {
            setAbierta(null)
            load().catch((err) => setError(getErrorMessage(err)))
          }}
        />
      )}
    </div>
  )
}
