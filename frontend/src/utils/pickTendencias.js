import { localDay, toDay } from './format'

/**
 * Destacados para Tendencias (home).
 * Criterio de negocio Eventix (sin flag en API):
 * 1. Flyer real (fotoUrl) — el carrusel vende con imagen.
 * 2. Fecha próxima — urgencia de compra.
 * 3. Más categorías de entrada — oferta comercial más completa.
 * 4. spotifyUrl — descubrimiento musical, producto más rico.
 * 5. ubicación — ficha lista para decidir asistencia.
 */
function daysUntilNextFecha(evento, today) {
  const days = (evento?.fechas ?? [])
    .map((f) => toDay(f.fecha))
    .filter(Boolean)
    .sort()
  const upcoming = days.find((d) => d >= today)
  const target = upcoming || days[days.length - 1]
  if (!target) return 999
  const a = Date.parse(`${today}T00:00:00Z`)
  const b = Date.parse(`${target}T00:00:00Z`)
  if (Number.isNaN(a) || Number.isNaN(b)) return 999
  return Math.round((b - a) / 86400000)
}

function scoreEvent(evento, today) {
  const days = daysUntilNextFecha(evento, today)
  const proximity = days < 0 ? Math.max(0, 20 + days) : Math.max(0, 100 - days)
  const ticketCats = Array.isArray(evento?.categorias) ? evento.categorias.length : 0
  const spotify = String(evento?.spotifyUrl || '').trim() ? 25 : 0
  const place = String(evento?.ubicacion || '').trim() ? 10 : 0
  return proximity + ticketCats * 8 + spotify + place
}

export function pickTendencias(events = [], limit = 5) {
  const today = localDay()
  return [...events]
    .filter((e) => String(e?.fotoUrl || '').trim())
    .map((e) => ({ e, score: scoreEvent(e, today) }))
    .sort((a, b) => b.score - a.score || String(a.e.titulo || '').localeCompare(String(b.e.titulo || ''), 'es'))
    .slice(0, limit)
    .map(({ e }) => e)
}
