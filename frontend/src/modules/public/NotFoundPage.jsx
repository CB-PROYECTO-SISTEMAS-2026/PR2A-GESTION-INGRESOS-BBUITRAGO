import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
/** Pantalla 404 inmersiva: solo la cifra en 3D y objetos del ecosistema Eventix cayendo. */
export default function NotFoundPage() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined

    let teardown = () => {}
    let cancelled = false

    import('./not-found-scene').then(async ({ mountNotFoundScene }) => {
      if (cancelled) return
      teardown = await mountNotFoundScene(canvas)
    })

    return () => {
      cancelled = true
      teardown()
    }
  }, [])

  return (
    <div className="relative min-h-dvh overflow-hidden bg-sidebar text-surface">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 size-full touch-none"
        aria-hidden
      />
      <MotionSafeRegion />
    </div>
  )
}

function MotionSafeRegion() {
  return (
    <div className="relative z-10 flex min-h-dvh flex-col items-center justify-end gap-4 px-4 pb-[max(2rem,env(safe-area-inset-bottom))]">
      <p className="sr-only">Error 404: la ruta no existe</p>
      <Link
        to="/"
        className="pointer-events-auto inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-6 text-sm font-semibold text-surface shadow-lg transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-focus"
      >
        Volver al inicio
      </Link>
    </div>
  )
}