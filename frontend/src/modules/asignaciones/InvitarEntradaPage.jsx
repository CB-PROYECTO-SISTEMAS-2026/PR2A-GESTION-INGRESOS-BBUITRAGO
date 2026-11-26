import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { aceptarAsignacion, previewInvitacion, rechazarAsignacion } from '../../api/asignaciones.api'
import { toast } from '../../components/Toast'
import { confirmDialog } from '../../components/ui/ConfirmDialog'
import { useAuth } from '../../context/AuthContext'
import { getErrorMessage } from '../../utils/format'

export default function InvitarEntradaPage() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const { isAuthenticated, user } = useAuth()

  const [preview, setPreview] = useState(null)
  const [checking, setChecking] = useState(Boolean(token))
  const [invalid, setInvalid] = useState(token ? '' : 'El enlace de invitación no es válido.')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState('')

  const returnPath = token ? `/invitar-entrada?token=${encodeURIComponent(token)}` : '/invitar-entrada'
  const loginUrl = `/login?redirect=${encodeURIComponent(returnPath)}`
  const registerUrl = `/register`

  useEffect(() => {
    if (!token) return undefined
    let alive = true
    previewInvitacion(token)
      .then(({ data }) => {
        if (alive) setPreview(data)
      })
      .catch((err) => {
        if (alive) setInvalid(getErrorMessage(err, 'La invitación no es válida o ya fue utilizada.'))
      })
      .finally(() => {
        if (alive) setChecking(false)
      })
    return () => {
      alive = false
    }
  }, [token])

  const onAceptar = async () => {
    if (!preview?.asignacionId) return
    setBusy(true)
    try {
      const { data } = await aceptarAsignacion(preview.asignacionId, token)
      setDone(data.mensaje || 'Entrada aceptada. Ya aparece en Mis entradas.')
      toast(data.mensaje || 'Entrada aceptada', 'success')
    } catch (err) {
      toast(getErrorMessage(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  const onRechazar = async () => {
    if (!preview?.asignacionId) return
    const ok = await confirmDialog({
      title: 'Rechazar invitación',
      message: 'Si rechazas, esta entrada no quedará a tu nombre.',
      confirmText: 'Rechazar',
      tone: 'danger',
    })
    if (ok !== true) return
    setBusy(true)
    try {
      const { data } = await rechazarAsignacion(preview.asignacionId)
      setDone(data.mensaje || 'Invitación rechazada.')
      toast(data.mensaje || 'Invitación rechazada', 'success')
    } catch (err) {
      toast(getErrorMessage(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center justify-center px-4 py-10">
      {checking ? (
        <p className="text-muted">Verificando invitación…</p>
      ) : invalid ? (
        <div className="card-surface w-full max-w-md p-8 text-center shadow-sm">
          <h1 className="font-display text-2xl font-bold">Invitación no disponible</h1>
          <p className="mt-2 text-sm text-muted">{invalid}</p>
          <Link to="/" className="btn-primary mt-5 inline-flex">
            Ir al inicio
          </Link>
        </div>
      ) : done ? (
        <div className="card-surface w-full max-w-md p-8 text-center shadow-sm">
          <h1 className="font-display text-2xl font-bold">Listo</h1>
          <p className="mt-2 text-sm text-muted">{done}</p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link to="/mis-entradas" className="btn-primary">
              Ver mis entradas
            </Link>
            <Link to="/perfil" className="btn-secondary">
              Mi perfil
            </Link>
          </div>
        </div>
      ) : (
        <div className="card-surface w-full max-w-md p-8 shadow-sm">
          <h1 className="font-display text-2xl font-bold">
            {preview.tipo === 'TRANSFERENCIA' ? 'Transferencia de entrada' : 'Invitación a entrada'}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {preview.remitente} te envió una entrada para <strong>{preview.evento}</strong>
            {preview.categoria ? ` · ${preview.categoria}` : ''}.
          </p>

          <dl className="mt-5 space-y-2 rounded-md border border-border bg-page p-4 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Evento</dt>
              <dd className="text-right font-medium">{preview.evento}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Categoría</dt>
              <dd className="text-right font-medium">{preview.categoria}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Destinatario</dt>
              <dd className="break-all text-right font-medium">{preview.destinatarioEmail}</dd>
            </div>
          </dl>

          {!isAuthenticated ? (
            <div className="mt-6 space-y-3">
              <p className="text-sm text-muted">
                Para aceptar o rechazar, inicia sesión con el correo de la invitación o crea una cuenta.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link to={loginUrl} className="btn-primary">
                  Iniciar sesión
                </Link>
                <Link to={registerUrl} className="btn-secondary">
                  Crear cuenta
                </Link>
              </div>
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              <p className="text-sm text-muted">
                Sesión de <strong>{user?.email || user?.nombre}</strong>. Si tu correo no coincide con el de la
                invitación, la aceptación será rechazada.
              </p>
              <p className="text-xs text-muted">
                Para quedar como titular necesitas tener tu identidad registrada en el perfil.
              </p>
              <div className="flex flex-wrap gap-3">
                <button type="button" className="btn-primary" disabled={busy} onClick={onAceptar}>
                  {busy ? 'Procesando…' : 'Aceptar entrada'}
                </button>
                <button type="button" className="btn-secondary !text-red-600 hover:!bg-red-50" disabled={busy} onClick={onRechazar}>
                  Rechazar
                </button>
                <Link to="/perfil#identidad" className="btn-secondary">
                  Ver identidad
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
