import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react'

const GRID = 8
const STEP_MS = 65
const FLIP_MS = 320
const MAX_COLS_HALF = GRID / 2

/* ── Eventix icon mark (ticket + orbit + star) ── */
function LogoMark() {
  return (
    <g transform="translate(50, 50) rotate(-22) translate(-50, -50)">
      <path d="M 5 50 C 5 35,25 24,50 24 C 75 24,95 35,95 50 C 95 51.5,94.5 53,93.5 54.5 L 88.5 53.5 C 89.5 52,90 51,90 50 C 90 38,72 28.5,50 28.5 C 28 28.5,10 38,10 50 C 10 51,10.5 52,11.5 53.5 L 6.5 54.5 C 5.5 53,5 51.5,5 50 Z"
            fill="url(#ev-ring-gr)" opacity="0.9" />
      <path d="M 28 33 L 72 33 A 6 6 0 0 1 78 39 L 78 44.5 A 5.5 5.5 0 0 0 78 55.5 L 78 61 A 6 6 0 0 1 72 67 L 28 67 A 6 6 0 0 1 22 61 L 22 55.5 A 5.5 5.5 0 0 0 22 44.5 L 22 39 A 6 6 0 0 1 28 33 Z"
            fill="url(#ev-ticket-gr)" />
      <path d="M 50 38 Q 50 50,62 50 Q 50 50,50 62 Q 50 50,38 50 Q 50 50,50 38 Z"
            fill="#FFFFFF" />
      <path d="M 5 50 C 5 65,25 76,50 76 C 75 76,95 65,95 50 L 90 48.5 C 89.5 61.5,72 71.5,50 71.5 C 28 71.5,10.5 61.5,10 48.5 L 5 50 Z"
            fill="url(#ev-ring-gr)" />
    </g>
  )
}

/* Shared gradients (rendered once inside a hidden <svg>) */
function LogoDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }}>
      <defs>
        <linearGradient id="ev-ticket-gr" x1="15%" y1="0%" x2="85%" y2="100%">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="45%" stopColor="#2563EB" />
          <stop offset="100%" stopColor="#1D4ED8" />
        </linearGradient>
        <linearGradient id="ev-ring-gr" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#1D4ED8" />
          <stop offset="50%" stopColor="#2563EB" />
          <stop offset="85%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#00F2FE" />
        </linearGradient>
      </defs>
    </svg>
  )
}

/**
 * QR oculto tras un mosaico de cuadrados con el logo Eventix partido.
 *
 * Revelar: cuadrados se flipean del centro hacia los bordes,
 *          logo se parte a la mitad y cada mitad sale volando.
 *
 * Ocultar: cuadrados se flipean de los bordes hacia el centro,
 *          las mitades del logo regresan y se juntan.
 */
const TapReveal = forwardRef(function TapReveal(
  {
    children,
    label = 'Toca para ver tu QR',
    hideLabel = 'Toca para ocultar tu QR',
    hideable = true,
    className = '',
    contentClassName = '',
    defaultRevealed = false,
    onPhaseChange,
    /** Si es false, el sello no revela al tocar; solo controles externos. */
    revealOnSealClick = true,
  },
  ref,
) {
  // phase: 'hidden' | 'revealing' | 'revealed' | 'hiding'
  const [phase, setPhase] = useState(defaultRevealed ? 'revealed' : 'hidden')
  const timer = useRef(null)
  const onPhaseChangeRef = useRef(onPhaseChange)
  onPhaseChangeRef.current = onPhaseChange

  const totalAnimMs = MAX_COLS_HALF * STEP_MS + FLIP_MS + 40

  const cells = useMemo(() =>
    Array.from({ length: GRID * GRID }, (_, i) => {
      const col = i % GRID
      const dist = Math.floor(Math.abs(col - 3.5)) // 0 for cols 3,4; 3 for cols 0,7
      return { i, dist }
    }),
  [])

  const handleReveal = useCallback(() => {
    clearTimeout(timer.current)
    setPhase('revealing')
    onPhaseChangeRef.current?.('revealing')
    timer.current = setTimeout(() => {
      setPhase('revealed')
      onPhaseChangeRef.current?.('revealed')
    }, totalAnimMs)
  }, [totalAnimMs])

  const handleHide = useCallback(() => {
    clearTimeout(timer.current)
    setPhase('hiding')
    onPhaseChangeRef.current?.('hiding')
    timer.current = setTimeout(() => {
      setPhase('hidden')
      onPhaseChangeRef.current?.('hidden')
    }, totalAnimMs)
  }, [totalAnimMs])

  const isOpen = phase === 'revealing' || phase === 'revealed'

  const getDelay = (dist) => {
    if (phase === 'revealing') return dist * STEP_MS
    if (phase === 'hiding') return (MAX_COLS_HALF - 1 - dist) * STEP_MS
    return 0
  }

  const canReveal = phase === 'hidden'
  const canHide = phase === 'revealed'
  const busy = phase === 'revealing' || phase === 'hiding'

  useImperativeHandle(
    ref,
    () => ({
      reveal: handleReveal,
      hide: handleHide,
      phase,
      canReveal,
      canHide,
      busy,
    }),
    [handleReveal, handleHide, phase, canReveal, canHide, busy],
  )

  const sealActivates = revealOnSealClick && canReveal

  return (
    <div className={`ev-flip-wrap ${className}`}>
      <LogoDefs />

      {/* QR content underneath */}
      <div className={`ev-flip-content ${contentClassName}`}>{children}</div>

      {/* Overlay seal */}
      <div
        className={`ev-flip-seal ${isOpen ? 'is-open' : ''} ${revealOnSealClick ? '' : 'ev-flip-seal--passive'}`}
        onClick={sealActivates ? handleReveal : undefined}
        onKeyDown={sealActivates ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleReveal() } } : undefined}
        role={sealActivates ? 'button' : undefined}
        tabIndex={sealActivates ? 0 : -1}
        aria-label={sealActivates ? (typeof label === 'string' ? label : 'Revelar contenido') : undefined}
        aria-hidden={!revealOnSealClick && canReveal ? true : undefined}
      >
        {/* Grid */}
        <div className="ev-flip-grid" aria-hidden="true">
          {cells.map(({ i, dist }) => (
            <span
              key={i}
              className="ev-flip-cell"
              style={{
                transitionDuration: `${FLIP_MS}ms`,
                transitionDelay: `${getDelay(dist)}ms`,
                transform: isOpen ? 'rotateY(90deg)' : 'rotateY(0deg)',
                opacity: isOpen ? 0 : 1,
              }}
            />
          ))}
        </div>

        {/* Logo — two overlapping SVGs, each clipped to its half */}
        <div className={`ev-flip-logo-wrap ${isOpen ? 'is-split' : ''}`}>
          <svg className="ev-flip-logo-half ev-flip-logo-left" viewBox="0 0 100 100">
            <defs><clipPath id="ev-cl-l"><rect x="0" y="0" width="50" height="100" /></clipPath></defs>
            <g clipPath="url(#ev-cl-l)"><LogoMark /></g>
          </svg>
          <svg className="ev-flip-logo-half ev-flip-logo-right" viewBox="0 0 100 100">
            <defs><clipPath id="ev-cl-r"><rect x="50" y="0" width="50" height="100" /></clipPath></defs>
            <g clipPath="url(#ev-cl-r)"><LogoMark /></g>
          </svg>
        </div>
      </div>

      {/* Label OUTSIDE the image — always visible, text toggles */}
      {hideable && (
        <button
          type="button"
          className="ev-flip-label-btn"
          onClick={canReveal ? handleReveal : canHide ? handleHide : undefined}
          disabled={busy}
        >
          {isOpen ? hideLabel : label}
        </button>
      )}
    </div>
  )
})

export default TapReveal
