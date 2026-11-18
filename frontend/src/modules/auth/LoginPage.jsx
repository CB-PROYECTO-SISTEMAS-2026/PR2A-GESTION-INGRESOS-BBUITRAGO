import { useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import AuthHeader from '../../components/layout/AuthHeader'
import { useAuth } from '../../context/AuthContext'
import { getErrorMessage } from '../../utils/format'

export default function LoginPage() {
  const { login, startSession } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const doLogin = async (iniciar) => {
    setError('')
    setLoading(true)
    try {
      const user = await iniciar()
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
      } else if (user?.roles?.includes('DEVOLUCIONES')) {
        navigate('/devoluciones')
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
    doLogin(() => login({ email, password }))
  }

  const accesoRapido = (indice) => doLogin(async () => {
    const respuesta = await fetch('/presentacion/sesion/' + indice, { method: 'POST' })
    if (!respuesta.ok) throw new Error('No se pudo iniciar la sesión de presentación.')
    return startSession(await respuesta.json())
  })

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
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <div className="mt-2 text-right">
            <Link to="/forgot-password" className="text-sm font-medium text-teal hover:underline">
              Olvidé mi contraseña
            </Link>
          </div>

          {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}

          <button type="submit" className="btn-primary mt-5 w-full" disabled={loading}>
            {loading ? 'Ingresando…' : 'Iniciar sesión'}
          </button>

          <p className="mt-4 text-center text-sm text-muted">
            ¿No tienes cuenta?{' '}
            <Link to="/register" className="font-semibold text-teal hover:underline">
              Crear cuenta
            </Link>
          </p>

          {import.meta.env.DEV && import.meta.env.EVENTIX_ROLES_DEMO?.length > 0 && (
            <div className="mt-6 border-t border-border pt-4">
              <p className="text-center text-xs font-semibold uppercase tracking-wide text-muted">Acceso rápido</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {import.meta.env.EVENTIX_ROLES_DEMO.map((label, indice) => (
                  <button key={label} type="button" disabled={loading} onClick={() => accesoRapido(indice)}
                    className="rounded-lg border border-teal px-3 py-2 text-sm font-semibold text-teal hover:bg-teal hover:text-white disabled:opacity-50">
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
