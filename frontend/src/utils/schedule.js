export const MAX_EVENT_SPAN_DAYS = 365

export function todayLocal() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function daysBetween(start, end) {
  const a = new Date(`${start}T00:00:00Z`)
  const b = new Date(`${end}T00:00:00Z`)
  return Math.round((b - a) / (1000 * 60 * 60 * 24))
}

/**
 * Mismas reglas que valida la API para la duración del evento.
 * `existingDays` (al editar) permite conservar días del evento que ya pasaron;
 * solo los días nuevos deben ser desde hoy.
 */
export function validateSchedule(
  { fechaInicio, fechaFin, horaInicio, horaFin, variosDias },
  { existingDays = null } = {},
) {
  const today = todayLocal()
  const isPastNew = (day) => day < today && !(existingDays && existingDays.has(day))

  const fechaLabel = variosDias ? 'la fecha de inicio' : 'la fecha del evento'
  if (!fechaInicio) return `Selecciona ${fechaLabel}.`
  if (isPastNew(fechaInicio)) return `${variosDias ? 'La fecha de inicio' : 'La fecha del evento'} no puede ser anterior a hoy.`
  if (!horaInicio || !horaFin) return 'Indica la hora de inicio y la hora de fin del evento.'
  if (horaFin <= horaInicio) return 'La hora de fin debe ser posterior a la hora de inicio.'

  if (!variosDias) return ''

  if (!fechaFin) return 'Selecciona la fecha de fin.'
  if (isPastNew(fechaFin)) return 'La fecha de fin no puede ser anterior a hoy.'
  if (fechaInicio === fechaFin) {
    return 'Las fechas de inicio y fin son iguales. Si el evento es de un solo día, desmarca "Evento de varios días".'
  }
  if (fechaInicio > fechaFin) return 'La fecha de inicio no puede ser posterior a la fecha de fin.'
  if (daysBetween(fechaInicio, fechaFin) > MAX_EVENT_SPAN_DAYS) {
    return 'Entre la fecha de inicio y la fecha de fin solo puede haber hasta 1 año de diferencia.'
  }
  return ''
}
