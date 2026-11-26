import { Link } from 'react-router-dom'
import logoHorizontalDark from '../assets/brand/eventix-logo-horizontal-dark.svg'
import logoHorizontalLight from '../assets/brand/eventix-logo-horizontal-light.svg'
import logoVerticalDark from '../assets/brand/eventix-logo-vertical-dark.svg'
import logoVerticalLight from '../assets/brand/eventix-logo-vertical-light.svg'
import symbolOrbit from '../assets/brand/eventix-symbol-orbit.svg'
import symbolWhite from '../assets/brand/eventix-symbol-white.svg'

/**
 * BrandLogo — Componente oficial de identidad visual Eventix (Orbit Ticket).
 * Renderizado vectorial SVG nítido en cualquier resolución de pantalla.
 *
 * @param {'horizontal' | 'vertical' | 'symbol'} variant - Formato del logotipo
 * @param {'dark' | 'light' | 'white'} theme - Tema ('dark' para fondos azul oscuro/negro, 'light' para blanco)
 * @param {string | false | null} to - Ruta de enlace (null o false para solo imagen sin Link)
 * @param {string} className - Clases del contenedor exterior
 * @param {string} imgClassName - Clases de la etiqueta <img>
 */
export default function BrandLogo({
  to = '/',
  variant = 'horizontal',
  theme = 'dark',
  className = '',
  imgClassName = 'h-9 w-auto',
}) {
  let src = logoHorizontalDark

  if (variant === 'symbol') {
    src = theme === 'white' ? symbolWhite : symbolOrbit
  } else if (variant === 'vertical') {
    src = theme === 'light' ? logoVerticalLight : logoVerticalDark
  } else {
    src = theme === 'light' ? logoHorizontalLight : logoHorizontalDark
  }

  const img = (
    <img
      src={src}
      alt="Eventix"
      className={imgClassName}
      loading="eager"
      decoding="async"
    />
  )

  if (to === false || to === null) {
    return <span className={`inline-flex items-center ${className}`}>{img}</span>
  }

  return (
    <Link to={to} className={`inline-flex items-center ${className}`} aria-label="Eventix">
      {img}
    </Link>
  )
}
