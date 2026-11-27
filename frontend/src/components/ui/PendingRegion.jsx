/**
 * Rueda centrada sobre el bloque que se está recargando.
 * No tapa clics: el menú, los filtros y el resto de la página siguen usándose.
 */
export default function PendingRegion({ pending, children, className = '' }) {
  return (
    <div className={`relative ${className}`} aria-busy={pending || undefined}>
      {children}
      {pending ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex h-full max-h-[70vh] items-center justify-center">
          <span className="ev-spinner" role="progressbar" aria-label="Cargando" />
        </div>
      ) : null}
    </div>
  )
}
