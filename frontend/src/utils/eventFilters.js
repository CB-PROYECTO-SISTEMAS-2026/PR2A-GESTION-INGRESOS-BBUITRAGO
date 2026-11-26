import { toDay } from './format'

export const FILTER = {
  all: 'all',
  week: 'week',
  month: 'month',
}

/** Bloques fijos de la home (por slug de CategoriaEvento). */
export const HOME_CATEGORY_SECTIONS = [
  { slug: 'conciertos', title: 'Conciertos' },
  { slug: 'cultura', title: 'Cultura' },
  { slug: 'ferias-expos', title: 'Ferias y expos' },
]

export function eventBounds(evento) {
  const fechas = evento?.fechas ?? []
  if (!fechas.length) return { start: '', end: '' }
  return { start: toDay(fechas[0].fecha), end: toDay(fechas[fechas.length - 1].fecha) }
}

export function intersects(evento, rangeStart, rangeEnd) {
  const { start, end } = eventBounds(evento)
  if (!start) return false
  const last = end || start
  return start <= rangeEnd && last >= rangeStart
}

export function weekRange(ref = new Date()) {
  const dow = ref.getDay()
  const mondayOffset = dow === 0 ? -6 : 1 - dow
  const monday = new Date(ref)
  monday.setDate(ref.getDate() + mondayOffset)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const fmt = (d) =>
    new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
  return { start: fmt(monday), end: fmt(sunday) }
}

export function monthRange(ref = new Date()) {
  const y = ref.getFullYear()
  const m = ref.getMonth()
  const start = `${y}-${String(m + 1).padStart(2, '0')}-01`
  const lastDay = new Date(y, m + 1, 0).getDate()
  const end = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { start, end }
}

/** "Noviembre" */
export function currentMonthName(ref = new Date()) {
  const raw = new Intl.DateTimeFormat('es-BO', { month: 'long' }).format(ref)
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

export function currentMonthSectionTitle(ref = new Date()) {
  return `Eventos de ${currentMonthName(ref)}`
}

export function eventHasSlug(evento, slug) {
  return (evento?.categoriasEvento ?? []).some((r) => r.categoriaEvento?.slug === slug)
}

export function collectTematicas(events) {
  const map = new Map()
  for (const ev of events) {
    for (const row of ev.categoriasEvento ?? []) {
      const cat = row.categoriaEvento
      if (cat?.id && cat?.nombre) {
        const key = cat.slug || cat.id
        if (!map.has(key)) {
          map.set(key, { id: cat.id, slug: cat.slug || '', nombre: cat.nombre })
        }
      }
    }
  }
  return [...map.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}

/** `filter`: all | week | month | slug de temática */
export function filterEvents(events, filter) {
  if (!filter || filter === FILTER.all) return events
  if (filter === FILTER.week) {
    const { start, end } = weekRange()
    return events.filter((e) => intersects(e, start, end))
  }
  if (filter === FILTER.month) {
    const { start, end } = monthRange()
    return events.filter((e) => intersects(e, start, end))
  }
  return events.filter((e) => eventHasSlug(e, filter) || (e.categoriasEvento ?? []).some((r) => r.categoriaEvento?.id === filter))
}
