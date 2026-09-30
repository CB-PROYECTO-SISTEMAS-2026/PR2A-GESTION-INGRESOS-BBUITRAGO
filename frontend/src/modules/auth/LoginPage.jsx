import { useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import AuthHeader from '../../components/layout/AuthHeader'
import { useAuth } from '../../context/AuthContext'
import { getErrorMessage } from '../../utils/format'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = await login({ email, password })
      const redirect = searchParams.get('redirect')
      const from = location.state?.from
      if (from) {
        navigate(from, { replace: true })
      } else if (redirect && /^\/(?![/\\])/.test(redirect)) {
        navigate(redirect, { replace: true })
      } else if (user?.roles?.includes('ADMIN')) {
        navigate('/admin')
      } else if (user?.roles?.includes('JEFE_NEGOCIO')) {
        navigate('/negocio')
      } else {
        navigate('/')
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Credenciales inválidas'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-page">
      <AuthHeader />

      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <form onSubmit={onSubmit} className="card-surface w-full max-w-md p-8 shadow-sm">
          <h1 className="font-display text-2xl font-bold">Iniciar sesión</h1>

          <label className="label mt-6" htmlFor="email">
            Correo electrónico *
          </label>
          <input
            id="email"
            type="email"
            className="input"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <label className="label mt-4" htmlFor="password">
            Contraseña *
          </label>
          <input
            id="password"
            type="password"
            className="input"
            placeholder="Tu contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <div className="mt-2 text-right">
            <Link to="/forgot-password" className="text-sm font-medium text-teal hover:underline">
              Olvidé mi contraseña
            </Link>
          </div>

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

          <button type="submit" className="btn-primary mt-5 w-full" disabled={loading}>
            {loading ? 'Ingresando…' : 'Iniciar Sesión'}
          </button>

          <p className="mt-4 text-center text-sm text-muted">
            ¿No tienes cuenta?{' '}
            <Link to="/register" className="font-semibold text-teal hover:underline">
              Crear cuenta
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
