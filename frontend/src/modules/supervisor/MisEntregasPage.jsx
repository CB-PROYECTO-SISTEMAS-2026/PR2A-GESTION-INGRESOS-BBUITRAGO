import { useEffect, useState } from 'react'
import { getMisEntregas, getMisPuntos } from '../../api/manillas.api'
import { formatDateTime, formatDay, getErrorMessage } from '../../utils/format'

/** Historial de manillas que entregó el supervisor, con el punto de cada entrega. */
export default function MisEntregasPage() {
  const [puntos, setPuntos] = useState([])
  const [puntoId, setPuntoId] = useState('')
  const [entregas, setEntregas] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    getMisPuntos()
      .then(({ data }) => setPuntos(data.puntos ?? []))
      .catch(() => setPuntos([]))
  }, [])

  useEffect(() => {
    let alive = true
    setEntregas(null)
    getMisEntregas(puntoId)
      .then(({ data }) => alive && setEntregas(data.entregas ?? []))
      .catch((err) => alive && setError(getErrorMessage(err)))
    return () => {
      alive = false
    }
  }, [puntoId])

  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-3xl font-bold text-ink">Mis entregas</h1>
        {puntos.length > 1 && (
          <select className="input sm:max-w-xs" value={puntoId} onChange={(e) => setPuntoId(e.target.value)} aria-label="Filtrar por punto">
            <option value="">Todos los puntos</option>
            {puntos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.evento.titulo} — {p.nombre}
              </option>
            ))}
          </select>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {!entregas && !error && <p className="text-muted">Cargando…</p>}

      {entregas && (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-page text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Fecha</th>
                <th className="px-4 py-3 font-semibold">Manilla</th>
                <th className="px-4 py-3 font-semibold">Cliente</th>
                <th className="px-4 py-3 font-semibold">Entrada</th>
                <th className="px-4 py-3 font-semibold">Punto</th>
              </tr>
            </thead>
            <tbody>
              {entregas.map((m) => (
                <tr key={m.id} className="border-t border-border">
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDateTime(m.entregadaAt)}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">{m.codigoManilla}</td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-ink">{m.cliente?.nombre ?? '—'}</p>
                    <p className="text-xs text-muted">{m.cliente?.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-slate-700">{m.entrada?.categoria}</p>
                    <p className="text-xs text-muted">{m.entrada?.fecha ? formatDay(m.entrada.fecha) : 'Todos los días'}</p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{m.puntoRetiro?.nombre ?? '—'}</td>
                </tr>
              ))}
              {!entregas.length && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted">
                    Aún no entregaste ninguna manilla.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
