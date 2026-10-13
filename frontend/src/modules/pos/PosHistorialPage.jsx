import { useEffect, useState } from 'react'
import { getMisVentas } from '../../api/pos.api'
import RangoDiasFiltro from '../../components/staff/RangoDiasFiltro'
import { formatBs, formatDay, formatDayRange, formatTime, getErrorMessage, localDay } from '../../utils/format'

/** HU-024: ventas cobradas por el ayudante, por día o rango de fechas. */
export default function PosHistorialPage() {
  const [desde, setDesde] = useState(localDay())
  const [hasta, setHasta] = useState(localDay())
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!desde || !hasta) return
    let cancel = false
    setLoading(true)
    getMisVentas({ desde, hasta })
      .then(({ data }) => {
        if (!cancel) {
          setData(data)
          setError('')
        }
      })
      .catch((err) => !cancel && setError(getErrorMessage(err)))
      .finally(() => !cancel && setLoading(false))
    return () => {
      cancel = true
    }
  }, [desde, hasta])

  const esUnDia = desde === hasta

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div>
        <h1 className="font-display text-xl font-bold">Historial de ventas</h1>
        <p className="text-sm text-muted">Los cobros que realizaste</p>
      </div>

      <RangoDiasFiltro
        desde={desde}
        hasta={hasta}
        onChange={(d, h) => {
          setDesde(d)
          setHasta(h)
        }}
      />

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      )}

      {data && (
        <div className="flex items-end justify-between rounded-xl bg-teal/10 p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-dark">
              {esUnDia ? 'Total del día' : 'Total del periodo'}
            </p>
            <p className="font-display text-2xl font-bold">{formatBs(data.total)}</p>
          </div>
          <div className="text-right text-xs text-muted">
            <p>{esUnDia ? formatDay(data.desde) : formatDayRange(data.desde, data.hasta)}</p>
            <p>
              {data.cantidad} {data.cantidad === 1 ? 'venta' : 'ventas'}
            </p>
          </div>
        </div>
      )}

      {loading && !data ? (
        <p className="text-center text-sm text-muted">Cargando…</p>
      ) : (
        <ul className="grid gap-2">
          {data?.ventas.map((v) => (
            <li key={v.id} className="flex items-center gap-3 rounded-xl border border-border bg-white p-3">
              <div className="w-14 shrink-0 text-center">
                <p className="text-sm font-semibold tabular-nums">{formatTime(v.fecha)}</p>
                {!esUnDia && <p className="text-[11px] text-muted">{new Date(v.fecha).toLocaleDateString('es-BO', { day: 'numeric', month: 'short' })}</p>}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{v.cliente}</p>
                <p className="truncate text-xs text-muted">{v.productos}</p>
              </div>
              <p className="shrink-0 font-semibold text-teal-dark">{formatBs(v.total)}</p>
            </li>
          ))}
          {data && !data.ventas.length && (
            <li className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">
              No hay ventas en este periodo.
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
