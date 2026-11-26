/** Códigos de país frecuentes (Bolivia primero). */
export const PHONE_COUNTRY_CODES = [
  { code: '+591', label: 'BO +591' },
  { code: '+54', label: 'AR +54' },
  { code: '+56', label: 'CL +56' },
  { code: '+51', label: 'PE +51' },
  { code: '+595', label: 'PY +595' },
  { code: '+55', label: 'BR +55' },
  { code: '+57', label: 'CO +57' },
  { code: '+52', label: 'MX +52' },
  { code: '+1', label: 'US/CA +1' },
  { code: '+34', label: 'ES +34' },
]

const CODE_SET = PHONE_COUNTRY_CODES.map((c) => c.code).sort((a, b) => b.length - a.length)

/** Separa un teléfono guardado ("+591 71234567") en código + número local. */
export function splitPhone(raw) {
  const value = String(raw || '').trim()
  if (!value) return { countryCode: '+591', number: '' }
  const normalized = value.replace(/\s+/g, ' ')
  for (const code of CODE_SET) {
    if (normalized.startsWith(code)) {
      return { countryCode: code, number: normalized.slice(code.length).replace(/^[\s\-()]+/, '') }
    }
  }
  if (normalized.startsWith('+')) {
    const m = normalized.match(/^(\+\d{1,3})\s*(.*)$/)
    if (m) return { countryCode: m[1], number: m[2].replace(/^[\s\-()]+/, '') }
  }
  return { countryCode: '+591', number: normalized.replace(/^0+/, '') }
}

export function joinPhone(countryCode, number) {
  const n = String(number || '').replace(/[^\d]/g, '')
  if (!n) return ''
  return `${countryCode} ${n}`.trim()
}

export function isValidLocalPhone(number) {
  const digits = String(number || '').replace(/\D/g, '')
  return digits.length >= 7 && digits.length <= 15
}
