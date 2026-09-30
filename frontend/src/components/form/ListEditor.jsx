import { useState } from 'react'
import { IconPlus, IconX } from '../ui/icons'

/**
 * Lista de elementos cortos (servicios, beneficios): se escribe uno,
 * se agrega con el botón o con Enter y se quita con la X.
 * `onPendingChange` avisa si quedó texto escrito sin agregar.
 */
export default function ListEditor({
  id,
  items,
  onChange,
  onPendingChange,
  placeholder,
  maxItems = 30,
  maxLength = 80,
  emptyText,
}) {
  const [text, setText] = useState('')
  const [error, setError] = useState('')

  const updateText = (value) => {
    setText(value)
    setError('')
    onPendingChange?.(value.trim())
  }

  const add = () => {
    const value = text.trim().replace(/\s+/g, ' ')
    if (!value) return
    if (value.length < 2) {
      setError('Escribe al menos 2 caracteres.')
      return
    }
    if (items.some((i) => i.toLowerCase() === value.toLowerCase())) {
      setError(`"${value}" ya está en la lista.`)
      return
    }
    if (items.length >= maxItems) {
      setError(`Puedes agregar hasta ${maxItems} elementos.`)
      return
    }
    onChange([...items, value])
    updateText('')
  }

  const remove = (index) => onChange(items.filter((_, i) => i !== index))

  const full = items.length >= maxItems

  return (
    <div>
      <div className="flex gap-2">
        <input
          id={id}
          className="input"
          value={text}
          maxLength={maxLength}
          placeholder={full ? `Máximo ${maxItems} elementos` : placeholder}
          disabled={full}
          onChange={(e) => updateText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
        />
        <button type="button" className="btn-secondary shrink-0" onClick={add} disabled={full || !text.trim()}>
          <IconPlus />
          Agregar
        </button>
      </div>
      {error && <p className="field-error">{error}</p>}

      {items.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {items.map((item, index) => (
            <li
              key={item}
              className="inline-flex items-center gap-1 rounded border border-border bg-page py-1 pl-2.5 pr-1 text-sm text-ink"
            >
              {item}
              <button
                type="button"
                onClick={() => remove(index)}
                className="rounded p-1 text-muted transition hover:bg-red-50 hover:text-red-600"
                aria-label={`Quitar ${item}`}
              >
                <IconX className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        emptyText && <p className="mt-3 text-sm text-muted">{emptyText}</p>
      )}
    </div>
  )
}
