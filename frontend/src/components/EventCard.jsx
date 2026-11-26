import { Link } from 'react-router-dom'
import { eventDayRange, eventImage, formatBs, lowestPrice } from '../utils/format'

export default function EventCard({ evento }) {
  const price = lowestPrice(evento)

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
      <div className="relative aspect-[4/5] overflow-hidden bg-page">
        <img
          src={eventImage(evento)}
          alt={evento?.titulo || 'Evento'}
          className="h-full w-full object-contain transition-transform duration-500 ease-out group-hover:scale-[1.02]"
          loading="lazy"
        />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4 sm:p-5">
        <div className="space-y-0.5 text-xs font-medium text-muted">
          <p className="flex items-center gap-1.5">
            <svg className="h-3.5 w-3.5 shrink-0 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
            </svg>
            <span>{eventDayRange(evento)}</span>
          </p>
          {evento?.ubicacion ? (
            <p className="flex items-start gap-1.5 pl-5">
              <span className="line-clamp-2">{evento.ubicacion}</span>
            </p>
          ) : null}
        </div>
        <h3 className="line-clamp-2 font-display text-xl font-bold leading-snug text-ink transition-colors group-hover:text-primary sm:text-2xl">
          {evento?.titulo || 'Evento'}
        </h3>
        {price != null && (
          <p className="text-sm font-semibold text-ink">Desde {formatBs(price)}</p>
        )}
        <div className="mt-auto border-t border-border pt-3">
          <Link
            to={`/eventos/${evento.id}`}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary-soft py-2.5 text-sm font-bold text-primary transition-all duration-200 hover:bg-primary hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-focus"
          >
            Ver evento
            <svg className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </div>
      </div>
    </article>
  )
}
