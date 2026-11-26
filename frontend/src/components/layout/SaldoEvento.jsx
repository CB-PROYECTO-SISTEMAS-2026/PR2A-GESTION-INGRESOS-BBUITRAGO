import { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { getMisSaldos } from '../../api/recargas.api'
import { formatBs } from '../../utils/format'

/** Saldos del cliente en el navbar: siempre visibles (sin desplegable). */
export default function SaldoEvento() {
  const [saldos, setSaldos] = useState([])
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

  if (!saldos.length) return null

  return (
    <div
      className="max-h-28 max-w-[11rem] shrink-0 overflow-y-auto border-l-2 border-primary pl-3"
      aria-label="Tus saldos por evento"
    >
      <ul className="space-y-2">
        {saldos.map((e) => (
          <li key={e.eventoId} className="min-w-0">
            <p className="truncate text-[10px] font-medium uppercase tracking-wide text-slate-400" title={e.titulo}>
              {e.titulo}
            </p>
            <p className="text-sm font-semibold tabular-nums leading-tight text-white">{formatBs(e.saldo)}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}