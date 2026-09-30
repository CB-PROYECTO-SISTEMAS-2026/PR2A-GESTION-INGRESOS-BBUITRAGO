import { Link } from 'react-router-dom'
import BrandLogo from '../BrandLogo'
import { CONTACT_CITY, CONTACT_EMAIL, CONTACT_PHONE } from '../../utils/contact'

export default function Footer() {
  return (
    <footer className="mt-auto bg-navy-2 text-slate-300">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-4">
        <div>
          <BrandLogo to="/" imgClassName="h-10 w-auto max-w-[180px] object-contain" />
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            La plataforma líder en gestión y venta de entradas para los eventos tecnológicos,
            culturales y artísticos más destacados.
          </p>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold text-white">Plataforma</h3>
          <ul className="space-y-2 text-sm">
            <li>
              <Link to="/" className="hover:text-white">
                Inicio
              </Link>
            </li>
            <li>
              <Link to="/eventos" className="hover:text-white">
                Explorar Eventos
              </Link>
            </li>
            <li>Cómo Funciona</li>
            <li>
              <a href={`mailto:${CONTACT_EMAIL}?subject=Soporte%20EvenTix`} className="hover:text-white">
                Soporte
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold text-white">Legal</h3>
          <ul className="space-y-2 text-sm">
            <li>Términos de Servicio</li>
            <li>Política de Privacidad</li>
            <li>Políticas de Reembolso</li>
          </ul>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold text-white">Contacto</h3>
          <ul className="space-y-2 text-sm">
            <li>
              <a href={`mailto:${CONTACT_EMAIL}`} className="break-all hover:text-white">
                {CONTACT_EMAIL}
              </a>
            </li>
            <li>
              <a href={`tel:${CONTACT_PHONE.replace(/\s/g, '')}`} className="hover:text-white">
                {CONTACT_PHONE}
              </a>
            </li>
            <li>{CONTACT_CITY}</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-slate-800 py-4 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} EvenTix. Todos los derechos reservados.
      </div>
    </footer>
  )
}
