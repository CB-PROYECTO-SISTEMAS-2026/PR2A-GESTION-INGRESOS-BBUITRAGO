import { useEffect, useMemo, useState } from 'react'
import { getPublishedEvents } from '../../api/events.api'
import EventCard from '../../components/EventCard'
import { getErrorMessage } from '../../utils/format'

export default function EventsPage() {
  const [events, setEvents] = useState([])
  const [q, setQ] = useState('')
  const [ubicacion, setUbicacion] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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

  const filtered = useMemo(() => {
    return events.filter((e) => {
      const matchQ =
        !q ||
        e.titulo?.toLowerCase().includes(q.toLowerCase()) ||
        e.descripcion?.toLowerCase().includes(q.toLowerCase())
      const matchLoc =
        !ubicacion || e.ubicacion?.toLowerCase().includes(ubicacion.toLowerCase())
      return matchQ && matchLoc
    })
  }, [events, q, ubicacion])

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold">Explorar eventos</h1>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <input
          className="input"
          placeholder="Buscar por título…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <input
          className="input"
          placeholder="Ubicación"
          value={ubicacion}
          onChange={(e) => setUbicacion(e.target.value)}
        />
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      <div className="mt-8">
        {loading ? (
          <p className="text-muted">Cargando…</p>
        ) : !events.length ? (
          <p className="text-muted">Por ahora no hay eventos publicados.</p>
        ) : filtered.length ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((e) => (
              <EventCard key={e.id} evento={e} />
            ))}
          </div>
        ) : (
          <p className="text-muted">No se encontraron eventos con esos filtros.</p>
        )}
      </div>
    </div>
  )
}
