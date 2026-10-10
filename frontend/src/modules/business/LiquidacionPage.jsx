import { useCallback, useEffect, useState } from 'react'
import { getLiquidacion, solicitarRetiro } from '../../api/pos.api'
import { toast } from '../../components/Toast'
import { confirmDialog } from '../../components/ui/ConfirmDialog'
import { formatBs, formatDateTime, formatDay, getErrorMessage } from '../../utils/format'
import { KpiCard } from './components/VentasUI'

const RETIRO_BADGE = {
  SOLICITADO: 'bg-amber-50 text-amber-700',
  APROBADO: 'bg-sky-50 text-sky-700',
  PAGADO: 'bg-emerald-50 text-emerald-700',
  RECHAZADO: 'bg-red-50 text-red-700',
}

/**
 * HU-025: lo vendido en un evento se acredita al dueño cuando el evento termina;
 * desde aquí solicita el retiro de lo disponible.
 */
export default function LiquidacionPage() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(null)

  const cargar = useCallback(async () => {
    try {
      const { data } = await getLiquidacion()
      setData(data)
      setError('')
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  const retirar = async (negocio) => {
    const ok = await confirmDialog({
      title: 'Solicitar retiro',
      message: `Se solicitará el retiro de ${formatBs(negocio.disponible)} de ${negocio.nombre}. El administrador revisará la solicitud y registrará la entrega.`,
      confirmText: 'Solicitar retiro',
      cancelText: 'Cancelar',
    })
    if (!ok) return
    setEnviando(negocio.id)
    try {
      await solicitarRetiro(negocio.id)
      toast('Solicitud de retiro enviada', 'success')
      await cargar()
    } catch (err) {
      toast(getErrorMessage(err), 'error')
    } finally {
      setEnviando(null)
    }
  }

  return (
    <div className="p-8">
      <h1 className="font-display text-3xl font-bold">Liquidación</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Las ventas de cada evento se acreditan a tu negocio cuando el evento finaliza. Lo vendido en eventos en curso
        queda pendiente hasta su cierre.
      </p>

      {error && (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      )}
      {!data && !error && <p className="mt-8 text-muted">Cargando…</p>}
      {data && !data.negocios.length && (
        <p className="mt-6 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Aún no tienes un negocio registrado.
        </p>
      )}

      {data?.negocios.map((n) => (
        <section key={n.id} className="mt-8">
          {data.negocios.length > 1 && <h2 className="mb-3 text-lg font-semibold">{n.nombre}</h2>}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Acreditado" value={formatBs(n.acreditado)} hint="Ventas de eventos finalizados" />
            <KpiCard label="Pendiente de cierre" value={formatBs(n.pendienteCierre)} hint="Ventas de eventos en curso" />
            <KpiCard label="Retirado o solicitado" value={formatBs(n.retirado)} hint="Retiros no rechazados" />
            <div className="flex flex-col justify-between rounded-lg border-2 border-teal bg-white p-5">
              <div>
                <p className="text-sm text-muted">Disponible para retiro</p>
                <p className="mt-2 font-display text-3xl font-bold tabular-nums">{formatBs(n.disponible)}</p>
              </div>
              <button
                type="button"
                className="btn-primary btn-sm mt-3"
                disabled={Number(n.disponible) <= 0 || enviando === n.id}
                onClick={() => retirar(n)}
              >
                {enviando === n.id ? 'Enviando…' : 'Solicitar retiro'}
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-5">
            <div className="overflow-x-auto rounded-lg border border-border bg-white lg:col-span-3">
              <h3 className="px-4 pt-4 font-semibold">Ventas por evento</h3>
              <table className="mt-2 min-w-full text-left text-sm">
                <thead className="text-xs text-muted">
                  <tr>
                    <th className="px-4 py-2 font-medium">Evento</th>
                    <th className="px-4 py-2 font-medium">Cierre</th>
                    <th className="px-4 py-2 font-medium">Estado</th>
                    <th className="px-4 py-2 text-right font-medium">Ventas</th>
                    <th className="px-4 py-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {n.eventos.map((e) => (
                    <tr key={e.eventoId} className="border-t border-border">
                      <td className="px-4 py-3">{e.titulo}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted">{formatDay(e.fechaFin)}</td>
                      <td className="px-4 py-3">
                        <span className={`badge ${e.cerrado ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                          {e.cerrado ? 'Acreditado' : 'En curso'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-muted">{e.transacciones}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatBs(e.total)}</td>
                    </tr>
                  ))}
                  {!n.eventos.length && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted">
                        Todavía no hay ventas registradas.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="rounded-lg border border-border bg-white lg:col-span-2">
              <h3 className="px-4 pt-4 font-semibold">Retiros</h3>
              <ul className="mt-2 divide-y divide-border text-sm">
                {n.retiros.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div>
                      <p className="font-semibold tabular-nums">{formatBs(r.monto)}</p>
                      <p className="text-xs text-muted">{formatDateTime(r.fecha)}</p>
                    </div>
                    <span className={`badge ${RETIRO_BADGE[r.estado] || 'bg-page text-muted'}`}>{r.estado}</span>
                  </li>
                ))}
                {!n.retiros.length && <li className="px-4 py-8 text-center text-muted">Sin retiros solicitados.</li>}
              </ul>
            </div>
          </div>
        </section>
      ))}
    </div>
  )
}
