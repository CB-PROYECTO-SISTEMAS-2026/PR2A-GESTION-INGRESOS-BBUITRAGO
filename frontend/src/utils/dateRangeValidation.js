/** Día calendario UTC "AAAA-MM-DD". */
export function isValidDayString(value) {
  if (!value || typeof value !== 'string') return false
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [y, m, d] = value.split('-').map((n) => Number(n))
  if (m < 1 || m > 12 || d < 1 || d > 31) return false
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

export function compareDays(a, b) {
  if (a === b) return 0
  return a < b ? -1 : 1
}

/**
 * @returns {{ ok: boolean, errors: Record<string, string>, desde: string, hasta: string }}
 */
export function validateEntradasDateFilter({ mode, desde, hasta }) {
  const errors = {}
  let d = (desde ?? '').trim()
  let h = (hasta ?? '').trim()

  if (!d && !h) {
    return { ok: true, errors, desde: '', hasta: '' }
  }

  if (mode === 'single') {
    const day = d || h
    if (!day) {
      errors.fecha = 'Elegí una fecha.'
      return { ok: false, errors, desde: '', hasta: '' }
    }
    if (!isValidDayString(day)) {
      errors.fecha = 'La fecha no es válida.'
      return { ok: false, errors, desde: '', hasta: '' }
    }
    return { ok: true, errors, desde: day, hasta: day }
  }

  if (!d) errors.desde = 'Indica la fecha de inicio.'
  else if (!isValidDayString(d)) errors.desde = 'Fecha de inicio inválida.'

  if (!h) errors.hasta = 'Indica la fecha de fin.'
  else if (!isValidDayString(h)) errors.hasta = 'Fecha de fin inválida.'

  if (d && h && isValidDayString(d) && isValidDayString(h) && compareDays(d, h) > 0) {
    errors.range = 'La fecha de inicio no puede ser posterior a la de fin.'
  }

  if (Object.keys(errors).length) {
    return { ok: false, errors, desde: d, hasta: h }
  }

  return { ok: true, errors, desde: d, hasta: h }
}

export function formatDayLabel(ymd) {
  if (!isValidDayString(ymd)) return '—'
  const d = new Date(`${ymd}T00:00:00Z`)
  return d.toLocaleDateString('es-BO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

export function toYmdFromDate(d) {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function addUtcMonths(ymd, delta) {
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1 + delta, 1))
  return toYmdFromDate(dt).slice(0, 8) + '01'
}