import { useEffect, useState } from 'react'
import { getMyProfile, removeMyFoto, updateMe, uploadMyFoto } from '../../api/users.api'
import { toast } from '../../components/Toast'
import Field, { Section } from '../../components/form/Field'
import { confirmDialog } from '../../components/ui/ConfirmDialog'
import { useAuth } from '../../context/AuthContext'
import { getErrorMessage, toDay } from '../../utils/format'
import { ACCEPT_IMAGE, validateFile } from '../../utils/files'
import { roleLabel } from '../../utils/roles'
import { todayLocal } from '../../utils/schedule'

const MIN_BIRTH_DAY = '1900-01-01'
const emptyForm = { nombre: '', apellido: '', telefono: '', documento: '', email: '', fechaNac: '' }

function toForm(data) {
  return {
    nombre: data?.nombre || '',
    apellido: data?.apellido || '',
    telefono: data?.telefono || '',
    documento: data?.documento || '',
    email: data?.email || '',
    fechaNac: toDay(data?.fechaNac),
  }
}

export default function ProfilePage() {
  const { user, refreshUser } = useAuth()
  const [form, setForm] = useState(emptyForm)
  const [roles, setRoles] = useState([])
  const [fotoUrl, setFotoUrl] = useState('')
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
        setRoles(data?.roles ?? [])
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
    if (form.nombre.trim().length < 2) next.nombre = 'Ingresa tu nombre (mínimo 2 caracteres).'
    if (form.telefono.trim() && !/^[\d+\s()-]{7,20}$/.test(form.telefono.trim())) {
      next.telefono = 'Ingresa un teléfono válido, de 7 a 20 dígitos.'
    }
    if (form.documento.trim() && form.documento.trim().length < 5) next.documento = 'El documento es demasiado corto.'
    if (form.fechaNac && (form.fechaNac < MIN_BIRTH_DAY || form.fechaNac > hoy)) {
      next.fechaNac = 'Ingresa una fecha de nacimiento válida.'
    }
    setFieldErrors(next)
    return Object.keys(next).length === 0
  }

  const onSave = async (e) => {
    e.preventDefault()
    setError('')
    if (!validate()) return
    setSaving(true)
    try {
      const { data } = await updateMe({
        nombre: form.nombre.trim(),
        apellido: form.apellido.trim() || undefined,
        telefono: form.telefono.trim() || undefined,
        documento: form.documento.trim() || undefined,
        fechaNac: form.fechaNac || null,
      })
      setForm(toForm(data))
      await refreshUser()
      toast('Perfil actualizado', 'success')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const onFotoChange = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const invalid = validateFile(file)
    if (invalid) {
      toast(invalid, 'error')
      return
    }
    setFotoBusy(true)
    try {
      const fd = new FormData()
      fd.append('foto', file)
      const { data } = await uploadMyFoto(fd)
      setFotoUrl(data?.fotoUrl || '')
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
      title: 'Quitar foto de perfil',
      message: 'Se mostrarán tus iniciales en lugar de la foto.',
      confirmText: 'Quitar foto',
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
    return <div className="mx-auto max-w-3xl px-4 py-12 text-muted">Cargando perfil…</div>
  }

  const iniciales = `${(form.nombre[0] || '?').toUpperCase()}${(form.apellido[0] || '').toUpperCase()}`

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-bold text-ink">Mi perfil</h1>
        {roles.map((r) => (
          <span key={r} className="badge bg-teal/10 text-teal-dark">
            {roleLabel(r)}
          </span>
        ))}
      </div>

      <Section title="Foto de perfil">
        <div className="flex flex-wrap items-center gap-5">
          {fotoUrl ? (
            <img src={fotoUrl} alt="Tu foto de perfil" className="h-20 w-20 rounded-full border border-border object-cover" />
          ) : (
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-navy font-display text-2xl font-bold text-white">
              {iniciales}
            </span>
          )}
          <div className="flex flex-wrap gap-3">
            <label className={`btn-secondary ${fotoBusy ? 'pointer-events-none opacity-60' : 'cursor-pointer'}`}>
              {fotoBusy ? 'Subiendo…' : fotoUrl ? 'Cambiar foto' : 'Subir foto'}
              <input type="file" accept={ACCEPT_IMAGE} className="hidden" onChange={onFotoChange} disabled={fotoBusy} />
            </label>
            {fotoUrl && (
              <button type="button" className="btn-secondary" onClick={onQuitarFoto} disabled={fotoBusy}>
                Quitar
              </button>
            )}
          </div>
        </div>
      </Section>

      <form onSubmit={onSave} noValidate>
        <Section title="Datos personales">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Nombre" htmlFor="nombre" required error={fieldErrors.nombre}>
              <input id="nombre" className="input" value={form.nombre} onChange={set('nombre')} maxLength={100} />
            </Field>
            <Field label="Apellido" htmlFor="apellido">
              <input id="apellido" className="input" value={form.apellido} onChange={set('apellido')} maxLength={100} />
            </Field>
            <Field label="Correo electrónico" htmlFor="email">
              <input id="email" className="input" value={form.email} disabled />
            </Field>
            <Field label="Teléfono" htmlFor="telefono" error={fieldErrors.telefono}>
              <input id="telefono" className="input" value={form.telefono} onChange={set('telefono')} maxLength={20} inputMode="tel" />
            </Field>
            <Field label="Documento de identidad" htmlFor="documento" error={fieldErrors.documento}>
              <input id="documento" className="input" value={form.documento} onChange={set('documento')} maxLength={30} />
            </Field>
            <Field label="Fecha de nacimiento" htmlFor="fechaNac" error={fieldErrors.fechaNac}>
              <input
                id="fechaNac"
                type="date"
                className="input"
                value={form.fechaNac}
                onChange={set('fechaNac')}
                min={MIN_BIRTH_DAY}
                max={hoy}
              />
            </Field>
          </div>
          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
          <div className="mt-6 flex justify-end">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </Section>
      </form>
    </div>
  )
}
