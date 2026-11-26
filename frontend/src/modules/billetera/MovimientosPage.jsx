import { useEffect, useRef, useState } from 'react'
import { Paginas } from '../sprint3/comun'
import { Link, useSearchParams } from 'react-router-dom'
import { getMisMovimientos, getMisSaldos } from '../../api/recargas.api'
import { formatBs, formatDateTime, formatDay, formatTime, getErrorMessage } from '../../utils/format'
import {
  TIPOS_MOVIMIENTO,
  estadoMovimientoBadge,
  estadoMovimientoLabel,
  montoConSigno,
  plazoTexto,
} from '../../utils/movimientos'

/**
 * HU-020 / HU-038 (cliente): historial de transacciones de todos los eventos o de uno solo
 * (Figma: Historial de Transacciones).
 */
export default function MovimientosPage() {
  const [params, setParams] = useSearchParams()
  const eventoId = params.get('evento') || ''
  const page = Math.max(1, Number.parseInt(params.get('page'),10)||1)
  const tipo = params.get('tipo') || ''
  const [eventos, setEventos] = useState(null)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const ultimaPeticion = useRef(0)

  const setFiltro = (key, value) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if(key !== 'page') next.delete('page')
        if (value) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: true },
    )

  useEffect(() => {
    getMisSaldos()
      .then(({ data }) => setEventos(data.saldos))
      .catch((err) => setError(getErrorMessage(err)))
  }, [])

  useEffect(() => {
    const peticion = ++ultimaPeticion.current
    setData(null)
    getMisMovimientos({ eventoId: eventoId || undefined, page, tipo: tipo || undefined })
      .then(({ data }) => {
        if (peticion !== ultimaPeticion.current) return
        setData(data)
        setError('')
      })
      .catch((err) => peticion === ultimaPeticion.current && setError(getErrorMessage(err)))
  }, [eventoId, tipo,page])

  const vigente = data && (data.evento?.id ?? '') === eventoId ? data : null
  const saldoElegido = eventos?.find((e) => e.eventoId === eventoId)
  const pendientes = eventos?.filter((e) => Number(e.saldo) > 0) ?? []

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-10">
      <div>
        <Link to="/mi-manilla" className="text-sm font-semibold text-teal-dark hover:text-teal">
          ← Volver a mi manilla
        </Link>
        <h1 className="mt-2 font-display text-3xl font-bold text-ink">Historial de Transacciones</h1>
        <p className="text-sm text-muted">Consulta recargas, consumos, devoluciones y ajustes de tus eventos</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <aside className="min-w-0 space-y-4">
          <div className="card-surface p-4">
            <p className="label">Evento</p>
            {eventos ? (
              <div className="mt-2 grid gap-1">
                {[{ eventoId: '', titulo: 'Todos los eventos' }, ...eventos].map((e) => (
                  <button
                    key={e.eventoId || 'todos'}
                    type="button"
                    onClick={() => setFiltro('evento', e.eventoId)}
                    aria-pressed={e.eventoId === eventoId}
                    className={`min-w-0 truncate rounded-md px-3 py-2 text-left text-sm ${
                      e.eventoId === eventoId ? 'bg-teal/10 font-semibold text-teal-dark' : 'text-muted hover:bg-page'
                    }`}
                  >
                    {e.titulo}
                  </button>
                ))}
                {!eventos.length && <p className="text-sm text-muted">No tienes eventos con saldo.</p>}
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted">Cargando…</p>
            )}
          </div>
          {vigente?.evento && (
            <div className="card-surface p-4">
              <p className="text-xs text-muted">Saldo de {vigente.evento.titulo}</p>
              <p className="font-display text-3xl font-bold text-teal-dark">{formatBs(vigente.saldo)}</p>
              {vigente.actualizado && (
                <p className="mt-1 text-xs text-muted">Última actualización: {formatDateTime(vigente.actualizado)}</p>
              )}
              {Number(vigente.saldo) > 0 && saldoElegido?.plazoRetiro && (
                <p className="mt-2 text-xs font-medium">{plazoTexto(saldoElegido.plazoRetiro, formatDay)}</p>
              )}
              <p className="mt-3 rounded-md bg-page p-3 text-xs text-muted">
                Los movimientos y el saldo corresponden solo al evento seleccionado. No se combinan ni transfieren entre
                eventos.
              </p>
            </div>
          )}
          {!eventoId && eventos && (
            <div className="card-surface p-4">
              <p className="text-sm font-semibold">Saldos pendientes de retiro</p>
              {pendientes.length ? (
                <ul className="mt-2 divide-y divide-border">
                  {pendientes.map((e) => (
                    <li key={e.eventoId} className="py-2">
                      <div className="flex justify-between gap-2 text-sm">
                        <span className="min-w-0 truncate">{e.titulo}</span>
                        <span className="shrink-0 font-semibold text-teal-dark">{formatBs(e.saldo)}</span>
                      </div>
                      {e.plazoRetiro && <p className="text-xs text-muted">{plazoTexto(e.plazoRetiro, formatDay)}</p>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-muted">No tienes saldo pendiente.</p>
              )}
              <p className="mt-3 rounded-md bg-page p-3 text-xs text-muted">
                Cada saldo pertenece solo a su evento. No se combinan ni transfieren entre eventos.
              </p>
            </div>
          )}
        </aside>

        <section className="card-surface min-w-0 p-4 sm:p-6">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Tipo de movimiento">
            {[{ value: '', label: 'Todos' }, ...TIPOS_MOVIMIENTO].map((t) => (
              <button
                key={t.value || 'todos'}
                type="button"
                aria-pressed={tipo === t.value}
                onClick={() => setFiltro('tipo', t.value)}
                className={`rounded-full border px-3 py-1 text-sm ${
                  tipo === t.value ? 'border-teal bg-teal/10 font-semibold text-teal-dark' : 'border-border text-muted'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {error && (
            <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
              {error}
            </p>
          )}

          {vigente && (
            <>
              <p className="mt-4 text-sm text-muted">
                {vigente.cantidad} {vigente.cantidad === 1 ? 'movimiento encontrado' : 'movimientos encontrados'}
              </p>
              <Paginas page={page} onChange={p=>setFiltro('page',String(p))} mas={page*vigente.pageSize<vigente.cantidad}/>
              <ul className="mt-3 divide-y divide-border">
                {vigente.movimientos.map((m) => {
                  const negativo = Number(m.monto) < 0
                  const anulado = m.estado === 'ANULADA'
                  return (
                    <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 text-sm">
                      <div className="w-28 shrink-0 text-muted">
                        <p>{new Date(m.fecha).toLocaleDateString('es-BO', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                        <p className="text-xs">{formatTime(m.fecha)}</p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{m.operacion}</p>
                        <p className="text-xs text-muted">{m.codigo}</p>
                        {!eventoId && <p className="truncate text-xs font-medium text-teal-dark">{m.evento.titulo}</p>}
                      </div>
                      <div className="w-28 text-right">
                        <p
                          className={`font-semibold tabular-nums ${
                            anulado ? 'text-muted line-through' : negativo ? 'text-red-600' : 'text-emerald-700'
                          }`}
                        >
                          {montoConSigno(m.monto, formatBs)}
                        </p>
                        <p className="text-xs text-muted">Saldo {formatBs(m.saldoResultante)}</p>
                      </div>
                      <span className={`badge ${estadoMovimientoBadge(m.estado)}`}>{estadoMovimientoLabel(m.estado)}</span>
                    </li>
                  )
                })}
                {!vigente.movimientos.length && (
                  <li className="py-10 text-center text-sm text-muted">No hay movimientos con este filtro.</li>
                )}
              </ul>
            </>
          )}
          {!vigente && !error && <p className="mt-6 text-sm text-muted">Cargando…</p>}
        </section>
      </div>
    </div>
  )
}
