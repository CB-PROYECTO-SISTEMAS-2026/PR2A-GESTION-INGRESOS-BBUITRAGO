import { useLayoutEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Navbar from '../../components/layout/Navbar'
import Footer from '../../components/layout/Footer'
import EventixBootLoader from '../../components/ui/EventixBootLoader'

/** Mide el header real para que el hero no salte al hidratar fuentes o auth. */
function useNavOffset() {
  useLayoutEffect(() => {
    const header = document.querySelector('.ev-public-shell > header')
    if (!header) return undefined

    const apply = () => {
      document.documentElement.style.setProperty('--ev-nav-offset', `${header.offsetHeight}px`)
    }

    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(header)
    window.addEventListener('resize', apply, { passive: true })

    return () => {
      ro.disconnect()
      window.removeEventListener('resize', apply)
      document.documentElement.style.removeProperty('--ev-nav-offset')
    }
  }, [])
}

export default function PublicLayout() {
  useNavOffset()

  return (
    <div className="ev-public-shell flex min-h-screen flex-col bg-page">
      <EventixBootLoader />
      <Navbar />
      <main className="ev-public-main flex-1">
        <Outlet />
      </main>
      <Footer variant="screen" />
    </div>
  )
}