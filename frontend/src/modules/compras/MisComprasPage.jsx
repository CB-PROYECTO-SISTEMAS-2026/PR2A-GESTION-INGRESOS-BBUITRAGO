import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { cancelarCompra, getMisCompras } from '../../api/compras.api'
import { toast } from '../../components/Toast'
import { confirmDialog } from '../../components/ui/ConfirmDialog'
import { IconExternal, IconTicket } from '../../components/ui/icons'
import { eventImage, formatBs, formatDateTime, formatDay, getErrorMessage } from '../../utils/format'
import { compraEstadoBadge, compraEstadoLabel } from './compraEstado'

const diaCorto = (fecha) => formatDay(fecha, { weekday: 'short', day: 'numeric', month: 'short' })

function CompraCard({ compra, onCancelar, busy }) {
  const pendiente = compra.estado === 'PENDIENTE'
  return (
    <article className="overflow-hidden rounded-lg border border-border bg-white">
      <div className="flex flex-wrap items-start gap-4 p-5">
        <img src={eventImage(compra.evento)} alt="" className="h-16 w-24 rounded-md object-cover" />
        <div className="min-w-0 flex-1">
          <Link to={`/eventos/${compra.evento.id}`} className="font-display text-lg font-bold text-ink hover:text-teal-dark">
            {compra.evento.titulo}
          </Link>
          <p className="text-sm text-muted">Compra del {formatDateTime(compra.createdAt)}</p>
        </div>
        <div className="text-right">
          <span className={`badge ${compraEstadoBadge(compra.estado)}`}>{compraEstadoLabel(compra.estado)}</span>
          <p className="mt-1 font-display text-xl font-bold text-ink">{formatBs(compra.montoTotal)}</p>
        </div>
      </div>

      <ul className="divide-y divide-border border-t border-border text-sm">
        {compra.items.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5">
            <span className="text-slate-700">
              <strong className="text-ink">
                {i.cantidad} × {i.categoria}
              </strong>
              {i.fecha ? ` · ${diaCorto(i.fecha)}` : ''}
              {i.paraNombre && (
                <span className="text-muted">
                  {' '}
                  · para {i.paraNombre} ({i.paraEmail})
                </span>
              )}
            </span>
            <span className="font-semibold text-ink">{formatBs(i.subtotal)}</span>
          </li>
        ))}
      </ul>

      {pendiente && (
        <p className="border-t border-border bg-amber-50 px-5 py-3 text-sm text-amber-900">
          Estamos verificando tu comprobante. Te avisaremos por correo cuando se apruebe.
        </p>
      )}
      {compra.estado === 'RECHAZADA' && (
        <div className="border-t border-border bg-red-50 px-5 py-3 text-sm text-red-800">
          <p className="font-semibold">Pago rechazado{compra.revisadoAt ? ` el ${formatDateTime(compra.revisadoAt)}` : ''}</p>
          {compra.motivoRechazo && <p className="mt-0.5">Motivo: {compra.motivoRechazo}</p>}
          <p className="mt-1">Si crees que es un error, vuelve a comprar adjuntando el comprobante correcto.</p>
        </div>
      )}
      {compra.estado === 'APROBADA' && (
        <div className="border-t border-border bg-teal/5 px-5 py-3 text-sm text-slate-700">
          <p>
            Pago aprobado{compra.revisadoAt ? ` el ${formatDateTime(compra.revisadoAt)}` : ''}. Se emitieron{' '}
            {compra.entradas.length} {compra.entradas.length === 1 ? 'entrada' : 'entradas'}.
          </p>
          {compra.items.some((i) => i.paraNombre) && (
            <p className="mt-0.5 text-muted">
              Las entradas para otras personas aparecen en su cuenta cuando ingresan con el correo que indicaste.
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-t border-border px-5 py-3">
        {compra.comprobanteUrl && (
          <a href={compra.comprobanteUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-sm">
            <IconExternal />
            Ver comprobante
          </a>
        )}
        {compra.estado === 'APROBADA' && (
          <Link to="/mis-entradas" className="btn-primary btn-sm">
            <IconTicket />
            Ver mis entradas
          </Link>
        )}
        {pendiente && (
          <button
            type="button"
            className="btn-secondary btn-sm !text-red-600 hover:!bg-red-50"
            onClick={() => onCancelar(compra)}
            disabled={busy}
          >
            {busy ? 'Cancelando…' : 'Cancelar compra'}
          </button>
        )}
      </div>
    </article>
  )
}

/** HU-010 / HU-013: el comprador sigue el estado de sus compras y el motivo si se rechazó el pago. */
export default function MisComprasPage() {
  const [compras, setCompras] = useState(null)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)

  useEffect(() => {
    let alive = true
    getMisCompras()
      .then(({ data }) => alive && setCompras(data.compras ?? []))
      .catch((err) => alive && setError(getErrorMessage(err, 'No se pudieron cargar tus compras.')))
    return () => {
      alive = false
    }
  }, [])

  const onCancelar = async (compra) => {
    const ok = await confirmDialog({
      title: 'Cancelar compra',
      message: `La compra de ${compra.totalEntradas} ${compra.totalEntradas === 1 ? 'entrada' : 'entradas'} para "${compra.evento.titulo}" se cancelará y no se revisará. Si ya pagaste, comunícate con el organizador.`,
      confirmText: 'Cancelar compra',
      cancelText: 'Volver',
      tone: 'danger',
    })
    if (ok !== true) return
    setBusyId(compra.id)
    try {
      const { data } = await cancelarCompra(compra.id)
      setCompras((list) => list.map((c) => (c.id === data.id ? data : c)))
      toast('Compra cancelada', 'success')
    } catch (err) {
      toast(getErrorMessage(err), 'error')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="font-display text-3xl font-bold text-ink">Mis compras</h1>
      <p className="mt-1 text-sm text-muted">Estado de tus compras y de la verificación de cada pago.</p>

      {error && <p className="mt-6 text-red-600">{error}</p>}
      {!compras && !error && <p className="mt-6 text-muted">Cargando…</p>}

      {compras && (
        <div className="mt-6 space-y-4">
          {compras.map((c) => (
            <CompraCard key={c.id} compra={c} onCancelar={onCancelar} busy={busyId === c.id} />
          ))}
          {!compras.length && (
            <div className="card-surface flex flex-col items-center gap-3 p-10 text-center">
              <IconTicket className="h-10 w-10 text-slate-300" />
              <p className="font-semibold text-ink">Todavía no compraste entradas</p>
              <Link to="/eventos" className="btn-primary">
                Ver eventos
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
