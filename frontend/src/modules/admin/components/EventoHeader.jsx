import { Link, NavLink } from 'react-router-dom'
import { estadoBadgeClass, estadoLabel } from '../../../utils/labels'
import { IconChevronLeft } from '../../../components/ui/icons'

const tabClass = ({ isActive }) =>
  `relative -mb-px inline-flex items-center border-b-2 px-1 pb-3 pt-1 text-sm font-semibold transition ${
    isActive ? 'border-teal text-ink' : 'border-transparent text-muted hover:border-slate-300 hover:text-ink'
  }`

/** Encabezado común de las tres pantallas de un evento, con sus pestañas. */
export default function EventoHeader({ eventoId, titulo, estado }) {
  const isNew = !eventoId

  const tabs = [
    { to: isNew ? null : `/admin/eventos/${eventoId}`, label: 'Editar evento', end: true },
    { to: isNew ? null : `/admin/eventos/${eventoId}/categorias`, label: 'Categorías y QR' },
    { to: isNew ? null : `/admin/eventos/${eventoId}/mapa`, label: 'Mapa e historial' },
  ]

  return (
    <header className="border-b border-border bg-white px-8 pt-6">
      <Link
        to="/admin/eventos"
        className="inline-flex items-center gap-1 text-sm font-semibold text-teal-dark hover:text-teal"
      >
        <IconChevronLeft />
        Eventos
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-bold text-ink">{isNew ? 'Nuevo evento' : titulo || 'Evento'}</h1>
        {estado && (
          <span className={`badge ${estadoBadgeClass(estado)}`}>
            {estadoLabel(estado)}
          </span>
        )}
      </div>

      <nav className="mt-5 flex gap-8" aria-label="Secciones del evento">
        {tabs.map((tab, i) =>
          tab.to ? (
            <NavLink key={tab.label} to={tab.to} end={tab.end} className={tabClass}>
              {tab.label}
            </NavLink>
          ) : (
            <span
              key={tab.label}
              className={
                i === 0
                  ? 'relative -mb-px border-b-2 border-teal px-1 pb-3 pt-1 text-sm font-semibold text-ink'
                  : 'relative -mb-px cursor-not-allowed border-b-2 border-transparent px-1 pb-3 pt-1 text-sm font-semibold text-slate-300'
              }
              title={i === 0 ? undefined : 'Disponible después de crear el evento'}
            >
              {tab.label}
            </span>
          ),
        )}
      </nav>
    </header>
  )
}
