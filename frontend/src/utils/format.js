import DEFAULT_EVENT_IMAGE from '../assets/img_evento_default.jpg'

export function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleDateString('es-BO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** "AAAA-MM-DD" de una columna DATE (llega como medianoche UTC). */
export function toDay(value) {
  if (!value) return ''
  return String(value).slice(0, 10)
}

/** Formatea un día calendario sin corrimiento por zona horaria. */
export function formatDay(value, options = { day: 'numeric', month: 'short', year: 'numeric' }) {
  const day = toDay(value)
  if (!day) return '—'
  const d = new Date(`${day}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleDateString('es-BO', { ...options, timeZone: 'UTC' })
}

/** "5 dic 2026" o "5 dic 2026 – 7 dic 2026" según el evento dure uno o varios días. */
export function formatDayRange(start, end) {
  if (!start) return '—'
  if (!end || toDay(end) === toDay(start)) return formatDay(start)
  return `${formatDay(start)} – ${formatDay(end)}`
}

export function eventDayRange(evento) {
  const fechas = evento?.fechas ?? []
  if (!fechas.length) return '—'
  return formatDayRange(fechas[0].fecha, fechas[fechas.length - 1].fecha)
}

/** Horario común de todos los días del evento, p. ej. "19:00 – 23:00". */
export function formatHorario(horaInicio, horaFin) {
  if (!horaInicio || !horaFin) return ''
  return `${horaInicio} – ${horaFin}`
}

export function isPdfUrl(url) {
  return /\.pdf($|\?)/i.test(url || '') || /\/raw\/upload\//.test(url || '')
}

/** Ej. "15 SEP 2026 · 09:00" para cards del homepage (Figma). */
export function formatEventCardDate(fecha, hora) {
  if (!fecha && !hora) return '—'
  const d = fecha ? new Date(fecha) : null
  const datePart =
    d && !Number.isNaN(d.getTime())
      ? d
          .toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' })
          .replace(/\./g, '')
          .toUpperCase()
      : ''
  const timePart = hora ? String(hora).slice(0, 5) : ''
  if (datePart && timePart) return `${datePart} · ${timePart}`
  return datePart || timePart || '—'
}

export function formatDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleString('es-BO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function lowestPrice(evento) {
  const cats = evento?.categorias ?? []
  if (!cats.length) return null
  const prices = cats.map((c) => Number(c.precio)).filter((n) => !Number.isNaN(n))
  if (!prices.length) return null
  return Math.min(...prices)
}

export function getErrorMessage(error, fallback = 'Ocurrió un error') {
  const status = error?.response?.status
  if (status === 429) return 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.'
  if (error && !error.response && error.request) {
    return 'No se pudo conectar con el servidor. Revisa tu conexión.'
  }
  const message = error?.response?.data?.message
  if (Array.isArray(message)) {
    return [...new Set(message.map((m) => (/[.!?]$/.test(m) ? m : `${m}.`)))].join(' ')
  }
  return message || error?.response?.data?.error || error?.message || fallback
}

export { DEFAULT_EVENT_IMAGE }

export function eventImage(evento) {
  const url = String(evento?.fotoUrl || '').trim()
  return url || DEFAULT_EVENT_IMAGE
}

export function formatBs(value) {
  const n = Number(value)
  if (Number.isNaN(n)) return 'Bs —'
  return `Bs ${n.toLocaleString('es-BO', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`
}

/** Las listas (servicios, beneficios) llegan como arreglo JSON desde la API. */
export function asList(value) {
  return Array.isArray(value) ? value.filter((v) => typeof v === 'string' && v.trim()) : []
}

export function asCronograma(value) {
  if (!value || typeof value !== 'object' || !value.apertura || !value.cierre) return null
  return {
    apertura: value.apertura,
    cierre: value.cierre,
    actividades: Array.isArray(value.actividades) ? value.actividades : [],
  }
}
