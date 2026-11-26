import { IconCheck, IconWarning, IconX } from '../ui/icons'

const TONOS = {
  success: {
    card: 'border-l-success bg-success-soft',
    icon: 'bg-success text-white',
    Icon: IconCheck,
  },
  warning: {
    card: 'border-l-warning bg-warning-soft',
    icon: 'bg-warning text-white',
    Icon: IconWarning,
  },
  danger: {
    card: 'border-l-danger bg-danger-soft',
    icon: 'bg-danger text-white',
    Icon: IconX,
  },
}

/** Resultado de una lectura: verde, amarillo o rojo. El motivo va en la tarjeta, no en un toast. */
export default function TarjetaLectura({ tono = 'success', titulo, motivo, nombre, codigo, extra }) {
  const tonoUi = TONOS[tono] || TONOS.success
  const Icon = tonoUi.Icon

  return (
    <article className={`w-full rounded-xl border border-border border-l-4 p-3 ${tonoUi.card}`} role="status">
      <div className="flex items-start gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${tonoUi.icon}`}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          {nombre && <p className="truncate font-semibold text-ink">{nombre}</p>}
          {codigo && <p className="font-mono text-xs text-muted">{codigo}</p>}
          {titulo && <p className={`text-sm font-semibold text-ink ${nombre || codigo ? 'mt-1' : ''}`}>{titulo}</p>}
          {motivo && <p className="mt-0.5 text-sm text-ink">{motivo}</p>}
          {extra && <p className="mt-1 text-xs text-muted">{extra}</p>}
        </div>
      </div>
    </article>
  )
}
