import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { getMySaldo } from '../../api/users.api'
import { formatBs } from '../../utils/format'

/**
 * Saldo del cliente en los eventos que se realizan hoy y para los que tiene entrada.
 * Cada evento tiene su propio saldo; fuera de esos días no se muestra nada.
 */
export default function SaldoEvento() {
  const [eventos, setEventos] = useState([])
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const { pathname } = useLocation()

  const load = useCallback(() => {
    getMySaldo()
      .then(({ data }) => setEventos(Array.isArray(data?.eventos) ? data.eventos : []))
      .catch(() => setEventos([]))
  }, [])

  useEffect(() => {
    load()
  }, [load, pathname])

  useEffect(() => {
    const onFocus = () => load()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [load])

  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  if (!eventos.length) return null

  if (eventos.length === 1) {
    const [e] = eventos
    return (
      <div className="max-w-44 border-l-2 border-teal pl-3" title={`Saldo en ${e.titulo}`}>
        <p className="truncate text-[11px] font-medium uppercase tracking-wide text-slate-400">{e.titulo}</p>
        <p className="text-sm font-semibold leading-tight text-white">{formatBs(e.saldo)}</p>
      </div>
    )
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="border-l-2 border-teal pl-3 text-left transition hover:opacity-80"
      >
        <span className="block text-[11px] font-medium uppercase tracking-wide text-slate-400">Saldo de hoy</span>
        <span className="block text-sm font-semibold leading-tight text-white">{eventos.length} eventos ▾</span>
      </button>
      {open && (
        <ul className="absolute right-0 z-50 mt-2 max-h-64 w-64 divide-y divide-border overflow-y-auto rounded-md border border-border bg-white text-ink shadow-lg">
          {eventos.map((e) => (
            <li key={e.eventoId} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
              <span className="truncate">{e.titulo}</span>
              <span className="shrink-0 font-semibold">{formatBs(e.saldo)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
