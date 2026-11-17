import { Link } from 'react-router-dom'
import { eventDayRange, eventImage, formatBs, lowestPrice } from '../utils/format'

export default function EventCard({ evento }) {
  const price = lowestPrice(evento)

  return (
    <article className="card-surface overflow-hidden transition hover:border-slate-300">
      <div className="aspect-[16/10] overflow-hidden bg-slate-200">
        <img src={eventImage(evento)} alt={evento?.titulo || 'Evento'} className="h-full w-full object-cover" loading="lazy" />
      </div>
      <div className="space-y-2 p-4">
        <p className="text-xs font-medium text-muted">
          {eventDayRange(evento)}
          {evento?.ubicacion ? ` · ${evento.ubicacion}` : ''}
        </p>
        <h3 className="line-clamp-2 font-display text-lg font-semibold text-ink">{evento?.titulo || 'Evento'}</h3>
        {evento?.descripcion && <p className="line-clamp-2 text-sm text-slate-600">{evento.descripcion}</p>}
        <div className="flex items-center justify-between gap-3 pt-2">
          <p className="text-sm font-semibold text-teal-dark">{price != null ? `Desde ${formatBs(price)}` : ''}</p>
          <Link to={`/eventos/${evento.id}`} className="btn-primary !px-3 !py-2 !text-sm">
            Ver evento
          </Link>
        </div>
      </div>
    </article>
  )
}
