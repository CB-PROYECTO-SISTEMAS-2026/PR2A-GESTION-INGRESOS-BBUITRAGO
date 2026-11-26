import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { cancelarCompra, getMisCompras } from '../../api/compras.api'
import { toast } from '../../components/Toast'
import { confirmDialog } from '../../components/ui/ConfirmDialog'
import { SkeletonCard } from '../../components/ui/Skeleton'
import { IconExternal, IconTicket } from '../../components/ui/icons'
import MisEntradasExplorerToolbar from '../../components/entradas/MisEntradasExplorerToolbar'
import { useAuth } from '../../context/AuthContext'
import { eventImage, formatBs, formatDateTime, formatDay, getErrorMessage } from '../../utils/format'
import { compraEstadoBadge, compraEstadoLabel } from './compraEstado'

const diaCorto = (fecha) => formatDay(fecha, { weekday: 'short', day: 'numeric', month: 'short' })
const PAGE_SIZE = 10

function puedeDevolverCompra(compra) {
  if (compra.estado !== 'APROBADA') return false
  const hasta = compra.reembolsoHasta || compra.evento?.reembolsoHasta
  if (hasta && new Date(hasta).getTime() < Date.now()) return false
  return (compra.entradas ?? []).some((e) => ['ASIGNADA', 'GENERADA'].includes(e.estado || e))
}

function CompraCard({ compra, onCancelar, busy }) {
  const pendiente = compra.estado === 'PENDIENTE'
  const devolver = puedeDevolverCompra(compra)

  return (
    <article className="ev-compra-card">
      <Link to={`/eventos/${compra.evento.id}`} className="ev-compra-media">
        <img
          src={eventImage(compra.evento)}
          alt=""
          className="ev-compra-img"
          width={640}
          height={360}
          loading="lazy"
        />
        <div className="ev-compra-veil" />
        <span className={`badge ev-compra-badge ${compraEstadoBadge(compra.estado)}`}>
          {compraEstadoLabel(compra.estado)}
        </span>
      </Link>

      <div className="ev-compra-body">
        <div className="min-w-0 flex-1">
          <Link to={`/eventos/${compra.evento.id}`} className="ev-compra-title text-balance">
            {compra.evento.titulo}
          </Link>
          <p className="mt-1 text-sm text-muted">{formatDateTime(compra.createdAt)}</p>
        </div>
        <p className="shrink-0 font-display text-xl font-bold tabular-nums text-ink">{formatBs(compra.montoTotal)}</p>
      </div>

      <ul className="ev-compra-items">
        {compra.items.map((i) => (
          <li key={i.id} className="flex min-w-0 items-center justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-slate-700">
              <strong className="text-ink">
                {i.cantidad} × {i.categoria}
              </strong>
              {i.fecha ? ` · ${diaCorto(i.fecha)}` : ''}
            </span>
            <span className="shrink-0 tabular-nums font-semibold text-ink">{formatBs(i.subtotal)}</span>
          </li>
        ))}
      </ul>

      {pendiente && <p className="ev-compra-note ev-compra-note--warn">Verificando comprobante</p>}
      {compra.estado === 'RECHAZADA' && (
        <div className="ev-compra-note ev-compra-note--danger">
          <p className="font-semibold">Pago rechazado</p>
          {compra.motivoRechazo && <p className="mt-0.5 break-words">{compra.motivoRechazo}</p>}
        </div>
      )}
      {compra.estado === 'APROBADA' && (
        <p className="ev-compra-note ev-compra-note--ok">
          {compra.entradas.length} {compra.entradas.length === 1 ? 'entrada emitida' : 'entradas emitidas'}
        </p>
      )}

      <div className="ev-compra-actions">
        {compra.comprobanteUrl && (
          <a href={compra.comprobanteUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-sm">
            <IconExternal />
            Comprobante
          </a>
        )}
        {compra.estado === 'APROBADA' && (
          <Link to="/mis-entradas" className="btn-primary btn-sm">
            <IconTicket />
            Mis entradas
          </Link>
        )}
        {devolver && (
          <Link to="/mis-reembolsos" className="btn-secondary btn-sm">
            Devolución de entrada
          </Link>
        )}
        {pendiente && (
          <button
            type="button"
            className="btn-secondary btn-sm !text-danger hover:!bg-danger-soft"
            onClick={() => onCancelar(compra)}
            disabled={busy}
          >
            {busy ? 'Cancelando…' : 'Cancelar'}
          </button>
        )}
      </div>
    </article>
  )
}

export default function MisComprasPage() {
  const { user } = useAuth()
  const [compras, setCompras] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [page, setPage] = useState(1)
  const [meta, setMeta] = useState({ total: 0, totalPages: 0, pageSize: PAGE_SIZE })
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [dateMode, setDateMode] = useState('range')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')

  const hasActiveFilters = Boolean(q.trim() || desde || hasta)

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q), 400)
    return () => window.clearTimeout(t)
  }, [q])

  useEffect(() => {
    setPage(1)
  }, [debouncedQ, desde, hasta])

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await getMisCompras({
        page,
        limit: PAGE_SIZE,
        q: debouncedQ.trim() || undefined,
        desde: desde || undefined,
        hasta: hasta || undefined,
      })
      setCompras(data.compras ?? [])
      setMeta({
        total: data.total ?? 0,
        totalPages: data.totalPages ?? 0,
        pageSize: data.pageSize ?? PAGE_SIZE,
      })
      setError('')
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudieron cargar tus compras.'))
    } finally {
      setLoading(false)
    }
  }, [page, debouncedQ, desde, hasta])

  useEffect(() => {
    cargar()
  }, [cargar])

  const onCancelar = async (compra) => {
    const ok = await confirmDialog({
      title: 'Cancelar compra',
      message: `Se cancelará la compra de ${compra.totalEntradas} ${compra.totalEntradas === 1 ? 'entrada' : 'entradas'} para “${compra.evento.titulo}”.`,
      confirmText: 'Cancelar compra',
      cancelText: 'Volver',
      tone: 'danger',
    })
    if (ok !== true) return
    setBusyId(compra.id)
    try {
      await cancelarCompra(compra.id)
      toast('Compra cancelada', 'success')
      await cargar()
    } catch (err) {
      toast(getErrorMessage(err), 'error')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="font-display text-3xl font-bold text-ink text-balance">Mis compras</h1>

      {error && (
        <p className="mt-6 rounded-md border border-danger/30 bg-danger-soft p-3 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <MisEntradasExplorerToolbar
        listKind="compras"
        userId={user?.id}
        q={q}
        onQueryChange={setQ}
        dateMode={dateMode}
        onDateModeChange={setDateMode}
        desde={desde}
        hasta={hasta}
        onDatesApply={({ desde: d, hasta: h }) => {
          setDesde(d)
          setHasta(h)
        }}
        onClearAll={() => {
          setQ('')
          setDesde('')
          setHasta('')
        }}
        hasActiveFilters={hasActiveFilters}
      />

      {loading && !compras && !error && (
        <div className="mt-6 grid gap-5 sm:grid-cols-2" aria-busy="true">
          <span className="sr-only">Cargando…</span>
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {!loading && compras && !compras.length && !hasActiveFilters && (
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <div className="card-surface col-span-full flex flex-col items-center gap-3 p-10 text-center">
            <IconTicket className="h-10 w-10 text-muted" aria-hidden="true" />
            <p className="font-semibold text-ink">Todavía no compraste entradas</p>
            <Link to="/eventos" className="btn-primary">
              Ver eventos
            </Link>
          </div>
        </div>
      )}

      {!loading && compras && !compras.length && hasActiveFilters && (
        <p className="mt-6 text-sm text-muted">Ninguna compra coincide con esos filtros.</p>
      )}

      {(compras ?? []).length > 0 ? (
        <div className="mt-6 grid gap-5 sm:grid-cols-2" aria-busy={loading}>
          {compras.map((c) => (
            <CompraCard key={c.id} compra={c} onCancelar={onCancelar} busy={busyId === c.id} />
          ))}
        </div>
      ) : null}

      {meta.totalPages > 1 ? (
        <nav
          aria-label="Páginas de compras"
          className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4"
        >
          <p className="text-sm text-muted">
            {meta.total} {meta.total === 1 ? 'compra' : 'compras'} · página {page} de {meta.totalPages}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-secondary btn-sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </button>
            <button
              type="button"
              className="btn-secondary btn-sm"
              disabled={page >= meta.totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente
            </button>
          </div>
        </nav>
      ) : null}
    </div>
  )
}