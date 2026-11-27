import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { getMisSaldos } from '../../api/recargas.api'
import { IconWallet } from '../ui/icons'
import { formatBs } from '../../utils/format'

function sortSaldos(items) {
  return [...items].sort((a, b) => {
    const da = Number(a.saldo) || 0
    const db = Number(b.saldo) || 0
    if (db !== da) return db - da
    return String(a.titulo || '').localeCompare(String(b.titulo || ''), 'es')
  })
}

/** Monedero compacto en el navbar: chip con total y panel desplegable. */
export default function SaldoEvento() {
  const [saldos, setSaldos] = useState([])
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const { pathname } = useLocation()

  const load = useCallback(() => {
    getMisSaldos()
      .then(({ data }) => setSaldos(Array.isArray(data?.saldos) ? data.saldos : []))
      .catch(() => setSaldos([]))
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
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const ordenados = useMemo(() => sortSaldos(saldos), [saldos])

  const totalConSaldo = useMemo(
    () => ordenados.filter((s) => Number(s.saldo) > 0).reduce((acc, s) => acc + Number(s.saldo), 0),
    [ordenados],
  )

  if (!saldos.length) return null

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
        className="flex max-w-[9.5rem] items-center gap-2 rounded-lg border border-sidebar-border bg-sidebar-hover px-2.5 py-1.5 text-left transition hover:border-primary-focus focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-focus sm:max-w-none sm:px-3"
      >
        <IconWallet className="h-4 w-4 shrink-0 text-primary-focus" aria-hidden="true" />
        <span className="min-w-0">
          <span className="block truncate text-[10px] font-semibold uppercase tracking-wide text-slate-400">Monedero</span>
          <span className="block text-sm font-semibold tabular-nums leading-tight text-white">{formatBs(totalConSaldo)}</span>
        </span>
      </button>

      {open && (
        <div
          className="ev-nav-saldo-panel absolute right-0 z-50 mt-2 w-[min(18rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-border bg-surface text-ink shadow-lg"
          role="dialog"
          aria-label="Saldos por evento"
        >
          <div className="border-b border-border px-3 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Tus saldos</p>
            <p className="mt-0.5 font-display text-lg font-bold tabular-nums text-ink">{formatBs(totalConSaldo)}</p>
          </div>

          <ul className="ev-nav-saldo-list max-h-56 divide-y divide-border overflow-y-auto">
            {ordenados.map((e) => {
              const monto = Number(e.saldo)
              const sinSaldo = !Number.isFinite(monto) || monto <= 0
              return (
                <li key={e.eventoId} className="px-3 py-2.5">
                  <p className="text-sm font-medium leading-snug text-ink" title={e.titulo}>
                    {e.titulo}
                  </p>
                  <p
                    className={`mt-0.5 text-sm font-semibold tabular-nums ${sinSaldo ? 'text-muted' : 'text-success'}`}
                  >
                    {formatBs(e.saldo)}
                  </p>
                </li>
              )
            })}
          </ul>

          <div className="border-t border-border p-2">
            <Link
              to="/mi-manilla"
              onClick={() => setOpen(false)}
              className="block rounded-md px-2 py-2 text-center text-sm font-semibold text-primary hover:bg-primary-soft"
            >
              Ver mi manilla
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}