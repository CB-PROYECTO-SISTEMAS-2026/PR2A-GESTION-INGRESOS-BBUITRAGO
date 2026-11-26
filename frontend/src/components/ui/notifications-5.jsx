import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react'
import { cn } from '../../lib/utils'

const config = {
  success: { icon: CircleCheck, accent: 'text-success' },
  info: { icon: Info, accent: 'text-info' },
  warning: { icon: TriangleAlert, accent: 'text-warning' },
  error: { icon: CircleAlert, accent: 'text-danger' },
}

export function ToastCard({ id, variant = 'info', title, body, onDismiss, onFocus, onBlur }) {
  const { icon: Icon, accent } = config[variant] ?? config.info

  return (
    <div
      data-toast-id={id}
      role={variant === 'error' ? 'alert' : 'status'}
      tabIndex={-1}
      onFocus={onFocus}
      onBlur={onBlur}
      className="ev-toast flex items-start gap-3 rounded-lg border border-border bg-surface p-4 text-ink shadow-sm"
    >
      <Icon className={cn('mt-0.5 size-5 shrink-0', accent)} aria-hidden="true" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm font-semibold text-balance">{title}</span>
        {body ? <span className="text-xs text-pretty text-muted">{body}</span> : null}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Cerrar notificación"
        className="inline-flex size-8 shrink-0 items-center justify-center text-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-focus"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  )
}
