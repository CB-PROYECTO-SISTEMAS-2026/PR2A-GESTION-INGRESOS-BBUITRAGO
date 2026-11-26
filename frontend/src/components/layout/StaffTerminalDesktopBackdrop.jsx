import symbolOrbit from '../../assets/brand/eventix-symbol-orbit.svg'

/** Fondo azul Eventix + isotipo difuminado; solo visible en desktop alrededor del marco móvil. */
export default function StaffTerminalDesktopBackdrop() {
  return (
  <>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-20 hidden bg-gradient-to-br from-primary via-primary-hover to-sidebar md:block"
      />
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 hidden items-center justify-center overflow-hidden md:flex">
        <img
          src={symbolOrbit}
          alt=""
          className="h-[min(72vh,32rem)] w-auto max-w-[90vw] scale-[1.35] opacity-[0.22] blur-3xl select-none"
          width={512}
          height={512}
          decoding="async"
        />
      </div>
    </>
  )
}