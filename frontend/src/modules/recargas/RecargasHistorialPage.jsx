import { useEffect, useState } from 'react'
import { getMisRecargas, reportarIncidenciaRecarga } from '../../api/recargas.api'
import { toast } from '../../components/Toast'
import RangoDiasFiltro from '../../components/staff/RangoDiasFiltro'
import Modal from '../../components/ui/Modal'
import { formatBs, formatDay, formatDayRange, formatTime, getErrorMessage, localDay } from '../../utils/format'
import { INCIDENCIA_TEXTO_MAX, TIPOS_INCIDENCIA, tipoIncidenciaLabel } from './incidencias'

/**
 * HU-020: recargas hechas por el recargador, por día o rango de fechas, con el efectivo recibido.
 * HU-047: desde aquí reporta los problemas de una recarga para que el administrador los resuelva.
 */
export default function RecargasHistorialPage() {
  const [desde, setDesde] = useState(localDay())
  const [hasta, setHasta] = useState(localDay())
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [reportando, setReportando] = useState(null)

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
            const incidencia = r.incidencia
            return (
              <li key={r.id} className="rounded-xl border border-border bg-white p-3">
                <div className="flex items-center gap-3">
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
                </div>
                {incidencia ? (
                  <div
                    className={`mt-2 rounded-lg px-3 py-2 text-xs ${
                      incidencia.abierta ? 'bg-amber-50 text-amber-900' : 'bg-slate-50 text-slate-700'
                    }`}
                  >
                    <p className="font-semibold">
                      {incidencia.abierta ? 'Problema reportado · en revisión' : 'Problema resuelto'} ·{' '}
                      {tipoIncidenciaLabel(incidencia.tipo)}
                    </p>
                    <p className="mt-0.5">{incidencia.descripcion}</p>
                    {incidencia.resolucion && <p className="mt-1">Respuesta: {incidencia.resolucion}</p>}
                  </div>
                ) : (
                  !anulada && (
                    <div className="mt-2 text-right">
                      <button
                        type="button"
                        className="text-xs font-semibold text-amber-700 hover:underline"
                        onClick={() => setReportando(r)}
                      >
                        Reportar un problema
                      </button>
                    </div>
                  )
                )}
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

      <ReportarIncidenciaModal
        recarga={reportando}
        onClose={() => setReportando(null)}
        onReportada={(res) => {
          setReportando(null)
          setData((d) =>
            d && {
              ...d,
              recargas: d.recargas.map((r) => (r.id === res.recargaId ? { ...r, incidencia: res.incidencia } : r)),
            },
          )
          toast('Problema reportado. El administrador lo revisará.', 'success')
        }}
      />
    </div>
  )
}

function ReportarIncidenciaModal({ recarga, onClose, onReportada }) {
  const [tipo, setTipo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  const cerrar = () => {
    if (enviando) return
    setTipo('')
    setDescripcion('')
    setError('')
    onClose()
  }

  const enviar = async (e) => {
    e.preventDefault()
    if (!tipo) {
      setError('Elige qué tipo de problema tuvo la recarga.')
      return
    }
    if (descripcion.trim().length < 5) {
      setError('Describe lo que pasó (mínimo 5 caracteres).')
      return
    }
    setEnviando(true)
    setError('')
    try {
      const { data } = await reportarIncidenciaRecarga(recarga.id, { tipo, descripcion: descripcion.trim() })
      setTipo('')
      setDescripcion('')
      onReportada(data)
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudo reportar el problema.'))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal
      open={Boolean(recarga)}
      onClose={cerrar}
      title="Reportar un problema"
      size="sm"
      labelledBy="reportar-incidencia-title"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={cerrar} disabled={enviando}>
            Cancelar
          </button>
          <button type="submit" form="form-reportar-incidencia" className="btn-primary" disabled={enviando}>
            {enviando ? 'Enviando…' : 'Reportar'}
          </button>
        </>
      }
    >
      {recarga && (
        <form id="form-reportar-incidencia" onSubmit={enviar} className="grid gap-4 px-6 py-5">
          <p className="text-sm text-muted">
            Recarga <span className="font-mono">{recarga.codigo}</span> de{' '}
            <strong className="text-ink">{formatBs(recarga.monto)}</strong> a {recarga.cliente}. El saldo no cambia hasta que
            el administrador lo revise.
          </p>
          <div>
            <label className="label" htmlFor="tipo-incidencia">
              ¿Qué pasó? *
            </label>
            <select id="tipo-incidencia" className="input" value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="">Elige una opción</option>
              {TIPOS_INCIDENCIA.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="descripcion-incidencia">
              Detalle *
            </label>
            <textarea
              id="descripcion-incidencia"
              className="input"
              rows={3}
              maxLength={INCIDENCIA_TEXTO_MAX}
              placeholder="Ej.: el cliente pidió Bs 20 y se cargaron Bs 200"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
            />
            <p className="mt-1 text-right text-xs text-muted">
              {descripcion.length}/{INCIDENCIA_TEXTO_MAX}
            </p>
          </div>
          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
        </form>
      )}
    </Modal>
  )
}
