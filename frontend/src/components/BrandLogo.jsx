import { Link } from 'react-router-dom'
import logo from '../assets/EventixLogo.png'

export default function BrandLogo({ to = '/', className = '', imgClassName = 'h-9 w-auto' }) {
  const img = <img src={logo} alt="EvenTix" className={imgClassName} />

  if (to === false || to === null) {
    return <span className={`inline-flex items-center ${className}`}>{img}</span>
  }

  return (
    <Link to={to} className={`inline-flex items-center ${className}`} aria-label="EvenTix">
      {img}
    </Link>
  )
}
