import { useOnlineStatus } from '../../hooks/useOnlineStatus'

/** Estado de red fijo al pie de las terminales de piso (sin nombre de sesión). */
export default function StaffConnectionFooter() {
  const online = useOnlineStatus()

  return (
    <footer
      className="flex items-center justify-center gap-2 border-t border-border bg-surface px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      role="status"
      aria-live="polite"
    >
      <span
        className={`h-2.5 w-2.5 shrink-0 rounded-full ${online ? 'bg-success' : 'bg-danger'} animate-[evDotPulse_1.25s_ease-in-out_infinite]`}
        aria-hidden="true"
      />
      <span className={`text-xs font-semibold ${online ? 'text-success' : 'text-danger'}`}>
        {online ? 'En línea' : 'Sin conexión'}
      </span>
    </footer>
  )
}