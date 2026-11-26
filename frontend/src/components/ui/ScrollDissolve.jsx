import { useEffect, useRef, useState } from 'react'

/** Crossfade entre dos imágenes reales al hacer scroll (Home marketing only). */
export default function ScrollDissolve({ imageFront, imageBack, className = '' }) {
  const ref = useRef(null)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!imageFront || !imageBack) return undefined
    const el = ref.current
    if (!el) return undefined

    const onScroll = () => {
      const rect = el.getBoundingClientRect()
      const view = window.innerHeight || 1
      const start = view * 0.85
      const end = view * 0.2
      const raw = (start - rect.top) / (start - end)
      setProgress(Math.min(1, Math.max(0, raw)))
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [imageFront, imageBack])

  if (!imageFront || !imageBack) return null

  return (
    <div ref={ref} className={`ev-dissolve ${className}`}>
      <div className="ev-dissolve-sticky">
        <img src={imageBack} alt="" className="ev-dissolve-img" />
        <img
          src={imageFront}
          alt=""
          className="ev-dissolve-img ev-dissolve-front"
          style={{ opacity: 1 - progress }}
        />
      </div>
    </div>
  )
}
