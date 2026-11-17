import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getMisSaldos } from '../../api/recargas.api'
import { IconWallet } from '../../components/ui/icons'
import { useAuth } from '../../context/AuthContext'
import { formatBs, formatDateTime, formatDayRange, getErrorMessage } from '../../utils/format'
import { MOMENTO_EVENTO } from '../../utils/movimientos'

/**
 * HU-020 (cliente): saldo en cada evento (Figma: Mi Manilla → Mis saldos). Cada saldo pertenece
 * solo a su evento: no se combina ni se transfiere.
 */
export default function MiManillaPage() {
  const { user } = useAuth()
  const [saldos, setSaldos] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancel = false
    getMisSaldos()
      .then(({ data }) => !cancel && setSaldos(data.saldos))
      .catch((err) => !cancel && setError(getErrorMessage(err, 'No se pudieron cargar tus saldos.')))
    return () => {
      cancel = true
    }
  }, [])

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <div>
        <Link to="/" className="text-sm font-semibold text-teal-dark hover:text-teal">
          ← Volver al inicio
        </Link>
        <h1 className="mt-2 font-display text-3xl font-bold text-ink">Mi Manilla</h1>
        <p className="text-sm text-muted">
          {[user?.nombre, user?.apellido].filter(Boolean).join(' ')} · {user?.email}
        </p>
      </div>

      <section className="card-surface p-6">
        <h2 className="font-display text-xl font-bold">Mis saldos</h2>
        <p className="mt-1 text-sm text-muted">
          Cada saldo pertenece exclusivamente a su evento y no se puede combinar, transferir ni usar en otros eventos.
          Recarga en los puntos de recarga del evento mostrando tu manilla o tu entrada digital.
        </p>

        {error && (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
            {error}
          </p>
        )}
        {!saldos && !error && <p className="mt-6 text-sm text-muted">Cargando…</p>}

        {saldos && (
          <ul className="mt-5 grid gap-3">
            {saldos.map((s) => {
              const momento = MOMENTO_EVENTO[s.momento]
              return (
                <li key={s.eventoId} className="min-w-0 rounded-lg border border-border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{s.titulo}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                        <span className={`badge ${s.cancelado ? 'bg-red-50 text-red-700' : momento.badge}`}>
                          {s.cancelado ? 'Cancelado' : momento.label}
                        </span>
                        <span>{formatDayRange(s.fechaInicio, s.fechaFin)}</span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs text-muted">Saldo</p>
                      <p className="font-display text-2xl font-bold text-teal-dark">{formatBs(s.saldo)}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs text-muted">
                    <span className="min-w-0">
                      {s.momento === 'FINALIZADO'
                        ? Number(s.saldo) > 0
                          ? 'Evento finalizado con saldo pendiente'
                          : 'Sin saldo pendiente'
                        : 'Saldo disponible solo dentro de este evento'}
                      {s.actualizado && ` · Actualizado ${formatDateTime(s.actualizado)}`}
                    </span>
                    <Link
                      to={`/mi-manilla/movimientos?evento=${encodeURIComponent(s.eventoId)}`}
                      className="font-semibold text-teal-dark hover:underline"
                    >
                      Ver movimientos
                    </Link>
                  </div>
                </li>
              )
            })}
            {!saldos.length && (
              <li className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted">
                <IconWallet className="h-8 w-8" />
                Todavía no tienes entradas ni saldo en ningún evento.
              </li>
            )}
          </ul>
        )}
      </section>
    </div>
  )
}
