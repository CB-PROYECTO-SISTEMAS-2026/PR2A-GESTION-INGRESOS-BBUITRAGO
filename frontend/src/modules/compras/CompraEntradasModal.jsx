import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { crearCompra, getCheckout } from '../../api/compras.api'
import { toast } from '../../components/Toast'
import ImageCaptureField from '../../components/form/ImageCaptureField'
import Modal from '../../components/ui/Modal'
import { Skeleton } from '../../components/ui/Skeleton'
import { confirmDialog } from '../../components/ui/ConfirmDialog'
import { IconCheck, IconDownload, IconTicket, IconX } from '../../components/ui/icons'
import { useAuth } from '../../context/AuthContext'
import { asList, formatBs, formatDay, getErrorMessage } from '../../utils/format'
import { nuevaClave, readStorage, writeStorage } from '../../utils/storage'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const lineaKey = (categoriaId, fechaId) => `${categoriaId}|${fechaId}`
const diaCorto = (fecha) => formatDay(fecha, { weekday: 'short', day: 'numeric', month: 'short' })

let nextAsigId = 1
const nuevaAsignacion = () => ({ id: nextAsigId++, email: '', categoriaId: '', fechaId: '' })

function Precio({ categoria }) {
  if (!categoria.descuento) return <span className="font-bold text-primary">{formatBs(categoria.precioFinal ?? categoria.precio)}</span>
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-2">
      <span className="text-sm text-muted line-through">{formatBs(categoria.precio)}</span>
      <span className="font-bold text-primary">{formatBs(categoria.precioFinal)}</span>
      <span className="badge bg-warning-soft text-warning">-{categoria.descuento}%</span>
    </span>
  )
}

function Stepper({ value, onChange, max, disabled, label }) {
  const btn =
    'px-3 py-1.5 text-lg font-bold leading-none text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-focus'
  return (
    <div className="inline-flex items-center rounded-md border border-border bg-white">
      <button type="button" className={btn} onClick={() => onChange(value - 1)} disabled={disabled || value <= 0} aria-label={`Quitar ${label}`}>
        −
      </button>
      <span className="min-w-8 text-center font-semibold tabular-nums text-ink" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        className={btn}
        onClick={() => onChange(value + 1)}
        disabled={disabled || value >= max}
        aria-label={`Agregar ${label}`}
      >
        +
      </button>
    </div>
  )
}

/**
 * Modal de compra: categorías + contadores, asignación por correo, QR del evento, comprobante con cámara.
 * No muestra cupos. El n.º de operación no se pide.
 */
export default function CompraEntradasModal({ open, onClose, eventoId }) {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [cantidades, setCantidades] = useState({})
  const [paraMi, setParaMi] = useState(0)
  const [asignaciones, setAsignaciones] = useState([])
  const [comprobante, setComprobante] = useState(null)
  const [comprobanteError, setComprobanteError] = useState('')
  const [errors, setErrors] = useState({})
  const [sending, setSending] = useState(false)
  const [enviada, setEnviada] = useState(null)
  const [qrOpen, setQrOpen] = useState(false)

  useEffect(() => {
    if (!open || !eventoId) return undefined
    let alive = true
    setData(null)
    setLoadError('')
    setCantidades({})
    setParaMi(0)
    setAsignaciones([])
    setComprobante(null)
    setComprobanteError('')
    setErrors({})
    setEnviada(null)
    setQrOpen(false)
    getCheckout(eventoId)
      .then(({ data: res }) => alive && setData(res))
      .catch((err) => alive && setLoadError(getErrorMessage(err, 'No se pudo cargar el evento.')))
    return () => {
      alive = false
    }
  }, [open, eventoId])

  const evento = data?.evento
  const categorias = useMemo(() => data?.categorias ?? [], [data])
  const multiDia = Boolean(evento?.multiDia)
  const fechas = useMemo(() => evento?.fechas ?? [], [evento])
  const fechaById = useMemo(() => new Map(fechas.map((f) => [f.id, f])), [fechas])
  const unicaFechaId = !multiDia ? fechas[0]?.id ?? '' : ''
  const maxEntradas = data?.maxEntradas ?? 6
  const habilitado = Boolean(data?.pago?.habilitado)
  const qrPagoUrl = data?.pago?.qrPagoUrl || ''
  const instruccionesPago = data?.pago?.instruccionesPago || ''
  const hayDiasALaVenta = fechas.some((f) => f.aLaVenta)
  const bloqueado = !habilitado || !hayDiasALaVenta

  const disponiblesDia = (c, fechaId) => c.disponiblesPorDia?.[fechaId] ?? 0

  const lineasPropias = useMemo(() => {
    const out = []
    for (const c of categorias) {
      const dias = multiDia ? c.fechaIds : [unicaFechaId]
      for (const fechaId of dias) {
        const cantidad = cantidades[lineaKey(c.id, fechaId)] || 0
        if (cantidad > 0) out.push({ key: lineaKey(c.id, fechaId), categoria: c, fechaId, cantidad })
      }
    }
    return out
  }, [categorias, cantidades, multiDia, unicaFechaId])

  const totalSeleccionadas = lineasPropias.reduce((s, l) => s + l.cantidad, 0)

  useEffect(() => {
    setParaMi((n) => Math.min(n, totalSeleccionadas))
  }, [totalSeleccionadas])

  const total = lineasPropias.reduce((s, l) => s + Number(l.categoria.precioFinal) * l.cantidad, 0)
  const paraOtros = Math.max(0, totalSeleccionadas - paraMi)

  const setCantidad = (c, fechaId, value) => {
    const key = lineaKey(c.id, fechaId)
    const actual = cantidades[key] || 0
    const restoDisponible = Math.max(0, disponiblesDia(c, fechaId))
    const otras = totalSeleccionadas - actual
    const tope = Math.min(restoDisponible, maxEntradas - otras)
    setCantidades((prev) => ({ ...prev, [key]: Math.max(0, Math.min(value, tope)) }))
    setErrors((e) => (e.items ? { ...e, items: '' } : e))
  }

  const setAsig = (id, field, value) => {
    setAsignaciones((list) =>
      list.map((a) => {
        if (a.id !== id) return a
        const next = { ...a, [field]: value }
        if (field === 'categoriaId' && multiDia) {
          const c = categorias.find((x) => x.id === value)
          if (!c?.fechaIds.includes(next.fechaId)) next.fechaId = c?.fechaIds.length === 1 ? c.fechaIds[0] : ''
        }
        return next
      }),
    )
  }

  const validate = () => {
    const next = {}
    if (!totalSeleccionadas) next.items = 'Agrega al menos una entrada.'
    else if (totalSeleccionadas > maxEntradas) next.items = `Máximo ${maxEntradas} entradas por compra.`
    if (paraMi < 1 && totalSeleccionadas > 0) next.paraMi = 'Marca al menos una entrada para ti.'
    if (asignaciones.length !== paraOtros) {
      next.asignaciones = `Agrega ${paraOtros} correo${paraOtros === 1 ? '' : 's'} para el resto de entradas.`
    }
    const correoPropio = (user?.email || '').trim().toLowerCase()
    const seen = new Set()
    for (const a of asignaciones) {
      const k = (f) => `a${a.id}.${f}`
      if (!a.categoriaId) next[k('categoriaId')] = 'Elige la entrada.'
      if (multiDia && !a.fechaId) next[k('fechaId')] = 'Elige el día.'
      const email = a.email.trim().toLowerCase()
      if (!EMAIL_RE.test(email)) next[k('email')] = 'Correo inválido.'
      else if (email === correoPropio) next[k('email')] = 'Usa otro correo (el tuyo ya está en “para ti”).'
      else if (seen.has(email + a.categoriaId + a.fechaId)) next[k('email')] = 'Correo repetido para esa entrada.'
      else seen.add(email + a.categoriaId + a.fechaId)
    }
    // Validar que las asignaciones no excedan lo comprado por categoría/día
    const pool = new Map(lineasPropias.map((l) => [l.key, l.cantidad]))
    let selfLeft = paraMi
    for (const l of lineasPropias) {
      const take = Math.min(selfLeft, pool.get(l.key) || 0)
      pool.set(l.key, (pool.get(l.key) || 0) - take)
      selfLeft -= take
    }
    for (const a of asignaciones) {
      if (!a.categoriaId) continue
      const fid = multiDia ? a.fechaId : unicaFechaId
      const key = lineaKey(a.categoriaId, fid)
      const left = pool.get(key) || 0
      if (left <= 0) next.asignaciones = 'Las entradas asignadas no coinciden con lo que elegiste.'
      else pool.set(key, left - 1)
    }
    if (total > 0 && !comprobante) next.comprobante = 'Adjunta el comprobante.'
    if (comprobanteError) next.comprobante = comprobanteError
    return next
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    setErrors(errs)
    if (Object.values(errs).some(Boolean)) {
      toast('Revisa los datos marcados.', 'error')
      return
    }
    const ok = await confirmDialog({
      title: 'Confirmar compra',
      message: `${totalSeleccionadas} ${totalSeleccionadas === 1 ? 'entrada' : 'entradas'} por ${formatBs(total)}.`,
      confirmText: 'Enviar compra',
      cancelText: 'Revisar',
    })
    if (ok !== true) return

    // Construir items: primero "para mí" repartidos, luego asignaciones
    const pool = lineasPropias.map((l) => ({ ...l, left: l.cantidad }))
    const items = []
    let selfNeed = paraMi
    for (const l of pool) {
      if (selfNeed <= 0) break
      const take = Math.min(selfNeed, l.left)
      if (take > 0) {
        items.push({
          categoriaId: l.categoria.id,
          ...(multiDia ? { fechaId: l.fechaId } : {}),
          cantidad: take,
        })
        l.left -= take
        selfNeed -= take
      }
    }
    for (const a of asignaciones) {
      items.push({
        categoriaId: a.categoriaId,
        ...(multiDia ? { fechaId: a.fechaId } : {}),
        cantidad: 1,
        paraEmail: a.email.trim(),
        paraNombre: a.email.trim().split('@')[0],
      })
    }

    setSending(true)
    const storageKey = `compra-clave:${eventoId}`
    const idempotencyKey = readStorage(storageKey) || nuevaClave()
    writeStorage(storageKey, idempotencyKey)
    try {
      const { data: compra } = await crearCompra(eventoId, {
        items,
        referencia: '',
        comprobante,
        reembolsoHasta: evento.reembolsoHasta,
        idempotencyKey,
      })
      writeStorage(storageKey, '')
      setEnviada(compra)
    } catch (err) {
      toast(getErrorMessage(err), 'error')
    } finally {
      setSending(false)
    }
  }

  useEffect(() => {
    if (asignaciones.length < paraOtros) {
      setAsignaciones((list) => {
        const next = [...list]
        while (next.length < paraOtros) next.push(nuevaAsignacion())
        return next
      })
    } else if (asignaciones.length > paraOtros) {
      setAsignaciones((list) => list.slice(0, paraOtros))
    }
  }, [paraOtros, asignaciones.length])

  useEffect(() => {
    if (!qrOpen) return undefined
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      e.stopImmediatePropagation()
      setQrOpen(false)
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [qrOpen])

  return (
    <>
    <Modal
      open={open}
      onClose={onClose}
      title={enviada ? 'Compra enviada' : 'Comprar entradas'}
      size="xl"
      labelledBy="compra-modal-title"
    >
      {loadError && (
        <div className="px-6 py-8">
          <p className="text-danger">{loadError}</p>
        </div>
      )}
      {!data && !loadError && (
        <div className="space-y-3 px-6 py-8" aria-busy="true">
          <span className="sr-only">Cargando…</span>
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      )}

      {enviada && evento && (
        <div className="px-6 py-8 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success-soft text-success">
            <IconCheck className="h-6 w-6" aria-hidden="true" />
          </span>
          <p className="mt-3 text-pretty text-slate-600">Recibimos tu comprobante. Te avisamos por correo cuando se apruebe.</p>
          <p className="mt-4 font-display text-xl font-bold text-ink">{formatBs(enviada.montoTotal)}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link to="/mis-compras" className="btn-primary" onClick={onClose}>
              Mis compras
            </Link>
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cerrar
            </button>
          </div>
        </div>
      )}

      {data && !enviada && (
        <form onSubmit={onSubmit} noValidate className="grid gap-0 lg:grid-cols-[1fr_300px]">
          <div className="space-y-6 px-6 py-5">
            {!hayDiasALaVenta && (
              <p className="rounded-md bg-page p-3 text-sm text-muted">
                La venta de entradas para este evento ya cerró.
              </p>
            )}
            {hayDiasALaVenta && !habilitado && (
              <p className="rounded-md bg-warning-soft p-3 text-sm text-warning">La venta aún no está habilitada.</p>
            )}

            <div className="space-y-4">
              {categorias.map((c) => {
                const beneficios = asList(c.beneficios)
                const dias = multiDia ? c.fechaIds : [unicaFechaId]
                return (
                  <article key={c.id} className="rounded-md border border-border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <h3 className="font-display text-lg font-semibold text-ink">{c.nombre}</h3>
                      <Precio categoria={c} />
                    </div>
                    {beneficios.length > 0 && (
                      <ul className="mt-2 space-y-1 text-sm text-muted">
                        {beneficios.map((b) => (
                          <li key={b}>{b}</li>
                        ))}
                      </ul>
                    )}
                    <div className="mt-3 space-y-2 border-t border-border pt-3">
                      {dias.map((fechaId) => {
                        const fecha = fechaById.get(fechaId)
                        const key = lineaKey(c.id, fechaId)
                        const actual = cantidades[key] || 0
                        const max =
                          actual +
                          Math.min(
                            Math.max(0, disponiblesDia(c, fechaId) - actual),
                            maxEntradas - (totalSeleccionadas - actual),
                          )
                        return (
                          <div
                            key={fechaId}
                            className={`flex items-center gap-3 ${multiDia ? 'justify-between' : 'justify-end'}`}
                          >
                            {multiDia && (
                              <span className="text-sm text-slate-700">
                                {diaCorto(fecha?.fecha)}
                                {fecha?.horaInicio ? ` · ${fecha.horaInicio}` : ''}
                              </span>
                            )}
                            <Stepper
                              value={actual}
                              onChange={(v) => setCantidad(c, fechaId, v)}
                              max={Math.max(actual, max)}
                              disabled={bloqueado}
                              label={c.nombre}
                            />
                          </div>
                        )
                      })}
                    </div>
                  </article>
                )
              })}
              {!categorias.length && <p className="text-sm text-muted">Sin entradas a la venta.</p>}
              {errors.items && <p className="field-error">{errors.items}</p>}
            </div>

            {totalSeleccionadas > 0 && (
              <section className="rounded-md border border-border p-4">
                <h3 className="font-semibold text-ink">¿Cuáles son tuyas?</h3>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="text-sm text-muted">Entradas a tu nombre</span>
                  <Stepper
                    value={paraMi}
                    onChange={setParaMi}
                    max={totalSeleccionadas}
                    disabled={bloqueado}
                    label="para ti"
                  />
                </div>
                {errors.paraMi && <p className="field-error">{errors.paraMi}</p>}

                {paraOtros > 0 && (
                  <div className="mt-4 space-y-3 border-t border-border pt-4">
                    <p className="text-sm text-ink">Asigna las otras por correo</p>
                    {asignaciones.map((a, i) => (
                      <div key={a.id} className="grid gap-2 sm:grid-cols-2">
                        <input
                          type="email"
                          className="input"
                          name={`asig-email-${a.id}`}
                          autoComplete="off"
                          spellCheck={false}
                          placeholder={`Correo persona ${i + 1}…`}
                          value={a.email}
                          onChange={(e) => setAsig(a.id, 'email', e.target.value)}
                          aria-invalid={Boolean(errors[`a${a.id}.email`])}
                        />
                        <select
                          className="input"
                          value={a.categoriaId}
                          onChange={(e) => setAsig(a.id, 'categoriaId', e.target.value)}
                          aria-label={`Entrada para persona ${i + 1}`}
                        >
                          <option value="">Entrada…</option>
                          {categorias.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.nombre}
                            </option>
                          ))}
                        </select>
                        {multiDia && (
                          <select
                            className="input sm:col-span-2"
                            value={a.fechaId}
                            onChange={(e) => setAsig(a.id, 'fechaId', e.target.value)}
                            disabled={!a.categoriaId}
                          >
                            <option value="">Día…</option>
                            {(categorias.find((c) => c.id === a.categoriaId)?.fechaIds ?? []).map((fid) => (
                              <option key={fid} value={fid}>
                                {diaCorto(fechaById.get(fid)?.fecha)}
                              </option>
                            ))}
                          </select>
                        )}
                        {(errors[`a${a.id}.email`] || errors[`a${a.id}.categoriaId`] || errors[`a${a.id}.fechaId`]) && (
                          <p className="field-error sm:col-span-2">
                            {errors[`a${a.id}.email`] || errors[`a${a.id}.categoriaId`] || errors[`a${a.id}.fechaId`]}
                          </p>
                        )}
                      </div>
                    ))}
                    {errors.asignaciones && <p className="field-error">{errors.asignaciones}</p>}
                  </div>
                )}
              </section>
            )}
          </div>

          <aside className="space-y-4 border-t border-border bg-page/50 px-6 py-5 lg:border-l lg:border-t-0">
            <div>
              <h3 className="font-display text-lg font-bold text-ink">Resumen</h3>
              <ul className="mt-3 space-y-2 text-sm">
                {lineasPropias.map((l) => (
                  <li key={l.key} className="flex justify-between gap-2">
                    <span className="min-w-0 truncate">
                      {l.cantidad} × {l.categoria.nombre}
                    </span>
                    <span className="shrink-0 tabular-nums font-semibold">{formatBs(Number(l.categoria.precioFinal) * l.cantidad)}</span>
                  </li>
                ))}
                {!lineasPropias.length && <li className="text-muted">Sin entradas</li>}
              </ul>
              <div className="mt-3 flex items-baseline justify-between border-t border-border pt-3">
                <span className="font-semibold">Total</span>
                <span className="font-display text-2xl font-bold text-primary tabular-nums">{formatBs(total)}</span>
              </div>
            </div>

            {habilitado && qrPagoUrl && (
              <div>
                <h3 className="font-display text-lg font-bold text-ink">Pago QR</h3>
                <button
                  type="button"
                  onClick={() => setQrOpen(true)}
                  className="mx-auto mt-3 block w-full max-w-[220px] rounded-md border border-border bg-white p-2 transition hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-focus"
                  aria-label="Ver QR de pago en pantalla completa"
                >
                  <img
                    src={qrPagoUrl}
                    alt="QR de pago del evento"
                    className="aspect-square w-full object-contain"
                    width={220}
                    height={220}
                  />
                </button>
                {instruccionesPago && (
                  <p className="mt-3 whitespace-pre-wrap text-sm text-muted">{instruccionesPago}</p>
                )}
                <div className="mt-4">
                  <p className="mb-2 text-sm font-medium text-ink">Comprobante</p>
                  <ImageCaptureField
                    value={comprobante}
                    allowPdf
                    disabled={bloqueado}
                    previewAlt="Comprobante"
                    onChange={(file, err) => {
                      setComprobante(file)
                      setComprobanteError(err || '')
                      if (errors.comprobante) setErrors((e) => ({ ...e, comprobante: '' }))
                    }}
                    error={errors.comprobante || comprobanteError}
                  />
                </div>
              </div>
            )}

            <button type="submit" className="btn-primary w-full" disabled={bloqueado || sending || !totalSeleccionadas}>
              <IconTicket />
              {sending ? 'Enviando…' : 'Confirmar compra'}
            </button>
          </aside>
        </form>
      )}
    </Modal>

    {qrOpen &&
      qrPagoUrl &&
      createPortal(
        <div
          className="fixed inset-0 z-[100] flex flex-col bg-sidebar/95"
          role="dialog"
          aria-modal="true"
          aria-label="QR de pago"
        >
          <div className="flex justify-end p-4">
            <button
              type="button"
              onClick={() => setQrOpen(false)}
              className="rounded-lg p-2 text-white/80 transition hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-focus"
              aria-label="Cerrar"
            >
              <IconX className="h-6 w-6" />
            </button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 px-4 pb-10">
            <img
              src={qrPagoUrl}
              alt="QR de pago del evento"
              className="max-h-[min(70vh,28rem)] w-full max-w-md object-contain"
            />
            <a
              href={qrPagoUrl}
              target="_blank"
              rel="noopener noreferrer"
              download="qr-pago-evento.jpeg"
              className="btn-primary inline-flex items-center gap-2"
            >
              <IconDownload className="h-4 w-4" />
              Descargar
            </a>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
