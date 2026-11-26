import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Skeleton from '../ui/Skeleton'
import { eventDayRange, eventImage } from '../../utils/format'
import { pickTendencias } from '../../utils/pickTendencias'

function shortestOffset(index, active, count) {
  let offset = index - active
  if (offset > count / 2) offset -= count
  if (offset < -count / 2) offset += count
  return offset
}

function FlyerFace({ item, linked }) {
  const img = (
    <img src={eventImage(item)} alt="" draggable={false} decoding="async" />
  )
  if (!linked) {
    return <div className="ev-curve-card">{img}</div>
  }
  return (
    <Link to={`/eventos/${item.id}`} className="ev-curve-card" aria-label={`Ver ${item.titulo || 'evento'}`}>
      {img}
    </Link>
  )
}

const TRAVEL_MS = 2000
const HOLD_MS = 5000

function Chevron({ direction }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={direction === 'prev' ? 'M14.5 5.5 8 12l6.5 6.5' : 'M9.5 5.5 16 12l-6.5 6.5'} />
    </svg>
  )
}

function CurvedCarousel({ items }) {
  const n = items.length
  const [active, setActive] = useState(0)
  const [traveling, setTraveling] = useState(false)
  const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 767px)').matches)
  const labelId = useId()
  const seen = useRef(new Map())
  const drag = useRef(null)
  const blockClick = useRef(false)
  const travelTimer = useRef(null)
  const busy = useRef(false)
  const stepRef = useRef(() => {})

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const sync = () => setCompact(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  useEffect(() => () => window.clearTimeout(travelTimer.current), [])

  useEffect(() => {
    if (n < 2) return undefined
    const id = window.setTimeout(() => stepRef.current((i) => (i + 1) % n), HOLD_MS)
    return () => window.clearTimeout(id)
  }, [n, active])

  useLayoutEffect(() => {
    const next = new Map()
    items.forEach((item, i) => next.set(item.id, shortestOffset(i, active, items.length)))
    seen.current = next
  }, [items, active])

  if (!n) return null

  const move = (update) => {
    if (busy.current || n < 2) return
    busy.current = true
    setTraveling(true)
    window.clearTimeout(travelTimer.current)
    travelTimer.current = window.setTimeout(() => {
      busy.current = false
      setTraveling(false)
    }, TRAVEL_MS)
    setActive(update)
  }

  stepRef.current = move

  const prev = () => move((i) => (i - 1 + n) % n)
  const next = () => move((i) => (i + 1) % n)
  const goTo = (index) => {
    if (index === active) return
    move(index)
  }
  const current = items[active]

  const onPointerDown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    drag.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      lock: null,
    }
  }

  const onPointerMove = (event) => {
    const start = drag.current
    if (!start || event.pointerId !== start.id) return
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    if (!start.lock) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
      start.lock = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
      if (start.lock === 'y') {
        drag.current = null
        return
      }
      event.currentTarget.setPointerCapture(event.pointerId)
    }
  }

  const onPointerUp = (event) => {
    const start = drag.current
    if (!start || event.pointerId !== start.id) return
    const dx = event.clientX - start.x
    drag.current = null
    if (start.lock !== 'x') return
    blockClick.current = true
    if (dx > 48) prev()
    else if (dx < -48) next()
  }

  const onClickCapture = (event) => {
    if (!blockClick.current) return
    blockClick.current = false
    event.preventDefault()
    event.stopPropagation()
  }

  return (
    <div
      className="ev-curve"
      role="region"
      aria-roledescription="carousel"
      aria-labelledby={labelId}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft') {
          event.preventDefault()
          prev()
        } else if (event.key === 'ArrowRight') {
          event.preventDefault()
          next()
        }
      }}
    >
      <p id={labelId} className="sr-only">
        Eventos en tendencia
      </p>

      <div
        className="ev-curve-stage"
        role="group"
        aria-label="Diapositivas"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={onClickCapture}
      >
        {items.map((item, i) => {
          const offset = shortestOffset(i, active, n)
          const prevOffset = seen.current.get(item.id)
          const jump = prevOffset != null && Math.abs(offset - prevOffset) > 1.5
          const hidden = Math.abs(offset) > (compact ? 1.05 : 2.05)
          const center = offset === 0

          return (
            <div
              key={item.id}
              className={`ev-curve-slide${center ? ' is-active' : ''}${jump ? ' is-jump' : ''}`}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} de ${n}`}
              aria-hidden={hidden || undefined}
              style={{
                '--curve-i': offset,
                zIndex: 12 - Math.round(Math.abs(offset)),
              }}
            >
              <FlyerFace item={item} linked={center} />
            </div>
          )
        })}
      </div>

      {n > 1 && (
        <div className="ev-curve-controls">
          <button type="button" className="ev-arrow" onClick={prev} aria-label="Anterior" aria-disabled={traveling || undefined}>
            <Chevron direction="prev" />
          </button>
          <button type="button" className="ev-arrow" onClick={next} aria-label="Siguiente" aria-disabled={traveling || undefined}>
            <Chevron direction="next" />
          </button>
        </div>
      )}

      <div className="ev-curve-footer">
        <p className="font-display text-xl font-semibold text-ink md:text-2xl">{current?.titulo}</p>
        <p className="mt-1 text-sm text-muted">
          {eventDayRange(current)}
          {current?.ubicacion ? ` · ${current.ubicacion}` : ''}
        </p>

        {n > 1 && (
          <nav className="ev-curve-markers" aria-label="Elegir diapositiva">
            {items.map((item, i) => (
              <button
                key={item.id}
                type="button"
                className="ev-curve-dot"
                aria-label={`Ir a ${item.titulo || `diapositiva ${i + 1}`}`}
                aria-current={i === active ? 'true' : undefined}
                onClick={() => goTo(i)}
              />
            ))}
          </nav>
        )}
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {`Diapositiva ${active + 1} de ${n}: ${current?.titulo || ''}`}
      </p>
    </div>
  )
}

export default function HomeTendencias({ events = [], loading = false }) {
  const featured = pickTendencias(events, 5)

  return (
    <section id="tendencias" tabIndex={-1} className="ev-tendencias scroll-mt-24">
      <div className="mx-auto max-w-6xl px-5">
        <header className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">Tendencias</p>
          <h2 className="ev-section-title mt-2 text-balance">Lo que está moviendo la cartelera</h2>
        </header>

        {loading ? (
          <div className="mt-10 space-y-6" aria-busy="true" aria-live="polite">
            <span className="sr-only">Cargando tendencias…</span>
            <div className="flex items-center justify-center gap-4">
              <Skeleton className="hidden h-72 w-44 rounded-2xl sm:block" />
              <Skeleton className="h-[28rem] w-64 rounded-2xl" />
              <Skeleton className="hidden h-72 w-44 rounded-2xl sm:block" />
            </div>
            <Skeleton className="mx-auto h-6 w-56" />
          </div>
        ) : featured.length === 0 ? (
          <p className="mt-10 text-muted">Aún no hay eventos con flyer para mostrar en tendencias.</p>
        ) : (
          <div className="mt-10">
            <CurvedCarousel items={featured} />
          </div>
        )}
      </div>
    </section>
  )
}
