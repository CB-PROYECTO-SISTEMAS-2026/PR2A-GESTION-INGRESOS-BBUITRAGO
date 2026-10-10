import { useEffect, useState } from 'react'
import { getMisRecargas } from '../../api/recargas.api'
import RangoDiasFiltro from '../../components/staff/RangoDiasFiltro'
import { formatBs, formatDay, formatDayRange, formatTime, getErrorMessage, localDay } from '../../utils/format'

/** HU-020: recargas hechas por el recargador, por día o rango de fechas, con el efectivo recibido. */
export default function RecargasHistorialPage() {
  const [desde, setDesde] = useState(localDay())
  const [hasta, setHasta] = useState(localDay())
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!desde || !hasta) return
    let cancel = false
    setLoading(true)
    getMisRecargas({ desde, hasta })
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
        <h1 className="font-display text-xl font-bold">Historial de recargas</h1>
        <p className="text-sm text-muted">Las recargas que realizaste</p>
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
              {esUnDia ? 'Efectivo del día' : 'Efectivo del periodo'}
            </p>
            <p className="font-display text-2xl font-bold">{formatBs(data.total)}</p>
          </div>
          <div className="text-right text-xs text-muted">
            <p>{esUnDia ? formatDay(data.desde) : formatDayRange(data.desde, data.hasta)}</p>
            <p>
              {data.cantidad} {data.cantidad === 1 ? 'recarga' : 'recargas'}
            </p>
            {data.anuladas > 0 && (
              <p className="text-amber-700">
                {data.anuladas} {data.anuladas === 1 ? 'anulada' : 'anuladas'}
              </p>
            )}
          </div>
        </div>
      )}

      {loading && !data ? (
        <p className="text-center text-sm text-muted">Cargando…</p>
      ) : (
        <ul className="grid gap-2">
          {data?.recargas.map((r) => {
            const anulada = r.estado === 'ANULADA'
            return (
              <li key={r.id} className="flex items-center gap-3 rounded-xl border border-border bg-white p-3">
                <div className="w-14 shrink-0 text-center">
                  <p className="text-sm font-semibold tabular-nums">{formatTime(r.fecha)}</p>
                  {!esUnDia && (
                    <p className="text-[11px] text-muted">
                      {new Date(r.fecha).toLocaleDateString('es-BO', { day: 'numeric', month: 'short' })}
                    </p>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{r.cliente}</p>
                  <p className="truncate text-xs text-muted">
                    {r.codigo} · {r.evento}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className={`font-semibold ${anulada ? 'text-muted line-through' : 'text-teal-dark'}`}>
                    + {formatBs(r.monto)}
                  </p>
                  {anulada && <span className="badge bg-slate-100 text-[11px] text-slate-600">Anulada</span>}
                </div>
              </li>
            )
          })}
          {data && !data.recargas.length && (
            <li className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">
              No hay recargas en este periodo.
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
