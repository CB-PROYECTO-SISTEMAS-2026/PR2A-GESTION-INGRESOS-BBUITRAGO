import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import BrandLogo from '../BrandLogo'
import { useAuth } from '../../context/AuthContext'

const tabClass = ({ isActive }) =>
  `flex-1 rounded-md py-2 text-center text-sm font-semibold transition ${
    isActive ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-ink'
  }`

/**
 * Terminal del personal del evento (punto de venta, recargas): pensada para el celular.
 * `tabs`: [{ to, label, end? }] — pestañas bajo la cabecera.
 */
export default function StaffLayout({ tabs, label }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-page">
      <div className="mx-auto flex min-h-screen max-w-md flex-col bg-page">
        <header className="sticky top-0 z-20 border-b border-border bg-white">
          <div className="flex items-center justify-between bg-navy px-4 py-3">
            <BrandLogo to={false} imgClassName="h-7 w-auto" />
            <div className="flex items-center gap-3">
              <span className="badge bg-teal/15 text-teal">STAFF</span>
              <button
                type="button"
                className="text-xs font-semibold text-slate-300 hover:text-white"
                onClick={() => {
                  logout()
                  navigate('/login', { replace: true })
                }}
              >
                Salir
              </button>
            </div>
          </div>
          <nav className="mx-4 my-3 flex gap-1 rounded-lg bg-page p-1" aria-label={label}>
            {tabs.map((tab) => (
              <NavLink key={tab.to} to={tab.to} end={tab.end} className={tabClass}>
                {tab.label}
              </NavLink>
            ))}
          </nav>
        </header>
        <main className="flex flex-1 flex-col">
          <Outlet />
        </main>
        {user?.nombre && (
          <p className="px-4 pb-4 pt-2 text-center text-xs text-muted">
            Sesión de {[user.nombre, user.apellido].filter(Boolean).join(' ')}
          </p>
        )}
      </div>
    </div>
  )
}
