import { useState } from 'react'
import Modal from '../../../components/ui/Modal'
import { toast } from '../../../components/Toast'
import { confirmDialog } from '../../../components/ui/ConfirmDialog'
import { IconCheck, IconExternal, IconX } from '../../../components/ui/icons'
import { aprobarCompra, rechazarCompra } from '../../../api/compras.api'
import { formatBs, formatDateTime, formatDay, getErrorMessage, isPdfUrl } from '../../../utils/format'
import { compraEstadoBadge, compraEstadoLabel } from '../../compras/compraEstado'

const MOTIVO_MIN = 5
const MOTIVO_MAX = 500
const MOTIVOS_RAPIDOS = [
  'El monto del comprobante no coincide con el total de la compra.',
  'El comprobante no es legible.',
  'No se encontró la transferencia en la cuenta del evento.',
]

const diaCorto = (fecha) => formatDay(fecha, { weekday: 'short', day: 'numeric', month: 'short' })

function Dato({ label, children }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{children}</dd>
    </div>
  )
}

/** HU-013: el administrador compara el comprobante con la compra y la aprueba o la rechaza con un motivo. */
export default function CompraRevisionModal({ compra, onClose, onRevisada }) {
  const [rechazando, setRechazando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [motivoError, setMotivoError] = useState('')
  const [busy, setBusy] = useState(false)
  const pendiente = compra.estado === 'PENDIENTE'

  const aprobar = async () => {
    const ok = await confirmDialog({
      title: 'Aprobar pago',
      message: `Confirmas que recibiste ${formatBs(compra.montoTotal)} de ${compra.comprador.nombre}. Se emitirán ${compra.totalEntradas} ${compra.totalEntradas === 1 ? 'entrada' : 'entradas'} con su código QR y se notificará por correo.`,
      confirmText: 'Aprobar y emitir entradas',
      cancelText: 'Volver',
    })
    if (ok !== true) return
    setBusy(true)
    try {
      const { data } = await aprobarCompra(compra.id)
      toast(
        data.correoEnviado === false ? 'Compra aprobada, pero no se pudo enviar el correo al comprador.' : 'Compra aprobada y entradas emitidas',
        data.correoEnviado === false ? 'info' : 'success',
      )
      onRevisada(data)
    } catch (err) {
      toast(getErrorMessage(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  const rechazar = async (e) => {
    e.preventDefault()
    const texto = motivo.trim()
    if (texto.length < MOTIVO_MIN) {
      setMotivoError(`Explica el motivo al comprador (al menos ${MOTIVO_MIN} caracteres).`)
      return
    }
    setBusy(true)
    try {
      const { data } = await rechazarCompra(compra.id, texto)
      toast('Compra rechazada; se notificó al comprador', 'success')
      onRevisada(data)
    } catch (err) {
      toast(getErrorMessage(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  const footer = pendiente ? (
    rechazando ? (
      <>
        <button type="button" className="btn-secondary" onClick={() => setRechazando(false)} disabled={busy}>
          Volver
        </button>
        <button type="submit" form="rechazo-form" className="btn-danger" disabled={busy}>
          {busy ? 'Rechazando…' : 'Rechazar compra'}
        </button>
      </>
    ) : (
      <>
        <button type="button" className="btn-secondary !text-red-600 hover:!bg-red-50" onClick={() => setRechazando(true)} disabled={busy}>
          <IconX />
          Rechazar
        </button>
        <button type="button" className="btn-primary" onClick={aprobar} disabled={busy}>
          <IconCheck />
          {busy ? 'Aprobando…' : 'Aprobar pago'}
        </button>
      </>
    )
  ) : (
    <button type="button" className="btn-secondary" onClick={onClose}>
      Cerrar
    </button>
  )

  return (
    <Modal open onClose={busy ? undefined : onClose} title="Revisión de pago" size="xl" labelledBy="compra-revision" footer={footer}>
      <div className="grid gap-6 p-6 lg:grid-cols-[1fr_minmax(0,360px)]">
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className={`badge ${compraEstadoBadge(compra.estado)}`}>{compraEstadoLabel(compra.estado)}</span>
            <span className="text-sm text-muted">Enviada el {formatDateTime(compra.createdAt)}</span>
          </div>

          <dl className="grid gap-4 sm:grid-cols-2">
            <Dato label="Comprador">
              <p className="font-semibold">{compra.comprador.nombre}</p>
              <p className="text-muted">{compra.comprador.email}</p>
            </Dato>
            <Dato label="Contacto">
              <p>Celular: {compra.comprador.telefono || '—'}</p>
              <p>Documento: {compra.comprador.documento || '—'}</p>
            </Dato>
            <Dato label="Evento">{compra.evento.titulo}</Dato>
            <Dato label="N.º de operación">{compra.referencia || 'No indicado'}</Dato>
          </dl>

          <div className="overflow-hidden rounded-md border border-border">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-page text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-2 font-semibold">Entrada</th>
                  <th className="px-3 py-2 font-semibold">Para</th>
                  <th className="px-3 py-2 text-right font-semibold">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {compra.items.map((i) => (
                  <tr key={i.id} className="border-t border-border">
                    <td className="px-3 py-2">
                      <p className="font-semibold text-ink">
                        {i.cantidad} × {i.categoria}
                      </p>
                      <p className="text-xs text-muted">
                        {i.fecha ? diaCorto(i.fecha) : ''} · {formatBs(i.precioUnit)} c/u
                      </p>
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {i.paraNombre ? (
                        <>
                          <p className="font-semibold">{i.paraNombre}</p>
                          <p className="text-xs text-muted">
                            {i.paraEmail} · {i.paraTelefono}
                          </p>
                        </>
                      ) : (
                        'El comprador'
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-ink">{formatBs(i.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-page">
                  <td colSpan={2} className="px-3 py-2 font-semibold text-ink">
                    Total ({compra.totalEntradas} {compra.totalEntradas === 1 ? 'entrada' : 'entradas'})
                  </td>
                  <td className="px-3 py-2 text-right font-display text-lg font-bold text-teal-dark">{formatBs(compra.montoTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {compra.estado === 'RECHAZADA' && compra.motivoRechazo && (
            <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              Rechazada por {compra.revisadoPor?.nombre ?? 'un administrador'} el {formatDateTime(compra.revisadoAt)}: {compra.motivoRechazo}
            </p>
          )}
          {compra.estado === 'APROBADA' && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
              <p className="font-semibold">
                Aprobada por {compra.revisadoPor?.nombre ?? 'un administrador'} el {formatDateTime(compra.revisadoAt)}
              </p>
              <ul className="mt-2 space-y-0.5 font-mono text-xs">
                {compra.entradas.map((e) => (
                  <li key={e.id}>
                    {e.codigo} · {e.categoria}
                    {e.fecha ? ` · ${diaCorto(e.fecha)}` : ''} · {e.titular?.nombre ?? 'pendiente de que el titular ingrese'}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {pendiente && rechazando && (
            <form id="rechazo-form" onSubmit={rechazar} noValidate className="space-y-3 rounded-md border border-red-200 bg-red-50/50 p-4">
              <label className="label" htmlFor="motivo-rechazo">
                Motivo del rechazo <span className="text-red-500">*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {MOTIVOS_RAPIDOS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    className="rounded-full border border-border bg-white px-3 py-1 text-xs text-slate-700 hover:border-red-300"
                    onClick={() => {
                      setMotivo(m)
                      setMotivoError('')
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <textarea
                id="motivo-rechazo"
                className="input min-h-24"
                value={motivo}
                maxLength={MOTIVO_MAX}
                placeholder="El comprador verá este motivo en Mis compras y en el correo."
                onChange={(e) => {
                  setMotivo(e.target.value)
                  setMotivoError('')
                }}
                aria-invalid={Boolean(motivoError)}
                autoFocus
              />
              <div className="flex justify-between text-xs text-muted">
                {motivoError ? <p className="field-error !mt-0">{motivoError}</p> : <span />}
                <span>
                  {motivo.length}/{MOTIVO_MAX}
                </span>
              </div>
            </form>
          )}
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Comprobante</p>
          {compra.comprobanteUrl ? (
            isPdfUrl(compra.comprobanteUrl) ? (
              <a
                href={compra.comprobanteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 flex h-48 flex-col items-center justify-center gap-2 rounded-md border border-border bg-page text-sm font-semibold text-teal-dark"
              >
                <IconExternal className="h-6 w-6" />
                Abrir comprobante (PDF)
              </a>
            ) : (
              <a href={compra.comprobanteUrl} target="_blank" rel="noopener noreferrer" className="mt-2 block" title="Abrir en tamaño completo">
                <img src={compra.comprobanteUrl} alt="Comprobante de pago" className="max-h-[60vh] w-full rounded-md border border-border object-contain" />
              </a>
            )
          ) : (
            <p className="mt-2 rounded-md border border-border bg-page p-4 text-sm text-muted">Compra sin costo: no requiere comprobante.</p>
          )}
        </div>
      </div>
    </Modal>
  )
}
