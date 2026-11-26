import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getMisSaldos } from '../../api/recargas.api'
import { IconChevronRight, IconWallet } from '../../components/ui/icons'
import { Skeleton } from '../../components/ui/Skeleton'
import { useAuth } from '../../context/AuthContext'
import { eventImage, formatBs, formatDateTime, formatDay, formatDayRange, getErrorMessage } from '../../utils/format'
import { MOMENTO_EVENTO } from '../../utils/movimientos'

/** Plazo para pedir la devolución del saldo que sobró (30 días desde el fin del evento). */
function plazoTexto(plazo) {
  if (!plazo) return 'Evento finalizado con saldo pendiente'
  if (plazo.vencido) return `El plazo para retirar este saldo venció el ${formatDay(plazo.fechaLimite)}`
  return `Puedes pedir la devolución de este saldo hasta el ${formatDay(plazo.fechaLimite)}`
}

function saldoNota(s) {
  if (s.momento === 'FINALIZADO') {
    return Number(s.saldo) > 0 ? plazoTexto(s.plazoRetiro) : 'Sin saldo pendiente'
  }
  return 'Saldo disponible solo dentro de este evento'
}

function SaldoSkeleton() {
  return (
    <div className="grid gap-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando…</span>
      <Skeleton className="h-24 w-full rounded-2xl" />
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="overflow-hidden rounded-2xl border border-border bg-surface">
          <div className="flex gap-0 sm:flex-row">
            <Skeleton className="aspect-[16/10] w-full rounded-none sm:aspect-auto sm:h-auto sm:w-28" />
            <div className="flex flex-1 flex-col gap-3 p-4">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-8 w-28" />
              <Skeleton className="h-3 w-4/5" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function SaldoCard({ saldo: s }) {
  const momento = MOMENTO_EVENTO[s.momento]
  const monto = Number(s.saldo)
  const sinSaldo = !Number.isFinite(monto) || monto <= 0

  return (
    <article className="ev-saldo-card">
      <div className="ev-saldo-media" aria-hidden="true">
        <img
          src={eventImage(s)}
          alt=""
          className="ev-saldo-img"
          width={320}
          height={200}
          loading="lazy"
        />
        <div className="ev-saldo-veil" />
      </div>

      <div className="ev-saldo-body">
        <header className="min-w-0">
          <h3 className="ev-saldo-title text-balance">{s.titulo}</h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span className={`badge ${s.cancelado ? 'bg-danger-soft text-danger' : momento.badge}`}>
              {s.cancelado ? 'Cancelado' : momento.label}
            </span>
            <span>{formatDayRange(s.fechaInicio, s.fechaFin)}</span>
          </div>
        </header>

        <div className="ev-saldo-amount">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Saldo</p>
          <p
            className={`font-display text-3xl font-bold tabular-nums leading-none ${
              sinSaldo ? 'text-muted' : 'text-success'
            }`}
          >
            {formatBs(s.saldo)}
          </p>
        </div>

        <p className="ev-saldo-note text-pretty">
          {saldoNota(s)}
          {s.actualizado ? ` · Actualizado ${formatDateTime(s.actualizado)}` : ''}
        </p>

        <footer className="ev-saldo-actions">
          <Link
            to={`/mi-manilla/movimientos?evento=${encodeURIComponent(s.eventoId)}`}
            className="btn-secondary btn-sm inline-flex items-center gap-1"
          >
            Ver movimientos
            <IconChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
          <Link to={`/eventos/${s.eventoId}`} className="text-sm font-semibold text-primary hover:underline">
            Ver evento
          </Link>
        </footer>
      </div>
    </article>
  )
}

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

  const resumen = useMemo(() => {
    if (!saldos?.length) return null
    const conSaldo = saldos.filter((s) => Number(s.saldo) > 0)
    const activos = saldos.filter((s) => !s.cancelado && s.momento !== 'FINALIZADO' && Number(s.saldo) > 0)
    const totalActivo = activos.reduce((acc, s) => acc + Number(s.saldo), 0)
    const totalPendiente = conSaldo.reduce((acc, s) => acc + Number(s.saldo), 0)
    return {
      eventos: saldos.length,
      conSaldo: conSaldo.length,
      totalActivo,
      totalPendiente,
      tieneActivos: activos.length > 0,
      tienePendiente: conSaldo.length > 0,
    }
  }, [saldos])

  const nombre = [user?.nombre, user?.apellido].filter(Boolean).join(' ')

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-10">
      <header className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Monedero</p>
        <h1 className="mt-1 font-display text-3xl font-bold text-ink text-balance">Mi manilla</h1>
        {(nombre || user?.email) && (
          <p className="mt-1 truncate text-sm text-muted">
            {nombre}
            {nombre && user?.email ? ' · ' : ''}
            {user?.email}
          </p>
        )}
      </header>

      {error && (
        <p className="mt-6 rounded-md border border-danger/30 bg-danger-soft p-3 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <section className="mt-6" aria-labelledby="mis-saldos-titulo">
        <h2 id="mis-saldos-titulo" className="sr-only">
          Mis saldos
        </h2>

        {!saldos && !error && <SaldoSkeleton />}

        {saldos && (
          <div className="grid gap-4">
            {resumen && (
              <div className="ev-saldo-resumen">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-white/70">
                    {resumen.tieneActivos
                      ? 'Disponible en eventos activos'
                      : resumen.tienePendiente
                        ? 'Saldo pendiente de retiro'
                        : 'Tus eventos'}
                  </p>
                  <p className="mt-1 font-display text-3xl font-bold tabular-nums text-white">
                    {resumen.tieneActivos
                      ? formatBs(resumen.totalActivo)
                      : resumen.tienePendiente
                        ? formatBs(resumen.totalPendiente)
                        : `${resumen.eventos} eventos`}
                  </p>
                </div>
                <dl className="ev-saldo-resumen-meta">
                  <div>
                    <dt>Eventos</dt>
                    <dd className="tabular-nums">{resumen.eventos}</dd>
                  </div>
                  <div>
                    <dt>Con saldo</dt>
                    <dd className="tabular-nums">{resumen.conSaldo}</dd>
                  </div>
                </dl>
              </div>
            )}

            {saldos.map((s) => (
              <SaldoCard key={s.eventoId} saldo={s} />
            ))}

            {!saldos.length && (
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-surface px-6 py-14 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
                  <IconWallet className="h-6 w-6" aria-hidden="true" />
                </span>
                <p className="font-display text-lg font-semibold text-ink">Todavía no tienes saldo</p>
                <p className="max-w-sm text-sm text-muted text-pretty">
                  Cuando tengas una entrada, el saldo de ese evento aparece acá. Recarga en el recinto con tu manilla o
                  tu entrada digital.
                </p>
                <Link to="/" className="btn-primary btn-sm mt-1">
                  Ver eventos
                </Link>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
