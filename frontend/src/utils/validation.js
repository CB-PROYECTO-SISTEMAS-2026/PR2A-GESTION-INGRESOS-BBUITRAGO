export const MAX_CAPACIDAD = 20000
export const MAX_PRECIO = 100000

const nf = new Intl.NumberFormat('es-BO')
export const formatNumber = (n) => nf.format(Number(n) || 0)

/** Mismas reglas que la API: solo dígitos, entero entre `min` y `max`. */
export function validateInteger(value, { label, min = 1, max = MAX_CAPACIDAD, required = true } = {}) {
  const raw = String(value ?? '').trim()
  if (!raw) return required ? `Ingresa ${label}.` : ''
  if (!/^\d+$/.test(raw)) return `${capitalize(label)} debe ser un número entero, sin letras, símbolos ni decimales.`
  const n = Number(raw)
  if (n < min || n > max) return `${capitalize(label)} debe estar entre ${formatNumber(min)} y ${formatNumber(max)}.`
  return ''
}

export function validateMoney(value, { label = 'el precio', max = MAX_PRECIO } = {}) {
  const raw = String(value ?? '').trim()
  if (!raw) return `Ingresa ${label}.`
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return `${capitalize(label)} debe ser un monto válido, con hasta 2 decimales.`
  if (Number(raw) > max) return `${capitalize(label)} no puede superar ${formatNumber(max)} Bs.`
  return ''
}

export function isGoogleMapsUrl(value) {
  let url
  try {
    url = new URL(String(value || '').trim())
  } catch {
    return false
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false
  const host = url.hostname.toLowerCase()
  if (host === 'maps.app.goo.gl') return url.pathname.length > 1
  if (host === 'goo.gl') return url.pathname.startsWith('/maps')
  if (/^maps\.google\.[a-z.]+$/.test(host)) return true
  if (/^(www\.)?google\.[a-z.]+$/.test(host)) return url.pathname.startsWith('/maps')
  return false
}

export function validateMapsUrl(value) {
  if (!String(value || '').trim()) return 'Pega el enlace de Google Maps del lugar.'
  if (!isGoogleMapsUrl(value)) return 'El enlace debe ser de Google Maps (por ejemplo, https://maps.app.goo.gl/...).'
  return ''
}

/** Mismas reglas que la API para el cronograma (ver event-content.ts). */
/** La apertura y el cierre del cronograma son la hora de inicio y fin del evento. */
export function validateCronograma(actividades, { horaInicio, horaFin }) {
  for (const a of actividades) {
    if (!a.hora) return 'Cada actividad del cronograma necesita una hora.'
    if (a.actividad.trim().length < 2) return 'Describe cada actividad del cronograma.'
    if (horaInicio && horaFin && (a.hora < horaInicio || a.hora > horaFin)) {
      return `La actividad "${a.actividad.trim()}" debe estar entre ${horaInicio} y ${horaFin}.`
    }
  }
  return ''
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}
