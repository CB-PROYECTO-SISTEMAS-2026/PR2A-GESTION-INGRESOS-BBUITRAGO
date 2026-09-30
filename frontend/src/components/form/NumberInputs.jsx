import { MAX_CAPACIDAD, MAX_PRECIO } from '../../utils/validation'

const BLOCKED_KEYS = new Set(['-', '+', 'e', 'E', '.', ','])

/**
 * Solo acepta dígitos: bloquea letras, símbolos, signos y decimales,
 * y no deja escribir un valor mayor a `max`.
 */
export function IntegerInput({ value, onChange, max = MAX_CAPACIDAD, className = 'input', ...props }) {
  const handleChange = (e) => {
    const raw = e.target.value
    if (raw === '') {
      onChange('')
      return
    }
    if (!/^\d+$/.test(raw)) return
    const normalized = raw.replace(/^0+(?=\d)/, '')
    if (Number(normalized) > max) return
    onChange(normalized)
  }

  return (
    <input
      {...props}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      className={className}
      value={value ?? ''}
      onChange={handleChange}
      onKeyDown={(e) => {
        if (BLOCKED_KEYS.has(e.key)) e.preventDefault()
        props.onKeyDown?.(e)
      }}
    />
  )
}

/** Montos en bolivianos: enteros o con hasta 2 decimales, sin signos ni letras. */
export function MoneyInput({ value, onChange, max = MAX_PRECIO, className = 'input', ...props }) {
  const handleChange = (e) => {
    const raw = e.target.value.replace(',', '.')
    if (raw === '') {
      onChange('')
      return
    }
    if (!/^\d+(\.\d{0,2})?$/.test(raw)) return
    const normalized = raw.replace(/^0+(?=\d)/, '')
    if (Number(normalized) > max) return
    onChange(normalized)
  }

  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-sm font-semibold text-muted">
        Bs
      </span>
      <input
        {...props}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        className={`${className} pl-11`}
        value={value ?? ''}
        onChange={handleChange}
        onKeyDown={(e) => {
          if (e.key === '-' || e.key === '+' || e.key === 'e' || e.key === 'E') e.preventDefault()
          props.onKeyDown?.(e)
        }}
      />
    </div>
  )
}
