import { NavLink } from 'react-router-dom'
import BrandLogo from '../BrandLogo'
import { useAuth } from '../../context/AuthContext'

/**
 * Menú lateral de los paneles. Los elementos sin `to` aún no tienen pantalla
 * y se muestran sin enlace.
 */
export default function PanelSidebar({ items, roleLabel }) {
  const { user } = useAuth()
  const nombre = [user?.nombre, user?.apellido].filter(Boolean).join(' ')

  return (
    <aside className="flex w-60 shrink-0 flex-col self-stretch bg-sidebar text-slate-300">
      <div className="border-b border-slate-800 px-5 py-5">
        <BrandLogo to="/" imgClassName="h-8 w-auto max-w-[140px] object-contain" />
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 p-3">
        {items.map((item) =>
          item.to ? (
            <NavLink
              key={item.label}
              to={item.to}
              end={item.end}
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
  )
}
