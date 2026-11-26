import { useEffect, useState } from 'react'
import { IconChevronLeft, IconChevronRight } from '../ui/icons'
import { compareDays, isValidDayString, toYmdFromDate } from '../../utils/dateRangeValidation'

const WEEK = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá']

function monthStartYmd(ymd) {
  if (!isValidDayString(ymd)) {
    const now = new Date()
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`
  }
  return `${ymd.slice(0, 7)}-01`
}

function addMonthsYmd(ymdMonthStart, delta) {
  const [y, m] = ymdMonthStart.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1 + delta, 1))
  return toYmdFromDate(dt)
}

function daysInMonth(ymdMonthStart) {
  const [y, m] = ymdMonthStart.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

function buildMonthGrid(ymdMonthStart) {
  const [y, m] = ymdMonthStart.split('-').map(Number)
  const firstDow = new Date(Date.UTC(y, m - 1, 1)).getUTCDay()
  const total = daysInMonth(ymdMonthStart)
  const cells = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= total; d++) {
    const mm = String(m).padStart(2, '0')
    const dd = String(d).padStart(2, '0')
    cells.push(`${y}-${mm}-${dd}`)
  }
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

function monthTitle(ymdMonthStart) {
  const [y, m] = ymdMonthStart.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1, 1))
  const raw = d.toLocaleDateString('es-BO', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

function normalizeRange(start, end) {
  const a = start && isValidDayString(start) ? start : null
  const b = end && isValidDayString(end) ? end : null
  if (!a) return { start: null, end: b, valid: false }
  if (!b) return { start: a, end: null, valid: false }
  if (compareDays(a, b) <= 0) return { start: a, end: b, valid: true }
  return { start: b, end: a, valid: true }
}

function dayClassForRange(day, rangeStart, rangeEnd, rangeValid) {
  if (!day) return 'ev-air-cal-day ev-air-cal-day--pad'
  let cls = 'ev-air-cal-day'
  if (!rangeStart) return cls

  const isStart = day === rangeStart
  const isEnd = rangeEnd && day === rangeEnd

  if (isStart) cls += ' is-edge is-start'
  if (isEnd) cls += ' is-edge is-end'

  if (rangeValid && rangeEnd && compareDays(rangeStart, day) < 0 && compareDays(day, rangeEnd) < 0) {
    cls += ' in-range'
  }

  return cls
}

function CalendarMonth({ roleLabel, anchor, onAnchorChange, rangeStart, rangeEnd, rangeValid, onPick }) {
  const cells = buildMonthGrid(anchor)

  return (
    <div className="ev-air-cal-month ev-air-cal-month--solo">
      <div className="ev-air-cal-head">
        <button
          type="button"
          className="ev-air-cal-nav"
          onClick={() => onAnchorChange(addMonthsYmd(anchor, -1))}
          aria-label={`Mes anterior (${roleLabel})`}
        >
          <IconChevronLeft className="h-3.5 w-3.5" />
        </button>
        <div className="min-w-0 text-center">
          <p className="ev-air-cal-role">{roleLabel}</p>
          <p className="ev-air-cal-month-title">{monthTitle(anchor)}</p>
        </div>
        <button
          type="button"
          className="ev-air-cal-nav"
          onClick={() => onAnchorChange(addMonthsYmd(anchor, 1))}
          aria-label={`Mes siguiente (${roleLabel})`}
        >
          <IconChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="ev-air-cal-week" aria-hidden="true">
        {WEEK.map((w) => (
          <span key={`${anchor}-${w}`} className="ev-air-cal-weekday">
            {w}
          </span>
        ))}
      </div>
      <div className="ev-air-cal-grid" role="grid">
        {cells.map((day, idx) =>
          day ? (
            <button
              key={`${anchor}-${day}`}
              type="button"
              role="gridcell"
              className={dayClassForRange(day, rangeStart, rangeEnd, rangeValid)}
              onClick={() => onPick(day)}
            >
              {Number(day.slice(8, 10))}
            </button>
          ) : (
            <span key={`${anchor}-pad-${idx}`} className="ev-air-cal-day ev-air-cal-day--pad" />
          ),
        )}
      </div>
    </div>
  )
}

export default function AirbnbRangeCalendar({
  mode,
  start,
  end,
  onSelectDay,
  onSelectStart,
  onSelectEnd,
}) {
  const [anchorStart, setAnchorStart] = useState(() => monthStartYmd(start || end))
  const [anchorEnd, setAnchorEnd] = useState(() => {
    const base = monthStartYmd(start || end)
    return end ? monthStartYmd(end) : addMonthsYmd(base, 1)
  })

  useEffect(() => {
    if (start) setAnchorStart(monthStartYmd(start))
  }, [start])

  useEffect(() => {
    if (end) setAnchorEnd(monthStartYmd(end))
    else if (start) setAnchorEnd((prev) => compareDays(monthStartYmd(start), prev) > 0 ? monthStartYmd(start) : prev)
  }, [end, start])

  const { start: rangeStart, end: rangeEnd, valid: rangeValid } = normalizeRange(start, end)

  if (mode === 'single') {
    const cells = buildMonthGrid(anchorStart)

    return (
      <div className="ev-air-cal ev-air-cal--single">
        <div className="ev-air-cal-head">
          <button
            type="button"
            className="ev-air-cal-nav"
            onClick={() => setAnchorStart((a) => addMonthsYmd(a, -1))}
            aria-label="Mes anterior"
          >
            <IconChevronLeft className="h-3.5 w-3.5" />
          </button>
          <p className="ev-air-cal-month-title">{monthTitle(anchorStart)}</p>
          <button
            type="button"
            className="ev-air-cal-nav"
            onClick={() => setAnchorStart((a) => addMonthsYmd(a, 1))}
            aria-label="Mes siguiente"
          >
            <IconChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="ev-air-cal-week" aria-hidden="true">
          {WEEK.map((w) => (
            <span key={w} className="ev-air-cal-weekday">
              {w}
            </span>
          ))}
        </div>
        <div className="ev-air-cal-grid" role="grid">
          {cells.map((day, idx) =>
            day ? (
              <button
                key={day}
                type="button"
                role="gridcell"
                className={`ev-air-cal-day${day === start ? ' is-edge is-selected' : ''}`}
                onClick={() => onSelectDay(day)}
              >
                {Number(day.slice(8, 10))}
              </button>
            ) : (
              <span key={`pad-${idx}`} className="ev-air-cal-day ev-air-cal-day--pad" />
            ),
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="ev-air-cal ev-air-cal--range">
      <div className="ev-air-cal-months ev-air-cal-months--pair">
        <CalendarMonth
          roleLabel="Inicio"
          anchor={anchorStart}
          onAnchorChange={setAnchorStart}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          rangeValid={rangeValid}
          onPick={onSelectStart}
        />
        <CalendarMonth
          roleLabel="Fin"
          anchor={anchorEnd}
          onAnchorChange={setAnchorEnd}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          rangeValid={rangeValid}
          onPick={onSelectEnd}
        />
      </div>
    </div>
  )
}