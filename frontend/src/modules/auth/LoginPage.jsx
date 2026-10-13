import { useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import AuthHeader from '../../components/layout/AuthHeader'
import { useAuth } from '../../context/AuthContext'
import { getErrorMessage } from '../../utils/format'

// TEMPORAL: accesos rápidos para pruebas. Eliminar antes de producción.
const DEMO_USERS = [
  { label: 'Admin', email: 'admin@eventix.com', password: 'Admin123!' },
  { label: 'Organizador', email: 'organizador@eventix.com', password: 'Organiza123!' },
  { label: 'Cliente', email: 'cliente@eventix.com', password: 'Cliente123!' },
  { label: 'Jefe de negocio', email: 'negocio@eventix.com', password: 'Negocio123!' },
  { label: 'Ayudante', email: 'ayudante@eventix.com', password: 'Ayudante123!' },
  { label: 'Encargado de acceso', email: 'acceso@eventix.com', password: 'Acceso123!' },
  { label: 'Recargador', email: 'recargador@eventix.com', password: 'Recarga123!' },
  { label: 'Devoluciones', email: 'devoluciones@eventix.com', password: 'Devol123!' },
]

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const doLogin = async (credentials) => {
    setError('')
    setLoading(true)
    try {
      const user = await login(credentials)
      const redirect = searchParams.get('redirect')
      const from = location.state?.from
      if (from) {
        navigate(from, { replace: true })
      } else if (redirect && /^\/(?![/\\])/.test(redirect)) {
        navigate(redirect, { replace: true })
      } else if (user?.roles?.includes('ADMIN')) {
        navigate('/admin')
      } else if (user?.roles?.includes('JEFE_NEGOCIO')) {
        navigate('/negocio/dashboard')
      } else if (user?.roles?.includes('AYUDANTE')) {
        navigate('/pos')
      } else if (user?.roles?.includes('RECARGADOR')) {
        navigate('/recargas')
      } else if (user?.roles?.includes('ENCARGADO_ACCESO')) {
        navigate('/supervisor')
      } else {
        navigate('/')
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Credenciales inválidas'))
    } finally {
      setLoading(false)
    }
  }

  const onSubmit = (e) => {
    e.preventDefault()
    doLogin({ email, password })
  }

  const onDemoLogin = (u) => {
    setEmail(u.email)
    setPassword(u.password)
    doLogin({ email: u.email, password: u.password })
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

          <div className="mt-6 border-t border-border pt-4">
            <p className="text-center text-xs font-semibold uppercase tracking-wide text-muted">Acceso rápido</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {DEMO_USERS.map((u) => (
                <button
                  key={u.email}
                  type="button"
                  className="rounded-lg border border-teal px-3 py-2 text-sm font-semibold text-teal hover:bg-teal hover:text-white disabled:opacity-50"
                  onClick={() => onDemoLogin(u)}
                  disabled={loading}
                >
                  {u.label}
                </button>
              ))}
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
