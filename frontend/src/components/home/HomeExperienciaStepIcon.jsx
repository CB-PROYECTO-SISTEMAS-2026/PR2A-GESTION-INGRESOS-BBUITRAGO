const GLYPH =
  'box-content block h-[1em] w-[1em] shrink-0 text-ink [&_svg]:block [&_svg]:h-full [&_svg]:w-full'

function Glyph({ children, className = '' }) {
  return (
    <span className={[GLYPH, className].filter(Boolean).join(' ')} aria-hidden="true">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </svg>
    </span>
  )
}

export default function HomeExperienciaStepIcon({ stepId, className }) {
  switch (stepId) {
    case 'descubre':
      return (
        <Glyph className={className}>
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="m16.5 16.5 5 5" />
          <path d="M8 10.5h5M10.5 8v5" strokeWidth="1.35" />
        </Glyph>
      )
    case 'elige':
      return (
        <Glyph className={className}>
          <path d="M4 8.5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1.5a2 2 0 0 0 0 3.5v1.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1.5a2 2 0 0 0 0-3.5Z" />
          <path d="M12 6.5v2M12 11v2M12 15.5v2" strokeWidth="1.35" />
        </Glyph>
      )
    case 'paga':
      return (
        <Glyph className={className}>
          <rect x="5" y="2.5" width="14" height="19" rx="2" />
          <rect x="8" y="6.5" width="8" height="8" rx="1" />
          <path d="M9.5 8.5h1.5v1.5H9.5zM13 8.5h1.5v1.5H13zM9.5 12h1.5v1.5H9.5z" />
          <path d="M16 17.5h5v5h-5z" strokeWidth="1.35" />
          <path d="M17.25 20.25 19 18l1.75 2.25" strokeWidth="1.35" />
        </Glyph>
      )
    case 'tu-qr':
      return (
        <Glyph className={className}>
          <rect x="4" y="4" width="7" height="7" rx="1" />
          <rect x="13" y="4" width="7" height="7" rx="1" />
          <rect x="4" y="13" width="7" height="7" rx="1" />
          <path d="M13 13h3v3h-3zM19 13v.01M13 19h.01M16 19h4v-3" />
          <path d="M19 16v3h-3" strokeWidth="1.35" />
        </Glyph>
      )
    case 'entra':
      return (
        <Glyph className={className}>
          <path d="M5 6.5h14v11H5z" />
          <path d="M9 6.5V5h6v1.5" />
          <rect x="8.5" y="10" width="7" height="7" rx="1" />
          <path d="M10 12h1.2v1.2H10zM12.5 12H14v1.2h-1.5zM10 14.8h1.2v1.2H10z" />
          <path d="M17.5 14.5l1.2 1.2 2.2-2.5" strokeWidth="1.4" />
        </Glyph>
      )
    case 'cashless':
      return (
        <Glyph className={className}>
          <path d="M4 8a2 2 0 0 1 2-2h11v4" />
          <rect x="3" y="8" width="18" height="12" rx="2" />
          <circle cx="17" cy="14" r="1.25" fill="currentColor" stroke="none" />
          <path d="M7 14h5M7 11h8" strokeWidth="1.35" />
          <path d="M12 4v2" strokeWidth="1.35" />
        </Glyph>
      )
    case 'cierra':
      return (
        <Glyph className={className}>
          <path d="M6 8.5a6 6 0 1 1 2.2 4.6" />
          <path d="M6 4.5V8.5H2" />
          <path d="M9 14.5h6M11.5 12v5" strokeWidth="1.35" />
        </Glyph>
      )
    default:
      return null
  }
}