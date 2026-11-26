import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ToastCard } from './ui/notifications-5'

let pushToast = null
let nextId = 1

const VARIANTS = new Set(['success', 'info', 'warning', 'error'])
const AUTO_MS = { success: 4500, info: 4500, warning: 7000, error: 0 }

function normalizeVariant(value) {
  if (value === 'danger') return 'error'
  return VARIANTS.has(value) ? value : 'info'
}

function toItem(messageOrOptions, type) {
  if (messageOrOptions && typeof messageOrOptions === 'object') {
    const title = messageOrOptions.title || messageOrOptions.message || ''
    const body = messageOrOptions.body || (messageOrOptions.title ? messageOrOptions.message : '') || ''
    return {
      id: nextId++,
      variant: normalizeVariant(messageOrOptions.variant || messageOrOptions.type || type),
      title,
      body,
    }
  }
  return {
    id: nextId++,
    variant: normalizeVariant(type),
    title: String(messageOrOptions ?? ''),
    body: '',
  }
}

function announce(text) {
  if (!text) return
  if (typeof document.ariaNotify === 'function') {
    document.ariaNotify(text)
  }
}

export function toast(messageOrOptions, type = 'info') {
  const item = toItem(messageOrOptions, type)
  if (!item.title) return item.id
  if (pushToast) pushToast(item)
  return item.id
}

export function ToastHost() {
  const [items, setItems] = useState([])
  const [announcement, setAnnouncement] = useState('')
  const stackRef = useRef(null)
  const timers = useRef(new Map())
  const lastFocus = useRef(null)

  const api = useRef({ dismiss: () => {}, scheduleDismiss: () => {} })

  const clearTimer = (id) => {
    const timer = timers.current.get(id)
    if (timer) {
      window.clearTimeout(timer)
      timers.current.delete(id)
    }
  }

  const dismiss = (id, { restoreFocus = false } = {}) => {
    clearTimer(id)
    setItems((prev) => {
      const remaining = prev.filter((t) => t.id !== id)
      if (restoreFocus) {
        queueMicrotask(() => {
          const next = remaining[0]
          const nextEl = next
            ? stackRef.current?.querySelector(`[data-toast-id="${next.id}"]`)
            : null
          if (nextEl instanceof HTMLElement) nextEl.focus()
          else lastFocus.current?.focus?.()
        })
      }
      return remaining
    })
  }

  const scheduleDismiss = (item) => {
    const ms = AUTO_MS[item.variant] ?? 4500
    if (!ms) return
    clearTimer(item.id)
    timers.current.set(
      item.id,
      window.setTimeout(() => {
        const active = document.activeElement
        if (active?.closest?.(`[data-toast-id="${item.id}"]`)) {
          api.current.scheduleDismiss(item)
          return
        }
        api.current.dismiss(item.id)
      }, ms),
    )
  }

  api.current.dismiss = dismiss
  api.current.scheduleDismiss = scheduleDismiss

  useEffect(() => {
    const timersMap = timers.current
    pushToast = (item) => {
      lastFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      setItems((prev) => {
        const next = [...prev, item]
        return next.length > 4 ? next.slice(next.length - 4) : next
      })
      const spoken = item.body ? `${item.title}. ${item.body}` : item.title
      setAnnouncement(spoken)
      announce(spoken)
      api.current.scheduleDismiss(item)
    }
    return () => {
      pushToast = null
      timersMap.forEach((timer) => window.clearTimeout(timer))
      timersMap.clear()
    }
  }, [])

  useEffect(() => {
    const el = stackRef.current
    if (!el) return
    el.setAttribute('popover', 'manual')
    try {
      if (items.length) el.showPopover?.()
      else el.hidePopover?.()
    } catch {
      // Navegadores sin Popover: el stack sigue en position:fixed.
    }
  }, [items.length])

  if (typeof document === 'undefined') return null

  return createPortal(
    <>
      <p className="sr-only">Anuncios</p>
      <div className="sr-only" aria-live="assertive" aria-atomic="true">
        {announcement}
      </div>
      <div
        ref={stackRef}
        role="region"
        aria-label="Notificaciones"
        className={`ev-toast-stack${items.length ? ' ev-toast-stack--open' : ''}`}
      >
        {items.map((item) => (
          <ToastCard
            key={item.id}
            id={item.id}
            variant={item.variant}
            title={item.title}
            body={item.body}
            onDismiss={() =>
              dismiss(item.id, {
                restoreFocus: document.activeElement?.closest?.(`[data-toast-id="${item.id}"]`),
              })
            }
            onFocus={() => clearTimer(item.id)}
            onBlur={() => scheduleDismiss(item)}
          />
        ))}
      </div>
    </>,
    document.body,
  )
}
