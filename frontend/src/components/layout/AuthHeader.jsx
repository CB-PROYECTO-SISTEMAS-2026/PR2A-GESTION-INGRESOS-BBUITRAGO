import BrandLogo from '../BrandLogo'
import { Link } from 'react-router-dom'

export default function AuthHeader({ backTo = '/', backLabel = 'Volver' }) {
  return (
    <header className="flex items-center justify-between bg-navy px-4 py-3 text-white">
      <BrandLogo to="/" imgClassName="h-8 w-auto max-w-[150px] object-contain" />
      <div className="flex items-center gap-4 text-sm">
        <Link to={backTo} className="text-slate-300 hover:text-white">
          {backLabel}
        </Link>
        <span className="border-l border-slate-600 pl-4 text-teal">Espacio Seguro</span>
      </div>
    </header>
  )
}
