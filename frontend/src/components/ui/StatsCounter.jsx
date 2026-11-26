import { useEffect, useRef, useState } from 'react'

export default function StatsCounter({ value = 0, suffix = '', prefix = '', duration = 1.4, className = '' }) {
  const [n, setN] = useState(0)
  const ref = useRef(null)
  const ran = useRef(false)
  const target = Number(value) || 0

  useEffect(() => {
    if (!ref.current) return undefined
    const obs = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting || ran.current) return
        ran.current = true
        const start = performance.now()
        const ms = Math.max(0.4, duration) * 1000
        const tick = (now) => {
          const t = Math.min(1, (now - start) / ms)
          const eased = 1 - Math.pow(1 - t, 3)
          setN(Math.round(eased * target))
          if (t < 1) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      },
      { threshold: 0.35 },
    )
    obs.observe(ref.current)
    return () => obs.disconnect()
  }, [target, duration])

  return (
    <span ref={ref} className={className}>
      {prefix}
      {n.toLocaleString('es-BO')}
      {suffix}
    </span>
  )
}
