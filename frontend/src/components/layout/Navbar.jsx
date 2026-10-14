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
  const preferred = ['ADMIN', 'ORGANIZADOR', 'JEFE_NEGOCIO', 'AYUDANTE', 'ENCARGADO_ACCESO', 'RECARGADOR', 'CLIENTE']
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
              className="block w-full px-3 py-2.5 text-left text-sm hover:bg-slate-50"
              onClick={() => {
                setOpen(false)
                navigate('/mis-entradas')
              }}
            >
              Mis entradas
            </button>
            {user?.roles?.includes('CLIENTE') && (
              <button
                type="button"
                className="block w-full px-3 py-2.5 text-left text-sm hover:bg-slate-50"
                onClick={() => {
                  setOpen(false)
                  navigate('/mis-compras')
                }}
              >
                Mis compras
              </button>
            )}
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

/** Enlaces de la barra según los roles del usuario (los que no tienen `to` aún no tienen pantalla). */
function navLinks(hasRole) {
  const links = [
    { to: '/', label: 'Inicio', end: true },
    { to: '/eventos', label: 'Eventos' },
  ]
  if (hasRole('CLIENTE')) {
    links.push({ to: '/mis-entradas', label: 'Mis Entradas' })
    links.push({ to: '/mis-compras', label: 'Mis Compras' })
    links.push({ to: '/mi-manilla', label: 'Mi Manilla' })
  }
  if (hasRole('ENCARGADO_ACCESO')) {
    links.push({ to: '/supervisor', label: 'Manillas', end: true })
    links.push({ to: '/supervisor/acceso', label: 'Control de acceso' })
  }
  if (hasRole('ADMIN')) links.push({ to: '/admin', label: 'Admin' })
  if (hasRole('ORGANIZADOR')) {
    links.push({ to: '/organizador/solicitudes', label: 'Solicitudes' })
    links.push({ to: '/organizador/nueva-solicitud', label: 'Nueva solicitud' })
  }
  if (hasRole('JEFE_NEGOCIO')) links.push({ to: '/negocio', label: 'Negocios' })
  if (hasRole('AYUDANTE')) links.push({ to: '/pos', label: 'Punto de venta' })
  if (hasRole('RECARGADOR')) links.push({ to: '/recargas', label: 'Recargas' })
  return links
}

/** En celulares los enlaces de la barra se muestran en un menú desplegable. */
function MobileNav({ links }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <div className="relative md:hidden" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Abrir menú de navegación"
        className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-600 text-white hover:border-teal hover:text-teal"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      {open && (
        <nav className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-md border border-border bg-white py-1 text-ink shadow-lg">
          {links.map((l) =>
            l.to ? (
              <NavLink
                key={l.label}
                to={l.to}
                end={l.end}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `block px-3 py-2.5 text-sm hover:bg-slate-50 ${isActive ? 'font-semibold text-teal-dark' : ''}`
                }
              >
                {l.label}
              </NavLink>
            ) : (
              <span key={l.label} className="block px-3 py-2.5 text-sm text-slate-400">
                {l.label}
              </span>
            ),
          )}
        </nav>
      )}
    </div>
  )
}

export default function Navbar() {
  const { user, isAuthenticated, logout, hasRole } = useAuth()
  const links = navLinks(hasRole)

  return (
    <header className="sticky top-0 z-40 bg-navy text-white shadow-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <BrandLogo to="/" imgClassName="h-9 w-auto max-w-[160px] object-contain" />

        <nav className="hidden items-center gap-6 md:flex">
          {links.map((l) =>
            l.to ? (
              <NavLink key={l.label} to={l.to} end={l.end} className={linkClass}>
                {l.label}
              </NavLink>
            ) : (
              <span key={l.label} className="cursor-default text-sm font-medium text-slate-500">
                {l.label}
              </span>
            ),
          )}
        </nav>

        <div className="flex items-center gap-3">
          <MobileNav links={links} />
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
