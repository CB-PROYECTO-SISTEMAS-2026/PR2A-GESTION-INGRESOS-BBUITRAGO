import { useState } from 'react'
import { Link } from 'react-router-dom'
import Field from '../form/Field'
import Modal from '../ui/Modal'
import { confirmDialog } from '../ui/ConfirmDialog'
import { eventImage, formatDateTime, formatDay } from '../../utils/format'
import { estadoBadgeClass, estadoLabel } from '../../utils/labels'

const TITULAR_LABEL = {
  SIN_ASIGNAR: 'Sin titular',
  INVITACION_PENDIENTE: 'Invitación pendiente',
  ASIGNADA: 'Titular asignado',
  REVOCADA: 'Titular revocado',
}

const TITULAR_BADGE = {
  SIN_ASIGNAR: 'bg-warning-soft text-warning',
  INVITACION_PENDIENTE: 'bg-info-soft text-info',
  ASIGNADA: 'bg-success-soft text-success',
  REVOCADA: 'bg-page text-muted',
}

const diaCorto = (fecha) => (fecha ? formatDay(fecha, { weekday: 'short', day: 'numeric', month: 'short' }) : null)

function EntradaTitularRow({ entrada, busy, onAsignarme, onInvitar, onCancelar, onReenviar }) {
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState('')
  const pendiente = entrada.invitacionPendiente
  const sinTitular = entrada.titularEstado === 'SIN_ASIGNAR' || entrada.titularEstado === 'REVOCADA'
  const puedeInvitar = sinTitular || entrada.titularEstado === 'INVITACION_PENDIENTE'
  const puedeAsignarme = sinTitular || (entrada.titularEstado === 'INVITACION_PENDIENTE' && !entrada.titular?.soyYo)

  const submitInvitar = (e) => {
    e.preventDefault()
    const value = email.trim()
    if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setEmailError('Ingresa un correo válido.')
      return
    }
    setEmailError('')
    onInvitar(entrada, value).then((ok) => {
      if (ok) setEmail('')
    })
  }

  return (
    <li className="rounded-xl border border-border bg-page/50 p-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md bg-ink">
          <img
            src={eventImage(entrada.evento)}
            alt=""
            className="max-h-full max-w-full object-contain"
            width={96}
            height={64}
          />
        </div>
        <div className="min-w-0 flex-1">
          <Link to={`/eventos/${entrada.evento.id}`} className="font-display text-base font-bold text-ink hover:text-primary">
            {entrada.evento.titulo}
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="badge bg-primary-soft text-primary">{entrada.categoria}</span>
            <span className={`badge ${estadoBadgeClass(entrada.estado)}`}>{estadoLabel(entrada.estado)}</span>
            <span className={`badge ${TITULAR_BADGE[entrada.titularEstado] || 'bg-page text-muted'}`}>
              {TITULAR_LABEL[entrada.titularEstado] || entrada.titularEstado}
            </span>
          </div>
          <p className="mt-1 font-mono text-xs text-muted">{entrada.codigo}</p>
          {entrada.fecha?.fecha && <p className="text-xs text-muted">Día: {diaCorto(entrada.fecha.fecha)}</p>}
        </div>
      </div>

      <div className="mt-3 space-y-3 border-t border-border pt-3 text-sm">
        {entrada.titular && (
          <p className="text-muted">
            Titular: <strong className="text-ink">{entrada.titular.nombre}</strong>
            {entrada.titular.soyYo ? ' (tú)' : ''} · {entrada.titular.email}
          </p>
        )}

        {pendiente && (
          <div className="rounded-md border border-info/30 bg-info-soft p-3 text-ink">
            <p className="text-sm">
              Invitación pendiente a <strong>{pendiente.email}</strong>
              {pendiente.expiresAt ? ` · vence ${formatDateTime(pendiente.expiresAt)}` : ''}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" className="btn-secondary btn-sm" disabled={busy} onClick={() => onReenviar(pendiente)}>
                Reenviar
              </button>
              <button
                type="button"
                className="btn-secondary btn-sm !text-danger hover:!bg-danger-soft"
                disabled={busy}
                onClick={() => onCancelar(pendiente)}
              >
                Cancelar invitación
              </button>
            </div>
          </div>
        )}

        {puedeAsignarme && (
          <button type="button" className="btn-primary btn-sm" disabled={busy} onClick={() => onAsignarme(entrada)}>
            Asignarme esta entrada
          </button>
        )}

        {puedeInvitar && !pendiente && (
          <form onSubmit={submitInvitar} className="flex flex-wrap items-end gap-2">
            <Field
              label="Invitar por correo"
              htmlFor={`invitar-titular-${entrada.id}`}
              error={emailError}
              className="min-w-48 flex-1"
            >
              <input
                id={`invitar-titular-${entrada.id}`}
                type="email"
                className="input"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setEmailError('')
                }}
                placeholder="correo@ejemplo.com"
                autoComplete="off"
              />
            </Field>
            <button type="submit" className="btn-secondary btn-sm" disabled={busy}>
              Enviar invitación
            </button>
          </form>
        )}
      </div>
    </li>
  )
}

export default function TitularesPendientesModal({
  open,
  onClose,
  entradas,
  busyId,
  onAsignarme,
  onInvitar,
  onCancelar,
  onReenviar,
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Definir titular"
      size="lg"
      labelledBy="titulares-pendientes-title"
    >
      <div className="max-h-[min(70vh,28rem)] space-y-3 overflow-y-auto px-6 pb-6 pt-2">
        <p className="text-sm text-muted">
          Entradas que compraste y aún no tienen titular definitivo.{' '}
          <Link to="/perfil#identidad" className="font-semibold text-primary hover:underline" onClick={onClose}>
            Identidad en el perfil
          </Link>
        </p>
        <ul className="space-y-3">
          {entradas.map((e) => (
            <EntradaTitularRow
              key={e.id}
              entrada={e}
              busy={busyId === e.id || busyId === e.invitacionPendiente?.id}
              onAsignarme={onAsignarme}
              onInvitar={onInvitar}
              onCancelar={onCancelar}
              onReenviar={onReenviar}
            />
          ))}
        </ul>
      </div>
    </Modal>
  )
}

export async function confirmAsignarme() {
  return confirmDialog({
    title: 'Asignarme esta entrada',
    message: 'La entrada quedará a tu nombre. Necesitas tener tu identidad registrada en el perfil. ¿Continuar?',
    confirmText: 'Asignarme',
  })
}