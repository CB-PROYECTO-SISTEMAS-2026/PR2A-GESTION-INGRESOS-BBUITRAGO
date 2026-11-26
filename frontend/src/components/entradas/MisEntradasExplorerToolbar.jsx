import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import AirbnbRangeCalendar from './AirbnbRangeCalendar'
import { IconCalendar, IconClock, IconSearch, IconX } from '../ui/icons'
import { formatDayLabel, isValidDayString, validateEntradasDateFilter } from '../../utils/dateRangeValidation'
import {
  pushMisComprasRecent,
  pushMisEntradasRecent,
  readMisComprasRecent,
  readMisEntradasRecent,
} from '../../utils/misEntradasSearchHistory'

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

const HISTORY = {
  entradas: { read: readMisEntradasRecent, push: pushMisEntradasRecent },
  compras: { read: readMisComprasRecent, push: pushMisComprasRecent },
}

export default function MisEntradasExplorerToolbar({
  userId,
  q,
  onQueryChange,
  dateMode,
  onDateModeChange,
  desde,
  hasta,
  onDatesApply,
  onClearAll,
  hasActiveFilters,
  listKind = 'entradas',
}) {
  const labels =
    listKind === 'compras'
      ? {
          section: 'Buscar y filtrar tus compras',
          search: 'Buscar en tus compras',
          placeholder: 'Evento, lugar, código o categoría…',
        }
      : {
          section: 'Buscar y filtrar tus entradas',
          search: 'Buscar en tus entradas',
          placeholder: 'Evento, lugar, código o categoría…',
        }
  const history = HISTORY[listKind] ?? HISTORY.entradas
  const listId = useId()
  const rootRef = useRef(null)
  const inputRef = useRef(null)
  const recordTimerRef = useRef(null)
  const lastRecordedRef = useRef('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [calOpen, setCalOpen] = useState(false)
  const [draftDesde, setDraftDesde] = useState(desde)
  const [draftHasta, setDraftHasta] = useState(hasta)
  const [dateErrors, setDateErrors] = useState({})
  const [recientes, setRecientes] = useState(() => history.read(userId))

  useEffect(() => {
    setDraftDesde(desde)
    setDraftHasta(hasta)
  }, [desde, hasta])

  useEffect(() => {
    setRecientes(history.read(userId))
  }, [userId, listKind, history])

  useEffect(() => {
    function onDocPointer(e) {
      if (!rootRef.current?.contains(e.target)) {
        setSearchFocused(false)
        setCalOpen(false)
      }
    }
    document.addEventListener('pointerdown', onDocPointer)
    return () => document.removeEventListener('pointerdown', onDocPointer)
  }, [])

  const commitSearchHistory = useCallback(
    (raw) => {
      const termino = raw.replace(/\s+/g, ' ').trim()
      if (termino.length < 2) return
      if (termino.toLowerCase() === lastRecordedRef.current) return
      lastRecordedRef.current = termino.toLowerCase()
      setRecientes(history.push(userId, termino))
    },
    [userId, history],
  )

  useEffect(() => {
    const termino = q.replace(/\s+/g, ' ').trim()
    if (termino.length < 2) {
      lastRecordedRef.current = ''
      return undefined
    }
    if (recordTimerRef.current) window.clearTimeout(recordTimerRef.current)
    recordTimerRef.current = window.setTimeout(() => commitSearchHistory(termino), 900)
    return () => {
      if (recordTimerRef.current) window.clearTimeout(recordTimerRef.current)
    }
  }, [q, commitSearchHistory])

  const recientesFiltrados = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return recientes.slice(0, 6)
    return recientes.filter((s) => s.toLowerCase().includes(term)).slice(0, 6)
  }, [recientes, q])

  const onSelectDay = (day) => {
    if (!isValidDayString(day)) return
    setDateErrors({})
    setDraftDesde(day)
    setDraftHasta(day)
  }

  const onSelectStart = (day) => {
    if (!isValidDayString(day)) return
    setDateErrors({})
    setDraftDesde(day)
  }

  const onSelectEnd = (day) => {
    if (!isValidDayString(day)) return
    setDateErrors({})
    setDraftHasta(day)
  }

  const applyDates = () => {
    const result = validateEntradasDateFilter({
      mode: dateMode,
      desde: dateMode === 'single' ? draftDesde || draftHasta : draftDesde,
      hasta: dateMode === 'single' ? draftDesde || draftHasta : draftHasta,
    })
    if (!result.ok) {
      setDateErrors(result.errors)
      return
    }
    setDateErrors({})
    onDatesApply({ desde: result.desde, hasta: result.hasta })
    setCalOpen(false)
  }

  const clearDates = () => {
    setDraftDesde('')
    setDraftHasta('')
    setDateErrors({})
    onDatesApply({ desde: '', hasta: '' })
  }

  const showDesde = calOpen ? draftDesde : desde || draftDesde
  const showHasta = calOpen ? draftHasta : hasta || draftHasta

  const fechaLabel =
    dateMode === 'single'
      ? formatDayLabel(showDesde || showHasta)
      : showDesde && showHasta
        ? `${formatDayLabel(showDesde)} – ${formatDayLabel(showHasta)}`
        : showDesde
          ? `${formatDayLabel(showDesde)} – …`
          : 'Elegir fechas'

  return (
    <section
      ref={rootRef}
      className="mt-6 overflow-visible rounded-2xl border border-border bg-surface shadow-sm shadow-primary/5"
      aria-label={labels.section}
    >
      <div className="border-b border-border bg-linear-to-b from-primary-soft/50 via-primary-soft/15 to-surface px-4 py-4 sm:px-5 sm:py-5">
        <div
          className={`relative rounded-full border bg-surface p-1 shadow-[0_10px_40px_-18px] shadow-primary/30 transition-[border-color,box-shadow] ${
            searchFocused ? 'border-primary/40 ring-2 ring-primary-focus/20' : 'border-border'
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
                placeholder={labels.placeholder}
                value={q}
                onChange={(e) => onQueryChange(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                role="combobox"
                aria-expanded={searchFocused}
                aria-controls={searchFocused ? `${listId}-suggestions` : undefined}
                aria-autocomplete="list"
                aria-label={labels.search}
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

          {searchFocused ? (
            <ul
              id={`${listId}-suggestions`}
              className="absolute inset-x-0 top-[calc(100%+0.35rem)] z-20 max-h-72 overflow-y-auto rounded-2xl border border-border bg-surface p-1.5 shadow-lg shadow-ink/10"
              role="listbox"
            >
              {recientesFiltrados.length ? (
                <li role="presentation" className="px-1 pt-1">
                  <p className="px-2 py-1.5 text-[0.65rem] font-semibold tracking-wide text-muted uppercase">
                    Tus últimas búsquedas
                  </p>
                  <ul className="space-y-0.5">
                    {recientesFiltrados.map((item) => (
                      <li key={item} role="presentation">
                        <button
                          type="button"
                          role="option"
                          className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-ink transition hover:bg-page focus-visible:bg-page focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-focus"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            onQueryChange(item)
                            commitSearchHistory(item)
                            inputRef.current?.focus()
                          }}
                        >
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-page text-muted">
                            <IconClock className="h-3.5 w-3.5" />
                          </span>
                          {highlightMatch(item, q)}
                        </button>
                      </li>
                    ))}
                  </ul>
                </li>
              ) : (
                <li className="px-3 py-4 text-sm text-muted" role="presentation">
                  Sin búsquedas recientes.
                </li>
              )}
            </ul>
          ) : null}
        </div>

        <div className="relative mt-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Tipo de fecha">
            <button
              type="button"
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                dateMode === 'single' ? 'border-primary bg-primary text-white' : 'border-border bg-page text-muted'
              }`}
              onClick={() => {
                onDateModeChange('single')
                setDraftHasta(draftDesde || draftHasta)
                setDateErrors({})
              }}
            >
              Un día
            </button>
            <button
              type="button"
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                dateMode === 'range' ? 'border-primary bg-primary text-white' : 'border-border bg-page text-muted'
              }`}
              onClick={() => {
                onDateModeChange('range')
                setDateErrors({})
              }}
            >
              Rango
            </button>
          </div>

          <div className="flex flex-wrap items-stretch gap-2">
            <button
              type="button"
              className={`flex min-h-10 min-w-0 flex-1 items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-focus ${
                calOpen ? 'border-primary/40 bg-primary-soft/30' : 'border-border bg-surface hover:border-primary/30'
              }`}
              onClick={() => setCalOpen((v) => !v)}
              aria-expanded={calOpen}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-page text-primary">
                <IconCalendar className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0">
                <span className="block text-[0.6rem] font-bold tracking-wide text-muted uppercase">Fecha</span>
                <span className="block truncate text-sm font-semibold text-ink">{fechaLabel}</span>
              </span>
            </button>
            <button
              type="button"
              className="btn-secondary btn-sm shrink-0 self-center"
              disabled={!desde && !hasta && !draftDesde && !draftHasta}
              onClick={clearDates}
            >
              Limpiar fechas
            </button>
          </div>

          {calOpen ? (
            <div
              className={`ev-air-cal-pop absolute inset-x-0 top-full z-50 mt-2 rounded-xl border border-border bg-surface p-3 shadow-xl shadow-ink/10 sm:left-auto sm:right-0 ${
                dateMode === 'single' ? 'sm:w-[17.5rem]' : 'sm:w-[min(100vw-2rem,34rem)]'
              }`}
            >
              <AirbnbRangeCalendar
                mode={dateMode}
                start={draftDesde}
                end={dateMode === 'single' ? draftDesde : draftHasta}
                onSelectDay={onSelectDay}
                onSelectStart={onSelectStart}
                onSelectEnd={onSelectEnd}
              />

              {dateErrors.fecha ? <p className="mt-2 text-xs text-danger">{dateErrors.fecha}</p> : null}
              {dateErrors.range ? <p className="mt-2 text-xs text-danger">{dateErrors.range}</p> : null}
              {dateErrors.desde ? <p className="mt-2 text-xs text-danger">{dateErrors.desde}</p> : null}
              {dateErrors.hasta ? <p className="mt-2 text-xs text-danger">{dateErrors.hasta}</p> : null}

              <div className="mt-3 flex justify-end border-t border-border pt-3">
                <button type="button" className="btn-primary btn-sm" onClick={applyDates}>
                  Aplicar
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {hasActiveFilters ? (
        <div className="flex justify-end border-t border-border px-4 py-3 sm:px-5">
          <button type="button" className="text-xs font-semibold text-primary hover:text-primary-hover" onClick={onClearAll}>
            Quitar filtros
          </button>
        </div>
      ) : null}
    </section>
  )
}