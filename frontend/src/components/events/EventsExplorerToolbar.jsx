import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { getEventSearchSuggestions, recordEventSearch } from '../../api/events.api'
import { getEventSearchVisitorKey } from '../../utils/eventSearchVisitor'
import { FILTER } from '../../utils/eventFilters'
import { IconClock, IconSearch, IconX } from '../ui/icons'

function highlightMatch(text, query) {
  const q = query.trim().toLowerCase()
  if (!q) return text
  const lower = text.toLowerCase()
  const idx = lower.indexOf(q)
  if (idx < 0) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded bg-primary-soft px-0.5 text-ink not-italic">{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  )
}

function filterList(items, query) {
  const q = query.trim().toLowerCase()
  if (!q) return items
  return items.filter((item) => item.toLowerCase().includes(q))
}

export default function EventsExplorerToolbar({
  q,
  onQueryChange,
  filtro,
  onFiltroChange,
  chips,
  onClearAll,
}) {
  const listId = useId()
  const inputRef = useRef(null)
  const rootRef = useRef(null)
  const recordTimerRef = useRef(null)
  const lastRecordedRef = useRef('')
  const [focused, setFocused] = useState(false)
  const [populares, setPopulares] = useState([])
  const [recientes, setRecientes] = useState([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)

  const activeChip = useMemo(() => chips.find((c) => c.id === filtro), [chips, filtro])
  const hasFilters = Boolean(q.trim()) || filtro !== FILTER.all
  const visitorKey = useMemo(() => getEventSearchVisitorKey(), [])

  const loadSuggestions = useCallback(async () => {
    setSuggestionsLoading(true)
    try {
      const { data } = await getEventSearchSuggestions(visitorKey)
      setPopulares(Array.isArray(data?.populares) ? data.populares : [])
      setRecientes(Array.isArray(data?.recientes) ? data.recientes : [])
    } catch {
      /* sin datos hasta que existan tablas o haya búsquedas */
    } finally {
      setSuggestionsLoading(false)
    }
  }, [visitorKey])

  const commitSearch = useCallback(
    async (raw, { refresh = true } = {}) => {
      const termino = raw.replace(/\s+/g, ' ').trim()
      if (termino.length < 2) return
      if (termino.toLowerCase() === lastRecordedRef.current) return
      lastRecordedRef.current = termino.toLowerCase()
      try {
        const { data } = await recordEventSearch(termino, visitorKey)
        if (refresh) {
          setPopulares(Array.isArray(data?.populares) ? data.populares : [])
          setRecientes(Array.isArray(data?.recientes) ? data.recientes : [])
        }
      } catch {
        /* no bloquear la UI */
      }
    },
    [visitorKey],
  )

  const popularesFiltrados = useMemo(() => filterList(populares, q), [populares, q])
  const recientesFiltrados = useMemo(() => filterList(recientes, q), [recientes, q])
  const showDropdown = focused

  useEffect(() => {
    function onDocPointer(e) {
      if (!rootRef.current?.contains(e.target)) setFocused(false)
    }
    document.addEventListener('pointerdown', onDocPointer)
    return () => document.removeEventListener('pointerdown', onDocPointer)
  }, [])

  useEffect(() => {
    if (!focused) return undefined
    loadSuggestions()
    return undefined
  }, [focused, loadSuggestions])

  useEffect(() => {
    const termino = q.replace(/\s+/g, ' ').trim()
    if (termino.length < 2) {
      lastRecordedRef.current = ''
      return undefined
    }
    if (recordTimerRef.current) window.clearTimeout(recordTimerRef.current)
    recordTimerRef.current = window.setTimeout(() => {
      commitSearch(termino)
    }, 900)
    return () => {
      if (recordTimerRef.current) window.clearTimeout(recordTimerRef.current)
    }
  }, [q, commitSearch])

  function pickSuggestion(text) {
    onQueryChange(text)
    setFocused(true)
    inputRef.current?.focus()
    commitSearch(text, { refresh: true })
  }

  function renderSection(title, icon, items, prefix) {
    if (!items.length) return null
    return (
      <li role="presentation" className="px-1 pt-1">
        <p className="px-2 py-1.5 text-[0.65rem] font-semibold tracking-wide text-muted uppercase">{title}</p>
        <ul className="space-y-0.5">
          {items.map((item) => (
            <li key={`${prefix}-${item}`} role="presentation">
              <button
                type="button"
                role="option"
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-ink transition hover:bg-page focus-visible:bg-page focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-focus"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pickSuggestion(item)}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-page text-muted">
                  {icon}
                </span>
                {highlightMatch(item, q)}
              </button>
            </li>
          ))}
        </ul>
      </li>
    )
  }

  const emptyPanel =
    !suggestionsLoading &&
    !popularesFiltrados.length &&
    !recientesFiltrados.length &&
    !populares.length &&
    !recientes.length

  return (
    <section
      ref={rootRef}
      className="mt-6 overflow-hidden rounded-2xl border border-border bg-surface shadow-sm shadow-primary/5"
      aria-label="Buscar y filtrar eventos"
    >
      <div className="border-b border-border bg-linear-to-b from-primary-soft/50 via-primary-soft/15 to-surface px-4 py-4 sm:px-5 sm:py-5">
        <div
          className={`relative rounded-full border bg-surface p-1 shadow-[0_10px_40px_-18px] shadow-primary/30 transition-[border-color,box-shadow] ${
            focused ? 'border-primary/40 ring-2 ring-primary-focus/20' : 'border-border'
          }`}
        >
          <div className="flex items-stretch gap-0 sm:gap-1">
            <div className="flex min-w-0 flex-1 items-center gap-2 pl-3 sm:pl-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                <IconSearch className="h-4 w-4" strokeWidth={2.2} />
              </span>
              <input
                ref={inputRef}
                id={`${listId}-search`}
                className="min-w-0 flex-1 border-0 bg-transparent py-3 pr-2 text-base text-ink outline-none placeholder:text-muted sm:text-[0.975rem]"
                type="search"
                name="q"
                autoComplete="off"
                spellCheck={false}
                placeholder="Evento, lugar, productora o categoría…"
                value={q}
                onChange={(e) => onQueryChange(e.target.value)}
                onFocus={() => setFocused(true)}
                role="combobox"
                aria-expanded={showDropdown}
                aria-controls={showDropdown ? `${listId}-suggestions` : undefined}
                aria-autocomplete="list"
                aria-label="Buscar eventos"
              />
            </div>

            {q ? (
              <button
                type="button"
                className="my-1 mr-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-page hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-focus"
                onClick={() => onQueryChange('')}
                aria-label="Borrar búsqueda"
              >
                <IconX className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          {showDropdown ? (
            <ul
              id={`${listId}-suggestions`}
              className="absolute inset-x-0 top-[calc(100%+0.35rem)] z-20 max-h-72 overflow-y-auto rounded-2xl border border-border bg-surface p-1.5 shadow-lg shadow-ink/10"
              role="listbox"
            >
              {suggestionsLoading ? (
                <li className="px-3 py-4 text-sm text-muted" role="presentation">
                  Cargando sugerencias…
                </li>
              ) : null}
              {!suggestionsLoading &&
                renderSection(
                  'Más buscados',
                  <IconSearch className="h-3.5 w-3.5" />,
                  popularesFiltrados.slice(0, 3),
                  'pop',
                )}
              {!suggestionsLoading &&
                renderSection(
                  'Tus últimas búsquedas',
                  <IconClock className="h-3.5 w-3.5" />,
                  recientesFiltrados.slice(0, 3),
                  'mine',
                )}
              {emptyPanel ? (
                <li className="px-3 py-4 text-sm text-muted" role="presentation">
                  Escribí para buscar. Acá verás hasta 3 términos más buscados por todos y tus 3 últimas
                  búsquedas en este dispositivo.
                </li>
              ) : null}
            </ul>
          ) : null}
        </div>

        {activeChip && filtro !== FILTER.all ? (
          <p className="mt-3 sm:hidden">
            <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">
              {activeChip.label}
            </span>
          </p>
        ) : null}
      </div>

      <div className="px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">Explorar por</p>
          {hasFilters ? (
            <button
              type="button"
              className="text-xs font-semibold text-primary transition hover:text-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-focus"
              onClick={onClearAll}
            >
              Quitar filtros
            </button>
          ) : null}
        </div>

        <div
          className="mt-3 flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="toolbar"
          aria-label="Filtros rápidos"
        >
          {chips.map((chip) => {
            const active = filtro === chip.id
            return (
              <button
                key={chip.id}
                type="button"
                aria-pressed={active}
                onClick={() => onFiltroChange(chip.id)}
                className={`shrink-0 rounded-full border px-3.5 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-focus ${
                  active
                    ? 'border-primary bg-primary text-white shadow-sm shadow-primary/25'
                    : 'border-border bg-page text-muted hover:border-primary/35 hover:bg-primary-soft/40 hover:text-ink'
                }`}
              >
                {chip.label}
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}