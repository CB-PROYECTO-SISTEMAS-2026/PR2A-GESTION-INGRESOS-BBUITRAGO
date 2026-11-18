import { useCallback, useEffect, useRef, useState } from 'react'
import { cambiarEstadoRetiro, getRetirosAdmin } from '../../api/pos.api'
import { toast } from '../../components/Toast'
import { confirmDialog } from '../../components/ui/ConfirmDialog'
import { IconExternal } from '../../components/ui/icons'
import { formatBs, formatDateTime, getErrorMessage } from '../../utils/format'

const ESTADOS = [
  { value: 'SOLICITADO', label: 'Solicitados', badge: 'bg-amber-50 text-amber-700' },
  { value: 'APROBADO', label: 'Aprobados', badge: 'bg-sky-50 text-sky-700' },
  { value: 'PAGADO', label: 'Pagados', badge: 'bg-emerald-50 text-emerald-700' },
  { value: 'RECHAZADO', label: 'Rechazados', badge: 'bg-red-50 text-red-700' },
]
const badgeDe = (estado) => ESTADOS.find((e) => e.value === estado)?.badge || 'bg-page text-muted'

/**
 * HU-025: el administrador revisa los retiros que solicitan los dueños de negocio cuando sus
 * eventos terminan, los aprueba o rechaza y registra el pago con su comprobante.
 */
export default function RetirosPage() {
  const [estado, setEstado] = useState('SOLICITADO')
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(null)

  // Número de la última petición: si el usuario cambia de pestaña antes de que llegue la
  // respuesta anterior, esa respuesta vieja se descarta (no pisa la tabla de la pestaña nueva).
  const ultimaPeticion = useRef(0)

  const cargar = useCallback(async () => {
    const peticion = ++ultimaPeticion.current
    try {
      const { data } = await getRetirosAdmin({ estado })
      if (peticion !== ultimaPeticion.current) return
      setData(data)
      setError('')
    } catch (err) {
      if (peticion === ultimaPeticion.current) setError(getErrorMessage(err))
    }
  }, [estado])

  useEffect(() => {
    cargar()
  }, [cargar])

  const cambiar = async (retiro, nuevo) => {
    const aprobar = nuevo === 'APROBADO'
    const ok = await confirmDialog({
      title: aprobar ? 'Aprobar retiro' : 'Rechazar retiro',
      message: aprobar
        ? `Se aprobará el retiro de ${formatBs(retiro.monto)} para ${retiro.negocio}. El titular podrá cobrar en devoluciones.`
        : `Se rechazará el retiro de ${formatBs(retiro.monto)} de ${retiro.negocio}. El monto vuelve a quedar disponible para el negocio.`,
      confirmText: aprobar ? 'Aprobar' : 'Rechazar',
      cancelText: 'Cancelar',
      tone: aprobar ? undefined : 'danger',
    })
    if (!ok) return
    const motivo = aprobar ? undefined : window.prompt('Motivo del rechazo que verá el dueño del negocio')?.trim()
    if (!aprobar && !motivo) return
    setOcupado(retiro.id)
    try {
      await cambiarEstadoRetiro(retiro.id, nuevo, motivo)
      toast(aprobar ? 'Retiro aprobado' : 'Retiro rechazado', 'success')
      await cargar()
    } catch (err) {
      toast(getErrorMessage(err), 'error')
    } finally {
      setOcupado(null)
    }
  }

  return (
    <div className="p-4 sm:p-8">
      <h1 className="font-display text-3xl font-bold">Retiros de negocios</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Los dueños de negocio solicitan el retiro de lo vendido cuando sus eventos terminan. Aprueba la solicitud,
        o recházala con un motivo. El encargado de devoluciones entrega el efectivo.
      </p>

      <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Estado">
        {ESTADOS.map((e) => {
          const r = data?.resumen.find((x) => x.estado === e.value)
          const activo = estado === e.value
          return (
            <button
              key={e.value}
              type="button"
              role="tab"
              aria-selected={activo}
              onClick={() => setEstado(e.value)}
              className={`rounded-md border px-3 py-2 text-left text-sm ${
                activo ? 'border-teal bg-teal/10 text-ink' : 'border-border bg-white text-muted hover:text-ink'
              }`}
            >
              <span className="font-semibold">{e.label}</span>
              {r && (
                <span className="ml-2 text-xs">
                  {r.cantidad} · {formatBs(r.monto)}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {error && (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      )}
      {!data && !error && <p className="mt-8 text-muted">Cargando…</p>}

      {data && (
        <div className="mt-6 overflow-x-auto rounded-lg border border-border bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-page text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Solicitado</th>
                <th className="px-4 py-3 font-medium">Negocio</th>
                <th className="px-4 py-3 font-medium">Dueño</th>
                <th className="px-4 py-3 text-right font-medium">Monto</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {data.retiros.map((r) => (
                <tr key={r.id} className="border-t border-border align-top">
                  <td className="whitespace-nowrap px-4 py-3 text-muted">{formatDateTime(r.fecha)}</td>
                  <td className="px-4 py-3 font-medium">{r.negocio}</td>
                  <td className="px-4 py-3">
                    <p>{r.dueno}</p>
                    <p className="text-xs text-muted">{r.email}</p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums">
                    {formatBs(r.monto)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${badgeDe(r.estado)}`}>{r.estado}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      {r.estado === 'SOLICITADO' && (
                        <button
                          type="button"
                          className="btn-primary btn-sm"
                          disabled={ocupado === r.id}
                          onClick={() => cambiar(r, 'APROBADO')}
                        >
                          Aprobar
                        </button>
                      )}
                      {['SOLICITADO', 'APROBADO'].includes(r.estado) && (
                        <button
                          type="button"
                          className="btn-secondary btn-sm text-red-700"
                          disabled={ocupado === r.id}
                          onClick={() => cambiar(r, 'RECHAZADO')}
                        >
                          Rechazar
                        </button>
                      )}
                      {r.evidenciaUrl && (
                        <a
                          href={r.evidenciaUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm font-semibold text-teal-dark hover:underline"
                        >
                          Comprobante <IconExternal className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!data.retiros.length && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted">
                    No hay retiros en este estado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

    </div>
  )
}
