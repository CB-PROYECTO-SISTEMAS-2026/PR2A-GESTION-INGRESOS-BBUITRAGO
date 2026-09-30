import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthHeader from '../../components/layout/AuthHeader'
import { useAuth } from '../../context/AuthContext'
import { getErrorMessage } from '../../utils/format'

export default function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    nombre: '',
    apellido: '',
    email: '',
    telefono: '',
    password: '',
    confirmPassword: '',
  })
  const [error, setError] = useState('')
  const [userExists, setUserExists] = useState(false)
  const [loading, setLoading] = useState(false)

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setUserExists(false)
    if (!form.nombre.trim() || form.nombre.trim().length < 2) {
      setError('Ingresa tu nombre (mínimo 2 caracteres)')
      return
    }
    if (form.telefono && !/^[\d+\s()-]{7,20}$/.test(form.telefono.trim())) {
      setError('Teléfono inválido')
      return
    }
    if (form.password !== form.confirmPassword) {
      setError('Las contraseñas no coinciden')
      return
    }
    if (form.password.length < 8) {
      setError('La contraseña debe tener mínimo 8 caracteres')
      return
    }
    if (!/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) {
      setError('La contraseña debe combinar letras y números')
      return
    }
    setLoading(true)
    try {
      await register({
        nombre: form.nombre.trim(),
        apellido: form.apellido.trim() || undefined,
        email: form.email.trim(),
        telefono: form.telefono.trim() || undefined,
        password: form.password,
      })
      navigate('/')
    } catch (err) {
      setUserExists(err?.response?.status === 409)
      setError(getErrorMessage(err, 'No se pudo crear la cuenta'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-page">
      <AuthHeader />

      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <form onSubmit={onSubmit} className="card-surface w-full max-w-md p-8 shadow-sm">
          <h1 className="font-display text-2xl font-bold">Crear cuenta</h1>

          <label className="label mt-6">Nombre *</label>
          <input
            className="input"
            value={form.nombre}
            onChange={set('nombre')}
            placeholder="Ej. María"
            required
          />

          <label className="label mt-4">Apellido</label>
          <input
            className="input"
            value={form.apellido}
            onChange={set('apellido')}
            placeholder="Ej. Quispe"
          />

          <label className="label mt-4">Correo electrónico *</label>
          <input
            type="email"
            className="input"
            value={form.email}
            onChange={set('email')}
            placeholder="tu.correo@ejemplo.com"
            required
          />
          <label className="label mt-4">Celular / Teléfono</label>
          <input
            className="input"
            value={form.telefono}
            onChange={set('telefono')}
            placeholder="Ej. 70012345"
          />
          <label className="label mt-4">Contraseña *</label>
          <input
            type="password"
            className="input"
            placeholder="Mínimo 8 caracteres"
            value={form.password}
            onChange={set('password')}
            required
            minLength={8}
          />
          <label className="label mt-4">Confirmar contraseña *</label>
          <input
            type="password"
            className="input"
            placeholder="Repite la misma contraseña"
            value={form.confirmPassword}
            onChange={set('confirmPassword')}
            required
          />

          {error && (
            <p className="mt-3 text-sm text-red-600">
              {error}
              {userExists && (
                <>
                  {' '}
                  <Link to="/login" className="font-semibold text-teal hover:underline">
                    Ir a iniciar sesión
                  </Link>
                </>
              )}
            </p>
          )}

          <button type="submit" className="btn-primary mt-5 w-full" disabled={loading}>
            {loading ? 'Creando…' : 'Crear Cuenta'}
          </button>

          <p className="mt-4 text-center text-sm text-muted">
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" className="font-semibold text-teal hover:underline">
              Iniciar sesión
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
