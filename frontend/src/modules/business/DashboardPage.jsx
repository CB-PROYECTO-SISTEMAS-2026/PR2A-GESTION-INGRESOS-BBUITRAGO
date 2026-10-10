import { useCallback, useEffect, useState } from 'react'
import { getResumenVentas } from '../../api/pos.api'
import { formatBs, formatTime, getErrorMessage } from '../../utils/format'
import { FiltrosVentas, KpiCard, VentasPorDiaChart } from './components/VentasUI'
import { useFiltrosVentas } from './components/ventasFiltros'

const POLL_MS = 30_000

/** HU-025: consolidado de lo recaudado por los puntos de venta del dueño. */
export default function DashboardPage() {
  const [filtros, setFiltros] = useFiltrosVentas()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  const cargar = useCallback(async () => {
    try {
      const { data } = await getResumenVentas(filtros)
      setData(data)
      setError('')
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }, [filtros])

  // Actualización periódica mientras la pestaña está visible.
  useEffect(() => {
    cargar()
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') cargar()
    }, POLL_MS)
    return () => clearInterval(id)
  }, [cargar])

  const k = data?.kpis

  return (
    <div className="p-4 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Dashboard</h1>
          <p className="mt-1 text-sm text-muted">Rendimiento de tus puntos de venta · se actualiza cada 30 segundos</p>
        </div>
      </div>

      <div className="mt-6">
        <FiltrosVentas filtros={filtros} onChange={setFiltros} negocios={data?.negocios} eventos={data?.eventos} />
      </div>

      {error && (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      )}

      {!data && !error && <p className="mt-8 text-muted">Cargando…</p>}

      {data && (
        <>
          {!data.negocios.length && (
            <p className="mt-6 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Aún no tienes un negocio registrado.
            </p>
          )}
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Ventas totales" value={formatBs(k.ventasTotales)} hint="Total recaudado en el periodo" />
            <KpiCard label="Productos vendidos" value={k.productosVendidos} hint="Artículos entregados" />
            <KpiCard
              label="Transacciones"
              value={k.transacciones}
              hint={`Ticket promedio ${formatBs(k.ticketPromedio)}`}
            />
            <KpiCard label="Ayudantes activos" value={k.ayudantesActivos} hint="Personal habilitado para cobrar" />
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-5">
            <section className="rounded-lg border border-border bg-white p-5 xl:col-span-3">
              <h2 className="font-semibold">Ventas por día</h2>
              <div className="mt-4">
                <VentasPorDiaChart datos={data.ventasPorDia} />
              </div>
            </section>

            <section className="rounded-lg border border-border bg-white p-5 xl:col-span-2">
              <h2 className="font-semibold">Últimas ventas</h2>
              <table className="mt-3 w-full text-left text-sm">
                <thead className="text-xs text-muted">
                  <tr>
                    <th className="py-2 font-medium">Hora</th>
                    <th className="py-2 font-medium">Cliente</th>
                    <th className="py-2 font-medium">Productos</th>
                    <th className="py-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.ultimasVentas.map((v) => (
                    <tr key={v.id} className="border-t border-border align-top">
                      <td className="whitespace-nowrap py-2.5 pr-3 tabular-nums text-muted">{formatTime(v.fecha)}</td>
                      <td className="py-2.5 pr-3 font-medium">{v.cliente}</td>
                      <td className="py-2.5 pr-3 text-muted">{v.productos}</td>
                      <td className="whitespace-nowrap py-2.5 text-right font-semibold tabular-nums">{formatBs(v.total)}</td>
                    </tr>
                  ))}
                  {!data.ultimasVentas.length && (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-muted">
                        Sin ventas en este periodo.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <section className="rounded-lg border border-border bg-white p-5">
              <h2 className="font-semibold">Recaudado por evento</h2>
              <p className="text-xs text-muted">Total de tu stand en cada evento del periodo</p>
              <table className="mt-3 w-full text-left text-sm">
                <tbody>
                  {data.porEvento.map((e) => (
                    <tr key={e.eventoId} className="border-t border-border">
                      <td className="py-2.5">{e.titulo}</td>
                      <td className="py-2.5 text-right text-muted">
                        {e.transacciones} {e.transacciones === 1 ? 'venta' : 'ventas'}
                      </td>
                      <td className="py-2.5 text-right font-semibold tabular-nums">{formatBs(e.total)}</td>
                    </tr>
                  ))}
                  {!data.porEvento.length && (
                    <tr>
                      <td className="py-6 text-center text-muted">Sin ventas en este periodo.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>

            <section className="rounded-lg border border-border bg-white p-5">
              <h2 className="font-semibold">Productos más vendidos</h2>
              <p className="text-xs text-muted">Ordenados por monto recaudado</p>
              <table className="mt-3 w-full text-left text-sm">
                <tbody>
                  {data.topProductos.map((p) => (
                    <tr key={p.productoId} className="border-t border-border">
                      <td className="py-2.5">{p.nombre}</td>
                      <td className="py-2.5 text-right text-muted">{p.cantidad} u.</td>
                      <td className="py-2.5 text-right font-semibold tabular-nums">{formatBs(p.total)}</td>
                    </tr>
                  ))}
                  {!data.topProductos.length && (
                    <tr>
                      <td className="py-6 text-center text-muted">Sin ventas en este periodo.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
          </div>
        </>
      )}
    </div>
  )
}
