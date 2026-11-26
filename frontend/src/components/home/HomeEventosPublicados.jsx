import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import EventCard from '../EventCard'
import { SkeletonGrid } from '../ui/Skeleton'
import { eventImage } from '../../utils/format'
import {
  HOME_CATEGORY_SECTIONS,
  currentMonthSectionTitle,
  eventHasSlug,
  filterEvents,
  FILTER,
} from '../../utils/eventFilters'

function VerMasCard({ to = '/eventos', previewSrcs = [] }) {
  const srcs = previewSrcs.filter(Boolean).slice(0, 4)
  return (
    <Link
      to={to}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-focus"
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-page">
        {srcs.length > 0 ? (
          <div
            className={`grid h-full w-full gap-px bg-border ${srcs.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}
          >
            {srcs.map((src, i) => (
              <div key={i} className="flex items-center justify-center bg-page p-1">
                <img src={src} alt="" className="max-h-full max-w-full object-contain" loading="lazy" />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center bg-primary-soft/40" />
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-ink/45 p-4 backdrop-blur-[2px] transition group-hover:bg-ink/55">
          <span className="text-center font-display text-lg font-bold text-white sm:text-xl">
            Ver más eventos
          </span>
        </div>
      </div>
      <div className="flex flex-1 flex-col justify-center gap-1 p-4 sm:p-5">
        <p className="text-sm font-semibold text-primary">Explorar agenda</p>
        <p className="text-xs text-muted">Todos los eventos publicados</p>
      </div>
    </Link>
  )
}

function EventBlock({ title, events, moreTo }) {
  if (!events.length) return null
  const visible = events.slice(0, 4)
  const rest = events.slice(4, 8).map((e) => eventImage(e)).filter(Boolean)
  const previewSrcs = rest.length ? rest : visible.map((e) => eventImage(e)).filter(Boolean)

  return (
    <div className="mt-12 first:mt-8">
      <h3 className="font-display text-xl font-bold text-ink sm:text-2xl">{title}</h3>
      <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {visible.map((ev) => (
          <EventCard key={ev.id} evento={ev} />
        ))}
        <VerMasCard to={moreTo} previewSrcs={previewSrcs} />
      </div>
    </div>
  )
}

export default function HomeEventosPublicados({ events = [], loading = false }) {
  const monthTitle = useMemo(() => currentMonthSectionTitle(), [])
  const monthEvents = useMemo(() => filterEvents(events, FILTER.month), [events])
  const categoryBlocks = useMemo(
    () =>
      HOME_CATEGORY_SECTIONS.map((section) => ({
        ...section,
        events: events.filter((e) => eventHasSlug(e, section.slug)),
      })),
    [events],
  )

  return (
    <section id="eventos" tabIndex={-1} className="mx-auto max-w-6xl scroll-mt-24 px-5 py-16">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">Agenda</p>
          <h2 className="ev-section-title mt-2 text-balance">Eventos publicados</h2>
        </div>
        <Link
          to="/eventos"
          className="btn-secondary inline-flex shrink-0 items-center gap-2 self-start !rounded-full !px-5 !py-2.5 text-sm sm:self-auto"
        >
          Ver todos
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
          </svg>
        </Link>
      </div>

      {loading ? (
        <div className="mt-8">
          <SkeletonGrid count={5} className="sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5" />
        </div>
      ) : events.length === 0 ? (
        <p className="mt-8 text-muted">No hay eventos publicados en este momento.</p>
      ) : (
        <>
          <EventBlock title={monthTitle} events={monthEvents} moreTo="/eventos?filtro=month" />
          {categoryBlocks.map((block) => (
            <EventBlock
              key={block.slug}
              title={block.title}
              events={block.events}
              moreTo={`/eventos?filtro=${encodeURIComponent(block.slug)}`}
            />
          ))}
        </>
      )}
    </section>
  )
}
