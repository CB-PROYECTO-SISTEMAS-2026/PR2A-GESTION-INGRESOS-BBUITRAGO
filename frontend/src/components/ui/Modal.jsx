import { useEffect, useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { IconX } from './icons'

const SIZES = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
}

let openCount = 0

export default function Modal({ open, onClose, title, children, footer, size = 'md', labelledBy }) {
  const panelRef = useRef(null)
  const onCloseRef = useRef(onClose)
  useLayoutEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!open) return undefined
    openCount += 1
    document.body.style.overflow = 'hidden'
    const previouslyFocused = document.activeElement
    if (!panelRef.current?.contains(document.activeElement)) panelRef.current?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') onCloseRef.current?.()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      openCount -= 1
      if (!openCount) document.body.style.overflow = ''
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus()
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-navy/60 p-4 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.()
      }}
      role="presentation"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={`flex max-h-[90vh] w-full ${SIZES[size]} flex-col overflow-hidden rounded-lg bg-white shadow-2xl outline-none`}
      >
        {title && (
          <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
            <h2 id={labelledBy} className="font-display text-xl font-bold text-ink">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted transition hover:bg-slate-100 hover:text-ink"
              aria-label="Cerrar"
            >
              <IconX className="h-5 w-5" />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-3 border-t border-border px-6 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}
