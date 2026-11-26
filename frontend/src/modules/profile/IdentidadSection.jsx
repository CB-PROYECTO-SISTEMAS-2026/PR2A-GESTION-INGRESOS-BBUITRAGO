import { useEffect, useId, useRef, useState } from 'react'
import {
  actualizarIdentidad,
  getMiIdentidad,
  registrarIdentidad,
} from '../../api/identidad.api'
import { toast } from '../../components/Toast'
import Field, { Section } from '../../components/form/Field'
import { getErrorMessage } from '../../utils/format'

const DOCUMENT_TYPES = [
  { value: 'CI', label: 'CI' },
  { value: 'PASAPORTE', label: 'Pasaporte' },
  { value: 'CE', label: 'Cédula de extranjería' },
  { value: 'OTRO', label: 'Otro' },
]

const COUNTRIES = [
  { value: 'BO', label: 'Bolivia (BO)' },
  { value: 'AR', label: 'Argentina (AR)' },
  { value: 'BR', label: 'Brasil (BR)' },
  { value: 'CL', label: 'Chile (CL)' },
  { value: 'CO', label: 'Colombia (CO)' },
  { value: 'EC', label: 'Ecuador (EC)' },
  { value: 'PY', label: 'Paraguay (PY)' },
  { value: 'PE', label: 'Perú (PE)' },
  { value: 'UY', label: 'Uruguay (UY)' },
  { value: 'VE', label: 'Venezuela (VE)' },
  { value: 'ES', label: 'España (ES)' },
  { value: 'US', label: 'Estados Unidos (US)' },
]

const emptyForm = {
  documentType: 'CI',
  documentCountry: 'BO',
  documentNumber: '',
  documentComplement: '',
  consentimiento: false,
  motivo: '',
}

function formatConsentDate(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('es-BO', { day: 'numeric', month: 'short', year: 'numeric' })
}

/**
 * Registro / actualización de documento.
 * En puerta solo se comprueban los últimos 4 caracteres del número.
 */
export default function IdentidadSection() {
  const headingId = useId()
  const firstInvalidRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [identidad, setIdentidad] = useState(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [fieldErrors, setFieldErrors] = useState({})
  const [loadError, setLoadError] = useState('')

  const registrada = Boolean(identidad)
  const showForm = !registrada || editing
  const showComplement = form.documentCountry === 'BO' && form.documentType === 'CI'

  useEffect(() => {
    let alive = true
    getMiIdentidad()
      .then(({ data }) => {
        if (!alive) return
        setIdentidad(data?.identidad || null)
        setEditing(!data?.registrada)
      })
      .catch((err) => {
        if (alive) setLoadError(getErrorMessage(err, 'No se pudo cargar tu identidad.'))
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (loading || loadError) return
    if (window.location.hash !== '#identidad') return
    document.getElementById('identidad')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [loading, loadError])

  const set = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((f) => {
      const next = { ...f, [key]: value }
      if (key === 'documentType' || key === 'documentCountry') {
        const country = key === 'documentCountry' ? value : f.documentCountry
        const type = key === 'documentType' ? value : f.documentType
        if (!(country === 'BO' && type === 'CI')) next.documentComplement = ''
      }
      return next
    })
    setFieldErrors((fe) => ({ ...fe, [key]: undefined }))
  }

  const startEdit = () => {
    setForm({
      ...emptyForm,
      documentType: identidad?.documentType || 'CI',
      documentCountry: identidad?.documentCountry || 'BO',
    })
    setFieldErrors({})
    setEditing(true)
  }

  const cancelEdit = () => {
    setForm(emptyForm)
    setFieldErrors({})
    setEditing(false)
  }

  const validate = () => {
    const next = {}
    if (!DOCUMENT_TYPES.some((t) => t.value === form.documentType)) {
      next.documentType = 'Tipo inválido.'
    }
    if (!/^[A-Za-z]{2}$/.test(form.documentCountry.trim())) {
      next.documentCountry = 'Código de país inválido.'
    }
    const number = form.documentNumber.trim().replace(/[\s.\-_/]/g, '')
    if (number.length < 4 || number.length > 30) {
      next.documentNumber = 'Entre 4 y 30 caracteres.'
    } else if (!/^[A-Za-z0-9]+$/.test(number)) {
      next.documentNumber = 'Solo letras y números.'
    }
    if (showComplement && form.documentComplement.trim()) {
      const comp = form.documentComplement.trim().replace(/[\s.\-]/g, '')
      if (!/^[A-Za-z0-9]{1,5}$/.test(comp)) next.documentComplement = 'Complemento inválido.'
    }
    if (!form.consentimiento) next.consentimiento = 'Debes aceptar para continuar.'
    if (registrada && form.motivo.trim().length < 10) {
      next.motivo = 'Mínimo 10 caracteres.'
    }
    setFieldErrors(next)
    return { ok: Object.keys(next).length === 0, firstKey: Object.keys(next)[0] }
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    const { ok, firstKey } = validate()
    if (!ok) {
      const el = firstInvalidRef.current?.querySelector(`[name="${firstKey}"]`)
      el?.focus()
      return
    }

    const payload = {
      documentType: form.documentType,
      documentCountry: form.documentCountry.trim().toUpperCase(),
      documentNumber: form.documentNumber.trim(),
      consentimiento: true,
    }
    if (showComplement && form.documentComplement.trim()) {
      payload.documentComplement = form.documentComplement.trim()
    }
    if (registrada) payload.motivo = form.motivo.trim()

    setSaving(true)
    try {
      const { data } = registrada
        ? await actualizarIdentidad(payload)
        : await registrarIdentidad(payload)
      setIdentidad(data?.identidad || null)
      setEditing(false)
      setForm(emptyForm)
      setFieldErrors({})
      toast(registrada ? 'Identidad actualizada' : 'Identidad registrada', 'success')
      requestAnimationFrame(() => {
        document.getElementById('identidad')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    } catch (err) {
      toast({ title: 'No se pudo guardar', body: getErrorMessage(err), variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Section title="Identidad">
        <div className="space-y-3" aria-busy="true">
          <span className="sr-only">Cargando identidad…</span>
          <div className="h-10 animate-pulse rounded-md bg-border/60" />
          <div className="h-10 animate-pulse rounded-md bg-border/60" />
          <div className="h-10 w-2/3 animate-pulse rounded-md bg-border/60" />
        </div>
      </Section>
    )
  }

  if (loadError) {
    return (
      <Section title="Identidad">
        <p className="text-sm text-danger" role="alert">
          {loadError}
        </p>
      </Section>
    )
  }

  return (
    <section id="identidad" className="card-surface scroll-mt-24 p-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 id={headingId} className="font-display text-lg font-bold text-ink">
          Identidad
        </h2>
        {registrada && !editing && (
          <button type="button" className="btn-secondary btn-sm" onClick={startEdit}>
            Actualizar
          </button>
        )}
      </div>

      {registrada && !editing && (
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Documento</dt>
            <dd className="mt-0.5 text-sm font-medium text-ink">
              {identidad.etiqueta || `${identidad.documentType} ${identidad.documentCountry}: ${identidad.documentMask}`}
            </dd>
          </div>
          {identidad.consentAt && (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Registrado</dt>
              <dd className="mt-0.5 text-sm text-ink">{formatConsentDate(identidad.consentAt)}</dd>
            </div>
          )}
        </dl>
      )}

      {showForm && (
        <form
          ref={firstInvalidRef}
          method="post"
          action="/api/users/me/identidad"
          noValidate
          aria-labelledby={headingId}
          onSubmit={onSubmit}
          className={registrada ? 'mt-5 border-t border-border pt-5' : ''}
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <fieldset className="sm:col-span-2">
              <legend className="label mb-2">
                Tipo de documento <span className="text-danger" aria-hidden="true">*</span>
              </legend>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {DOCUMENT_TYPES.map((t) => (
                  <label key={t.value} className="inline-flex items-center gap-2 text-sm font-medium text-ink">
                    <input
                      type="radio"
                      name="documentType"
                      value={t.value}
                      checked={form.documentType === t.value}
                      onChange={set('documentType')}
                      required
                      className="h-4 w-4 accent-primary"
                    />
                    {t.label}
                  </label>
                ))}
              </div>
              {fieldErrors.documentType && <p className="field-error">{fieldErrors.documentType}</p>}
            </fieldset>

            <Field label="País emisor" htmlFor="id-pais" required error={fieldErrors.documentCountry}>
              <select
                id="id-pais"
                name="documentCountry"
                className="input"
                value={form.documentCountry}
                onChange={set('documentCountry')}
                required
                aria-invalid={fieldErrors.documentCountry ? 'true' : undefined}
              >
                {COUNTRIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="N° de documento" htmlFor="id-numero" required error={fieldErrors.documentNumber}>
              <input
                id="id-numero"
                name="documentNumber"
                className="input"
                value={form.documentNumber}
                onChange={set('documentNumber')}
                required
                minLength={4}
                maxLength={30}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="characters"
                spellCheck={false}
                inputMode="text"
                aria-invalid={fieldErrors.documentNumber ? 'true' : undefined}
                enterKeyHint={showComplement ? 'next' : registrada ? 'next' : 'done'}
              />
            </Field>

            {showComplement && (
              <Field label="Complemento CI" htmlFor="id-complemento" error={fieldErrors.documentComplement}>
                <input
                  id="id-complemento"
                  name="documentComplement"
                  className="input"
                  value={form.documentComplement}
                  onChange={set('documentComplement')}
                  maxLength={5}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  aria-invalid={fieldErrors.documentComplement ? 'true' : undefined}
                  placeholder="Opcional"
                  enterKeyHint={registrada ? 'next' : 'done'}
                />
              </Field>
            )}

            {registrada && (
              <Field
                label="Motivo del cambio"
                htmlFor="id-motivo"
                required
                error={fieldErrors.motivo}
                className="sm:col-span-2"
              >
                <textarea
                  id="id-motivo"
                  name="motivo"
                  className="input min-h-24 resize-y"
                  value={form.motivo}
                  onChange={set('motivo')}
                  required
                  minLength={10}
                  maxLength={500}
                  aria-invalid={fieldErrors.motivo ? 'true' : undefined}
                  placeholder="Ej.: Corrección de dígito / cambio de documento"
                />
              </Field>
            )}
          </div>

          <label className="mt-5 flex items-start gap-3 text-sm text-ink">
            <input
              type="checkbox"
              name="consentimiento"
              className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
              checked={form.consentimiento}
              onChange={set('consentimiento')}
              required
              aria-invalid={fieldErrors.consentimiento ? 'true' : undefined}
            />
            <span>
              Autorizo el uso de mi documento para titularidad de entradas y control de acceso.
              {fieldErrors.consentimiento && (
                <span className="mt-1 block text-sm text-danger" role="alert">
                  {fieldErrors.consentimiento}
                </span>
              )}
            </span>
          </label>

          <div className="mt-6 flex flex-wrap justify-end gap-3">
            {registrada && (
              <button type="button" className="btn-secondary" onClick={cancelEdit} disabled={saving}>
                Cancelar
              </button>
            )}
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Guardando…' : registrada ? 'Guardar cambios' : 'Registrar identidad'}
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
