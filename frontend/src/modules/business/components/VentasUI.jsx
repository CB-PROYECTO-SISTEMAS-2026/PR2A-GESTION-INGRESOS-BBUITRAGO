import { useState } from 'react'
import { formatBs, formatDay } from '../../../utils/format'
import { RANGOS } from './ventasFiltros'

/** Filtros en una sola fila: rango de fechas, negocio y evento. */
export function FiltrosVentas({ filtros, onChange, negocios = [], eventos = [], children }) {
  const set = (patch) => onChange({ ...filtros, ...patch })
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex rounded-md border border-border bg-white p-0.5" role="group" aria-label="Rango rápido">
        {RANGOS.map((r) => {
          const activo = filtros.desde === r.desde() && filtros.hasta === r.hasta()
          return (
            <button
              key={r.label}
              type="button"
              aria-pressed={activo}
              className={`rounded px-3 py-1.5 text-sm font-medium ${activo ? 'bg-teal text-white' : 'text-muted hover:text-ink'}`}
              onClick={() => set({ desde: r.desde(), hasta: r.hasta() })}
            >
              {r.label}
            </button>
          )
        })}
      </div>
      <label className="text-xs font-medium text-muted">
        Desde
        <input
          type="date"
          className="input mt-1 !py-1.5 text-sm"
          value={filtros.desde}
          max={filtros.hasta}
          onChange={(e) => e.target.value && set({ desde: e.target.value })}
        />
      </label>
      <label className="text-xs font-medium text-muted">
        Hasta
        <input
          type="date"
          className="input mt-1 !py-1.5 text-sm"
          value={filtros.hasta}
          min={filtros.desde}
          onChange={(e) => e.target.value && set({ hasta: e.target.value })}
        />
      </label>
      {negocios.length > 1 && (
        <label className="text-xs font-medium text-muted">
          Negocio
          <select className="input mt-1 !py-1.5 text-sm" value={filtros.negocioId} onChange={(e) => set({ negocioId: e.target.value })}>
            <option value="">Todos</option>
            {negocios.map((n) => (
              <option key={n.id} value={n.id}>
                {n.nombre}
              </option>
            ))}
          </select>
        </label>
      )}
      {eventos.length > 0 && (
        <label className="text-xs font-medium text-muted">
          Evento
          <select
            className="input mt-1 max-w-64 !py-1.5 text-sm"
            value={filtros.eventoId}
            onChange={(e) => set({ eventoId: e.target.value })}
          >
            <option value="">Todos los eventos</option>
            {eventos.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.titulo}
              </option>
            ))}
          </select>
        </label>
      )}
      {children && <div className="ml-auto flex items-end gap-2">{children}</div>}
    </div>
  )
}

export function KpiCard({ label, value, hint }) {
  return (
    <div className="rounded-lg border border-border bg-white p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 font-display text-3xl font-bold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  )
}

/**
 * Ventas por día (una sola serie). Las barras usan teal-dark (#00a8b3, contraste 2.8:1 con el
 * fondo), por eso cada barra muestra su monto como texto y la tabla de abajo repite los datos.
 */
export function VentasPorDiaChart({ datos }) {
  const [hover, setHover] = useState(null)
  const max = Math.max(...datos.map((d) => Number(d.total)), 0)
  const mostrarValores = datos.length <= 14
  const corto = (dia) => formatDay(dia, { day: 'numeric', month: 'short' })

  if (!datos.length || max === 0) {
    return <p className="flex h-56 items-center justify-center text-sm text-muted">Sin ventas en este periodo.</p>
  }

  return (
    <div>
      <div className="relative flex h-56 items-end gap-0.5 border-b border-slate-300 pt-6" role="img" aria-label="Ventas por día">
        {datos.map((d, i) => {
          const valor = Number(d.total)
          const alto = max ? (valor / max) * 100 : 0
          return (
            <div
              key={d.dia}
              className="group relative flex h-full flex-1 flex-col items-center justify-end"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              tabIndex={0}
              aria-label={`${corto(d.dia)}: ${formatBs(valor)}`}
            >
              {mostrarValores && valor > 0 && (
                <span className="mb-1 text-[11px] font-medium text-muted tabular-nums">{formatBs(valor)}</span>
              )}
              <div
                className={`w-full max-w-10 rounded-t-[4px] transition-opacity ${
                  hover !== null && hover !== i ? 'opacity-60' : ''
                }`}
                style={{ height: `${Math.max(alto, valor > 0 ? 1.5 : 0)}%`, background: '#00a8b3' }}
              />
              {hover === i && (
                <div className="pointer-events-none absolute -top-2 z-10 -translate-y-full whitespace-nowrap rounded-md border border-border bg-white px-3 py-1.5 text-xs shadow-lg">
                  <p className="text-muted">{formatDay(d.dia)}</p>
                  <p className="font-semibold text-ink">{formatBs(valor)}</p>
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div className="mt-2 flex gap-0.5 text-[11px] text-muted">
        {datos.map((d, i) => (
          <span key={d.dia} className="flex-1 truncate text-center">
            {datos.length <= 14 || i % Math.ceil(datos.length / 10) === 0 ? corto(d.dia) : ''}
          </span>
        ))}
      </div>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-xs font-semibold text-muted">Ver como tabla</summary>
        <table className="mt-2 w-full text-left text-sm">
          <tbody>
            {datos.map((d) => (
              <tr key={d.dia} className="border-t border-border">
                <td className="py-1.5">{formatDay(d.dia)}</td>
                <td className="py-1.5 text-right tabular-nums">{formatBs(d.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}
