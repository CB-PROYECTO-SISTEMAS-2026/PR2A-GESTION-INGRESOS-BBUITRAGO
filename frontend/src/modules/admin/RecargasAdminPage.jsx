import { useCallback, useEffect, useRef, useState } from 'react'
import { getAllEventsAdmin } from '../../api/events.api'
import { anularRecarga, getRecargasAdmin, resolverIncidenciaRecarga } from '../../api/recargas.api'
import { toast } from '../../components/Toast'
import Modal from '../../components/ui/Modal'
import { formatBs, formatDateTime, getErrorMessage } from '../../utils/format'
import { estadoMovimientoBadge, estadoMovimientoLabel } from '../../utils/movimientos'
import { INCIDENCIA_TEXTO_MAX, tipoIncidenciaLabel } from '../recargas/incidencias'

const ESTADOS = [
  { value: '', label: 'Todas' },
  { value: 'COMPLETADA', label: 'Vigentes' },
  { value: 'ANULADA', label: 'Anuladas' },
]
const MOTIVO_MAX = 120

/**
 * HU-047: el administrador general revisa las recargas de todos los eventos y anula las que se
 * hicieron por error. Solo él puede anular: el saldo vuelve a como estaba y queda el rastro.
 * Los recargadores reportan incidencias desde su historial y aquí se resuelven.
 */
export default function RecargasAdminPage() {
  const [eventos, setEventos] = useState([])
  const [filtro, setFiltro] = useState({ eventoId: '', estado: '', incidencia: '', desde: '', hasta: '' })
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [anulando, setAnulando] = useState(null)
  const [resolviendo, setResolviendo] = useState(null)
  const ultimaPeticion = useRef(0)

  useEffect(() => {
    getAllEventsAdmin()
      .then(({ data }) => setEventos(Array.isArray(data) ? data : data?.data ?? []))
      .catch(() => setEventos([]))
  }, [])

  const cargar = useCallback(async () => {
    const peticion = ++ultimaPeticion.current
    try {
      const params = Object.fromEntries(Object.entries({ ...filtro, page }).filter(([, v]) => v))
      const { data } = await getRecargasAdmin(params)
      if (peticion !== ultimaPeticion.current) return
      setData(data)
      setError('')
    } catch (err) {
      if (peticion === ultimaPeticion.current) setError(getErrorMessage(err))
    }
  }, [filtro, page])

  useEffect(() => {
    cargar()
  }, [cargar])

  const cambiarFiltro = (cambios) => {
    setFiltro((f) => ({ ...f, ...cambios }))
    setPage(1)
  }

  return (
    <div className="p-4 sm:p-8">
      <h1 className="font-display text-3xl font-bold">Recargas de saldo</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Recargas en efectivo hechas por los recargadores en los eventos. Si una recarga se hizo por error (monto o cliente
        equivocado), anúlala: el monto se descuenta del saldo del cliente y queda registrado el motivo. Los problemas que
        reportan los recargadores aparecen como incidencias.
      </p>

      {data?.incidenciasAbiertas > 0 && filtro.incidencia !== 'ABIERTA' && (
        <button
          type="button"
          className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100"
          onClick={() => cambiarFiltro({ incidencia: 'ABIERTA', estado: '' })}
        >
          {data.incidenciasAbiertas === 1
            ? 'Hay 1 incidencia sin resolver · Ver'
            : `Hay ${data.incidenciasAbiertas} incidencias sin resolver · Ver`}
        </button>
      )}

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <div className="flex gap-2" role="tablist" aria-label="Estado">
          {ESTADOS.map((e) => (
            <button
              key={e.value || 'todas'}
              type="button"
              role="tab"
              aria-selected={filtro.estado === e.value}
              onClick={() => cambiarFiltro({ estado: e.value })}
              className={`rounded-md border px-3 py-2 text-sm font-semibold ${
                filtro.estado === e.value ? 'border-teal bg-teal/10 text-ink' : 'border-border bg-white text-muted hover:text-ink'
              }`}
            >
              {e.label}
            </button>
          ))}
          <button
            type="button"
            role="tab"
            aria-selected={filtro.incidencia === 'ABIERTA'}
            onClick={() => cambiarFiltro({ incidencia: filtro.incidencia === 'ABIERTA' ? '' : 'ABIERTA' })}
            className={`rounded-md border px-3 py-2 text-sm font-semibold ${
              filtro.incidencia === 'ABIERTA'
                ? 'border-amber-400 bg-amber-50 text-ink'
                : 'border-border bg-white text-muted hover:text-ink'
            }`}
          >
            Con incidencia abierta
          </button>
        </div>
        <label className="text-xs text-muted">
          Evento
          <select
            className="input mt-1 !py-1.5 text-sm"
            value={filtro.eventoId}
            onChange={(e) => cambiarFiltro({ eventoId: e.target.value })}
          >
            <option value="">Todos los eventos</option>
            {eventos.map((e) => (
              <option key={e.id} value={e.id}>
                {e.titulo}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted">
          Desde
          <input
            type="date"
            className="input mt-1 !py-1.5 text-sm"
            value={filtro.desde}
            max={filtro.hasta || undefined}
            onChange={(e) => cambiarFiltro({ desde: e.target.value })}
          />
        </label>
        <label className="text-xs text-muted">
          Hasta
          <input
            type="date"
            className="input mt-1 !py-1.5 text-sm"
            value={filtro.hasta}
            min={filtro.desde || undefined}
            onChange={(e) => cambiarFiltro({ hasta: e.target.value })}
          />
        </label>
      </div>

      {error && (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      )}
      {!data && !error && <p className="mt-8 text-muted">Cargando…</p>}

      {data && (
        <>
          <p className="mt-4 text-sm text-muted">
            {data.totalItems} {data.totalItems === 1 ? 'recarga' : 'recargas'} · Total vigente{' '}
            <strong className="text-ink">{formatBs(data.totalRecargado)}</strong>
          </p>
          <div className="mt-3 overflow-x-auto rounded-lg border border-border bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-page text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Evento</th>
                  <th className="px-4 py-3 font-medium">Recargador</th>
                  <th className="px-4 py-3 text-right font-medium">Monto</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data.recargas.map((r) => (
                  <tr key={r.id} className="border-t border-border align-top">
                    <td className="whitespace-nowrap px-4 py-3">
                      <p className="text-muted">{formatDateTime(r.fecha)}</p>
                      <p className="font-mono text-xs text-muted">{r.codigo}</p>
                    </td>
                    <td className="px-4 py-3 font-medium">{r.cliente}</td>
                    <td className="px-4 py-3">{r.evento}</td>
                    <td className="px-4 py-3">{r.recargador}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums">
                      {formatBs(r.monto)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${estadoMovimientoBadge(r.estado)}`}>{estadoMovimientoLabel(r.estado)}</span>
                      {r.estado === 'ANULADA' && r.nota && <p className="mt-1 max-w-xs text-xs text-muted">{r.nota}</p>}
                      {r.incidencia && (
                        <div
                          className={`mt-2 max-w-xs rounded-md px-2 py-1.5 text-xs ${
                            r.incidencia.abierta ? 'bg-amber-50 text-amber-900' : 'bg-slate-50 text-slate-700'
                          }`}
                        >
                          <p className="font-semibold">
                            {r.incidencia.abierta ? 'Incidencia abierta' : 'Incidencia resuelta'} ·{' '}
                            {tipoIncidenciaLabel(r.incidencia.tipo)}
                          </p>
                          <p className="mt-0.5">{r.incidencia.descripcion}</p>
                          {r.incidencia.resolucion && <p className="mt-1">Resolución: {r.incidencia.resolucion}</p>}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        {r.incidencia?.abierta && (
                          <button type="button" className="btn-secondary btn-sm" onClick={() => setResolviendo(r)}>
                            Resolver
                          </button>
                        )}
                        {r.estado === 'COMPLETADA' && (
                          <button type="button" className="btn-secondary btn-sm text-red-700" onClick={() => setAnulando(r)}>
                            Anular
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!data.recargas.length && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-muted">
                      No hay recargas con este filtro.
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

      <AnularRecargaModal
        recarga={anulando}
        onClose={() => setAnulando(null)}
        onAnulada={async (res) => {
          setAnulando(null)
          toast(`Recarga ${res.codigo} anulada. Nuevo saldo del cliente: ${formatBs(res.saldoResultante)}`, 'success')
          await cargar()
        }}
      />

      <ResolverIncidenciaModal
        recarga={resolviendo}
        onClose={() => setResolviendo(null)}
        onResuelta={async () => {
          setResolviendo(null)
          toast('Incidencia resuelta.', 'success')
          await cargar()
        }}
      />
    </div>
  )
}

function ResolverIncidenciaModal({ recarga, onClose, onResuelta }) {
  const [resolucion, setResolucion] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  const cerrar = () => {
    if (enviando) return
    setResolucion('')
    setError('')
    onClose()
  }

  const enviar = async (e) => {
    e.preventDefault()
    if (resolucion.trim().length < 5) {
      setError('Escribe cómo se resolvió (mínimo 5 caracteres).')
      return
    }
    setEnviando(true)
    setError('')
    try {
      await resolverIncidenciaRecarga(recarga.incidencia.id, resolucion.trim())
      setResolucion('')
      await onResuelta()
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudo resolver la incidencia.'))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal
      open={Boolean(recarga)}
      onClose={cerrar}
      title="Resolver incidencia"
      size="sm"
      labelledBy="resolver-incidencia-title"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={cerrar} disabled={enviando}>
            Cancelar
          </button>
          <button type="submit" form="form-resolver-incidencia" className="btn-primary" disabled={enviando}>
            {enviando ? 'Guardando…' : 'Marcar como resuelta'}
          </button>
        </>
      }
    >
      {recarga?.incidencia && (
        <form id="form-resolver-incidencia" onSubmit={enviar} className="grid gap-4 px-6 py-5">
          <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-semibold">
              {tipoIncidenciaLabel(recarga.incidencia.tipo)} · reportada por {recarga.recargador}
            </p>
            <p className="mt-1">{recarga.incidencia.descripcion}</p>
          </div>
          <p className="text-sm text-muted">
            Recarga <span className="font-mono">{recarga.codigo}</span> de{' '}
            <strong className="text-ink">{formatBs(recarga.monto)}</strong> a {recarga.cliente}. Si hay que devolver el
            saldo, usa <strong className="text-ink">Anular</strong>: la incidencia se cierra sola.
          </p>
          <div>
            <label className="label" htmlFor="resolucion-incidencia">
              Resolución *
            </label>
            <textarea
              id="resolucion-incidencia"
              className="input"
              rows={3}
              maxLength={INCIDENCIA_TEXTO_MAX}
              placeholder="Ej.: se verificó con el cliente y la recarga es correcta"
              value={resolucion}
              onChange={(e) => setResolucion(e.target.value)}
            />
            <p className="mt-1 text-right text-xs text-muted">
              {resolucion.length}/{INCIDENCIA_TEXTO_MAX}
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

function AnularRecargaModal({ recarga, onClose, onAnulada }) {
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  const cerrar = () => {
    if (enviando) return
    setMotivo('')
    setError('')
    onClose()
  }

  const enviar = async (e) => {
    e.preventDefault()
    if (motivo.trim().length < 5) {
      setError('Escribe el motivo de la anulación (mínimo 5 caracteres).')
      return
    }
    setEnviando(true)
    setError('')
    try {
      const { data } = await anularRecarga(recarga.id, motivo.trim())
      setMotivo('')
      await onAnulada(data)
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudo anular la recarga.'))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal
      open={Boolean(recarga)}
      onClose={cerrar}
      title="Anular recarga"
      size="sm"
      labelledBy="anular-recarga-title"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={cerrar} disabled={enviando}>
            Cancelar
          </button>
          <button type="submit" form="form-anular-recarga" className="btn-danger" disabled={enviando}>
            {enviando ? 'Anulando…' : 'Anular recarga'}
          </button>
        </>
      }
    >
      {recarga && (
        <form id="form-anular-recarga" onSubmit={enviar} className="grid gap-4 px-6 py-5">
          <p className="text-sm text-muted">
            Se descontarán <strong className="text-ink">{formatBs(recarga.monto)}</strong> del saldo de{' '}
            <strong className="text-ink">{recarga.cliente}</strong> en {recarga.evento}. Si el cliente ya gastó ese saldo,
            no se podrá anular.
          </p>
          <div>
            <label className="label" htmlFor="motivo-anulacion">
              Motivo *
            </label>
            <textarea
              id="motivo-anulacion"
              className="input"
              rows={3}
              maxLength={MOTIVO_MAX}
              placeholder="Ej.: se recargó Bs 200 en lugar de Bs 20"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
            <p className="mt-1 text-right text-xs text-muted">
              {motivo.length}/{MOTIVO_MAX}
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
