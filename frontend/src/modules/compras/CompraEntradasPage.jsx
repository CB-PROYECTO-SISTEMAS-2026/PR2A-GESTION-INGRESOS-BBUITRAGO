import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { crearCompra, getCheckout } from '../../api/compras.api'
import { useAuth } from '../../context/AuthContext'
import { toast } from '../../components/Toast'
import { confirmDialog } from '../../components/ui/ConfirmDialog'
import Field from '../../components/form/Field'
import {
  IconCalendar,
  IconCheck,
  IconChevronLeft,
  IconMapPin,
  IconPlus,
  IconTicket,
  IconTrash,
  IconUpload,
  IconUsers,
  IconWarning,
} from '../../components/ui/icons'
import { asList, eventDayRange, eventImage, formatBs, formatDay, getErrorMessage } from '../../utils/format'
import { ACCEPT_IMAGE, validateFile } from '../../utils/files'
import { formatNumber } from '../../utils/validation'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const TELEFONO_RE = /^[\d+\s()-]{7,20}$/
const ACCEPT_COMPROBANTE = `${ACCEPT_IMAGE},application/pdf`

const diaCorto = (fecha) => formatDay(fecha, { weekday: 'short', day: 'numeric', month: 'short' })
const lineaKey = (categoriaId, fechaId) => `${categoriaId}|${fechaId}`

let nextTerceroId = 1
const nuevoTercero = () => ({ id: nextTerceroId++, categoriaId: '', fechaId: '', nombre: '', email: '', telefono: '' })

function Precio({ categoria, className = '' }) {
  if (!categoria.descuento) return <span className={`font-bold text-teal-dark ${className}`}>{formatBs(categoria.precio)}</span>
  return (
    <span className={`inline-flex flex-wrap items-baseline justify-end gap-x-2 ${className}`}>
      <span className="text-sm text-muted line-through">{formatBs(categoria.precio)}</span>
      <span className="font-bold text-teal-dark">{formatBs(categoria.precioFinal)}</span>
      <span className="badge bg-amber-100 text-amber-800">-{categoria.descuento}%</span>
    </span>
  )
}

function Stepper({ value, onChange, max, disabled, label }) {
  const btn = 'px-3 py-1.5 text-lg font-bold leading-none text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40'
  return (
    <div className="inline-flex items-center rounded-md border border-border bg-white">
      <button type="button" className={btn} onClick={() => onChange(value - 1)} disabled={disabled || value <= 0} aria-label={`Quitar una entrada ${label}`}>
        −
      </button>
      <span className="min-w-8 text-center font-semibold text-ink" aria-live="polite">
        {value}
      </span>
      <button type="button" className={btn} onClick={() => onChange(value + 1)} disabled={disabled || value >= max} aria-label={`Agregar una entrada ${label}`}>
        +
      </button>
    </div>
  )
}

/** HU-010, HU-011, HU-012: compra de entradas para uno mismo o para otras personas, pagando con el QR del evento. */
export default function CompraEntradasPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [cantidades, setCantidades] = useState({})
  const [terceros, setTerceros] = useState([])
  const [referencia, setReferencia] = useState('')
  const [comprobante, setComprobante] = useState(null)
  const [errors, setErrors] = useState({})
  const [sending, setSending] = useState(false)
  const [enviada, setEnviada] = useState(null)

  useEffect(() => {
    let alive = true
    getCheckout(id)
      .then(({ data: res }) => alive && setData(res))
      .catch((err) => alive && setLoadError(getErrorMessage(err, 'No se pudo cargar el evento.')))
    return () => {
      alive = false
    }
  }, [id])

  const preview = useMemo(
    () => (comprobante && comprobante.type.startsWith('image/') ? URL.createObjectURL(comprobante) : null),
    [comprobante],
  )
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview])

  const evento = data?.evento
  const categorias = useMemo(() => data?.categorias ?? [], [data])
  const multiDia = Boolean(evento?.multiDia)
  const fechas = useMemo(() => evento?.fechas ?? [], [evento])
  const fechaById = useMemo(() => new Map(fechas.map((f) => [f.id, f])), [fechas])
  const unicaFechaId = !multiDia ? fechas[0]?.id ?? '' : ''

  const lineas = useMemo(() => {
    const out = []
    for (const c of categorias) {
      const dias = multiDia ? c.fechaIds : [unicaFechaId]
      for (const fechaId of dias) {
        const cantidad = cantidades[lineaKey(c.id, fechaId)] || 0
        if (cantidad > 0) out.push({ key: lineaKey(c.id, fechaId), categoria: c, fechaId, cantidad, para: null })
      }
    }
    for (const t of terceros) {
      const categoria = categorias.find((c) => c.id === t.categoriaId)
      if (categoria) out.push({ key: `t-${t.id}`, categoria, fechaId: multiDia ? t.fechaId : unicaFechaId, cantidad: 1, para: t })
    }
    return out
  }, [categorias, cantidades, terceros, multiDia, unicaFechaId])

  const usadasPorDia = useMemo(() => {
    const m = new Map()
    for (const l of lineas) {
      const k = lineaKey(l.categoria.id, l.fechaId)
      m.set(k, (m.get(k) || 0) + l.cantidad)
    }
    return m
  }, [lineas])

  const totalEntradas = lineas.reduce((s, l) => s + l.cantidad, 0)
  const total = lineas.reduce((s, l) => s + Number(l.categoria.precioFinal) * l.cantidad, 0)
  const maxEntradas = data?.maxEntradas ?? 20
  const habilitado = Boolean(data?.pago?.habilitado)
  const hayDiasALaVenta = fechas.some((f) => f.aLaVenta)

  // El cupo de cada categoría es por día: lo que queda se cuenta por separado en cada día.
  const disponiblesDia = (c, fechaId) => c.disponiblesPorDia?.[fechaId] ?? 0
  const restantes = (c, fechaId) =>
    Math.max(0, disponiblesDia(c, fechaId) - (usadasPorDia.get(lineaKey(c.id, fechaId)) || 0))
  const restantesCategoria = (c) => (multiDia ? c.fechaIds : [unicaFechaId]).reduce((s, f) => s + restantes(c, f), 0)

  const setCantidad = (c, fechaId, value) => {
    const key = lineaKey(c.id, fechaId)
    const actual = cantidades[key] || 0
    const tope = actual + Math.min(restantes(c, fechaId), maxEntradas - totalEntradas)
    setCantidades((prev) => ({ ...prev, [key]: Math.max(0, Math.min(value, tope)) }))
    setErrors((e) => (e.items ? { ...e, items: '' } : e))
  }

  const setTercero = (tid, field, value) => {
    setTerceros((list) =>
      list.map((t) => {
        if (t.id !== tid) return t
        const next = { ...t, [field]: value }
        if (field === 'categoriaId' && multiDia) {
          const c = categorias.find((x) => x.id === value)
          if (!c?.fechaIds.includes(next.fechaId)) next.fechaId = c?.fechaIds.length === 1 ? c.fechaIds[0] : ''
        }
        return next
      }),
    )
    setErrors((e) => (e[`t${tid}.${field}`] || e.items ? { ...e, [`t${tid}.${field}`]: '', items: '' } : e))
  }

  const onComprobante = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const err = validateFile(file, { allowPdf: true })
    setErrors((prev) => ({ ...prev, comprobante: err }))
    if (!err) setComprobante(file)
  }

  const validate = () => {
    const next = {}
    if (!totalEntradas) next.items = 'Agrega al menos una entrada.'
    else if (totalEntradas > maxEntradas) next.items = `Puedes comprar hasta ${maxEntradas} entradas por compra.`
    for (const c of categorias) {
      for (const fechaId of multiDia ? c.fechaIds : [unicaFechaId]) {
        const hay = disponiblesDia(c, fechaId)
        if ((usadasPorDia.get(lineaKey(c.id, fechaId)) || 0) > hay) {
          const dia = multiDia ? ` para el ${diaCorto(fechaById.get(fechaId)?.fecha)}` : ''
          next.items = `Solo quedan ${formatNumber(hay)} entradas "${c.nombre}" disponibles${dia}.`
        }
      }
    }
    const correoPropio = (user?.email || '').trim().toLowerCase()
    for (const t of terceros) {
      const k = (f) => `t${t.id}.${f}`
      if (!t.categoriaId) next[k('categoriaId')] = 'Elige la categoría.'
      if (multiDia && !t.fechaId) next[k('fechaId')] = 'Elige el día.'
      if (t.nombre.trim().length < 2) next[k('nombre')] = 'Escribe el nombre completo.'
      const email = t.email.trim().toLowerCase()
      if (!EMAIL_RE.test(email)) next[k('email')] = 'Escribe un correo válido.'
      else if (email === correoPropio) next[k('email')] = 'Es tu correo: agrégala como entrada para ti.'
      if (!TELEFONO_RE.test(t.telefono.trim())) next[k('telefono')] = 'Escribe un celular válido (7 a 20 dígitos).'
    }
    if (total > 0 && !comprobante) next.comprobante = 'Adjunta el comprobante de tu pago por QR.'
    return next
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    setErrors(errs)
    if (Object.values(errs).some(Boolean)) {
      toast('Revisa los datos marcados antes de confirmar.', 'error')
      return
    }
    const ok = await confirmDialog({
      title: 'Confirmar compra',
      message: `Vas a comprar ${totalEntradas} ${totalEntradas === 1 ? 'entrada' : 'entradas'} por ${formatBs(total)}. El administrador verificará tu comprobante antes de emitirlas.`,
      confirmText: 'Enviar compra',
      cancelText: 'Revisar',
    })
    if (ok !== true) return

    const items = lineas.map((l) => ({
      categoriaId: l.categoria.id,
      ...(multiDia ? { fechaId: l.fechaId } : {}),
      cantidad: l.cantidad,
      ...(l.para
        ? { paraNombre: l.para.nombre.trim(), paraEmail: l.para.email.trim(), paraTelefono: l.para.telefono.trim() }
        : {}),
    }))
    setSending(true)
    try {
      const { data: compra } = await crearCompra(id, { items, referencia: referencia.trim(), comprobante })
      setEnviada(compra)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      toast(getErrorMessage(err), 'error')
    } finally {
      setSending(false)
    }
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12">
        <p className="text-red-600">{loadError}</p>
        <Link to="/eventos" className="mt-4 inline-block font-semibold text-teal-dark">
          Volver a eventos
        </Link>
      </div>
    )
  }
  if (!data) return <div className="mx-auto max-w-6xl px-4 py-12 text-muted">Cargando…</div>

  if (enviada) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="card-surface p-8 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-teal/15 text-teal-dark">
            <IconCheck className="h-7 w-7" />
          </span>
          <h1 className="mt-4 font-display text-2xl font-bold text-ink">¡Compra enviada!</h1>
          <p className="mt-2 text-slate-600">
            Recibimos tu comprobante. El administrador verificará el pago y te avisaremos por correo cuando tus entradas estén
            listas.
          </p>
          <dl className="mx-auto mt-6 max-w-sm space-y-2 rounded-md border border-border bg-page p-4 text-left text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Evento</dt>
              <dd className="text-right font-semibold text-ink">{evento.titulo}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Entradas</dt>
              <dd className="font-semibold text-ink">{enviada.totalEntradas}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Total</dt>
              <dd className="font-semibold text-ink">{formatBs(enviada.montoTotal)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Estado</dt>
              <dd>
                <span className="badge bg-amber-100 text-amber-800">Pendiente de verificación</span>
              </dd>
            </div>
          </dl>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link to="/mis-compras" className="btn-primary">
              Ver mis compras
            </Link>
            <Link to={`/eventos/${id}`} className="btn-secondary">
              Volver al evento
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const bloqueado = !habilitado || !hayDiasALaVenta

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link to={`/eventos/${id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-teal-dark hover:underline">
        <IconChevronLeft />
        Volver al evento
      </Link>

      <header className="mt-4 flex flex-wrap items-center gap-4 rounded-lg border border-border bg-white p-4">
        <img src={eventImage(evento)} alt="" className="h-20 w-28 rounded-md object-cover" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Comprar entradas</p>
          <h1 className="font-display text-2xl font-bold text-ink">{evento.titulo}</h1>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
            <span className="inline-flex items-center gap-1">
              <IconCalendar className="h-4 w-4 text-teal-dark" />
              {eventDayRange(evento)}
            </span>
            <span className="inline-flex items-center gap-1">
              <IconMapPin className="h-4 w-4 text-teal-dark" />
              {evento.ubicacion}
            </span>
          </div>
        </div>
      </header>

      {!hayDiasALaVenta && (
        <p className="mt-6 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          Este evento ya se realizó: no vende más entradas.
        </p>
      )}
      {hayDiasALaVenta && !habilitado && (
        <div className="mt-6 flex gap-3 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <IconWarning className="mt-0.5 h-5 w-5 shrink-0" />
          <p>La venta de entradas de este evento todavía no está habilitada. Vuelve a intentarlo más tarde.</p>
        </div>
      )}

      <form onSubmit={onSubmit} noValidate className="mt-6 grid items-start gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <section className="card-surface p-6">
            <h2 className="font-display text-xl font-semibold text-ink">Entradas para ti</h2>
            <p className="mt-1 text-sm text-muted">
              Quedarán a tu nombre{multiDia ? '. Elige cuántas quieres para cada día' : ''}. Máximo {maxEntradas} entradas por compra.
            </p>
            <div className="mt-5 space-y-4">
              {categorias.map((c) => {
                const beneficios = asList(c.beneficios)
                const dias = multiDia ? c.fechaIds : [unicaFechaId]
                const agotada = c.disponibles <= 0
                return (
                  <article key={c.id} className="rounded-md border border-border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-ink">{c.nombre}</p>
                        <p className={`text-xs font-medium ${agotada ? 'text-red-600' : 'text-muted'}`}>
                          {agotada
                            ? 'Agotada'
                            : multiDia
                              ? `${formatNumber(c.cupoPorDia)} entradas por día`
                              : `${formatNumber(restantesCategoria(c))} disponibles`}
                        </p>
                      </div>
                      <Precio categoria={c} />
                    </div>
                    {beneficios.length > 0 && (
                      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                        {beneficios.map((b) => (
                          <li key={b} className="inline-flex items-center gap-1 text-xs text-slate-600">
                            <IconCheck className="h-3.5 w-3.5 text-teal" />
                            {b}
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="mt-3 space-y-2 border-t border-border pt-3">
                      {dias.map((fechaId) => {
                        const fecha = fechaById.get(fechaId)
                        return (
                          <div key={fechaId} className="flex items-center justify-between gap-3">
                            <span className="text-sm text-slate-700">
                              {multiDia ? diaCorto(fecha?.fecha) : formatDay(fecha?.fecha)}
                              {fecha?.horaInicio ? ` · ${fecha.horaInicio}` : ''}
                              {multiDia && (
                                <span className={`ml-2 text-xs ${disponiblesDia(c, fechaId) > 0 ? 'text-muted' : 'text-red-600'}`}>
                                  {disponiblesDia(c, fechaId) > 0
                                    ? `${formatNumber(restantes(c, fechaId))} disponibles`
                                    : 'Agotado'}
                                </span>
                              )}
                            </span>
                            <Stepper
                              value={cantidades[lineaKey(c.id, fechaId)] || 0}
                              onChange={(v) => setCantidad(c, fechaId, v)}
                              max={
                                (cantidades[lineaKey(c.id, fechaId)] || 0) +
                                Math.min(restantes(c, fechaId), maxEntradas - totalEntradas)
                              }
                              disabled={bloqueado}
                              label={`${c.nombre}${multiDia ? ` del ${diaCorto(fecha?.fecha)}` : ''}`}
                            />
                          </div>
                        )
                      })}
                      {!dias.length && <p className="text-sm text-muted">Sin días a la venta.</p>}
                    </div>
                  </article>
                )
              })}
              {!categorias.length && <p className="text-sm text-muted">Este evento aún no tiene entradas a la venta.</p>}
            </div>
          </section>

          <section className="card-surface p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-semibold text-ink">Entradas para otras personas</h2>
                <p className="mt-1 text-sm text-muted">
                  Cada entrada queda a nombre de esa persona. Le enviaremos un correo y la verá en su cuenta al ingresar con ese
                  correo.
                </p>
              </div>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => setTerceros((list) => [...list, nuevoTercero()])}
                disabled={bloqueado || totalEntradas >= maxEntradas || !categorias.length}
              >
                <IconPlus />
                Agregar persona
              </button>
            </div>
            <div className="mt-4 space-y-4">
              {terceros.map((t, i) => {
                const categoria = categorias.find((c) => c.id === t.categoriaId)
                const err = (f) => errors[`t${t.id}.${f}`]
                return (
                  <fieldset key={t.id} className="rounded-md border border-border p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
                        <IconUsers className="h-4 w-4 text-teal-dark" />
                        Persona {i + 1}
                      </p>
                      <button
                        type="button"
                        className="rounded p-1.5 text-muted hover:bg-red-50 hover:text-red-600"
                        onClick={() => setTerceros((list) => list.filter((x) => x.id !== t.id))}
                        aria-label={`Quitar persona ${i + 1}`}
                      >
                        <IconTrash />
                      </button>
                    </div>
                    <div className="mt-3 grid gap-4 sm:grid-cols-2">
                      <Field label="Categoría" htmlFor={`t${t.id}-cat`} required error={err('categoriaId')}>
                        <select
                          id={`t${t.id}-cat`}
                          className="input"
                          value={t.categoriaId}
                          onChange={(e) => setTercero(t.id, 'categoriaId', e.target.value)}
                        >
                          <option value="">Selecciona</option>
                          {categorias.map((c) => (
                            <option key={c.id} value={c.id} disabled={c.id !== t.categoriaId && restantesCategoria(c) <= 0}>
                              {c.nombre} — {formatBs(c.precioFinal)}
                            </option>
                          ))}
                        </select>
                      </Field>
                      {multiDia && (
                        <Field label="Día" htmlFor={`t${t.id}-dia`} required error={err('fechaId')}>
                          <select
                            id={`t${t.id}-dia`}
                            className="input"
                            value={t.fechaId}
                            onChange={(e) => setTercero(t.id, 'fechaId', e.target.value)}
                            disabled={!categoria}
                          >
                            <option value="">{categoria ? 'Selecciona' : 'Elige primero la categoría'}</option>
                            {(categoria?.fechaIds ?? []).map((fid) => (
                              <option
                                key={fid}
                                value={fid}
                                disabled={fid !== t.fechaId && restantes(categoria, fid) <= 0}
                              >
                                {diaCorto(fechaById.get(fid)?.fecha)}
                                {restantes(categoria, fid) <= 0 && fid !== t.fechaId ? ' (agotado)' : ''}
                              </option>
                            ))}
                          </select>
                        </Field>
                      )}
                      <Field label="Nombre completo" htmlFor={`t${t.id}-nombre`} required error={err('nombre')}>
                        <input
                          id={`t${t.id}-nombre`}
                          className="input"
                          value={t.nombre}
                          maxLength={100}
                          onChange={(e) => setTercero(t.id, 'nombre', e.target.value)}
                        />
                      </Field>
                      <Field label="Correo" htmlFor={`t${t.id}-email`} required error={err('email')}>
                        <input
                          id={`t${t.id}-email`}
                          type="email"
                          className="input"
                          value={t.email}
                          maxLength={191}
                          onChange={(e) => setTercero(t.id, 'email', e.target.value)}
                        />
                      </Field>
                      <Field label="Celular" htmlFor={`t${t.id}-tel`} required error={err('telefono')}>
                        <input
                          id={`t${t.id}-tel`}
                          type="tel"
                          className="input"
                          value={t.telefono}
                          maxLength={20}
                          placeholder="Ej. 71234567"
                          onChange={(e) => setTercero(t.id, 'telefono', e.target.value)}
                        />
                      </Field>
                    </div>
                  </fieldset>
                )
              })}
              {!terceros.length && <p className="text-sm text-muted">No agregaste entradas para otras personas.</p>}
            </div>
          </section>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-24">
          <section className="card-surface p-6">
            <h2 className="font-display text-lg font-bold text-ink">Resumen</h2>
            <ul className="mt-4 space-y-3 text-sm">
              {lineas.map((l) => (
                <li key={l.key} className="flex justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">
                      {l.cantidad} × {l.categoria.nombre}
                    </p>
                    <p className="text-xs text-muted">
                      {l.fechaId ? diaCorto(fechaById.get(l.fechaId)?.fecha) : 'Día por elegir'}
                      {l.para ? ` · para ${l.para.nombre.trim() || 'otra persona'}` : ''}
                    </p>
                  </div>
                  <span className="shrink-0 font-semibold text-ink">{formatBs(Number(l.categoria.precioFinal) * l.cantidad)}</span>
                </li>
              ))}
              {!lineas.length && <li className="text-muted">Aún no elegiste entradas.</li>}
            </ul>
            <div className="mt-4 flex items-baseline justify-between border-t border-border pt-4">
              <span className="font-semibold text-ink">Total a pagar</span>
              <span className="font-display text-2xl font-bold text-teal-dark">{formatBs(total)}</span>
            </div>
            {errors.items && <p className="field-error">{errors.items}</p>}
          </section>

          {habilitado && (
            <section className="card-surface p-6">
              <h2 className="font-display text-lg font-bold text-ink">Pago por QR</h2>
              <p className="mt-1 text-sm text-muted">Escanea el QR con tu app bancaria y transfiere el total exacto.</p>
              <a href={data.pago.qrPagoUrl} target="_blank" rel="noopener noreferrer" className="mt-4 block">
                <img
                  src={data.pago.qrPagoUrl}
                  alt="QR de pago del evento"
                  className="mx-auto aspect-square w-full max-w-64 rounded-md border border-border object-contain p-2"
                />
              </a>
              {data.pago.instruccionesPago && (
                <p className="mt-3 whitespace-pre-line rounded-md bg-page p-3 text-sm text-slate-700">{data.pago.instruccionesPago}</p>
              )}

              <div className="mt-5 space-y-4">
                <Field label="Comprobante de pago" required={total > 0} error={errors.comprobante}>
                  <label
                    className={`flex cursor-pointer flex-col items-center gap-2 rounded-md border-2 border-dashed p-4 text-center text-sm transition hover:border-teal ${
                      errors.comprobante ? 'border-red-300' : 'border-border'
                    }`}
                  >
                    {preview ? (
                      <img src={preview} alt="Comprobante adjunto" className="max-h-48 rounded object-contain" />
                    ) : (
                      <IconUpload className="h-6 w-6 text-muted" />
                    )}
                    <span className="font-semibold text-teal-dark">
                      {comprobante ? comprobante.name : 'Subir imagen o PDF del comprobante'}
                    </span>
                    {comprobante && <span className="text-xs text-muted">Haz clic para cambiarlo</span>}
                    <input type="file" accept={ACCEPT_COMPROBANTE} className="sr-only" onChange={onComprobante} disabled={bloqueado} />
                  </label>
                </Field>
                <Field label="N.º de operación (opcional)" htmlFor="referencia">
                  <input
                    id="referencia"
                    className="input"
                    value={referencia}
                    maxLength={100}
                    placeholder="Referencia de la transferencia"
                    onChange={(e) => setReferencia(e.target.value)}
                  />
                </Field>
              </div>
            </section>
          )}

          <button type="submit" className="btn-primary w-full" disabled={bloqueado || sending || !totalEntradas}>
            <IconTicket />
            {sending ? 'Enviando compra…' : 'Confirmar compra'}
          </button>
        </aside>
      </form>
    </div>
  )
}
