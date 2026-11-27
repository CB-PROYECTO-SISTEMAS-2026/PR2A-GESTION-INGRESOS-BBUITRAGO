import { useEffect, useState } from 'react'

/** Monta el panel y anima entrada/salida (cajón desde la derecha). */
export function useSlideOver(open, durationMs = 300) {
  const [mounted, setMounted] = useState(open)
  const [active, setActive] = useState(false)

  useEffect(() => {
    if (open) {
      setMounted(true)
      const raf = requestAnimationFrame(() => setActive(true))
      return () => cancelAnimationFrame(raf)
    }
    setActive(false)
    const timer = setTimeout(() => setMounted(false), durationMs)
    return () => clearTimeout(timer)
  }, [open, durationMs])

  return { mounted, active }
}