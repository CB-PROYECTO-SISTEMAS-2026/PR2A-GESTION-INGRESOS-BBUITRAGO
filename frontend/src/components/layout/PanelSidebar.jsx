import { useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import BrandLogo from '../BrandLogo'
import { useAuth } from '../../context/AuthContext'
import { IconX } from '../ui/icons'

/**
 * Menú lateral de los paneles. Los elementos sin `to` aún no tienen pantalla
 * y se muestran sin enlace.
 *
 * En pantallas grandes (lg) es una columna fija. En celulares y tablets es un cajón que se
 * abre con el botón "Menú" de PanelLayout (`open`) y se cierra al elegir una opción.
 */
export default function PanelSidebar({ items, roleLabel, open = false, onClose }) {
  const { user } = useAuth()
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
          <BrandLogo to="/" imgClassName="h-8 w-auto max-w-[140px] object-contain" />
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
          {items.map((item) =>
            item.to ? (
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
            ) : (
              <span key={item.label} className="cursor-default px-3 py-2 text-sm font-medium text-slate-500">
                {item.label}
              </span>
            ),
          )}
        </nav>
        {nombre && (
          <div className="border-t border-slate-800 px-5 py-4">
            <p className="truncate text-sm font-semibold text-white">{nombre}</p>
            <p className="text-xs text-slate-400">{roleLabel}</p>
          </div>
        )}
      </aside>
    </>
  )
}
