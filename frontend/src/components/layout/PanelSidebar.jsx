import { useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import BrandLogo from '../BrandLogo'
import { useAuth } from '../../context/AuthContext'
import { homeFor } from '../../utils/roles'
import { confirmLogout } from '../../utils/confirmLogout'
import { IconX } from '../ui/icons'

/**
 * Menú lateral de los paneles.
 *
 * En pantallas grandes (lg) es una columna fija. En celulares y tablets es un cajón que se
 * abre con el botón "Menú" de PanelLayout (`open`) y se cierra al elegir una opción.
 */
export default function PanelSidebar({
  items,
  roleLabel,
  open = false,
  onClose,
  /** En jefe de negocio el perfil y el logout viven solo en el menú del navbar. */
  showAccountLinks = true,
}) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const nombre = [user?.nombre, user?.apellido].filter(Boolean).join(' ')

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={onClose} aria-hidden="true" />}
      <aside
        id="panel-sidebar"
        className={`fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col overflow-y-auto bg-sidebar text-slate-300 transition-transform duration-200 lg:static lg:z-auto lg:w-60 lg:translate-x-0 lg:self-stretch ${
          // Cerrado en móvil también queda `invisible`: sin foco de teclado ni lector de pantalla.
          open ? 'visible translate-x-0' : 'invisible -translate-x-full lg:visible'
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-5">
          <BrandLogo to={homeFor(user?.roles)} imgClassName="h-8 w-auto max-w-[140px] object-contain" />
          <button
            type="button"
            className="rounded-md p-1 text-slate-400 hover:text-white lg:hidden"
            onClick={onClose}
            aria-label="Cerrar menú"
          >
            <IconX className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 p-3">
          {items.map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              end={item.end}
              onClick={onClose}
              className={({ isActive }) =>
                `rounded-md px-3 py-2 text-sm font-medium transition ${
                  isActive ? 'bg-teal text-white' : 'hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-800 px-5 py-4">
          {nombre ? (
            <>
              <p className="truncate text-sm font-semibold text-white">{nombre}</p>
              <p className="text-xs text-slate-400">{roleLabel}</p>
            </>
          ) : null}
          {showAccountLinks ? (
            <div className={`flex flex-col gap-1 ${nombre ? 'mt-3' : ''}`}>
              <NavLink
                to="/perfil"
                onClick={onClose}
                className="rounded-md px-0 py-1.5 text-sm text-slate-300 transition hover:text-white"
              >
                Mi perfil
              </NavLink>
              <button
                type="button"
                className="rounded-md px-0 py-1.5 text-left text-sm text-danger transition hover:text-red-300"
                onClick={async () => {
                  onClose?.()
                  if (!(await confirmLogout())) return
                  navigate('/', { replace: true, state: { scrollToInicio: true } })
                  logout()
                }}
              >
                Cerrar sesión
              </button>
            </div>
          ) : null}
        </div>
      </aside>
    </>
  )
}
