import { useEffect, useState } from 'react'
import Modal from './Modal'

let enqueue = null
let nextId = 1

/**
 * Abre un diálogo de confirmación con la línea gráfica del sistema.
 * Resuelve `true` al confirmar, `false` al pulsar el botón de cancelar
 * y `null` si se cierra sin elegir (Escape, clic fuera o la X).
 */
export function confirmDialog(options) {
  return new Promise((resolve) => {
    if (!enqueue) {
      resolve(null)
      return
    }
    enqueue({ id: nextId++, resolve, ...options })
  })
}

/** Doble confirmación para eliminar: advertencia y luego confirmación final. */
export async function confirmDelete({ title, message, confirmText = 'Eliminar', finalMessage } = {}) {
  const first = await confirmDialog({
    title,
    message,
    confirmText: 'Continuar',
    cancelText: 'Cancelar',
    tone: 'danger',
  })
  if (!first) return false
  const second = await confirmDialog({
    title: '¿Estás seguro?',
    message: finalMessage || 'Esta acción no se puede deshacer. La información se perderá y no podrá recuperarse.',
    confirmText,
    cancelText: 'No, volver',
    tone: 'danger',
  })
  return second === true
}

export function ConfirmHost() {
  const [queue, setQueue] = useState([])

  useEffect(() => {
    enqueue = (item) => setQueue((q) => [...q, item])
    return () => {
      enqueue = null
    }
  }, [])

  const current = queue[0]
  if (!current) return null

  const finish = (value) => {
    current.resolve(value)
    setQueue((q) => q.slice(1))
  }

  return <ConfirmPanel key={current.id} item={current} onFinish={finish} />
}

function ConfirmPanel({ item, onFinish }) {
  const {
    title,
    message,
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    tone = 'default',
    requireText,
  } = item
  const [typed, setTyped] = useState('')
  const danger = tone === 'danger'
  const canConfirm = !requireText || typed === requireText

  const submit = (e) => {
    e.preventDefault()
    if (canConfirm) onFinish(true)
  }

  return (
    <Modal open onClose={() => onFinish(null)} size="sm" labelledBy={`confirm-${item.id}`}>
      <form onSubmit={submit} className="p-6">
        <h2 id={`confirm-${item.id}`} className="font-display text-lg font-bold text-ink">
          {title}
        </h2>
        {message && <div className="mt-2 text-sm leading-relaxed text-slate-600">{message}</div>}

        {requireText && (
          <div className="mt-5">
            <label className="label" htmlFor={`confirm-input-${item.id}`}>
              Escribe <span className="font-mono text-red-600">{requireText}</span> para confirmar
            </label>
            <input
              id={`confirm-input-${item.id}`}
              className="input font-mono"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              autoFocus
              spellCheck={false}
            />
          </div>
        )}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="btn-secondary" onClick={() => onFinish(false)}>
            {cancelText}
          </button>
          <button
            type="submit"
            className={danger ? 'btn-danger' : 'btn-primary'}
            disabled={!canConfirm}
            autoFocus={!requireText}
          >
            {confirmText}
          </button>
        </div>
      </form>
    </Modal>
  )
}
