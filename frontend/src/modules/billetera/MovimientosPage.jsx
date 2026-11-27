import { useEffect, useMemo, useRef, useState } from 'react'
import { Paginas } from '../sprint3/comun'
import { Link, useSearchParams } from 'react-router-dom'
import { getMisMovimientos, getMisSaldos } from '../../api/recargas.api'
import { IconSearch } from '../../components/ui/icons'
import PendingRegion from '../../components/ui/PendingRegion'
import { Skeleton } from '../../components/ui/Skeleton'
import { formatBs, formatTime, getErrorMessage } from '../../utils/format'
import {
  TIPOS_MOVIMIENTO,
  estadoMovimientoBadge,
  estadoMovimientoLabel,
  montoConSigno,
} from '../../utils/movimientos'

const EVENTOS_PAGE_SIZE = 10

/** HU-020 (cliente): historial de transacciones del saldo de un evento (Figma: Historial de Transacciones). */
export default function MovimientosPage() {
  const [params, setParams] = useSearchParams()
  const eventoId = params.get('evento') || ''
  const page = Math.max(1, Number.parseInt(params.get('page'), 10) || 1)
  const tipo = params.get('tipo') || ''
  const [eventos, setEventos] = useState(null)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [actualizando, setActualizando] = useState(false)
  const [eventoQ, setEventoQ] = useState('')
  const [eventosPage, setEventosPage] = useState(1)
  const ultimaPeticion = useRef(0)

  const eventosFiltrados = useMemo(() => {
    const lista = eventos ?? []
    const q = eventoQ.trim().toLowerCase()
    if (!q) return lista
    return lista.filter((e) => e.titulo.toLowerCase().includes(q))
  }, [eventos, eventoQ])

  const eventosTotalPages = eventosFiltrados.length
    ? Math.ceil(eventosFiltrados.length / EVENTOS_PAGE_SIZE)
    : 0

  const eventosPagina = useMemo(() => {
    const start = (eventosPage - 1) * EVENTOS_PAGE_SIZE
    return eventosFiltrados.slice(start, start + EVENTOS_PAGE_SIZE)
  }, [eventosFiltrados, eventosPage])

  useEffect(() => {
    setEventosPage(1)
  }, [eventoQ])

  const setFiltro = (key, value) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (key !== 'page') next.delete('page')
        if (value) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: true },
    )

  useEffect(() => {
    getMisSaldos()
      .then(({ data }) => {
        setEventos(data.saldos)
        // Sin evento en la URL se muestra el primero (el que está en curso o el más próximo).
        if (!eventoId && data.saldos[0]) setFiltro('evento', data.saldos[0].eventoId)
      })
      .catch((err) => setError(getErrorMessage(err)))
    // Solo al abrir la pantalla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!eventoId) return
    const peticion = ++ultimaPeticion.current
    setActualizando(true)
    getMisMovimientos({ eventoId, page, tipo: tipo || undefined })
      .then(({ data }) => {
        if (peticion !== ultimaPeticion.current) return
        setData(data)
        setError('')
      })
      .catch((err) => peticion === ultimaPeticion.current && setError(getErrorMessage(err)))
      .finally(() => {
        if (peticion === ultimaPeticion.current) setActualizando(false)
      })
  }, [eventoId, tipo, page])

  const vigente = data && data.evento.id === eventoId ? data : null

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:py-10">
      <header className="min-w-0">
        <Link to="/mi-manilla" className="text-sm font-semibold text-primary hover:text-primary-hover">
          ← Volver a mi manilla
        </Link>
        <h1 className="mt-2 font-display text-3xl font-bold text-ink text-balance">Movimientos</h1>
      </header>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <aside className="min-w-0 space-y-4">
          <div className="card-surface p-4">
            <p className="label">Evento</p>
            {eventos ? (
              <>
                <label className="mt-2 flex min-h-11 items-center gap-2 rounded-lg border border-border bg-page px-2.5 py-1.5">
                  <IconSearch className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden="true" />
                  <input
                    type="search"
                    value={eventoQ}
                    onChange={(e) => setEventoQ(e.target.value)}
                    placeholder="Buscar evento…"
                    autoComplete="off"
                    spellCheck={false}
                    className="min-w-0 flex-1 border-0 bg-transparent text-sm text-ink outline-none placeholder:text-muted"
                    aria-label="Buscar evento"
                  />
                </label>
                <div className="mt-2 grid gap-1">
                  {eventosPagina.map((e) => (
                    <button
                      key={e.eventoId}
                      type="button"
                      onClick={() => setFiltro('evento', e.eventoId)}
                      aria-pressed={e.eventoId === eventoId}
                      className={`min-h-11 min-w-0 truncate rounded-md px-3 py-2 text-left text-sm transition-colors ${
                        e.eventoId === eventoId
                          ? 'bg-primary-soft font-semibold text-primary'
                          : 'text-muted hover:bg-page hover:text-ink'
                      }`}
                    >
                      {e.titulo}
                    </button>
                  ))}
                  {!eventos.length && <p className="text-sm text-muted">No tienes eventos con saldo.</p>}
                  {eventos.length > 0 && !eventosFiltrados.length && (
                    <p className="text-sm text-muted">Ningún evento coincide.</p>
                  )}
                </div>
                {eventosTotalPages > 1 ? (
                  <nav
                    aria-label="Eventos con saldo"
                    className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-2"
                  >
                    <button
                      type="button"
                      className="btn-secondary btn-sm"
                      disabled={eventosPage <= 1}
                      onClick={() => setEventosPage((p) => p - 1)}
                    >
                      Anterior
                    </button>
                    <span className="text-xs tabular-nums text-muted">
                      {eventosPage} / {eventosTotalPages}
                    </span>
                    <button
                      type="button"
                      className="btn-secondary btn-sm"
                      disabled={eventosPage >= eventosTotalPages}
                      onClick={() => setEventosPage((p) => p + 1)}
                    >
                      Siguiente
                    </button>
                  </nav>
                ) : null}
              </>
            ) : (
              <div className="mt-3 space-y-2" aria-busy="true">
                <span className="sr-only">Cargando…</span>
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-4/5" />
              </div>
            )}
          </div>
          {vigente && (
            <div className="overflow-hidden rounded-xl border border-border bg-sidebar p-4 text-white shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-white/65">
                Saldo · {vigente.evento.titulo}
              </p>
              <p className="mt-1 font-display text-3xl font-bold tabular-nums">{formatBs(vigente.saldo)}</p>
              {vigente.actualizado && (
                <time className="mt-2 block text-xs tabular-nums text-white/70" dateTime={vigente.actualizado}>
                  Actualizado{' '}
                  {new Date(vigente.actualizado).toLocaleDateString('es-BO', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                  <span aria-hidden="true"> · </span>
                  {formatTime(vigente.actualizado)}
                </time>
              )}
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
                className={`min-h-9 rounded-full border px-3 py-1 text-sm transition-colors ${
                  tipo === t.value
                    ? 'border-primary bg-primary-soft font-semibold text-primary'
                    : 'border-border text-muted hover:border-primary/40 hover:text-ink'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {error && (
            <p className="mt-4 rounded-md border border-danger/30 bg-danger-soft p-3 text-sm text-danger" role="alert">
              {error}
            </p>
          )}

          {vigente && (
            <PendingRegion pending={actualizando} className="mt-4">
              <>
                <p className="text-sm text-muted">
                  {vigente.cantidad} {vigente.cantidad === 1 ? 'movimiento' : 'movimientos'}
                </p>
                <Paginas
                  page={page}
                  onChange={(p) => setFiltro('page', String(p))}
                  mas={page * vigente.pageSize < vigente.cantidad}
                />
                <ul className="mt-3 divide-y divide-border">
                  {vigente.movimientos.map((m) => {
                    const negativo = Number(m.monto) < 0
                    const anulado = m.estado === 'ANULADA'
                    return (
                      <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3.5 text-sm">
                        <div className="w-28 shrink-0 text-muted">
                          <p className="tabular-nums">
                            {new Date(m.fecha).toLocaleDateString('es-BO', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </p>
                          <p className="text-xs tabular-nums">{formatTime(m.fecha)}</p>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-ink">{m.operacion}</p>
                          <p className="text-xs text-muted">{m.codigo}</p>
                        </div>
                        <div className="w-28 text-right">
                          <p
                            className={`font-semibold tabular-nums ${
                              anulado
                                ? 'text-muted line-through'
                                : negativo
                                  ? 'text-danger'
                                  : 'text-success'
                            }`}
                          >
                            {montoConSigno(m.monto, formatBs)}
                          </p>
                          <p className="text-xs text-muted">Saldo {formatBs(m.saldoResultante)}</p>
                        </div>
                        <span className={`badge ${estadoMovimientoBadge(m.estado)}`}>
                          {estadoMovimientoLabel(m.estado)}
                        </span>
                      </li>
                    )
                  })}
                  {!vigente.movimientos.length && (
                    <li className="py-10 text-center text-sm text-muted">No hay movimientos con este filtro.</li>
                  )}
                </ul>
              </>
            </PendingRegion>
          )}
          {!vigente && !error && eventoId && (
            <div className="mt-6 space-y-3" aria-busy="true" role="status">
              <span className="sr-only">Cargando movimientos…</span>
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
