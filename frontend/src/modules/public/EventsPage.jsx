import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getPublishedEvents } from '../../api/events.api'
import EventCard from '../../components/EventCard'
import EventsExplorerToolbar from '../../components/events/EventsExplorerToolbar'
import { SkeletonGrid } from '../../components/ui/Skeleton'
import { asList, getErrorMessage } from '../../utils/format'
import { FILTER, collectTematicas, filterEvents } from '../../utils/eventFilters'

function haystack(evento) {
  const org = evento.organizador?.nombreProductora?.trim() || ''
  const ticketCats = (evento.categorias ?? []).map((c) => c.nombre).join(' ')
  const temaCats = (evento.categoriasEvento ?? [])
    .map((r) => r.categoriaEvento?.nombre)
    .filter(Boolean)
    .join(' ')
  const servicios = asList(evento.servicios).join(' ')
  const partes = [
    evento.titulo,
    evento.descripcion,
    evento.ubicacion,
    org,
    ticketCats,
    temaCats,
    servicios,
    evento.tipoAcceso,
  ]
  return partes.filter(Boolean).join(' ').toLowerCase()
}

function normalizeFiltro(raw) {
  if (!raw) return FILTER.all
  if (raw === 'semana' || raw === FILTER.week) return FILTER.week
  if (raw === 'mes' || raw === FILTER.month) return FILTER.month
  if (raw === 'todos' || raw === FILTER.all) return FILTER.all
  return raw
}

export default function EventsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [events, setEvents] = useState([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filtro, setFiltro] = useState(() => normalizeFiltro(searchParams.get('filtro')))

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const { data } = await getPublishedEvents()
        const list = Array.isArray(data) ? data : data?.data ?? data?.items ?? []
        if (alive) setEvents(list)
      } catch (err) {
        if (alive) setError(getErrorMessage(err))
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    setFiltro(normalizeFiltro(searchParams.get('filtro')))
  }, [searchParams])

  const tematicas = useMemo(() => collectTematicas(events), [events])

  const chips = useMemo(
    () => [
      { id: FILTER.all, label: 'Todos' },
      { id: FILTER.week, label: 'Esta semana' },
      { id: FILTER.month, label: 'Este mes' },
      ...tematicas.map((t) => ({ id: t.slug || t.id, label: t.nombre })),
    ],
    [tematicas],
  )

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    return filterEvents(events, filtro).filter((e) => {
      if (query && !haystack(e).includes(query)) return false
      return true
    })
  }, [events, q, filtro])

  function chooseFiltro(id) {
    setFiltro(id)
    const next = new URLSearchParams(searchParams)
    if (id === FILTER.all) next.delete('filtro')
    else next.set('filtro', id)
    setSearchParams(next, { replace: true })
  }

  function clearAllFilters() {
    setQ('')
    chooseFiltro(FILTER.all)
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold text-balance">Explorar eventos</h1>

      <EventsExplorerToolbar
        q={q}
        onQueryChange={setQ}
        filtro={filtro}
        onFiltroChange={chooseFiltro}
        chips={chips}
        onClearAll={clearAllFilters}
      />

      {error && <p className="mt-4 text-sm text-danger">{error}</p>}
      <div className="mt-8">
        {loading ? (
          <SkeletonGrid count={6} />
        ) : !events.length ? (
          <p className="text-muted">Por ahora no hay eventos publicados.</p>
        ) : filtered.length ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((e) => (
              <EventCard key={e.id} evento={e} />
            ))}
          </div>
        ) : (
          <p className="text-muted">No hay eventos con esos filtros.</p>
        )}
      </div>
    </div>
  )
}
