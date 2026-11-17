import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { asignarSupervisorAcceso, getAccesoEvento, quitarSupervisorAcceso } from '../../api/acceso.api'
import { toast } from '../../components/Toast'
import { confirmDialog } from '../../components/ui/ConfirmDialog'
import { IconUsers, IconX } from '../../components/ui/icons'
import AforoResumen from '../../components/acceso/AforoResumen'
import EventoHeader from './components/EventoHeader'
import EncargadoAccesoPicker from './components/EncargadoAccesoPicker'
import { formatDay, getErrorMessage, toDay } from '../../utils/format'
import { formatNumber } from '../../utils/validation'
import { movimientoBadge, movimientoLabel } from '../acceso/accesoLabels'

const REFRESH_MS = 20_000
const diaCorto = (fecha) => formatDay(fecha, { weekday: 'short', day: 'numeric', month: 'short' })
const hora = (value) => new Date(value).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })

/** HU-016 / HU-017 / HU-046 (administración): supervisores de la puerta, aforo y registro de accesos por día. */
export default function AccesoEventoPage() {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [fechaId, setFechaId] = useState('')
  const [loadError, setLoadError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const { data: res } = await getAccesoEvento(id, fechaId || undefined)
    setData(res)
    setLoadError('')
  }, [id, fechaId])

  useEffect(() => {
    load().catch((err) => setLoadError(getErrorMessage(err)))
  }, [load])

  const esHoy = data?.aforo?.fecha && toDay(data.aforo.fecha.fecha) === data.hoy
  useEffect(() => {
    if (!esHoy) return undefined
    const timer = setInterval(() => load().catch(() => {}), REFRESH_MS)
    return () => clearInterval(timer)
  }, [esHoy, load])

  const run = async (action, mensaje) => {
    setBusy(true)
    try {
      const { data: res } = await action()
      setData((d) => ({ ...d, supervisores: res.supervisores }))
      toast(mensaje, 'success')
      return true
    } catch (err) {
      toast(getErrorMessage(err), 'error')
      return false
    } finally {
      setBusy(false)
    }
  }

  const onQuitar = async (s) => {
    const ok = await confirmDialog({
      title: 'Quitar supervisor',
      message: `${s.nombre} ya no podrá registrar ingresos ni salidas en este evento. Sus registros anteriores se conservan.`,
      confirmText: 'Quitar',
      cancelText: 'Cancelar',
      tone: 'danger',
    })
    if (ok !== true) return
    await run(() => quitarSupervisorAcceso(id, s.id), 'Supervisor quitado')
  }

  if (!data) {
    return (
      <>
        <EventoHeader eventoId={id} />
        {loadError ? <p className="p-8 text-red-600">{loadError}</p> : <div className="p-8 text-muted">Cargando…</div>}
      </>
    )
  }

  const { evento, fechas, supervisores, aforo, registros, rechazos } = data
  const fechaActual = aforo.fecha?.id ?? ''
  const cerrado = evento.estado === 'FINALIZADO' || evento.estado === 'CANCELADO'

  return (
    <>
      <EventoHeader eventoId={id} titulo={evento.titulo} estado={evento.estado} />

      <div className="space-y-6 p-8">
        {evento.estado !== 'PUBLICADO' && (
          <p className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            El evento no está publicado: los supervisores podrán escanear entradas recién cuando se publique.
          </p>
        )}

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
          <section className="card-surface p-6">
            <h2 className="font-display text-lg font-bold text-ink">Supervisores de la puerta</h2>
            <p className="mt-1 text-sm text-muted">Solo ellos pueden escanear entradas y registrar ingresos y salidas.</p>
            <ul className="mt-4 space-y-2">
              {supervisores.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-ink">
                      {s.nombre}
                      {!s.activo && <span className="ml-1 text-xs text-red-600">(cuenta inactiva)</span>}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {s.email} · {formatNumber(s.registros)} registros
                    </span>
                  </span>
                  <button
                    type="button"
                    className="rounded-full p-1 text-muted hover:bg-red-50 hover:text-red-600"
                    onClick={() => onQuitar(s)}
                    disabled={busy}
                    aria-label={`Quitar a ${s.nombre}`}
                  >
                    <IconX className="h-4 w-4" />
                  </button>
                </li>
              ))}
              {!supervisores.length && (
                <li className="flex items-center gap-2 text-sm text-amber-700">
                  <IconUsers className="h-4 w-4" />
                  Sin supervisores: nadie puede controlar el acceso.
                </li>
              )}
            </ul>
            {!cerrado && (
              <div className="mt-4">
                <EncargadoAccesoPicker
                  eventoId={id}
                  disabled={busy}
                  onPick={(c) => run(() => asignarSupervisorAcceso(id, c.id), `${c.nombre} asignado al control de acceso`)}
                />
              </div>
            )}
          </section>

          <section className="card-surface p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-bold text-ink">Aforo</h2>
                <p className="text-sm text-muted">{esHoy ? 'En tiempo real (se actualiza cada 20 segundos).' : 'Resumen del día elegido.'}</p>
              </div>
              {fechas.length > 1 && (
                <select className="input !w-auto" value={fechaActual} onChange={(e) => setFechaId(e.target.value)} aria-label="Día del evento">
                  {fechas.map((f) => (
                    <option key={f.id} value={f.id}>
                      {diaCorto(f.fecha)}
                      {toDay(f.fecha) === data.hoy ? ' (hoy)' : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="mt-4">
              <AforoResumen aforo={aforo} />
            </div>
          </section>
        </div>

        <section className="card-surface p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-lg font-bold text-ink">
              Registro de accesos{aforo.fecha ? ` · ${diaCorto(aforo.fecha.fecha)}` : ''}
            </h2>
            <span className="text-sm text-muted">
              {formatNumber(data.totalRegistros)} movimientos
              {data.totalRegistros > registros.length ? ` · se muestran los ${formatNumber(registros.length)} más recientes` : ''}
            </span>
          </div>
          <div className="mt-4 overflow-x-auto rounded-md border border-border">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-page text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Hora</th>
                  <th className="px-4 py-3 font-semibold">Movimiento</th>
                  <th className="px-4 py-3 font-semibold">Persona</th>
                  <th className="px-4 py-3 font-semibold">Entrada</th>
                  <th className="px-4 py-3 font-semibold">Supervisor</th>
                  <th className="px-4 py-3 font-semibold">Foto</th>
                </tr>
              </thead>
              <tbody>
                {registros.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{hora(r.createdAt)}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${movimientoBadge(r.tipo)}`}>{movimientoLabel(r.tipo)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-ink">{r.persona ?? '—'}</p>
                      {r.documento && <p className="text-xs text-muted">Doc. {r.documento}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-slate-700">{r.categoria}</p>
                      <p className="font-mono text-xs text-muted">{r.manilla ?? r.codigo}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{r.supervisor ?? '—'}</td>
                    <td className="px-4 py-3">
                      {r.fotoIngresoUrl ? (
                        <a href={r.fotoIngresoUrl} target="_blank" rel="noopener noreferrer" title="Ver foto del primer ingreso">
                          <img src={r.fotoIngresoUrl} alt="Foto del primer ingreso" className="h-10 w-14 rounded border border-border object-cover" />
                        </a>
                      ) : (
                        <span className="text-xs text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {!registros.length && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted">
                      No hay ingresos ni salidas registrados este día.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {rechazos?.length > 0 && (
          <section className="card-surface p-6">
            <h2 className="font-display text-lg font-bold text-ink">Intentos rechazados</h2>
            <p className="mt-1 text-sm text-muted">
              El supervisor no dejó pasar a la persona porque no coincidía con la foto del primer ingreso de esa entrada.
            </p>
            <div className="mt-4 overflow-x-auto rounded-md border border-border">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-page text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Hora</th>
                    <th className="px-4 py-3 font-semibold">Puerta</th>
                    <th className="px-4 py-3 font-semibold">Titular de la entrada</th>
                    <th className="px-4 py-3 font-semibold">Entrada</th>
                    <th className="px-4 py-3 font-semibold">Supervisor</th>
                    <th className="px-4 py-3 font-semibold">Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {rechazos.map((r) => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">{hora(r.createdAt)}</td>
                      <td className="px-4 py-3">
                        <span className="badge bg-red-100 text-red-700">{r.sentido === 'SALIDA' ? 'Salida' : 'Entrada'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-ink">{r.persona ?? '—'}</p>
                        {r.documento && <p className="text-xs text-muted">Doc. {r.documento}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-slate-700">{r.categoria}</p>
                        <p className="font-mono text-xs text-muted">{r.manilla ?? r.codigo}</p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">{r.supervisor ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-700">{r.motivo ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </>
  )
}
