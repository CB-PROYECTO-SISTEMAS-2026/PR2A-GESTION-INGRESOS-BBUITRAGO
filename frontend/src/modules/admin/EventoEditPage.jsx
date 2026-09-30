import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  createEvent,
  getEventAdminById,
  getOrganizadores,
  getSolicitudById,
  updateEvent,
  uploadEventFoto,
} from '../../api/events.api'
import { toast } from '../../components/Toast'
import { confirmDialog } from '../../components/ui/ConfirmDialog'
import { IconExternal } from '../../components/ui/icons'
import Field, { Section } from '../../components/form/Field'
import { IntegerInput } from '../../components/form/NumberInputs'
import ListEditor from '../../components/form/ListEditor'
import CronogramaEditor, { toCronogramaPayload, toEditableActividades } from '../../components/form/CronogramaEditor'
import EventoHeader from './components/EventoHeader'
import { useLeaveGuard } from '../../hooks/useLeaveGuard'
import { DEFAULT_EVENT_IMAGE, asCronograma, asList, getErrorMessage, toDay } from '../../utils/format'
import { ESTADO_EVENTO_OPTIONS, TIPO_ACCESO_OPTIONS, estadoLabel } from '../../utils/labels'
import { ACCEPT_IMAGE, validateFile } from '../../utils/files'
import { todayLocal, validateSchedule } from '../../utils/schedule'
import { isGoogleMapsUrl, validateCronograma, validateInteger, validateMapsUrl } from '../../utils/validation'

const MAX_SERVICIOS = 30

const emptyForm = {
  titulo: '',
  descripcion: '',
  ubicacion: '',
  ubicacionUrl: '',
  tipoAcceso: 'QR_DIGITAL',
  estado: 'BORRADOR',
  capacidad: '',
  organizadorId: '',
  fechaInicio: '',
  fechaFin: '',
  horaInicio: '09:00',
  horaFin: '18:00',
}

function snapshotOf({ form, variosDias, servicios, cronograma, fotoFile }) {
  return JSON.stringify({ form, variosDias, servicios, cronograma: toCronogramaPayload(cronograma), foto: Boolean(fotoFile) })
}

export default function EventoEditPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const isNew = id === 'nuevo'
  const solicitudId = isNew ? params.get('solicitudId') : null
  const navigate = useNavigate()
  const minDate = useMemo(() => todayLocal(), [])

  const [form, setForm] = useState(emptyForm)
  const [variosDias, setVariosDias] = useState(false)
  const [servicios, setServicios] = useState([])
  const [servicioPendiente, setServicioPendiente] = useState('')
  const [cronograma, setCronograma] = useState([])
  const [existingDays, setExistingDays] = useState(null)
  const [solicitud, setSolicitud] = useState(null)
  const [organizadores, setOrganizadores] = useState([])
  const [guardado, setGuardado] = useState({ titulo: '', estado: '' })
  const [fotoActual, setFotoActual] = useState('')
  const [fotoFile, setFotoFile] = useState(null)
  const [savedSnapshot, setSavedSnapshot] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const fotoPreview = useMemo(() => (fotoFile ? URL.createObjectURL(fotoFile) : ''), [fotoFile])
  useEffect(() => () => fotoPreview && URL.revokeObjectURL(fotoPreview), [fotoPreview])

  const applyLoaded = (next) => {
    setForm(next.form)
    setVariosDias(next.variosDias)
    setServicios(next.servicios)
    setCronograma(next.cronograma)
    setFotoFile(null)
    setSavedSnapshot(snapshotOf({ ...next, fotoFile: null }))
  }

  const applyEvento = (e) => {
    const fechas = e.fechas ?? []
    const first = fechas[0]
    const last = fechas[fechas.length - 1]
    const multi = fechas.length > 1
    const nextForm = {
      ...emptyForm,
      titulo: e.titulo || '',
      descripcion: e.descripcion || '',
      ubicacion: e.ubicacion || '',
      ubicacionUrl: e.ubicacionUrl || '',
      tipoAcceso: e.tipoAcceso || 'QR_DIGITAL',
      estado: e.estado || 'BORRADOR',
      capacidad: e.capacidad != null ? String(e.capacidad) : '',
      organizadorId: e.organizadorId || '',
      fechaInicio: toDay(first?.fecha),
      fechaFin: multi ? toDay(last?.fecha) : '',
      horaInicio: first?.horaInicio || emptyForm.horaInicio,
      horaFin: first?.horaFin || emptyForm.horaFin,
    }
    applyLoaded({
      form: nextForm,
      variosDias: multi,
      servicios: asList(e.servicios),
      cronograma: toEditableActividades(asCronograma(e.cronograma)),
    })
    setExistingDays(new Set(fechas.map((f) => toDay(f.fecha))))
    setFotoActual(e.fotoUrl || '')
    setGuardado({ titulo: e.titulo || '', estado: e.estado || '' })
  }

  useEffect(() => {
    let alive = true
    setLoading(true)
    setLoadError('')
    setErrors({})
    setFormError('')
    setSolicitud(null)
    ;(async () => {
      try {
        if (!isNew) {
          const { data } = await getEventAdminById(id)
          if (alive) applyEvento(data?.data ?? data)
        } else if (solicitudId) {
          const { data } = await getSolicitudById(solicitudId)
          const s = data?.data ?? data
          if (!alive) return
          setSolicitud(s)
          const nextForm = {
            ...emptyForm,
            titulo: s.nombreEvento || '',
            descripcion: s.descripcion || '',
            ubicacion: s.ubicacion || '',
            ubicacionUrl: s.ubicacionUrl || '',
            capacidad: s.capacidad != null ? String(s.capacidad) : '',
            fechaInicio: toDay(s.fechaInicio),
            fechaFin: s.fechaFin ? toDay(s.fechaFin) : '',
            horaInicio: s.horaInicio || emptyForm.horaInicio,
            horaFin: s.horaFin || emptyForm.horaFin,
          }
          applyLoaded({
            form: nextForm,
            variosDias: Boolean(s.fechaFin),
            servicios: [],
            cronograma: [],
          })
        } else {
          const { data } = await getOrganizadores()
          if (!alive) return
          setOrganizadores(Array.isArray(data) ? data : data?.data ?? [])
          applyLoaded({ form: emptyForm, variosDias: false, servicios: [], cronograma: [] })
        }
      } catch (err) {
        if (alive) setLoadError(getErrorMessage(err))
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isNew, solicitudId])

  const dirty =
    !loading && !loadError && savedSnapshot !== '' && snapshotOf({ form, variosDias, servicios, cronograma, fotoFile }) !== savedSnapshot

  const { allowNavigation } = useLeaveGuard(dirty && !saving, async (blocker) => {
    const salir = await confirmDialog({
      title: 'Hay cambios sin guardar',
      message: 'Si sales ahora, los cambios que hiciste en este evento se perderán.',
      confirmText: 'Salir sin guardar',
      cancelText: 'Seguir editando',
      tone: 'danger',
    })
    if (salir === true) blocker.proceed()
    else blocker.reset()
  })

  const solicitudBloqueada =
    Boolean(solicitud) && (solicitud.estado !== 'APROBADA' || Boolean(solicitud.evento))

  const clearError = (name) => setErrors((prev) => (prev[name] ? { ...prev, [name]: '' } : prev))

  const setField = (name, value) => {
    setForm((f) => ({ ...f, [name]: value }))
    clearError(name)
  }

  const onChange = (e) => setField(e.target.name, e.target.value)

  const onHoraChange = (e) => {
    setField(e.target.name, e.target.value)
    clearError('fechas')
    clearError('cronograma')
  }

  const onToggleVariosDias = (e) => {
    const checked = e.target.checked
    setVariosDias(checked)
    clearError('fechas')
    if (!checked) setForm((f) => ({ ...f, fechaFin: '' }))
  }

  const onFotoChange = (e) => {
    const file = e.target.files?.[0] || null
    e.target.value = ''
    if (!file) return
    const invalid = validateFile(file)
    if (invalid) {
      toast(invalid, 'error')
      return
    }
    setFotoFile(file)
  }

  const validate = () => {
    const next = {}
    if (form.titulo.trim().length < 3) next.titulo = 'El título debe tener al menos 3 caracteres.'
    if (form.descripcion.trim().length < 10) next.descripcion = 'La descripción debe tener al menos 10 caracteres.'
    if (isNew && !solicitudId && !form.organizadorId) next.organizadorId = 'Selecciona el organizador del evento.'
    if (form.ubicacion.trim().length < 3) next.ubicacion = 'Escribe la dirección o el nombre del lugar.'
    const mapsError = validateMapsUrl(form.ubicacionUrl)
    if (mapsError) next.ubicacionUrl = mapsError
    const capacidadError = validateInteger(form.capacidad, { label: 'la capacidad máxima' })
    if (capacidadError) next.capacidad = capacidadError
    const scheduleError = validateSchedule({ ...form, variosDias }, { existingDays: isNew ? null : existingDays })
    if (scheduleError) next.fechas = scheduleError
    const cronogramaError = validateCronograma(cronograma, form)
    if (cronogramaError) next.cronograma = cronogramaError
    if (servicioPendiente) next.servicios = `Escribiste "${servicioPendiente}" pero no lo agregaste. Presiona Agregar o borra el texto.`
    return next
  }

  const focusFirstError = (errs) => {
    const order = ['titulo', 'descripcion', 'organizadorId', 'ubicacion', 'ubicacionUrl', 'capacidad', 'fechas', 'cronograma', 'servicios']
    const first = order.find((k) => errs[k])
    if (!first) return
    const el = document.getElementById(first === 'fechas' ? 'fechaInicio' : first)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el?.focus({ preventScroll: true })
  }

  const buildPayload = () => ({
    titulo: form.titulo.trim(),
    descripcion: form.descripcion.trim(),
    ubicacion: form.ubicacion.trim(),
    ubicacionUrl: form.ubicacionUrl.trim(),
    capacidad: Number(form.capacidad),
    servicios,
    cronograma: toCronogramaPayload(cronograma),
    tipoAcceso: form.tipoAcceso,
    fechaInicio: form.fechaInicio,
    horaInicio: form.horaInicio,
    horaFin: form.horaFin,
    ...(variosDias ? { fechaFin: form.fechaFin } : {}),
  })

  const uploadFoto = async (eventoId) => {
    const fd = new FormData()
    fd.append('foto', fotoFile)
    const { data } = await uploadEventFoto(eventoId, fd)
    return data?.fotoUrl || ''
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    setErrors(errs)
    setFormError('')
    if (Object.values(errs).some(Boolean)) {
      focusFirstError(errs)
      return
    }
    setSaving(true)

    try {
      if (isNew) {
        const { data } = await createEvent({
          ...buildPayload(),
          ...(solicitudId ? { solicitudId } : { organizadorId: form.organizadorId }),
        })
        const created = data?.data ?? data
        if (fotoFile) {
          try {
            await uploadFoto(created.id)
          } catch (err) {
            toast(`El evento se creó, pero la imagen no se pudo subir: ${getErrorMessage(err)}`, 'error')
          }
        }
        toast('Evento creado como borrador', 'success')
        allowNavigation()
        navigate(`/admin/eventos/${created.id}`, { replace: true })
        return
      }

      if (fotoFile) {
        const url = await uploadFoto(id)
        setFotoActual(url)
        setFotoFile(null)
      }
      const { data } = await updateEvent(id, { ...buildPayload(), estado: form.estado })
      applyEvento(data?.data ?? data)
      toast('Cambios guardados', 'success')
    } catch (err) {
      const message = getErrorMessage(err)
      setFormError(message)
      toast(message, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <>
        <EventoHeader eventoId={isNew ? null : id} />
        <div className="p-8 text-muted">Cargando…</div>
      </>
    )
  }

  if (loadError) {
    return (
      <div className="p-8">
        <p className="text-red-600">{loadError}</p>
        <Link to="/admin/eventos" className="mt-3 inline-block font-semibold text-teal-dark">
          Volver a eventos
        </Link>
      </div>
    )
  }

  const fotoSrc = fotoPreview || fotoActual || DEFAULT_EVENT_IMAGE
  const usaImagenPorDefecto = !fotoPreview && !fotoActual
  const mapsValido = isGoogleMapsUrl(form.ubicacionUrl)

  return (
    <>
      <EventoHeader eventoId={isNew ? null : id} titulo={guardado.titulo} estado={guardado.estado} />

      <form onSubmit={onSubmit} noValidate className="mx-auto max-w-4xl space-y-6 p-8">
        {solicitudBloqueada && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            {solicitud.evento
              ? 'Esta solicitud ya tiene un evento creado.'
              : `La solicitud está ${estadoLabel(solicitud.estado).toLowerCase()}. Solo se puede crear el evento de una solicitud aprobada.`}{' '}
            <Link to={`/admin/solicitudes/${solicitudId}`} className="font-semibold underline">
              Ver solicitud
            </Link>
          </div>
        )}

        <Section title="Información general">
          <div className="grid gap-5">
            <Field label="Título" htmlFor="titulo" required error={errors.titulo}>
              <input
                id="titulo"
                className="input"
                name="titulo"
                value={form.titulo}
                onChange={onChange}
                maxLength={191}
                aria-invalid={Boolean(errors.titulo)}
              />
            </Field>
            <Field label="Descripción" htmlFor="descripcion" required error={errors.descripcion}>
              <textarea
                id="descripcion"
                className="input min-h-32"
                name="descripcion"
                value={form.descripcion}
                onChange={onChange}
                maxLength={5000}
                aria-invalid={Boolean(errors.descripcion)}
              />
            </Field>
            {isNew && !solicitudId && (
              <Field label="Organizador" htmlFor="organizadorId" required error={errors.organizadorId}>
                <select
                  id="organizadorId"
                  className="input"
                  name="organizadorId"
                  value={form.organizadorId}
                  onChange={onChange}
                  aria-invalid={Boolean(errors.organizadorId)}
                >
                  <option value="">{organizadores.length ? 'Selecciona un organizador' : 'No hay organizadores activos'}</option>
                  {organizadores.map((o) => (
                    <option key={o.id} value={o.id}>
                      {[o.nombre, o.apellido].filter(Boolean).join(' ')} ({o.email})
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </div>
        </Section>

        <Section title="Imagen del evento">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
            <div className="w-full max-w-sm">
              <img
                src={fotoSrc}
                alt="Imagen del evento"
                className={`aspect-[16/9] w-full rounded border border-border object-cover ${usaImagenPorDefecto ? 'opacity-60' : ''}`}
              />
              {usaImagenPorDefecto && (
                <p className="mt-2 text-sm text-slate-600">Sube la imagen del evento. Sin ella no se puede publicar.</p>
              )}
              {fotoPreview && <p className="mt-2 text-sm text-slate-600">Imagen nueva. Se guardará al guardar los cambios.</p>}
            </div>
            <div className="flex flex-wrap gap-3">
              <label className="btn-secondary cursor-pointer">
                {usaImagenPorDefecto ? 'Subir imagen' : 'Cambiar imagen'}
                <input type="file" accept={ACCEPT_IMAGE} className="hidden" onChange={onFotoChange} />
              </label>
              {fotoFile && (
                <button type="button" className="btn-secondary" onClick={() => setFotoFile(null)}>
                  Descartar
                </button>
              )}
            </div>
          </div>
        </Section>

        <Section title="Lugar y capacidad">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Ubicación" htmlFor="ubicacion" required error={errors.ubicacion} className="sm:col-span-2">
              <input
                id="ubicacion"
                className="input"
                name="ubicacion"
                value={form.ubicacion}
                onChange={onChange}
                maxLength={191}
                placeholder="Dirección o nombre del lugar"
                aria-invalid={Boolean(errors.ubicacion)}
              />
            </Field>
            <Field label="Enlace de Google Maps" htmlFor="ubicacionUrl" required error={errors.ubicacionUrl} className="sm:col-span-2">
              <div className="flex gap-2">
                <input
                  id="ubicacionUrl"
                  className="input"
                  name="ubicacionUrl"
                  type="url"
                  value={form.ubicacionUrl}
                  onChange={onChange}
                  maxLength={500}
                  placeholder="https://maps.app.goo.gl/..."
                  aria-invalid={Boolean(errors.ubicacionUrl)}
                />
                {mapsValido && (
                  <a
                    href={form.ubicacionUrl.trim()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary shrink-0"
                  >
                    <IconExternal />
                    Abrir
                  </a>
                )}
              </div>
            </Field>
            <Field label="Capacidad máxima" htmlFor="capacidad" required error={errors.capacidad}>
              <IntegerInput
                id="capacidad"
                value={form.capacidad}
                onChange={(v) => setField('capacidad', v)}
                placeholder="Máximo 20.000"
                aria-invalid={Boolean(errors.capacidad)}
              />
            </Field>
          </div>
        </Section>

        <Section title="Fecha y horario">
          <label className="mb-5 inline-flex cursor-pointer items-center gap-3 text-sm font-semibold text-ink">
            <input type="checkbox" className="h-4 w-4 accent-teal" checked={variosDias} onChange={onToggleVariosDias} />
            Evento de varios días
          </label>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={variosDias ? 'Fecha de inicio' : 'Fecha del evento'} htmlFor="fechaInicio" required>
              <input
                id="fechaInicio"
                className="input"
                type="date"
                name="fechaInicio"
                value={form.fechaInicio}
                onChange={(e) => {
                  onChange(e)
                  clearError('fechas')
                }}
                min={isNew ? minDate : undefined}
              />
            </Field>
            {variosDias ? (
              <Field label="Fecha de fin" htmlFor="fechaFin" required>
                <input
                  id="fechaFin"
                  className="input"
                  type="date"
                  name="fechaFin"
                  value={form.fechaFin}
                  onChange={(e) => {
                    onChange(e)
                    clearError('fechas')
                  }}
                  min={form.fechaInicio || minDate}
                />
              </Field>
            ) : (
              <div className="hidden sm:block" />
            )}
            <Field label="Hora de inicio" htmlFor="horaInicio" required>
              <input
                id="horaInicio"
                className="input"
                type="time"
                name="horaInicio"
                value={form.horaInicio}
                onChange={onHoraChange}
              />
            </Field>
            <Field label="Hora de fin" htmlFor="horaFin" required>
              <input
                id="horaFin"
                className="input"
                type="time"
                name="horaFin"
                value={form.horaFin}
                onChange={onHoraChange}
              />
            </Field>
          </div>
          {errors.fechas && <p className="field-error">{errors.fechas}</p>}
        </Section>

        <Section title="Cronograma">
          <CronogramaEditor
            id="cronograma"
            actividades={cronograma}
            apertura={form.horaInicio}
            cierre={form.horaFin}
            onChange={(v) => {
              setCronograma(v)
              clearError('cronograma')
            }}
          />
          {errors.cronograma && <p className="field-error mt-3">{errors.cronograma}</p>}
        </Section>

        <Section title="Servicios">
          <ListEditor
            id="servicios"
            items={servicios}
            onChange={(v) => {
              setServicios(v)
              clearError('servicios')
            }}
            onPendingChange={(v) => {
              setServicioPendiente(v)
              clearError('servicios')
            }}
            placeholder="Nombre del servicio"
            maxItems={MAX_SERVICIOS}
            maxLength={80}
            emptyText="Aún no agregaste servicios."
          />
          {errors.servicios && <p className="field-error">{errors.servicios}</p>}
        </Section>

        <Section title={isNew ? 'Acceso' : 'Acceso y estado'}>
          <div className="grid gap-5">
            <div>
              <span className="label">Tipo de acceso</span>
              <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Tipo de acceso">
                {TIPO_ACCESO_OPTIONS.map((opt) => {
                  const selected = form.tipoAcceso === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setField('tipoAcceso', opt.value)}
                      className={`flex items-center gap-3 rounded-md border px-4 py-3 text-left text-sm font-semibold transition ${
                        selected ? 'border-teal bg-teal/5 text-ink' : 'border-border text-slate-600 hover:border-slate-400'
                      }`}
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                          selected ? 'border-teal' : 'border-slate-300'
                        }`}
                        aria-hidden="true"
                      >
                        {selected && <span className="h-2 w-2 rounded-full bg-teal" />}
                      </span>
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>
            {!isNew && (
              <Field label="Estado" htmlFor="estado" className="sm:max-w-sm">
                <select id="estado" className="input" name="estado" value={form.estado} onChange={onChange}>
                  {ESTADO_EVENTO_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </div>
        </Section>

        {formError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</div>
        )}

        <div className="flex justify-end border-t border-border pt-6">
          <button type="submit" className="btn-primary min-w-44" disabled={saving || solicitudBloqueada}>
            {saving ? 'Guardando…' : isNew ? 'Crear evento' : 'Guardar'}
          </button>
        </div>
      </form>
    </>
  )
}
