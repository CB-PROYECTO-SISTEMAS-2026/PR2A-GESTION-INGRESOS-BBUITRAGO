import { useCallback, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import BrandLogo from '../BrandLogo'
import StaffTerminalDesktopBackdrop from './StaffTerminalDesktopBackdrop'
import { StaffAccountDrawer, StaffAccountMenuButton } from '../terminal/StaffAccountMenu'
import StaffConnectionFooter from '../terminal/StaffConnectionFooter'
import { StaffShellContext } from './staffShellContext'

const tabClass = ({ isActive }) =>
  `flex-1 rounded-md py-2 text-center text-sm font-semibold transition ${
    isActive ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-ink'
  }`

/**
 * Terminal del personal del evento (punto de venta, recargas): pensada para el celular.
 * `tabs`: [{ to, label, end? }] — pestañas bajo la cabecera.
 */
export default function StaffLayout({
  tabs,
  label,
  perfilPath,
  lectorPath,
  showLectorQr = true,
  showAjustes = true,
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const enPerfil = perfilPath && location.pathname === perfilPath

  const homeLector = lectorPath || tabs[0]?.to || '/'

  const irLectorQr = useCallback(() => {
    navigate(homeLector, { state: { openLector: true } })
  }, [homeLector, navigate])

  const shell = useMemo(
    () => ({
      openAjustes: () => {},
      goLectorQr: irLectorQr,
    }),
    [irLectorQr],
  )

  return (
    <StaffShellContext.Provider value={shell}>
      <div className="min-h-screen bg-page md:min-h-[100dvh] md:bg-transparent">
        <StaffTerminalDesktopBackdrop />
        <div
          className={`relative mx-auto flex min-h-screen w-full max-w-md flex-col bg-page md:min-h-[100dvh] md:shadow-[0_0_80px_rgba(15,23,42,0.35)] ${
            menuOpen ? 'overflow-hidden' : ''
          }`}
        >
          <header className="relative z-30 shrink-0 border-b border-border bg-white">
            <div className="flex items-center justify-between bg-sidebar px-4 py-3">
              <BrandLogo to={false} imgClassName="h-7 w-auto" />
              <StaffAccountMenuButton open={menuOpen} onToggle={() => setMenuOpen((v) => !v)} />
            </div>
            {!enPerfil && tabs?.length > 0 && (
              <nav className="mx-4 my-3 flex gap-1 rounded-lg bg-page p-1" aria-label={label}>
                {tabs.map((tab) => (
                  <NavLink key={tab.to} to={tab.to} end={tab.end} className={tabClass}>
                    {tab.label}
                  </NavLink>
                ))}
              </nav>
            )}
          </header>
          <main className="flex flex-1 flex-col">
            <Outlet />
          </main>
          <StaffConnectionFooter />

          <StaffAccountDrawer
            open={menuOpen}
            onClose={() => setMenuOpen(false)}
            perfilPath={perfilPath}
            onLectorQr={irLectorQr}
            showLectorQr={showLectorQr}
            showAjustes={showAjustes}
          />
        </div>
      </div>
    </StaffShellContext.Provider>
  )
}