import { useCallback, useState } from 'react'
import { Outlet } from 'react-router-dom'
import Footer from './Footer'
import Navbar from './Navbar'

/**
 * Estructura común de los paneles (administrador, negocio): menú lateral y contenido.
 * En celulares el menú lateral se abre desde el botón "Menú".
 * El navbar público va cuando el rol puede recorrer la tienda (admin, jefe de negocio).
 */
export default function PanelLayout({ sidebar: Sidebar, showFooter = true, showNavbar = true }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const closeMenu = useCallback(() => setMenuOpen(false), [])

  return (
    <div className="flex min-h-screen flex-col bg-page">
      {showNavbar ? <Navbar /> : null}
      <div className="flex flex-1">
        <Sidebar open={menuOpen} onClose={closeMenu} />
        <div className="min-w-0 flex-1 overflow-auto bg-white">
          <div className="border-b border-border bg-white px-4 py-2 lg:hidden">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-semibold text-ink hover:bg-page"
              onClick={() => setMenuOpen(true)}
              aria-expanded={menuOpen}
              aria-controls="panel-sidebar"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              Menú
            </button>
          </div>
          <Outlet />
        </div>
      </div>
      {showFooter ? <Footer variant="compact" /> : null}
    </div>
  )
}
