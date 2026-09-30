import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import AuthHeader from '../../components/layout/AuthHeader'
import { aceptarInvitacion, verificarInvitacion } from '../../api/adminUsers.api'
import { useAuth } from '../../context/AuthContext'
import { formatDateTime, getErrorMessage } from '../../utils/format'
import { validatePassword } from '../../utils/password'
import { roleLabel } from '../../utils/roles'

function homeFor(roles = []) {
  if (roles.includes('ADMIN')) return '/admin'
  if (roles.includes('JEFE_NEGOCIO')) return '/negocio'
  if (roles.includes('ORGANIZADOR')) return '/organizador/solicitudes'
  return '/'
}

export default function AceptarInvitacionPage() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const navigate = useNavigate()
  const { startSession, logout, isAuthenticated } = useAuth()

  const [invitacion, setInvitacion] = useState(null)
  const [checking, setChecking] = useState(Boolean(token))
  const [invalid, setInvalid] = useState(token ? '' : 'El enlace de invitación no es válido.')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!token) return
    let alive = true
    ;(async () => {
      try {
        const { data } = await verificarInvitacion(token)
        if (alive) setInvitacion(data)
      } catch (err) {
        if (alive) setInvalid(getErrorMessage(err, 'La invitación no es válida o ya fue utilizada.'))
      } finally {
        if (alive) setChecking(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [token])

  const onSubmit = async (e) => {
    e.preventDefault()
    const problem = validatePassword(password, confirmPassword)
    if (problem) {
      setError(problem)
      return
    }
    setError('')
    setSaving(true)
    try {
      const { data } = await aceptarInvitacion({ token, password })
      if (isAuthenticated) logout()
      const user = startSession(data)
      navigate(homeFor(user?.roles), { replace: true })
    } catch (err) {
      const message = getErrorMessage(err, 'No se pudo activar la cuenta')
      if (err?.response?.status === 409) setInvalid(message)
      else setError(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-page">
      <AuthHeader backTo="/login" backLabel="Iniciar sesión" />

      <div className="flex flex-1 items-center justify-center px-4 py-10">
        {checking ? (
          <p className="text-muted">Verificando invitación…</p>
        ) : invalid ? (
          <div className="card-surface w-full max-w-md p-8 text-center shadow-sm">
            <h1 className="font-display text-2xl font-bold">Invitación no disponible</h1>
            <p className="mt-2 text-sm text-muted">{invalid}</p>
            <Link to="/login" className="btn-primary mt-5 inline-flex">
              Ir a iniciar sesión
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="card-surface w-full max-w-md p-8 shadow-sm">
            <h1 className="font-display text-2xl font-bold">Activar cuenta</h1>
            <p className="mt-1 text-sm text-muted">
              Fuiste invitado a EvenTix como <strong>{roleLabel(invitacion.role)}</strong>. Crea
              tu contraseña para confirmar la cuenta.
            </p>

            <dl className="mt-5 space-y-2 rounded-md border border-border bg-page p-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Nombre</dt>
                <dd className="text-right font-medium">
                  {[invitacion.nombre, invitacion.apellido].filter(Boolean).join(' ')}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Correo</dt>
                <dd className="break-all text-right font-medium">{invitacion.email}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Rol</dt>
                <dd className="text-right font-medium">{roleLabel(invitacion.role)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Válida hasta</dt>
                <dd className="text-right font-medium">{formatDateTime(invitacion.expiresAt)}</dd>
              </div>
            </dl>

            <label className="label mt-5">Contraseña *</label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              autoComplete="new-password"
              required
            />
            <label className="label mt-4">Confirmar contraseña *</label>
            <input
              type="password"
              className="input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repite la contraseña"
              autoComplete="new-password"
              required
            />

            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

            <button type="submit" className="btn-primary mt-5 w-full" disabled={saving}>
              {saving ? 'Activando…' : 'Aceptar invitación y crear cuenta'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
