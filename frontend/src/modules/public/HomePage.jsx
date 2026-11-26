import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getPublishedEvents } from '../../api/events.api'
import FaqAccordion from '../../components/ui/FaqAccordion'
import CylinderCarousel from '../../components/ui/CylinderCarousel'
import BackToTop from '../../components/ui/BackToTop'
import HomeHero from '../../components/home/HomeHero'
import HomeTendencias from '../../components/home/HomeTendencias'
import HomeEventosPublicados from '../../components/home/HomeEventosPublicados'
import HomeExperiencia from '../../components/home/HomeExperiencia'
import { eventImage, getErrorMessage } from '../../utils/format'
import { scrollHomeHeroInicio } from '../../utils/goHomeHero'

export default function HomePage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [events, setEvents] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!location.state?.scrollToInicio) return
    navigate({ pathname: location.pathname, search: location.search, hash: location.hash }, { replace: true, state: null })
    requestAnimationFrame(() => scrollHomeHeroInicio())
  }, [location, navigate])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const { data } = await getPublishedEvents()
        const list = Array.isArray(data) ? data : data?.data ?? data?.items ?? []
        if (alive) setEvents(list)
      } catch (err) {
        if (alive) setError(getErrorMessage(err, 'No se pudieron cargar los eventos'))
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  const withImages = useMemo(
    () =>
      events
        .map((e) => ({
          id: e.id,
          titulo: e.titulo,
          src: eventImage(e),
          to: `/eventos/${e.id}`,
        }))
        .filter((e) => e.src),
    [events],
  )

  return (
    <div className="ev-home">
      <HomeHero />

      <HomeTendencias events={events} loading={loading} />

      {error && (
        <div className="mx-auto max-w-6xl px-5 py-4">
          <p className="rounded-md border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p>
        </div>
      )}

      {withImages.length >= 3 && (
        <section className="overflow-hidden bg-page py-10">
          <CylinderCarousel images={withImages} />
        </section>
      )}

      <HomeEventosPublicados events={events} loading={loading} />

      <HomeExperiencia />

      <section
        id="faq"
        tabIndex={-1}
        className="ev-home-faq scroll-mt-24 border-t border-border bg-primary-soft pt-24 md:pt-32"
      >
        <div className="mx-auto max-w-6xl px-5 pb-16">
          <FaqAccordion />
        </div>
      </section>

      <BackToTop />
    </div>
  )
}
