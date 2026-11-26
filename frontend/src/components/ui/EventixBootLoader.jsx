import { useRef, useState } from 'react'
import { gsap, useGSAP, ScrollTrigger } from '../../lib/gsap'
import BootWordmark, { bootLiquidMaskPath } from './BootWordmark'

const BOOT_CLASS = 'ev-boot-active'
const MASK_ID = 'ev-boot-liquid-mask'
const BOOT_DONE = 'ev-boot-done'

function notifyBootDone() {
  document.documentElement.classList.remove(BOOT_CLASS)
  window.dispatchEvent(new Event(BOOT_DONE))
  ScrollTrigger.refresh()
}

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Intro al entrar a rutas públicas — relleno líquido + cortina (referencia NeoLeaf). */
export default function EventixBootLoader() {
  const rootRef = useRef(null)
  const maskPathRef = useRef(null)
  const starRef = useRef(null)
  const [show, setShow] = useState(() => !prefersReducedMotion())

  if (show && typeof document !== 'undefined') {
    document.documentElement.classList.add(BOOT_CLASS)
  }

  useGSAP(
    () => {
      const root = rootRef.current
      if (!root) return undefined

      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (reduce) {
        notifyBootDone()
        setShow(false)
        return undefined
      }

      const html = document.documentElement
      html.classList.add(BOOT_CLASS)
      window.scrollTo(0, 0)
      const pinTop = () => window.scrollTo(0, 0)
      window.addEventListener('scroll', pinTop)

      const state = { p: 0, phase: 0 }
      const maskPath = maskPathRef.current
      const star = starRef.current

      const syncLiquid = () => {
        if (maskPath) {
          maskPath.setAttribute('d', bootLiquidMaskPath(240, 70, state.p, state.phase))
        }
      }

      syncLiquid()
      if (star) gsap.set(star, { opacity: 0, scale: 0.72 })

      const tl = gsap.timeline()

      tl.to(state, {
        p: 100,
        duration: 2.85,
        ease: 'power3.inOut',
        onUpdate: syncLiquid,
      }).to(
        state,
        {
          phase: Math.PI * 10,
          duration: 2.85,
          ease: 'none',
          onUpdate: syncLiquid,
        },
        0,
      )

      tl.to(
        star,
        {
          opacity: 1,
          scale: 1,
          duration: 0.22,
          ease: 'back.out(2)',
        },
        '-=0.12',
      )

      tl.to(
        root,
        {
          yPercent: -100,
          duration: 0.9,
          ease: 'power4.inOut',
        },
        '+=0.08',
      )

      tl.call(() => {
        window.removeEventListener('scroll', pinTop)
        window.scrollTo(0, 0)
        notifyBootDone()
        setShow(false)
      })

      return () => {
        window.removeEventListener('scroll', pinTop)
        tl.kill()
        html.classList.remove(BOOT_CLASS)
      }
    },
    { scope: rootRef },
  )

  if (!show) return null

  return (
    <div
      ref={rootRef}
      className="ev-boot"
      role="status"
      aria-live="polite"
      aria-label="Cargando Eventix"
      aria-busy="true"
    >
      <div className="ev-boot-stage">
        <BootWordmark maskId={MASK_ID} maskPathRef={maskPathRef} starRef={starRef} />
      </div>
    </div>
  )
}