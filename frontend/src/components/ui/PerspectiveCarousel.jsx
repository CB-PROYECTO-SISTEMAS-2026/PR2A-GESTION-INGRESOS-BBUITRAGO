import { useState } from 'react'
import { Link } from 'react-router-dom'

/** Carrusel 3D ligero (CSS) para eventos publicados con foto. */
export default function PerspectiveCarousel({ items = [], className = '' }) {
  const [active, setActive] = useState(0)
  if (!items.length) return null

  const n = items.length
  const prev = () => setActive((i) => (i - 1 + n) % n)
  const next = () => setActive((i) => (i + 1) % n)

  return (
    <div className={`ev-persp ${className}`}>
      <div className="ev-persp-stage">
        {items.map((item, i) => {
          let offset = i - active
          if (offset > n / 2) offset -= n
          if (offset < -n / 2) offset += n
          const abs = Math.abs(offset)
          return (
            <button
              key={item.id || i}
              type="button"
              className={`ev-persp-slide ${offset === 0 ? 'is-active' : ''}`}
              style={{
                transform: `translateX(${offset * 58}%) scale(${offset === 0 ? 1 : 0.82}) rotateY(${offset * -28}deg)`,
                zIndex: 20 - abs,
                opacity: abs > 2 ? 0 : 1 - abs * 0.28,
                pointerEvents: abs > 2 ? 'none' : 'auto',
              }}
              onClick={() => setActive(i)}
              aria-label={item.title || item.titulo || `Slide ${i + 1}`}
            >
              <img src={item.src || item.fotoUrl} alt={item.alt || item.titulo || ''} />
            </button>
          )
        })}
      </div>
      <div className="ev-persp-meta">
        <p className="font-display text-xl font-semibold text-ink">{items[active]?.titulo || items[active]?.title}</p>
        {items[active]?.to && (
          <Link to={items[active].to} className="btn-primary !mt-3 !py-2 !text-sm">
            Ver evento
          </Link>
        )}
        <div className="mt-4 flex items-center justify-center gap-3">
          <button type="button" className="ev-arrow" onClick={prev} aria-label="Anterior">
            ‹
          </button>
          <div className="flex gap-1.5">
            {items.map((_, i) => (
              <button
                key={i}
                type="button"
                className={`h-2 w-2 rounded-full ${i === active ? 'bg-primary' : 'bg-border'}`}
                aria-label={`Ir al ${i + 1}`}
                onClick={() => setActive(i)}
              />
            ))}
          </div>
          <button type="button" className="ev-arrow" onClick={next} aria-label="Siguiente">
            ›
          </button>
        </div>
      </div>
    </div>
  )
}
