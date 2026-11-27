import { useState } from 'react'
import { forgotPassword } from '../../api/auth.api'
import { getErrorMessage } from '../../utils/format'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)
    try {
      const { data } = await forgotPassword({ email: email.trim() })
      setMessage(
        data?.message || 'Si el correo está registrado, te enviamos un enlace para restablecer tu contraseña.',
      )
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center px-4 py-10">
      <form onSubmit={onSubmit} className="card-surface w-full max-w-md p-8 shadow-sm">
        <h1 className="font-display text-2xl font-bold">Recuperar contraseña</h1>
        <p className="mt-1 text-sm text-muted">
          Ingresa tu correo y te enviaremos un enlace para crear una nueva contraseña.
        </p>

        <label className="label mt-6" htmlFor="email">
          Correo electrónico
        </label>
        <input
          id="email"
          type="email"
          className="input"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            setError('')
          }}
          placeholder="tu.correo@ejemplo.com"
          required
        />
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        {message && <p className="mt-3 text-sm text-teal-dark">{message}</p>}

        <button type="submit" className="btn-primary mt-5 w-full" disabled={loading}>
          {loading ? 'Enviando…' : 'Enviar enlace'}
        </button>
      </form>
    </div>
  )
}
