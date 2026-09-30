import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import BrandLogo from '../BrandLogo'
import SaldoEvento from './SaldoEvento'
import { ROLE_LABELS } from '../../utils/roles'

const linkClass = ({ isActive }) =>
  `text-sm font-medium transition ${isActive ? 'text-teal' : 'text-slate-300 hover:text-white'}`

function roleLabel(roles = []) {
  if (!roles.length) return 'Usuario'
  const preferred = ['ADMIN', 'ORGANIZADOR', 'JEFE_NEGOCIO', 'CLIENTE']
  const found = preferred.find((r) => roles.includes(r)) || roles[0]
  return ROLE_LABELS[found] || found
}

function UserMenu({ user, logout }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const navigate = useNavigate()
  const displayName = user?.nombre || 'Usuario'
  const role = roleLabel(user?.roles)

  useEffect(() => {
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  return (
    <div className="flex items-center gap-3" ref={ref}>
      <div className="hidden text-right sm:block">
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{role}</p>
        <p className="text-sm font-semibold leading-tight text-white">{displayName}</p>
      </div>

      <div className="relative">
        <button
          type="button"
          aria-label="Menú de usuario"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-slate-600 bg-slate-800/60 text-white transition hover:border-teal hover:text-teal"
        >
          {user?.fotoUrl ? (
            <img src={user.fotoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
              <path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z" />
            </svg>
          )}
        </button>

        {open && (
          <div className="absolute right-0 z-50 mt-2 w-48 overflow-hidden rounded-md border border-border bg-white py-1 text-ink shadow-lg">
            <div className="border-b border-border px-3 py-2 sm:hidden">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted">{role}</p>
              <p className="text-sm font-semibold">{displayName}</p>
            </div>
            <button
              type="button"
              className="block w-full px-3 py-2.5 text-left text-sm hover:bg-slate-50"
              onClick={() => {
                setOpen(false)
                navigate('/perfil')
              }}
            >
              Mi perfil
            </button>
            <button
              type="button"
              className="block w-full px-3 py-2.5 text-left text-sm text-red-600 hover:bg-red-50"
              onClick={() => {
                setOpen(false)
                logout()
                navigate('/')
              }}
            >
              Cerrar sesión
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Navbar() {
  const { user, isAuthenticated, logout, hasRole } = useAuth()

  return (
    <header className="sticky top-0 z-40 bg-navy text-white shadow-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <BrandLogo to="/" imgClassName="h-9 w-auto max-w-[160px] object-contain" />

        <nav className="hidden items-center gap-6 md:flex">
          <NavLink to="/" end className={linkClass}>
            Inicio
          </NavLink>
          <NavLink to="/eventos" className={linkClass}>
            Eventos
          </NavLink>
          {hasRole('CLIENTE') && <span className="cursor-default text-sm font-medium text-slate-500">Mis Entradas</span>}
          {hasRole('ADMIN') && (
            <NavLink to="/admin" className={linkClass}>
              Admin
            </NavLink>
          )}
          {hasRole('ORGANIZADOR') && (
            <>
              <NavLink to="/organizador/solicitudes" className={linkClass}>
                Solicitudes
              </NavLink>
              <NavLink to="/organizador/nueva-solicitud" className={linkClass}>
                Nueva solicitud
              </NavLink>
            </>
          )}
          {hasRole('JEFE_NEGOCIO') && (
            <NavLink to="/negocio" className={linkClass}>
              Negocios
            </NavLink>
          )}
        </nav>

        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <>
              {hasRole('CLIENTE') && <SaldoEvento />}
              <UserMenu user={user} logout={logout} />
            </>
          ) : (
            <Link to="/login" className="btn-primary !py-2 !text-sm">
              Iniciar Sesión
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
