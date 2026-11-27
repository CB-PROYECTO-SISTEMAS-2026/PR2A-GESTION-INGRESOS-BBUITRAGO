const esquina = 'pointer-events-none absolute h-7 w-7 border-white'

/** Visor de cámara con esquinas de encuadre y, debajo, la última lectura. */
export default function MarcoEscaner({ children, lectura = null }) {
  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-xl bg-ink">
        {children}
        <span className={`${esquina} left-3 top-3 border-l-2 border-t-2`} />
        <span className={`${esquina} right-3 top-3 border-r-2 border-t-2`} />
        <span className={`${esquina} bottom-3 left-3 border-b-2 border-l-2`} />
        <span className={`${esquina} bottom-3 right-3 border-b-2 border-r-2`} />
      </div>
      {lectura}
    </div>
  )
}
