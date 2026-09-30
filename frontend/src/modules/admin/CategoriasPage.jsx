import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  createCategoria,
  deleteCategoria,
  getCategorias,
  getEventAdminById,
  updateCategoria,
} from '../../api/events.api'
import { toast } from '../../components/Toast'
import { confirmDelete, confirmDialog } from '../../components/ui/ConfirmDialog'
import { IconCheck, IconPencil, IconQr, IconTrash } from '../../components/ui/icons'
import Field from '../../components/form/Field'
import { IntegerInput, MoneyInput } from '../../components/form/NumberInputs'
import ListEditor from '../../components/form/ListEditor'
import EventoHeader from './components/EventoHeader'
import CodigosQrPanel from './components/CodigosQrPanel'
import { asList, formatBs, formatDay, getErrorMessage } from '../../utils/format'
import { formatNumber, validateInteger, validateMoney } from '../../utils/validation'

const MAX_BENEFICIOS = 20

const emptyForm = { nombre: '', precio: '', cupo: '', beneficios: [] }

export default function CategoriasPage() {
  const { id } = useParams()
  const [evento, setEvento] = useState(null)
  const [items, setItems] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [fechaIds, setFechaIds] = useState([])
  const [beneficioPendiente, setBeneficioPendiente] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [openQr, setOpenQr] = useState(() => new Set())
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const fechas = useMemo(() => evento?.fechas ?? [], [evento])
  const multiDia = fechas.length > 1

  const load = useCallback(async () => {
    const [{ data: ev }, { data: cats }] = await Promise.all([getEventAdminById(id), getCategorias(id)])
    setEvento(ev?.data ?? ev)
    setItems(Array.isArray(cats) ? cats : cats?.data ?? [])
  }, [id])

  useEffect(() => {
    let alive = true
    setLoading(true)
    load()
      .catch((err) => alive && setLoadError(getErrorMessage(err)))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [load])

  const capacidad = evento?.capacidad ?? 0
  const asignadas = items.reduce((sum, c) => sum + c.cupo, 0)
  const editing = items.find((c) => c.id === editingId) || null
  const disponiblesParaForm = capacidad - asignadas + (editing?.cupo ?? 0)

  const setField = (name, value) => {
    setForm((f) => ({ ...f, [name]: value }))
    setErrors((e) => (e[name] ? { ...e, [name]: '' } : e))
  }

  const resetForm = () => {
    setForm(emptyForm)
    setFechaIds([])
    setBeneficioPendiente('')
    setEditingId(null)
    setErrors({})
  }

  const startEdit = (c) => {
    setEditingId(c.id)
    setForm({
      nombre: c.nombre || '',
      precio: String(Number(c.precio)),
      cupo: String(c.cupo),
      beneficios: asList(c.beneficios),
    })
    setFechaIds((c.fechasDisponibles || []).filter((f) => f.disponible !== false).map((f) => f.fechaId))
    setBeneficioPendiente('')
    setErrors({})
    document.getElementById('categoria-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const validate = () => {
    const next = {}
    if (form.nombre.trim().length < 2) next.nombre = 'El nombre debe tener al menos 2 caracteres.'
    const precioError = validateMoney(form.precio)
    if (precioError) next.precio = precioError
    const cupoError = validateInteger(form.cupo, { label: 'la cantidad de entradas' })
    if (cupoError) next.cupo = cupoError
    else if (Number(form.cupo) > disponiblesParaForm) {
      next.cupo =
        disponiblesParaForm > 0
          ? `Solo quedan ${formatNumber(disponiblesParaForm)} entradas por asignar según la capacidad del evento.`
          : 'Ya se asignó toda la capacidad del evento. Aumenta la capacidad máxima o reduce otra categoría.'
    } else if (editing && Number(form.cupo) < editing.codigosAsignados) {
      next.cupo = `Ya se vendieron ${formatNumber(editing.codigosAsignados)} entradas de esta categoría. La cantidad no puede ser menor.`
    }
    if (multiDia && !fechaIds.length) next.fechas = 'Selecciona al menos un día.'
    if (beneficioPendiente) {
      next.beneficios = `Escribiste "${beneficioPendiente}" pero no lo agregaste. Presiona Agregar o borra el texto.`
    }
    return next
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    setErrors(errs)
    if (Object.values(errs).some(Boolean)) return

    const cupo = Number(form.cupo)
    if (editing && cupo < editing.cupo) {
      const diferencia = editing.cupo - cupo
      const ok = await confirmDialog({
        title: 'Reducir entradas',
        message: `La categoría pasará de ${formatNumber(editing.cupo)} a ${formatNumber(cupo)} entradas. Se eliminarán ${formatNumber(diferencia)} códigos QR que aún no se vendieron.`,
        confirmText: 'Guardar cambios',
        cancelText: 'Cancelar',
      })
      if (ok !== true) return
    }

    const payload = {
      nombre: form.nombre.trim(),
      precio: form.precio,
      cupo,
      beneficios: form.beneficios,
      ...(multiDia ? { fechaIds } : {}),
    }
    setSaving(true)
    try {
      if (editingId) {
        await updateCategoria(editingId, payload)
        toast('Categoría actualizada', 'success')
      } else {
        await createCategoria(id, payload)
        toast(`Categoría creada con ${formatNumber(cupo)} códigos QR`, 'success')
      }
      resetForm()
      await load()
    } catch (err) {
      toast(getErrorMessage(err), 'error')
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async (c) => {
    const ok = await confirmDelete({
      title: `Eliminar "${c.nombre}"`,
      message: `Se eliminará la categoría junto con sus ${formatNumber(c.codigosTotal)} códigos QR.`,
      finalMessage: 'La categoría y sus códigos QR se perderán y no se podrán recuperar.',
    })
    if (!ok) return
    try {
      await deleteCategoria(c.id)
      if (editingId === c.id) resetForm()
      toast('Categoría eliminada', 'success')
      await load()
    } catch (err) {
      toast(getErrorMessage(err), 'error')
    }
  }

  const toggleQr = (categoriaId) =>
    setOpenQr((prev) => {
      const next = new Set(prev)
      if (next.has(categoriaId)) next.delete(categoriaId)
      else next.add(categoriaId)
      return next
    })

  const toggleFecha = (fechaId) => {
    setFechaIds((ids) => (ids.includes(fechaId) ? ids.filter((x) => x !== fechaId) : [...ids, fechaId]))
    setErrors((e) => (e.fechas ? { ...e, fechas: '' } : e))
  }

  if (loading) {
    return (
      <>
        <EventoHeader eventoId={id} />
        <div className="p-8 text-muted">Cargando…</div>
      </>
    )
  }

  if (loadError) {
    return (
      <>
        <EventoHeader eventoId={id} />
        <p className="p-8 text-red-600">{loadError}</p>
      </>
    )
  }

  const porcentaje = capacidad ? Math.min(100, Math.round((asignadas / capacidad) * 100)) : 0
  const dayLabel = (fechaId) => formatDay(fechas.find((f) => f.id === fechaId)?.fecha, { weekday: 'short', day: 'numeric', month: 'short' })

  return (
    <>
      <EventoHeader eventoId={id} titulo={evento?.titulo} estado={evento?.estado} />

      <div className="space-y-6 p-8">
        <section className="card-surface flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Capacidad máxima</p>
              <p className="mt-1 font-display text-2xl font-bold text-ink">{formatNumber(capacidad)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">En categorías</p>
              <p className="mt-1 font-display text-2xl font-bold text-ink">{formatNumber(asignadas)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Por asignar</p>
              <p className="mt-1 font-display text-2xl font-bold text-teal-dark">{formatNumber(Math.max(0, capacidad - asignadas))}</p>
            </div>
          </div>
          <div className="w-full sm:max-w-xs">
            <div className="h-2 overflow-hidden rounded-sm bg-slate-100">
              <div className="h-full bg-teal transition-all" style={{ width: `${porcentaje}%` }} />
            </div>
            <p className="mt-1.5 text-right text-xs font-semibold text-muted">{porcentaje}% asignado</p>
          </div>
        </section>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
          <form
            id="categoria-form"
            onSubmit={onSubmit}
            noValidate
            className={`card-surface space-y-5 p-6 lg:sticky lg:top-6 ${editing ? 'ring-2 ring-teal/40' : ''}`}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-lg font-bold text-ink">
                {editing ? `Editar "${editing.nombre}"` : 'Nueva categoría'}
              </h2>
            </div>

            <Field label="Nombre" htmlFor="cat-nombre" required error={errors.nombre}>
              <input
                id="cat-nombre"
                className="input"
                value={form.nombre}
                maxLength={60}
                onChange={(e) => setField('nombre', e.target.value)}
                aria-invalid={Boolean(errors.nombre)}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Precio" htmlFor="cat-precio" required error={errors.precio}>
                <MoneyInput
                  id="cat-precio"
                  value={form.precio}
                  onChange={(v) => setField('precio', v)}
                  aria-invalid={Boolean(errors.precio)}
                />
              </Field>
              <Field label="Cantidad de entradas" htmlFor="cat-cupo" required error={errors.cupo}>
                <IntegerInput
                  id="cat-cupo"
                  value={form.cupo}
                  onChange={(v) => setField('cupo', v)}
                  placeholder={disponiblesParaForm > 0 ? `Hasta ${formatNumber(disponiblesParaForm)}` : undefined}
                  aria-invalid={Boolean(errors.cupo)}
                />
              </Field>
            </div>

            <Field label="Beneficios" htmlFor="cat-beneficios" error={errors.beneficios}>
              <ListEditor
                id="cat-beneficios"
                items={form.beneficios}
                onChange={(v) => setField('beneficios', v)}
                onPendingChange={(v) => {
                  setBeneficioPendiente(v)
                  setErrors((e) => (e.beneficios ? { ...e, beneficios: '' } : e))
                }}
                placeholder="Beneficio"
                maxItems={MAX_BENEFICIOS}
                maxLength={120}
              />
            </Field>

            {multiDia && (
              <Field label="Días válidos" error={errors.fechas}>
                <div className="flex flex-wrap gap-2">
                  {fechas.map((f) => {
                    const checked = fechaIds.includes(f.id)
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => toggleFecha(f.id)}
                        aria-pressed={checked}
                        className={`inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-sm font-medium transition ${
                          checked ? 'border-teal bg-teal text-white' : 'border-border text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        {checked && <IconCheck className="h-3.5 w-3.5" />}
                        {dayLabel(f.id)}
                      </button>
                    )
                  })}
                </div>
              </Field>
            )}

            <div className="flex flex-wrap gap-3 pt-1">
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Agregar categoría'}
              </button>
              {editing && (
                <button type="button" className="btn-secondary" onClick={resetForm} disabled={saving}>
                  Cancelar
                </button>
              )}
            </div>
          </form>

          <div className="space-y-4">
            {items.map((c) => {
              const isEditing = c.id === editingId
              const qrOpen = openQr.has(c.id)
              const beneficios = asList(c.beneficios)
              const dias = (c.fechasDisponibles || []).filter((f) => f.disponible !== false)
              return (
                <article
                  key={c.id}
                  className={`rounded-lg border border-l-4 bg-white p-5 transition ${
                    isEditing ? 'border-teal border-l-teal bg-teal/[0.03]' : 'border-border border-l-border'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-display text-xl font-bold text-ink">{c.nombre}</h3>
                        {isEditing && <span className="text-xs font-semibold text-teal-dark">En edición</span>}
                      </div>
                      <p className="mt-0.5 text-lg font-bold text-teal-dark">{formatBs(c.precio)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-display text-xl font-bold text-ink">{formatNumber(c.cupo)}</p>
                      <p className="text-xs font-semibold text-muted">
                        entradas{c.codigosAsignados > 0 ? ` · ${formatNumber(c.codigosAsignados)} vendidas` : ''}
                      </p>
                    </div>
                  </div>

                  {beneficios.length > 0 && (
                    <ul className="mt-4 grid gap-1.5 sm:grid-cols-2">
                      {beneficios.map((b) => (
                        <li key={b} className="flex items-start gap-2 text-sm text-slate-700">
                          <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal" />
                          {b}
                        </li>
                      ))}
                    </ul>
                  )}

                  {multiDia && (
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {dias.map((d) => (
                        <span key={d.fechaId} className="badge bg-slate-100 text-slate-700">
                          {dayLabel(d.fechaId)}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-5 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={`btn-sm ${qrOpen ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => toggleQr(c.id)}
                      aria-expanded={qrOpen}
                    >
                      <IconQr />
                      {qrOpen ? 'Ocultar códigos QR' : `Ver códigos QR (${formatNumber(c.codigosTotal)})`}
                    </button>
                    <button type="button" className="btn-secondary btn-sm" onClick={() => startEdit(c)} disabled={isEditing}>
                      <IconPencil />
                      Editar
                    </button>
                    <button
                      type="button"
                      className="btn-secondary btn-sm !text-red-600 hover:!bg-red-50"
                      onClick={() => onDelete(c)}
                    >
                      <IconTrash />
                      Eliminar
                    </button>
                  </div>

                  {qrOpen && <CodigosQrPanel categoria={c} />}
                </article>
              )
            })}
            {!items.length && (
              <div className="card-surface flex flex-col items-center justify-center gap-2 p-10 text-center">
                <IconQr className="h-10 w-10 text-slate-300" />
                <p className="font-semibold text-ink">Este evento aún no tiene categorías</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
