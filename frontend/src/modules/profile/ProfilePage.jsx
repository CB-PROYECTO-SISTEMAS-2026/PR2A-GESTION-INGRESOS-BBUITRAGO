import { useEffect, useState } from 'react'
import { getMyProfile, removeMyFoto, updateMe, uploadMyFoto } from '../../api/users.api'
import { toast } from '../../components/Toast'
import Field, { Section } from '../../components/form/Field'
import ImageCaptureField from '../../components/form/ImageCaptureField'
import { Skeleton } from '../../components/ui/Skeleton'
import { confirmDialog } from '../../components/ui/ConfirmDialog'
import { useAuth } from '../../context/AuthContext'
import { getErrorMessage, toDay } from '../../utils/format'
import { joinPhone, isValidLocalPhone, PHONE_COUNTRY_CODES, splitPhone } from '../../utils/phone'
import { todayLocal } from '../../utils/schedule'
import IdentidadSection from './IdentidadSection'

const MIN_BIRTH_DAY = '1900-01-01'
const emptyForm = {
  nombre: '',
  apellido: '',
  email: '',
  fechaNac: '',
  countryCode: '+591',
  phoneNumber: '',
  nombreProductora: '',
}

function toForm(data) {
  const phone = splitPhone(data?.telefono)
  return {
    nombre: data?.nombre || '',
    apellido: data?.apellido || '',
    email: data?.email || '',
    fechaNac: toDay(data?.fechaNac),
    countryCode: phone.countryCode,
    phoneNumber: phone.number,
    nombreProductora: data?.nombreProductora || '',
  }
}

/** Perfil: datos básicos + identidad; organizadores editan también la productora. */
export default function ProfilePage() {
  const { user, refreshUser, hasRole } = useAuth()
  const isOrganizador = hasRole('ORGANIZADOR')
  const [form, setForm] = useState(emptyForm)
  const [fotoUrl, setFotoUrl] = useState('')
  const [fotoFile, setFotoFile] = useState(null)
  const [fotoError, setFotoError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [fotoBusy, setFotoBusy] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const hoy = todayLocal()

  useEffect(() => {
    let alive = true
    getMyProfile()
      .then(({ data }) => {
        if (!alive) return
        setForm(toForm(data))
        setFotoUrl(data?.fotoUrl || '')
      })
      .catch((err) => alive && setError(getErrorMessage(err, 'No se pudo cargar tu perfil')))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [user?.id])

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    setFieldErrors((fe) => ({ ...fe, [key]: undefined }))
  }

  const validate = () => {
    const next = {}
    if (form.nombre.trim().length < 2) next.nombre = 'Mínimo 2 caracteres.'
    if (form.phoneNumber.trim() && !isValidLocalPhone(form.phoneNumber)) {
      next.phoneNumber = '7 a 15 dígitos.'
    }
    if (form.fechaNac && (form.fechaNac < MIN_BIRTH_DAY || form.fechaNac > hoy)) {
      next.fechaNac = 'Fecha inválida.'
    }
    setFieldErrors(next)
    return Object.keys(next).length === 0
  }

  const onSave = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    setError('')
    try {
      await updateMe({
        nombre: form.nombre.trim(),
        apellido: form.apellido.trim(),
        telefono: joinPhone(form.countryCode, form.phoneNumber) || null,
        fechaNac: form.fechaNac || null,
        ...(isOrganizador ? { nombreProductora: form.nombreProductora.trim() || null } : {}),
      })
      await refreshUser()
      toast('Perfil guardado', 'success')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const applyFotoFile = async (file) => {
    if (!file) return
    setFotoBusy(true)
    try {
      const fd = new FormData()
      fd.append('foto', file)
      const { data } = await uploadMyFoto(fd)
      setFotoUrl(data?.fotoUrl || '')
      setFotoFile(null)
      await refreshUser()
      toast('Foto actualizada', 'success')
    } catch (err) {
      toast(getErrorMessage(err), 'error')
    } finally {
      setFotoBusy(false)
    }
  }

  const onQuitarFoto = async () => {
    const ok = await confirmDialog({
      title: 'Quitar foto',
      message: 'Se mostrarán tus iniciales.',
      confirmText: 'Quitar',
      tone: 'danger',
    })
    if (ok !== true) return
    setFotoBusy(true)
    try {
      await removeMyFoto()
      setFotoUrl('')
      await refreshUser()
      toast('Foto eliminada', 'success')
    } catch (err) {
      toast(getErrorMessage(err), 'error')
    } finally {
      setFotoBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-12" aria-busy="true">
        <span className="sr-only">Cargando…</span>
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  const iniciales = `${(form.nombre[0] || '?').toUpperCase()}${(form.apellido[0] || '').toUpperCase()}`

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <h1 className="font-display text-3xl font-bold text-ink text-balance">Mi perfil</h1>

      <Section title="Foto">
        <div className="flex flex-wrap items-center gap-5">
          {fotoUrl ? (
            <img
              src={fotoUrl}
              alt="Tu foto de perfil"
              className="h-20 w-20 rounded-full border border-border object-cover"
              width={80}
              height={80}
            />
          ) : (
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-sidebar font-display text-2xl font-bold text-white">
              {iniciales}
            </span>
          )}
          <div className="min-w-0 flex-1 space-y-2">
            <ImageCaptureField
              value={fotoFile}
              disabled={fotoBusy}
              previewAlt="Nueva foto"
              onChange={(file, err) => {
                setFotoError(err || '')
                setFotoFile(file)
                if (file && !err) applyFotoFile(file)
              }}
              error={fotoError}
            />
            {fotoUrl && (
              <button type="button" className="btn-secondary btn-sm" onClick={onQuitarFoto} disabled={fotoBusy}>
                Quitar foto
              </button>
            )}
          </div>
        </div>
      </Section>

      <form onSubmit={onSave} noValidate>
        <Section title="Datos">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Nombre" htmlFor="nombre" required error={fieldErrors.nombre}>
              <input
                id="nombre"
                name="given-name"
                autoComplete="given-name"
                className="input"
                value={form.nombre}
                onChange={set('nombre')}
                maxLength={100}
              />
            </Field>
            <Field label="Apellido" htmlFor="apellido">
              <input
                id="apellido"
                name="family-name"
                autoComplete="family-name"
                className="input"
                value={form.apellido}
                onChange={set('apellido')}
                maxLength={100}
              />
            </Field>
            {isOrganizador && (
              <Field label="Nombre de productora" htmlFor="nombreProductora" className="sm:col-span-2">
                <input
                  id="nombreProductora"
                  name="organization"
                  autoComplete="organization"
                  className="input"
                  value={form.nombreProductora}
                  onChange={set('nombreProductora')}
                  maxLength={120}
                  placeholder="Ej. Sich Producciones"
                />
              </Field>
            )}
            <Field label="Correo" htmlFor="email">
              <input id="email" className="input" value={form.email} disabled spellCheck={false} />
            </Field>
            <Field label="Celular" htmlFor="phoneNumber" error={fieldErrors.phoneNumber}>
              <div className="flex gap-2">
                <select
                  className="input w-[7.5rem] shrink-0"
                  aria-label="Código de país"
                  name="country-code"
                  value={form.countryCode}
                  onChange={set('countryCode')}
                >
                  {PHONE_COUNTRY_CODES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <input
                  id="phoneNumber"
                  name="tel-national"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel-national"
                  className="input min-w-0 flex-1"
                  value={form.phoneNumber}
                  onChange={set('phoneNumber')}
                  maxLength={15}
                  placeholder="71234567…"
                />
              </div>
            </Field>
            <Field label="Nacimiento" htmlFor="fechaNac" error={fieldErrors.fechaNac}>
              <input
                id="fechaNac"
                type="date"
                name="bday"
                autoComplete="bday"
                className="input"
                value={form.fechaNac}
                onChange={set('fechaNac')}
                min={MIN_BIRTH_DAY}
                max={hoy}
              />
            </Field>
          </div>
          {error && (
            <p className="mt-4 text-sm text-danger" role="alert">
              {error}
            </p>
          )}
          <div className="mt-6 flex justify-end">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </Section>
      </form>

      <IdentidadSection />
    </div>
  )
}
