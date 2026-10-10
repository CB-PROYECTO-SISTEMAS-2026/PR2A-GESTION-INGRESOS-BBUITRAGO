import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getEventAdminById } from '../../api/events.api'
import { getMovimientosEvento } from '../../api/recargas.api'
import { formatBs, formatDateTime, getErrorMessage } from '../../utils/format'
import {
  TIPOS_MOVIMIENTO,
  estadoMovimientoBadge,
  estadoMovimientoLabel,
  montoConSigno,
  tipoMovimientoLabel,
} from '../../utils/movimientos'
import EventoHeader from './components/EventoHeader'

/** HU-020 (administrador): movimientos de saldo de todos los clientes en un evento, con totales. */
export default function MovimientosEventoPage() {
  const { id } = useParams()
  const [evento, setEvento] = useState(null)
  const [tipo, setTipo] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const ultimaPeticion = useRef(0)

  useEffect(() => {
    getEventAdminById(id)
      .then(({ data }) => setEvento(data?.data ?? data))
      .catch(() => setEvento(null))
  }, [id])

  const cargar = useCallback(async () => {
    const peticion = ++ultimaPeticion.current
    try {
      const { data } = await getMovimientosEvento(id, { tipo: tipo || undefined, page })
      if (peticion !== ultimaPeticion.current) return
      setData(data)
      setError('')
    } catch (err) {
      if (peticion === ultimaPeticion.current) setError(getErrorMessage(err))
    }
  }, [id, tipo, page])

  useEffect(() => {
    cargar()
  }, [cargar])

  const tarjetas = data
    ? [
        ['Recargado', data.totales.RECARGA],
        ['Consumido', data.totales.COMPRA_PRODUCTO],
        ['Devuelto', data.totales.DEVOLUCION],
        ['Ajustes', data.totales.AJUSTE],
      ]
    : []

  return (
    <>
      <EventoHeader eventoId={id} titulo={evento?.titulo} estado={evento?.estado} />
      <div className="p-4 sm:p-8">
        {error && (
          <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
            {error}
          </p>
        )}
        {!data && !error && <p className="text-muted">Cargando…</p>}

        {data && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <div className="card-surface bg-teal/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-teal-dark">Saldo en circulación</p>
                <p className="font-display text-2xl font-bold">{formatBs(data.saldoEnCirculacion)}</p>
                <p className="text-xs text-muted">Suma de los saldos actuales de los clientes</p>
              </div>
              {tarjetas.map(([label, t]) => (
                <div key={label} className="card-surface p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
                  <p className="font-display text-2xl font-bold">{formatBs(Math.abs(Number(t.monto)))}</p>
                  <p className="text-xs text-muted">
                    {t.cantidad} {t.cantidad === 1 ? 'movimiento' : 'movimientos'}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Tipo de movimiento">
              {[{ value: '', label: 'Todos' }, ...TIPOS_MOVIMIENTO].map((t) => (
                <button
                  key={t.value || 'todos'}
                  type="button"
                  aria-pressed={tipo === t.value}
                  onClick={() => {
                    setTipo(t.value)
                    setPage(1)
                  }}
                  className={`rounded-full border px-3 py-1 text-sm ${
                    tipo === t.value ? 'border-teal bg-teal/10 font-semibold text-teal-dark' : 'border-border bg-white text-muted'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="mt-4 overflow-x-auto rounded-lg border border-border bg-white">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-page text-muted">
                  <tr>
                    <th className="px-4 py-3 font-medium">Fecha</th>
                    <th className="px-4 py-3 font-medium">Cliente</th>
                    <th className="px-4 py-3 font-medium">Operación</th>
                    <th className="px-4 py-3 font-medium">Realizado por</th>
                    <th className="px-4 py-3 text-right font-medium">Monto</th>
                    <th className="px-4 py-3 text-right font-medium">Saldo</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {data.movimientos.map((m) => (
                    <tr key={m.id} className="border-t border-border align-top">
                      <td className="whitespace-nowrap px-4 py-3">
                        <p className="text-muted">{formatDateTime(m.fecha)}</p>
                        <p className="font-mono text-xs text-muted">{m.codigo}</p>
                      </td>
                      <td className="px-4 py-3 font-medium">{m.cliente}</td>
                      <td className="px-4 py-3">
                        <p>{tipoMovimientoLabel(m.tipo)}</p>
                        <p className="max-w-xs text-xs text-muted">{m.operacion}</p>
                      </td>
                      <td className="px-4 py-3">{m.operador || '—'}</td>
                      <td
                        className={`whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums ${
                          m.estado === 'ANULADA' ? 'text-muted line-through' : Number(m.monto) < 0 ? 'text-red-600' : 'text-emerald-700'
                        }`}
                      >
                        {montoConSigno(m.monto, formatBs)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{formatBs(m.saldoResultante)}</td>
                      <td className="px-4 py-3">
                        <span className={`badge ${estadoMovimientoBadge(m.estado)}`}>{estadoMovimientoLabel(m.estado)}</span>
                      </td>
                    </tr>
                  ))}
                  {!data.movimientos.length && (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-muted">
                        No hay movimientos de saldo en este evento.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {data.totalPages > 1 && (
              <div className="mt-4 flex items-center justify-end gap-3 text-sm">
                <button type="button" className="btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Anterior
                </button>
                <span className="text-muted">
                  Página {data.page} de {data.totalPages}
                </span>
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  disabled={page >= data.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Siguiente
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
