import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getPagoEvento, quitarQrPago, updatePagoEvento } from '../../api/compras.api'
import { toast } from '../../components/Toast'
import { confirmDialog } from '../../components/ui/ConfirmDialog'
import { IconQr, IconTrash, IconUpload, IconWarning } from '../../components/ui/icons'
import Field from '../../components/form/Field'
import EventoHeader from './components/EventoHeader'
import { formatBs, getErrorMessage } from '../../utils/format'
import { ACCEPT_IMAGE, validateFile } from '../../utils/files'
import { formatNumber } from '../../utils/validation'
import { COMPRA_ESTADOS, compraEstadoBadge, compraEstadoLabel } from '../compras/compraEstado'

const MAX_INSTRUCCIONES = 1000

/** HU-012: QR al que los compradores transfieren el pago de sus entradas e instrucciones de pago del evento. */
export default function PagoEventoPage() {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [qr, setQr] = useState(null)
  const [qrError, setQrError] = useState('')
  const [instrucciones, setInstrucciones] = useState('')
  const [saving, setSaving] = useState(false)

  const apply = (res) => {
    setData(res)
    setInstrucciones(res.pago.instruccionesPago ?? '')
  }

  useEffect(() => {
    let alive = true
    getPagoEvento(id)
      .then(({ data: res }) => alive && apply(res))
      .catch((err) => alive && setLoadError(getErrorMessage(err)))
    return () => {
      alive = false
    }
  }, [id])

  const preview = useMemo(() => (qr ? URL.createObjectURL(qr) : null), [qr])
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview])

  const onFile = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const err = validateFile(file)
    setQrError(err)
    if (!err) setQr(file)
  }

  const cambios = Boolean(qr) || instrucciones.trim() !== (data?.pago.instruccionesPago ?? '')

  const onSubmit = async (e) => {
    e.preventDefault()
    if (!data.pago.qrPagoUrl && !qr) {
      setQrError('Sube la imagen del QR de pago para habilitar la venta.')
      return
    }
    setSaving(true)
    try {
      const { data: res } = await updatePagoEvento(id, { qr, instruccionesPago: instrucciones.trim() })
      apply(res)
      setQr(null)
      toast(qr ? 'QR de pago guardado: la venta está habilitada' : 'Instrucciones de pago guardadas', 'success')
    } catch (err) {
      toast(getErrorMessage(err), 'error')
    } finally {
      setSaving(false)
    }
  }

  const onQuitar = async () => {
    const ok = await confirmDialog({
      title: 'Quitar QR de pago',
      message: 'Sin QR de pago nadie podrá comprar entradas de este evento hasta que subas uno nuevo. Las compras ya enviadas se conservan.',
      confirmText: 'Quitar QR',
      cancelText: 'Cancelar',
      tone: 'danger',
    })
    if (ok !== true) return
    setSaving(true)
    try {
      const { data: res } = await quitarQrPago(id)
      apply(res)
      toast('QR de pago quitado: la venta quedó pausada', 'success')
    } catch (err) {
      toast(getErrorMessage(err), 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!data) {
    return (
      <>
        <EventoHeader eventoId={id} />
        {loadError ? <p className="p-8 text-red-600">{loadError}</p> : <div className="p-8 text-muted">Cargando…</div>}
      </>
    )
  }

  const { evento, pago, conteo } = data
  const qrVisible = preview || pago.qrPagoUrl

  return (
    <>
      <EventoHeader eventoId={id} titulo={evento.titulo} estado={evento.estado} />

      <div className="space-y-6 p-8">
        {!pago.habilitado && (
          <div className="flex gap-3 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <IconWarning className="mt-0.5 h-5 w-5 shrink-0" />
            <p>
              <strong>La venta está pausada.</strong> Sube el QR al que los compradores deben transferir para habilitar la compra
              de entradas.
            </p>
          </div>
        )}

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
          <form onSubmit={onSubmit} noValidate className="card-surface space-y-5 p-6">
            <h2 className="font-display text-lg font-bold text-ink">QR de pago</h2>
            <Field label="Imagen del QR" required error={qrError}>
              <label
                className={`flex cursor-pointer flex-col items-center gap-3 rounded-md border-2 border-dashed p-4 text-center text-sm transition hover:border-teal ${
                  qrError ? 'border-red-300' : 'border-border'
                }`}
              >
                {qrVisible ? (
                  <img src={qrVisible} alt="QR de pago" className="aspect-square w-full max-w-56 rounded object-contain" />
                ) : (
                  <IconQr className="h-16 w-16 text-slate-300" />
                )}
                <span className="inline-flex items-center gap-1.5 font-semibold text-teal-dark">
                  <IconUpload className="h-4 w-4" />
                  {qr ? qr.name : pago.qrPagoUrl ? 'Reemplazar QR' : 'Subir QR de pago'}
                </span>
                <input type="file" accept={ACCEPT_IMAGE} className="sr-only" onChange={onFile} disabled={saving} />
              </label>
            </Field>

            <Field label="Instrucciones para el comprador" htmlFor="instrucciones">
              <textarea
                id="instrucciones"
                className="input min-h-28"
                value={instrucciones}
                maxLength={MAX_INSTRUCCIONES}
                placeholder="Ej. Banco, titular de la cuenta y que transfiera el monto exacto."
                onChange={(e) => setInstrucciones(e.target.value)}
              />
              <p className="mt-1 text-right text-xs text-muted">
                {instrucciones.length}/{MAX_INSTRUCCIONES}
              </p>
            </Field>

            <div className="flex flex-wrap gap-3">
              <button type="submit" className="btn-primary" disabled={saving || !cambios}>
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
              {qr && (
                <button type="button" className="btn-secondary" onClick={() => setQr(null)} disabled={saving}>
                  Descartar imagen
                </button>
              )}
              {pago.qrPagoUrl && !qr && (
                <button type="button" className="btn-secondary !text-red-600 hover:!bg-red-50" onClick={onQuitar} disabled={saving}>
                  <IconTrash />
                  Quitar QR
                </button>
              )}
            </div>
          </form>

          <section className="card-surface p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="font-display text-lg font-bold text-ink">Compras del evento</h2>
              <Link to={`/admin/compras?evento=${id}`} className="text-sm font-semibold text-teal-dark hover:underline">
                Ir a verificación de pagos
              </Link>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {COMPRA_ESTADOS.map((estado) => (
                <Link
                  key={estado}
                  to={`/admin/compras?evento=${id}&estado=${estado}`}
                  className="rounded-md border border-border p-4 transition hover:border-teal"
                >
                  <span className={`badge ${compraEstadoBadge(estado)}`}>{compraEstadoLabel(estado)}</span>
                  <p className="mt-2 font-display text-2xl font-bold text-ink">{formatNumber(conteo[estado] ?? 0)}</p>
                </Link>
              ))}
            </div>
            <div className="mt-5 rounded-md bg-page p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Recaudado (pagos aprobados)</p>
              <p className="mt-1 font-display text-3xl font-bold text-teal-dark">{formatBs(data.recaudado)}</p>
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
