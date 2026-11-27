import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useSlideOver } from '../../hooks/useSlideOver'
import AjustesLector from './AjustesLector'
import { confirmLogout } from '../../utils/confirmLogout'
import { IconQr } from '../ui/icons'

function IconMenu({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" d="M4 7h16M4 12h16M4 18h16" />
    </svg>
  )
}

function IconGear({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  )
}

function IconUser({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  )
}

export function StaffAccountMenuButton({ open, onToggle }) {
  return (
    <button
      type="button"
      aria-label="Menú de cuenta"
      aria-expanded={open}
      aria-haspopup="dialog"
      onClick={onToggle}
      className="flex h-10 w-10 items-center justify-center rounded-md border border-sidebar-border text-white transition hover:border-primary-focus focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-focus"
    >
      <IconMenu />
    </button>
  )
}

/**
 * Cajón lateral de cuenta (altura completa del marco móvil, ancho ~80 %). El backdrop solo cubre el marco.
 */
export function StaffAccountDrawer({
  open,
  onClose,
  perfilPath,
  onLectorQr,
  showLectorQr = true,
  showAjustes = true,
}) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [ajustes, setAjustes] = useState(false)

  const displayName = [user?.nombre, user?.apellido].filter(Boolean).join(' ') || user?.email || 'Usuario'
  const email = user?.email || ''
  const { mounted, active } = useSlideOver(open)

  useEffect(() => {
    if (!mounted) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [mounted, onClose])

  const ir = (fn) => {
    onClose()
    fn()
  }

  return (
  <>
      {mounted && (
        <>
      <button
        type="button"
        className={`absolute inset-0 z-40 bg-ink/45 transition-opacity duration-300 ${
          active ? 'opacity-100' : 'opacity-0'
        }`}
        aria-label="Cerrar menú"
        onClick={onClose}
      />
      <aside
        className={`absolute inset-y-0 right-0 z-50 flex w-[82%] max-w-[19rem] min-w-0 flex-col overflow-hidden bg-surface text-ink shadow-xl transition-transform duration-300 ease-out ${
          active ? 'translate-x-0' : 'translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Cuenta"
      >
        <div className="flex w-full min-w-0 flex-col items-center overflow-hidden border-b border-border px-5 pb-5 pt-6 text-center">
          {user?.fotoUrl ? (
            <img
              src={user.fotoUrl}
              alt=""
              className="h-20 w-20 rounded-full border border-border object-cover"
              width={80}
              height={80}
            />
          ) : (
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-danger text-white">
              <svg viewBox="0 0 24 24" className="h-10 w-10" fill="currentColor" aria-hidden="true">
                <path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z" />
              </svg>
            </span>
          )}
          <p className="mt-4 w-full min-w-0 break-words text-base font-bold leading-snug text-ink line-clamp-2">
            {displayName}
          </p>
          {email ? (
            <p className="mt-0.5 w-full min-w-0 break-all text-sm leading-snug text-muted line-clamp-3" title={email}>
              {email}
            </p>
          ) : null}
        </div>

        <nav className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto py-2">
          <button
            type="button"
            className="flex w-full items-center gap-3 px-5 py-3.5 text-left text-sm font-medium hover:bg-page"
            onClick={() => ir(() => navigate(perfilPath))}
          >
            <IconUser className="h-5 w-5 shrink-0 text-muted" />
            Mi perfil
          </button>
          {showLectorQr && (
            <button
              type="button"
              className="flex w-full items-center gap-3 px-5 py-3.5 text-left text-sm font-medium hover:bg-page"
              onClick={() => ir(onLectorQr)}
            >
              <IconQr className="h-5 w-5 shrink-0 text-muted" />
              Lector QR
            </button>
          )}
          {showAjustes && (
            <button
              type="button"
              className="flex w-full items-center gap-3 px-5 py-3.5 text-left text-sm font-medium hover:bg-page"
              onClick={() => ir(() => setAjustes(true))}
            >
              <IconGear className="h-5 w-5 shrink-0 text-muted" />
              Ajustes
            </button>
          )}
        </nav>

        <div className="border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            className="w-full rounded-xl bg-sidebar py-3.5 text-sm font-bold text-white transition hover:bg-sidebar-hover"
            onClick={async () => {
              onClose()
              if (!(await confirmLogout())) return
              logout()
              navigate('/login', { replace: true })
            }}
          >
            Cerrar sesión
          </button>
        </div>
      </aside>
        </>
      )}

      {showAjustes && <AjustesLector abierto={ajustes} onCerrar={() => setAjustes(false)} embedded />}
    </>
  )
}