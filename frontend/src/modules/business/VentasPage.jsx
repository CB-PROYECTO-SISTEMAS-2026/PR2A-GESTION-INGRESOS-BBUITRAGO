import { useEffect, useState } from 'react'
import { exportarVentas, getResumenVentas, getVentasNegocio } from '../../api/pos.api'
import { toast } from '../../components/Toast'
import { IconDownload } from '../../components/ui/icons'
import { formatBs, formatDateTime, getErrorMessage } from '../../utils/format'
import { FiltrosVentas, KpiCard } from './components/VentasUI'
import { useFiltrosVentas } from './components/ventasFiltros'

/** Registro detallado de las ventas de los puntos de venta, con exportación para Excel. */
export default function VentasPage() {
  const [filtros, setFiltros] = useFiltrosVentas(0)
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [opciones, setOpciones] = useState({ negocios: [], eventos: [] })
  const [error, setError] = useState('')
  const [exportando, setExportando] = useState(false)

  useEffect(() => {
    getResumenVentas()
      .then(({ data }) => setOpciones({ negocios: data.negocios, eventos: data.eventos }))
      .catch(() => {})
  }, []) // solo para llenar los filtros de negocio y evento

  useEffect(() => {
    let cancel = false
    getVentasNegocio({ ...filtros, page })
      .then(({ data }) => {
        if (!cancel) {
          setData(data)
          setError('')
        }
      })
      .catch((err) => !cancel && setError(getErrorMessage(err)))
    return () => {
      cancel = true
    }
  }, [filtros, page])

  const cambiarFiltros = (next) => {
    setFiltros(next)
    setPage(1)
  }

  const exportar = async () => {
    setExportando(true)
    try {
      const { data: blob } = await exportarVentas(filtros)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ventas_${filtros.desde}_${filtros.hasta}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      toast(getErrorMessage(err, 'No se pudo exportar'), 'error')
    } finally {
      setExportando(false)
    }
  }

  const paginas = data ? Math.max(1, Math.ceil(data.totalItems / data.pageSize)) : 1
  const promedio = data?.totalItems ? Number(data.totalRecaudado) / data.totalItems : 0

  return (
    <div className="p-4 sm:p-8">
      <h1 className="font-display text-3xl font-bold">Registro de ventas</h1>
      <p className="mt-1 text-sm text-muted">Detalle de los cobros realizados en tus puntos de venta</p>

      <div className="mt-6">
        <FiltrosVentas filtros={filtros} onChange={cambiarFiltros} negocios={opciones.negocios} eventos={opciones.eventos}>
          <button type="button" className="btn-secondary btn-sm" onClick={exportar} disabled={exportando || !data?.totalItems}>
            <IconDownload /> {exportando ? 'Exportando…' : 'Exportar Excel (CSV)'}
          </button>
        </FiltrosVentas>
      </div>

      {error && (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      )}

      {!data && !error && <p className="mt-8 text-muted">Cargando…</p>}

      {data && (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <KpiCard label="Total recaudado" value={formatBs(data.totalRecaudado)} hint="En el periodo seleccionado" />
            <KpiCard label="Transacciones" value={data.totalItems} hint="Ventas completadas" />
            <KpiCard label="Ticket promedio" value={formatBs(promedio)} hint="Promedio por venta" />
          </div>

          <div className="mt-6 overflow-x-auto rounded-lg border border-border bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-page text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Productos</th>
                  <th className="px-4 py-3 font-medium">Ayudante</th>
                  <th className="px-4 py-3 font-medium">Evento</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((v) => (
                  <tr key={v.id} className="border-t border-border align-top">
                    <td className="whitespace-nowrap px-4 py-3 text-muted">{formatDateTime(v.fecha)}</td>
                    <td className="px-4 py-3 font-medium">{v.cliente}</td>
                    <td className="px-4 py-3">{v.productos}</td>
                    <td className="px-4 py-3 text-muted">{v.ayudante}</td>
                    <td className="px-4 py-3 text-muted">{v.evento}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatBs(v.total)}</td>
                  </tr>
                ))}
                {!data.items.length && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-muted">
                      Sin ventas en este periodo.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {paginas > 1 && (
            <div className="mt-4 flex items-center justify-end gap-3 text-sm">
              <button type="button" className="btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Anterior
              </button>
              <span className="text-muted">
                Página {page} de {paginas}
              </span>
              <button type="button" className="btn-secondary btn-sm" disabled={page >= paginas} onClick={() => setPage(page + 1)}>
                Siguiente
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
