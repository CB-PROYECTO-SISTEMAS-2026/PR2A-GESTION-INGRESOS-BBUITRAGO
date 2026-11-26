import { useRef } from 'react'
import { gsap, useGSAP, ScrollTrigger } from '../../lib/gsap'
import { DESKTOP_PATH, MOBILE_PATH, alignLayersToFixedPath } from './homeExperienciaPath'
import HomeExperienciaStepIcon from './HomeExperienciaStepIcon'

const BOOT_DONE = 'ev-boot-done'

function bootIsRunning() {
  return (
    document.documentElement.classList.contains('ev-boot-active') ||
    Boolean(document.querySelector('.ev-boot'))
  )
}

const SLOTS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven']

const STEPS = [
  {
    id: 'descubre',
    titleA: 'Explora',
    titleB: 'eventos',
    body: 'Fecha, lugar y categoría: elige qué quieres vivir en Cochabamba.',
  },
  {
    id: 'elige',
    titleA: 'Detalle',
    titleB: 'y entradas',
    body: 'Revisa el evento, compara categorías y arma tu compra.',
  },
  {
    id: 'paga',
    titleA: 'QR bancario',
    titleB: 'y comprobante',
    body: 'Transfiere al QR del organizador, sube el comprobante y espera la validación.',
  },
  {
    id: 'tu-qr',
    titleA: 'Entrada',
    titleB: 'digital',
    body: 'Cuando se confirma el pago, revelas, amplías o descargas tu QR.',
  },
  {
    id: 'entra',
    titleA: 'Acceso',
    titleB: 'al evento',
    body: 'Presentas tu QR en la puerta; el staff valida y puede entregarte la manilla.',
  },
  {
    id: 'cashless',
    titleA: 'Recarga',
    titleB: 'en el recinto',
    body: 'Cargas saldo en el punto de recargas y pagas en los negocios sin efectivo.',
  },
  {
    id: 'cierra',
    titleA: 'Reembolso',
    titleB: 'o saldo',
    body: 'Si no usaste la entrada o te quedó saldo, solicitas retiro o reembolso dentro del plazo.',
  },
]

function RouteSvg({ path, variant, className }) {
  return (
    <div className={className}>
      <svg
        className="ev-ex-svg"
        viewBox={path.viewBox}
        width="100%"
        height="auto"
        aria-hidden="true"
      >
        <path className={`ev-ex-stroke ev-ex-stroke--${variant}`} d={path.d} />
      </svg>
    </div>
  )
}

function Hole({ align }) {
  const mirrored = align === 'end'
  const cx = mirrored ? 20.5415 : 12.4585
  const shadowCx = mirrored ? 12.5 : 20.5
  const rotation = mirrored ? -0.0733968 : 0.0733968

  return (
    <div className={`ev-ex-hole ev-ex-hole--${align}`} aria-hidden="true">
      <svg viewBox="0 0 33 38" width="100%" height="auto">
        <ellipse className="ev-ex-hole-shadow" cx={shadowCx} cy="34.5" rx="12.5" ry="3.5" />
        <ellipse
          cx={cx}
          cy="18.0159"
          rx="12.4357"
          ry="18"
          transform={`rotate(${rotation} ${cx} 18.0159)`}
          fill="currentColor"
        />
      </svg>
    </div>
  )
}

export default function HomeExperiencia() {
  const sectionRef = useRef(null)
  const bodyRef = useRef(null)
  const layersRef = useRef(null)

  useGSAP(
    (_context, contextSafe) => {
      const root = sectionRef.current
      const body = bodyRef.current
      const layers = layersRef.current
      if (!root || !body || !layers) return

      let mm
      let ro
      let started = false
      let onRefreshInit
      let bootTimer
      let refreshTimer

      const iconWidth = () => {
        const probe = root.querySelector('.ev-ex-icon-probe')
        return probe?.getBoundingClientRect().width || 0
      }

      const snapStepsToPath = (path) => {
        const fallback = iconWidth()
        if (fallback > 0) {
          body.style.setProperty('--ev-ex-icon-measure-px', `${fallback}px`)
        }
        return alignLayersToFixedPath(path, root, layers, fallback)
      }

      const play = (path, stepProgresses, reduce) => {
        const icons = gsap.utils.toArray('.ev-ex-icon', root)
        const pills = gsap.utils.toArray('.ev-ex-pill', root)
        const targetW = iconWidth()

        const len = path.getTotalLength()
        gsap.set(path, {
          attr: { 'stroke-dasharray': len, 'stroke-dashoffset': reduce ? 0 : len },
        })

        if (reduce) {
          icons.forEach((icon) => {
            gsap.set(icon, {
              width: targetW || 'auto',
              scale: 1,
              autoAlpha: 1,
              overflow: 'hidden',
            })
          })
          gsap.set(pills, { scale: 1, rotation: -5, autoAlpha: 1 })
          return
        }

        icons.forEach((icon) => {
          icon.style.transformOrigin = 'center center'
          gsap.set(icon, { width: 0, scale: 0, autoAlpha: 0, overflow: 'hidden' })
        })
        pills.forEach((pill) => {
          pill.style.transformOrigin = 'center center'
          gsap.set(pill, { scale: 0, rotation: 0, autoAlpha: 0 })
        })

        const tl = gsap.timeline({ paused: true })
        tl.to(path, { attr: { 'stroke-dashoffset': 0 }, ease: 'none', duration: 1 }, 0)

        icons.forEach((icon, index) => {
          const point = stepProgresses[index] ?? index / Math.max(icons.length - 1, 1)
          const at = Math.max(0, point - 0.04)
          tl.to(
            icon,
            {
              width: targetW || 'auto',
              scale: 1,
              autoAlpha: 1,
              duration: 0.14,
              ease: 'back.out(3.5)',
            },
            at,
          )
          tl.to(
            pills[index],
            {
              scale: 1,
              rotation: -5,
              autoAlpha: 1,
              duration: 0.14,
              ease: 'back.out(3.5)',
            },
            at + 0.02,
          )
        })

        ScrollTrigger.create({
          id: 'experiencia',
          animation: tl,
          trigger: body,
          start: 'top 70%',
          end: 'bottom 70%',
          scrub: 1.2,
          invalidateOnRefresh: true,
        })
      }

      const setup = contextSafe(() => {
        if (started) return
        started = true

        mm = gsap.matchMedia()
        mm.add(
          {
            isDesktop: '(min-width: 480px)',
            isMobile: '(max-width: 479px)',
            reduceMotion: '(prefers-reduced-motion: reduce)',
          },
          (context) => {
            const { isMobile, reduceMotion } = context.conditions
            const path = root.querySelector(
              isMobile ? '.ev-ex-draw--mobile path' : '.ev-ex-draw--desktop path',
            )
            if (!path) return

            const stepProgresses = snapStepsToPath(path)
            play(path, stepProgresses, Boolean(reduceMotion))
          },
        )

        onRefreshInit = () => {
          const isMobile = window.matchMedia('(max-width: 479px)').matches
          const path = root.querySelector(
            isMobile ? '.ev-ex-draw--mobile path' : '.ev-ex-draw--desktop path',
          )
          if (path) snapStepsToPath(path)
        }

        ScrollTrigger.addEventListener('refreshInit', onRefreshInit)

        const home = root.closest('.ev-home')
        if (home) {
          ro = new ResizeObserver(() => {
            window.clearTimeout(refreshTimer)
            refreshTimer = window.setTimeout(() => ScrollTrigger.refresh(), 200)
          })
          ro.observe(home)
        }

        requestAnimationFrame(() => ScrollTrigger.refresh())
      })

      if (bootIsRunning()) {
        window.addEventListener(BOOT_DONE, setup, { once: true })
        bootTimer = window.setTimeout(setup, 5000)
        if (!bootIsRunning()) setup()
      } else {
        setup()
      }

      return () => {
        window.removeEventListener(BOOT_DONE, setup)
        window.clearTimeout(bootTimer)
        window.clearTimeout(refreshTimer)
        if (onRefreshInit) ScrollTrigger.removeEventListener('refreshInit', onRefreshInit)
        ro?.disconnect()
        mm?.revert()
      }
    },
    { scope: sectionRef },
  )

  return (
    <section
      ref={sectionRef}
      id="como-funciona"
      tabIndex={-1}
      className="ev-experiencia scroll-mt-24"
    >
      <div className="ev-ex-intro mx-auto max-w-6xl px-5 pt-16 md:pt-24">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">Cómo funciona</p>
        <h2 className="ev-section-title mt-2 text-balance">Experiencia Eventix</h2>
      </div>

      <div ref={bodyRef} className="ev-ex-body">
        <div className="ev-ex-scale">
          <div className="ev-ex-path">
            <RouteSvg
              path={DESKTOP_PATH}
              variant="desktop"
              className="ev-ex-ghost ev-ex-ghost--desktop"
            />
            <RouteSvg
              path={DESKTOP_PATH}
              variant="desktop"
              className="ev-ex-draw ev-ex-draw--desktop"
            />
            <RouteSvg
              path={MOBILE_PATH}
              variant="mobile"
              className="ev-ex-ghost ev-ex-ghost--mobile"
            />
            <RouteSvg
              path={MOBILE_PATH}
              variant="mobile"
              className="ev-ex-draw ev-ex-draw--mobile"
            />
            <Hole align="start" />
            <Hole align="end" />
          </div>

          <div ref={layersRef} className="ev-ex-layers">
            {STEPS.map((step, i) => (
              <div key={step.id} className="ev-ex-layer">
                <article className={`ev-ex-block ev-ex-block--${SLOTS[i]}`}>
                  {i === 0 && (
                    <span className="ev-ex-icon-probe" aria-hidden="true">
                      <HomeExperienciaStepIcon stepId={step.id} className="ev-ex-icon-glyph" />
                    </span>
                  )}
                  <span className="ev-ex-word">{step.titleA}</span>
                  <div className="ev-ex-icon" aria-hidden="true">
                    <HomeExperienciaStepIcon stepId={step.id} className="ev-ex-icon-glyph" />
                  </div>
                  <span className="ev-ex-word">{step.titleB}</span>
                  <p className="ev-ex-pill">{step.body}</p>
                </article>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}