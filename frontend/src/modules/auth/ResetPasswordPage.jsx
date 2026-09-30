import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import AuthHeader from '../../components/layout/AuthHeader'
import { resetPassword } from '../../api/auth.api'
import { getErrorMessage } from '../../utils/format'
import { validatePassword } from '../../utils/password'

export default function ResetPasswordPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token') || ''
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e) => {
    e.preventDefault()
    const invalid = validatePassword(password, confirmPassword)
    if (invalid) {
      setError(invalid)
      return
    }
    setError('')
    setLoading(true)
    try {
      await resetPassword({ token, newPassword: password })
      navigate('/login', { replace: true })
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudo restablecer la contraseña'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-page">
      <AuthHeader backTo="/login" />

      <div className="flex flex-1 items-center justify-center px-4 py-10">
        {!token ? (
          <div className="card-surface w-full max-w-md p-8 text-center shadow-sm">
            <h1 className="font-display text-2xl font-bold">Enlace inválido</h1>
            <p className="mt-2 text-sm text-muted">
              Abre el enlace que te enviamos por correo o solicita uno nuevo.
            </p>
            <Link to="/forgot-password" className="btn-primary mt-5 inline-flex">
              Solicitar nuevo enlace
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="card-surface w-full max-w-md p-8 shadow-sm">
            <h1 className="font-display text-2xl font-bold">Nueva contraseña</h1>

            <label className="label mt-6">Nueva contraseña *</label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              autoComplete="new-password"
              required
            />
            <label className="label mt-4">Confirmar *</label>
            <input
              type="password"
              className="input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repite la nueva contraseña"
              autoComplete="new-password"
              required
            />

            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

            <button type="submit" className="btn-primary mt-5 w-full" disabled={loading}>
              {loading ? 'Guardando…' : 'Restablecer'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
