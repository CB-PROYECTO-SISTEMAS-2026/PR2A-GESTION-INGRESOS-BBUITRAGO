import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import BrandLogo from '../BrandLogo'
import SaldoEvento from './SaldoEvento'
import { ROLE_LABELS } from '../../utils/roles'
import { confirmLogout } from '../../utils/confirmLogout'

const exploreLinkClass = ({ isActive }) =>
  `ev-nav-link text-sm font-medium transition ${isActive ? 'text-primary-focus is-active' : 'text-slate-300 hover:text-white'}`

function roleLabel(roles = []) {
  if (!roles.length) return 'Usuario'
  const preferred = ['ADMIN', 'ORGANIZADOR', 'JEFE_NEGOCIO', 'AYUDANTE', 'ENCARGADO_ACCESO', 'RECARGADOR', 'DEVOLUCIONES', 'CLIENTE']
  const found = preferred.find((r) => roles.includes(r)) || roles[0]
  return ROLE_LABELS[found] || found
}

/** Navegación estable (no cambia por rol). En home: anclas de sección. */
const HOME_SECTIONS = [
  { to: '/#inicio', hash: 'inicio', label: 'Inicio' },
  { to: '/#eventos', hash: 'eventos', label: 'Eventos' },
  { to: '/#como-funciona', hash: 'como-funciona', label: 'Cómo funciona' },
  { to: '/#faq', hash: 'faq', label: 'Preguntas' },
  { to: '/eventos', hash: null, label: 'Explorar' },
]

/** Accesos de trabajo / administración según rol (solo menú avatar). */
function panelLinks(hasRole) {
  const links = []
  if (hasRole('ADMIN')) links.push({ to: '/admin', label: 'Panel admin' })
  if (hasRole('ORGANIZADOR')) {
    links.push({ to: '/organizador/solicitudes', label: 'Mis solicitudes' })
    links.push({ to: '/organizador/nueva-solicitud', label: 'Nueva solicitud' })
  }
  if (hasRole('JEFE_NEGOCIO')) links.push({ to: '/negocio', label: 'Negocios' })
  if (hasRole('AYUDANTE')) links.push({ to: '/pos', label: 'Punto de venta' })
  if (hasRole('RECARGADOR')) links.push({ to: '/recargas', label: 'Recargas' })
  if (hasRole('DEVOLUCIONES')) links.push({ to: '/devoluciones', label: 'Devoluciones' })
  if (hasRole('ENCARGADO_ACCESO')) {
    links.push({ to: '/supervisor', label: 'Puerta' })
    links.push({ to: '/supervisor/manillas', label: 'Manillas' })
  }
  return links
}

function scrollToHash(hash) {
  if (!hash) return
  const el = document.getElementById(hash)
  if (!el) return
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
}

function UserMenu({ user, logout, panels }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const navigate = useNavigate()
  const displayName = user?.nombre || 'Usuario'
  const role = roleLabel(user?.roles)
  const isCliente = user?.roles?.includes('CLIENTE')

  useEffect(() => {
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const go = (to) => {
    setOpen(false)
    navigate(to)
  }

  return (
    <div className="flex items-center gap-3" ref={ref}>
      <div className="hidden text-right sm:block">
        <p className="text-sm font-semibold leading-tight text-white">{displayName}</p>
      </div>

      <div className="relative">
        <button
          type="button"
          aria-label="Menú de usuario"
          aria-expanded={open}
          aria-haspopup="menu"
          onClick={() => setOpen((v) => !v)}
          className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-sidebar-border bg-sidebar-hover text-white transition hover:border-primary-focus focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-focus"
        >
          {user?.fotoUrl ? (
            <img src={user.fotoUrl} alt="" className="h-full w-full object-cover" width={40} height={40} />
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
              <path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z" />
            </svg>
          )}
        </button>

        {open && (
          <div className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-md border border-border bg-surface py-1 text-ink shadow-lg" role="menu">
            <div className="border-b border-border px-3 py-2 sm:hidden">
              <p className="text-sm font-semibold">{displayName}</p>
              <p className="text-[11px] text-muted">{role}</p>
            </div>
            <button type="button" role="menuitem" className="block w-full px-3 py-2.5 text-left text-sm hover:bg-page" onClick={() => go('/perfil')}>
              Mi perfil
            </button>
            {isCliente && (
              <>
                <button type="button" role="menuitem" className="block w-full px-3 py-2.5 text-left text-sm hover:bg-page" onClick={() => go('/mis-entradas')}>
                  Mis entradas
                </button>
                <button type="button" role="menuitem" className="block w-full px-3 py-2.5 text-left text-sm hover:bg-page" onClick={() => go('/mis-compras')}>
                  Mis compras
                </button>
                <button type="button" role="menuitem" className="block w-full px-3 py-2.5 text-left text-sm hover:bg-page" onClick={() => go('/mis-reembolsos')}>
                  Mis reembolsos
                </button>
                <button type="button" role="menuitem" className="block w-full px-3 py-2.5 text-left text-sm hover:bg-page" onClick={() => go('/mi-manilla')}>
                  Mi manilla
                </button>
              </>
            )}
            {panels.length > 0 && (
              <>
                <div className="my-1 border-t border-border" />
                <p className="px-3 py-1.5 text-[10px] font-semibold uppercase text-muted">Trabajo</p>
                {panels.map((p) => (
                  <button
                    key={p.to + p.label}
                    type="button"
                    role="menuitem"
                    className="block w-full px-3 py-2.5 text-left text-sm hover:bg-page"
                    onClick={() => go(p.to)}
                  >
                    {p.label}
                  </button>
                ))}
              </>
            )}
            <div className="my-1 border-t border-border" />
            <button
              type="button"
              role="menuitem"
              className="block w-full px-3 py-2.5 text-left text-sm text-danger hover:bg-danger-soft"
              onClick={async () => {
                setOpen(false)
                if (!(await confirmLogout())) return
                navigate('/', { replace: true, state: { scrollToInicio: true } })
                logout()
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

const SECTION_HASHES = HOME_SECTIONS.filter((s) => s.hash).map((s) => s.hash)

export default function Navbar() {
  const { user, isAuthenticated, logout, hasRole } = useAuth()
  const panels = panelLinks(hasRole)
  const location = useLocation()
  const navigate = useNavigate()
  const onHome = location.pathname === '/'
  const [activeSection, setActiveSection] = useState('inicio')
  const clickingRef = useRef(false)
  const skipHomeResetRef = useRef(false)

  const onSectionNav = (e, link) => {
    if (!link.hash) return
    e.preventDefault()
    if (onHome) {
      clickingRef.current = true
      setActiveSection(link.hash)
      scrollToHash(link.hash)
      // Sin hash en la URL: al recargar siempre arranca en Inicio.
      if (window.location.hash) window.history.replaceState(null, '', '/')
      window.setTimeout(() => {
        clickingRef.current = false
      }, 800)
      return
    }
    skipHomeResetRef.current = true
    navigate('/', { state: { scrollTo: link.hash } })
  }

  /** Entrar o recargar home: arriba en Inicio (sin #hash). */
  useEffect(() => {
    if (!onHome) return undefined
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual'
    }
    if (window.location.hash) {
      window.history.replaceState(null, '', '/')
    }
    if (skipHomeResetRef.current || location.state?.scrollTo) {
      return undefined
    }
    setActiveSection('inicio')
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    return undefined
  }, [onHome, location.key])

  /** Desde otra ruta: ir a home y bajar a la sección pedida. */
  useEffect(() => {
    if (!onHome) return undefined
    const target = location.state?.scrollTo
    if (!target || !SECTION_HASHES.includes(target)) return undefined
    clickingRef.current = true
    skipHomeResetRef.current = true
    setActiveSection(target)
    requestAnimationFrame(() => scrollToHash(target))
    navigate('.', { replace: true, state: {} })
    const t = window.setTimeout(() => {
      clickingRef.current = false
      skipHomeResetRef.current = false
    }, 800)
    return () => window.clearTimeout(t)
  }, [onHome, location.state, navigate])

  /** Scroll-spy solo visual: no escribe hash (eso hacía que al recargar saltara a FAQ). */
  useEffect(() => {
    if (!onHome) return undefined

    const pickActive = () => {
      if (clickingRef.current) return
      const offset = 120
      let current = 'inicio'
      for (const id of SECTION_HASHES) {
        const el = document.getElementById(id)
        if (!el || el.classList.contains('sr-only')) continue
        if (el.getBoundingClientRect().top - offset <= 0) current = id
      }
      setActiveSection((prev) => (prev === current ? prev : current))
    }

    pickActive()
    window.addEventListener('scroll', pickActive, { passive: true })
    window.addEventListener('resize', pickActive)
    return () => {
      window.removeEventListener('scroll', pickActive)
      window.removeEventListener('resize', pickActive)
    }
  }, [onHome])

  const sectionActive = (hash) => onHome && activeSection === hash

  return (
    <header className="sticky top-0 z-40 bg-sidebar text-white shadow-md">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <BrandLogo to="/" imgClassName="h-9 w-auto max-w-[160px] object-contain" />

        <nav className="hidden flex-1 items-center justify-center gap-5 md:flex" aria-label="Explorar">
          {HOME_SECTIONS.map((l) =>
            l.hash ? (
              <a
                key={l.label}
                href={l.to}
                aria-current={sectionActive(l.hash) ? 'true' : undefined}
                className={`ev-nav-link text-sm font-medium transition ${
                  sectionActive(l.hash) ? 'text-primary-focus is-active' : 'text-slate-300 hover:text-white'
                }`}
                onClick={(e) => onSectionNav(e, l)}
              >
                {l.label}
              </a>
            ) : (
              <NavLink key={l.label} to={l.to} className={exploreLinkClass}>
                {l.label}
              </NavLink>
            ),
          )}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <NavLink
            to="/eventos"
            className={({ isActive }) =>
              `hidden max-md:inline text-sm font-medium transition ${
                isActive ? 'text-primary-focus' : 'text-slate-300 hover:text-white'
              }`
            }
          >
            Explorar
          </NavLink>
          {isAuthenticated ? (
            <>
              {hasRole('CLIENTE') && <SaldoEvento />}
              <UserMenu user={user} logout={logout} panels={panels} />
            </>
          ) : (
            <Link to="/login" className="btn-primary !py-2 !text-sm">
              Iniciar sesión
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
