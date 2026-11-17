import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createSolicitud } from '../../api/events.api'
import { toast } from '../../components/Toast'
import Field, { Section } from '../../components/form/Field'
import { IntegerInput } from '../../components/form/NumberInputs'
import { IconExternal, IconUpload } from '../../components/ui/icons'
import { getErrorMessage } from '../../utils/format'
import { ACCEPT_MAPA, validateFile } from '../../utils/files'
import { todayLocal, validateSchedule } from '../../utils/schedule'
import { isGoogleMapsUrl, validateInteger, validateMapsUrl } from '../../utils/validation'

const initialForm = {
  nombreEvento: '',
  descripcion: '',
  ubicacion: '',
  ubicacionUrl: '',
  capacidad: '',
  empresa: '',
  fechaInicio: '',
  fechaFin: '',
  horaInicio: '09:00',
  horaFin: '18:00',
}

export default function SolicitudFormPage() {
  const navigate = useNavigate()
  const minDate = useMemo(() => todayLocal(), [])
  const [form, setForm] = useState(initialForm)
  const [variosDias, setVariosDias] = useState(false)
  const [mapa, setMapa] = useState(null)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [loading, setLoading] = useState(false)

  const mapaPreview = useMemo(() => (mapa && mapa.type !== 'application/pdf' ? URL.createObjectURL(mapa) : ''), [mapa])
  useEffect(() => () => mapaPreview && URL.revokeObjectURL(mapaPreview), [mapaPreview])

  const setField = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => (e[key] ? { ...e, [key]: '' } : e))
  }
  const set = (key) => (e) => setField(key, e.target.value)
  const setFecha = (key) => (e) => {
    setField(key, e.target.value)
    setErrors((prev) => (prev.fechas ? { ...prev, fechas: '' } : prev))
  }

  const onMapa = (e) => {
    const file = e.target.files?.[0] || null
    e.target.value = ''
    if (!file) return
    const invalid = validateFile(file, { allowPdf: true })
    if (invalid) {
      setErrors((prev) => ({ ...prev, mapa: invalid }))
      return
    }
    setMapa(file)
    setErrors((prev) => ({ ...prev, mapa: '' }))
  }

  const validate = () => {
    const next = {}
    if (form.nombreEvento.trim().length < 5) next.nombreEvento = 'El nombre del evento debe tener al menos 5 caracteres.'
    if (form.descripcion.trim().length < 20) next.descripcion = 'La descripción debe tener al menos 20 caracteres.'
    if (form.ubicacion.trim().length < 5) next.ubicacion = 'Escribe la dirección o el nombre del lugar (mínimo 5 caracteres).'
    const mapsError = validateMapsUrl(form.ubicacionUrl)
    if (mapsError) next.ubicacionUrl = mapsError
    const capacidadError = validateInteger(form.capacidad, { label: 'la capacidad máxima' })
    if (capacidadError) next.capacidad = capacidadError
    const scheduleError = validateSchedule({ ...form, variosDias })
    if (scheduleError) next.fechas = scheduleError
    if (!mapa) next.mapa = 'Adjunta el mapa de la zona del evento (imagen o PDF).'
    return next
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setFormError('')
    const errs = validate()
    setErrors(errs)
    if (Object.values(errs).some(Boolean)) return

    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('nombreEvento', form.nombreEvento.trim())
      fd.append('descripcion', form.descripcion.trim())
      fd.append('ubicacion', form.ubicacion.trim())
      fd.append('ubicacionUrl', form.ubicacionUrl.trim())
      fd.append('capacidad', form.capacidad)
      if (form.empresa.trim()) fd.append('empresa', form.empresa.trim())
      fd.append('fechaInicio', form.fechaInicio)
      if (variosDias) fd.append('fechaFin', form.fechaFin)
      fd.append('horaInicio', form.horaInicio)
      fd.append('horaFin', form.horaFin)
      fd.append('mapa', mapa)

      await createSolicitud(fd)
      toast('Solicitud enviada', 'success')
      navigate('/organizador/solicitudes')
    } catch (err) {
      setFormError(getErrorMessage(err, 'No se pudo enviar la solicitud'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold text-ink">Nueva solicitud de evento</h1>
        <Link to="/organizador/solicitudes" className="text-sm font-semibold text-teal-dark hover:underline">
          Mis solicitudes
        </Link>
      </div>

      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-6">
        <Section title="Datos del evento">
          <div className="grid gap-5">
            <Field label="Nombre del evento" htmlFor="nombreEvento" required error={errors.nombreEvento}>
              <input
                id="nombreEvento"
                className="input"
                value={form.nombreEvento}
                onChange={set('nombreEvento')}
                maxLength={120}
                aria-invalid={Boolean(errors.nombreEvento)}
              />
            </Field>
            <Field label="Descripción" htmlFor="descripcion" required error={errors.descripcion}>
              <textarea
                id="descripcion"
                className="input min-h-28"
                value={form.descripcion}
                onChange={set('descripcion')}
                maxLength={5000}
                aria-invalid={Boolean(errors.descripcion)}
              />
            </Field>
            <Field label="Empresa u organización" htmlFor="empresa">
              <input id="empresa" className="input" value={form.empresa} onChange={set('empresa')} maxLength={191} />
            </Field>
          </div>
        </Section>

        <Section title="Lugar y capacidad">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Ubicación" htmlFor="ubicacion" required error={errors.ubicacion} className="sm:col-span-2">
              <input
                id="ubicacion"
                className="input"
                value={form.ubicacion}
                onChange={set('ubicacion')}
                maxLength={191}
                placeholder="Dirección o nombre del lugar"
                aria-invalid={Boolean(errors.ubicacion)}
              />
            </Field>
            <Field label="Enlace de Google Maps" htmlFor="ubicacionUrl" required error={errors.ubicacionUrl} className="sm:col-span-2">
              <div className="flex gap-2">
                <input
                  id="ubicacionUrl"
                  type="url"
                  className="input"
                  value={form.ubicacionUrl}
                  onChange={set('ubicacionUrl')}
                  maxLength={500}
                  placeholder="https://maps.app.goo.gl/..."
                  aria-invalid={Boolean(errors.ubicacionUrl)}
                />
                {isGoogleMapsUrl(form.ubicacionUrl) && (
                  <a href={form.ubicacionUrl.trim()} target="_blank" rel="noopener noreferrer" className="btn-secondary shrink-0">
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
            <Field label="Mapa de la zona" required error={errors.mapa} className="sm:col-span-2">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <label className="btn-secondary cursor-pointer self-start">
                  <IconUpload />
                  {mapa ? 'Cambiar archivo' : 'Elegir archivo'}
                  <input type="file" accept={ACCEPT_MAPA} className="hidden" onChange={onMapa} />
                </label>
                {mapa && <span className="truncate text-sm font-medium text-slate-600">{mapa.name}</span>}
              </div>
              {mapaPreview && (
                <img src={mapaPreview} alt="Vista previa del mapa" className="mt-3 max-h-64 rounded-lg border border-border object-contain" />
              )}
            </Field>
          </div>
        </Section>

        <Section title="Fecha y horario">
          <label className="mb-5 inline-flex cursor-pointer items-center gap-3 text-sm font-semibold text-ink">
            <input
              type="checkbox"
              className="h-4 w-4 accent-teal"
              checked={variosDias}
              onChange={(e) => {
                const checked = e.target.checked
                setVariosDias(checked)
                setErrors((prev) => ({ ...prev, fechas: '' }))
                if (!checked) setForm((f) => ({ ...f, fechaFin: '' }))
              }}
            />
            Evento de varios días
          </label>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={variosDias ? 'Fecha de inicio' : 'Fecha del evento'} htmlFor="fechaInicio" required>
              <input id="fechaInicio" type="date" className="input" value={form.fechaInicio} onChange={setFecha('fechaInicio')} min={minDate} />
            </Field>
            {variosDias ? (
              <Field label="Fecha de fin" htmlFor="fechaFin" required>
                <input
                  id="fechaFin"
                  type="date"
                  className="input"
                  value={form.fechaFin}
                  onChange={setFecha('fechaFin')}
                  min={form.fechaInicio || minDate}
                />
              </Field>
            ) : (
              <div className="hidden sm:block" />
            )}
            <Field label="Hora de inicio" htmlFor="horaInicio" required>
              <input id="horaInicio" type="time" className="input" value={form.horaInicio} onChange={setFecha('horaInicio')} />
            </Field>
            <Field label="Hora de fin" htmlFor="horaFin" required>
              <input id="horaFin" type="time" className="input" value={form.horaFin} onChange={setFecha('horaFin')} />
            </Field>
          </div>
          {errors.fechas && <p className="field-error">{errors.fechas}</p>}
        </Section>

        {formError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</div>
        )}

        <div className="flex justify-end">
          <button type="submit" className="btn-primary min-w-44" disabled={loading}>
            {loading ? 'Enviando…' : 'Enviar solicitud'}
          </button>
        </div>
      </form>
    </div>
  )
}
