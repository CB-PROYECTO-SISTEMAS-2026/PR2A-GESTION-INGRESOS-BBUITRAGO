import { useEffect, useRef, useState } from 'react'
import BrandLogo from '../BrandLogo'
import heroDesktop from '../../assets/hero/hero-eventix-desktop.jpg'
import heroMobile from '../../assets/hero/hero-eventix-mobile.jpg'

function prefersReduce() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function clearHash() {
  if (!window.location.hash) return
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
}

function scrollToId(id) {
  const el = document.getElementById(id)
  if (!el) return
  el.scrollIntoView({ behavior: prefersReduce() ? 'auto' : 'smooth', block: 'start' })
  clearHash()
}

export default function HomeHero() {
  const pinRef = useRef(null)
  const [photoOk, setPhotoOk] = useState(true)
  const [photoReady, setPhotoReady] = useState(false)

  useEffect(() => {
    const img = pinRef.current?.querySelector('.ev-home-hero-media img')
    if (img?.complete && img.naturalWidth > 0) setPhotoReady(true)
  }, [])

  useEffect(() => {
    const pin = pinRef.current
    if (!pin) return undefined

    const reduceMq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const supported =
      window.CSS?.supports?.('(animation-timeline: scroll()) and (animation-range: 0% 100%)') ?? false

    const clear = () => {
      pin.classList.remove('is-hero-scroll-fallback')
      pin.style.removeProperty('--hero-p')
    }

    if (reduceMq.matches || supported) {
      clear()
      return undefined
    }

    pin.classList.add('is-hero-scroll-fallback')
    let frame = 0
    const update = () => {
      frame = 0
      const rect = pin.getBoundingClientRect()
      const travel = rect.height - window.innerHeight
      const scrolled = Math.min(Math.max(-rect.top, 0), Math.max(travel, 0))
      const progress = travel > 0 ? scrolled / travel : 0
      pin.style.setProperty('--hero-p', progress.toFixed(4))
    }
    const onScroll = () => {
      if (frame) return
      frame = window.requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    const onReduce = () => {
      if (reduceMq.matches) clear()
    }
    reduceMq.addEventListener('change', onReduce)

    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      reduceMq.removeEventListener('change', onReduce)
      if (frame) window.cancelAnimationFrame(frame)
      clear()
    }
  }, [])

  const scrollNext = () => {
    const next = pinRef.current?.nextElementSibling
    if (!(next instanceof HTMLElement)) return
    next.scrollIntoView({ behavior: prefersReduce() ? 'auto' : 'smooth', block: 'start' })
    clearHash()
  }

  return (
    <section id="inicio" tabIndex={-1} ref={pinRef} className="ev-home-hero-pin scroll-mt-24">
      <div className="ev-home-hero">
        {photoOk && (
          <div className={`ev-home-hero-media${photoReady ? ' is-ready' : ''}`} aria-hidden="true">
            <picture>
              <source media="(min-width: 768px)" srcSet={heroDesktop} />
              <img
                src={heroMobile}
                alt=""
                width={720}
                height={1280}
                fetchPriority="high"
                decoding="async"
                onLoad={() => setPhotoReady(true)}
                onError={() => setPhotoOk(false)}
              />
            </picture>
          </div>
        )}
        <div className="ev-home-hero-veil" aria-hidden="true" />

        <div className="ev-home-hero-lockup">
          <h1 className="ev-home-hero-logo">
            <BrandLogo
              to={false}
              variant="horizontal"
              theme="dark"
              imgClassName="h-14 w-auto md:h-20"
            />
          </h1>
          <p className="ev-home-hero-copy">
            Tu acceso directo a los mejores eventos en Cochabamba
          </p>
          <p className="ev-home-hero-sub">
            Compra tus entradas en minutos, recibe tu QR y consume sin efectivo con tu manilla
          </p>
          <div className="ev-home-hero-actions">
            <button type="button" className="btn-primary" onClick={() => scrollToId('eventos')}>
              Explorar eventos
            </button>
            <button type="button" className="ev-home-hero-ghost" onClick={() => scrollToId('como-funciona')}>
              Cómo funciona
            </button>
          </div>
        </div>

        <button type="button" className="ev-home-hero-cue" aria-label="Bajar" onClick={scrollNext}>
          <span className="ev-home-hero-cue-track" aria-hidden="true">
            <span className="ev-home-hero-cue-dot" />
          </span>
        </button>
      </div>
    </section>
  )
}
