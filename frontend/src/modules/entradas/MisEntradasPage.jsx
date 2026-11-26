import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  aceptarAsignacion,
  asignarmeEntrada,
  cancelarAsignacion,
  getAsignacionesCompradas,
  getMisInvitaciones,
  invitarEntrada,
  reenviarAsignacion,
  rechazarAsignacion,
  transferirEntrada,
} from '../../api/asignaciones.api'
import { getMisEntradas, solicitarReembolsoEntrada } from '../../api/entradas.api'
import { toast } from '../../components/Toast'
import Field from '../../components/form/Field'
import Modal from '../../components/ui/Modal'
import TapReveal from '../../components/ui/TapReveal'
import { SkeletonCard } from '../../components/ui/Skeleton'
import { confirmDialog } from '../../components/ui/ConfirmDialog'
import MisEntradasExplorerToolbar from '../../components/entradas/MisEntradasExplorerToolbar'
import TitularesPendientesModal, { confirmAsignarme } from '../../components/entradas/TitularesPendientesModal'
import { entradaNecesitaTitular } from '../../utils/entradaTitular'
import { IconDownload, IconExternal, IconTicket } from '../../components/ui/icons'
import { useAuth } from '../../context/AuthContext'
import { eventImage, formatDay, formatDayRange, getErrorMessage } from '../../utils/format'
import { estadoBadgeClass, estadoLabel } from '../../utils/labels'

const DIA_LARGO = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
const QR_TOGGLE_COOLDOWN_MS = 450
const capitalizar = (texto) => texto.charAt(0).toUpperCase() + texto.slice(1)

function diaDeLaEntrada(entrada) {
  if (entrada.fecha) return capitalizar(formatDay(entrada.fecha.fecha, DIA_LARGO))
  const fechas = entrada.evento.fechas
  if (!fechas.length) return '—'
  if (fechas.length === 1) return capitalizar(formatDay(fechas[0].fecha, DIA_LARGO))
  return `Todos los días: ${formatDayRange(fechas[0].fecha, fechas[fechas.length - 1].fecha)}`
}

function fechaRefEntrada(entrada) {
  return entrada.fecha ?? entrada.evento.fechas?.[0] ?? null
}

function puedeTransferir(entrada) {
  if (['USADA', 'REEMBOLSADA', 'ANULADA'].includes(entrada.estado)) return false
  if (entrada.titularEstado === 'INVITACION_PENDIENTE') return false
  const evento = entrada.evento
  if (evento?.permiteTransferencias === false) return false
  if (evento?.transferenciaHasta && new Date(evento.transferenciaHasta).getTime() < Date.now()) return false
  return true
}

function puedeDevolver(entrada) {
  if (!['ASIGNADA', 'GENERADA'].includes(entrada.estado)) return false
  const hasta = entrada.reembolsoHasta
  if (hasta && new Date(hasta).getTime() < Date.now()) return false
  return true
}

function CarnetField({ label, value, mono = false }) {
  if (!value) return null
  return (
    <div className="min-w-0">
      <p className="ev-pass-field-label">{label}</p>
      <p className={`ev-pass-field-value ${mono ? 'ev-pass-field-value--mono' : ''}`}>{value}</p>
    </div>
  )
}

function CarnetLugar({ nombre, url }) {
  if (!nombre) return null
  return (
    <div className="min-w-0 sm:col-span-2">
      <p className="ev-pass-field-label">Lugar</p>
      <p className="ev-pass-field-value">{nombre}</p>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          Ver mapa
          <IconExternal className="h-3 w-3" aria-hidden="true" />
        </a>
      ) : null}
    </div>
  )
}

function TransferirModal({ entrada, open, onClose, busy, onConfirm }) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) {
      setEmail('')
      setError('')
    }
  }, [open])

  const onSubmit = async (e) => {
    e.preventDefault()
    const value = email.trim()
    if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError('Correo inválido.')
      return
    }
    setError('')
    const okConfirm = await confirmDialog({
      title: '¿Estás seguro?',
      message: `Enviaremos la invitación a ${value}. Si la acepta, la entrada dejará de estar a tu nombre. No se puede deshacer.`,
      confirmText: 'Sí, enviar invitación',
      cancelText: 'No, volver',
      tone: 'danger',
    })
    if (okConfirm !== true) return
    const ok = await onConfirm(entrada, value)
    if (ok) onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Transferir entrada"
      description="Envías una invitación por correo a otra persona. Si la acepta, la entrada queda a su nombre y tú ya no podrás usarla."
      size="sm"
      labelledBy="transferir-entrada-title"
    >
      <form onSubmit={onSubmit} className="space-y-4 px-6 pb-6 pt-4">
        <Field label="Correo del nuevo titular" htmlFor="transferir-email" error={error}>
          <input
            id="transferir-email"
            type="email"
            className="input"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setError('')
            }}
            placeholder="correo@ejemplo.com"
            autoComplete="off"
            spellCheck={false}
            required
          />
        </Field>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="btn-secondary btn-sm" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button type="submit" className="btn-danger btn-sm" disabled={busy}>
            Enviar invitación
          </button>
        </div>
      </form>
    </Modal>
  )
}

function ReembolsoModal({ entrada, open, onClose, busy, onConfirm }) {
  const [motivo, setMotivo] = useState('')

  useEffect(() => {
    if (!open) setMotivo('')
  }, [open])

  const onSubmit = async (e) => {
    e.preventDefault()
    const value = motivo.trim()
    if (!value) return
    const okConfirm = await confirmDialog({
      title: '¿Estás seguro?',
      message: 'Tu solicitud se enviará al equipo de Eventix. Si la aprueban, el QR dejará de ser válido y el reembolso seguirá su proceso. No se puede deshacer.',
      confirmText: 'Sí, enviar solicitud',
      cancelText: 'No, volver',
      tone: 'danger',
    })
    if (okConfirm !== true) return
    const ok = await onConfirm(entrada, value)
    if (ok) onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Solicitar devolución"
      description="Indica brevemente por qué solicitas la devolución. Si la aprueban, se anula tu entrada y se te reembolsa según las reglas del evento."
      size="sm"
      labelledBy="reembolso-entrada-title"
    >
      <form onSubmit={onSubmit} className="space-y-4 px-6 pb-6 pt-4">
        <Field label="Motivo" htmlFor="reembolso-motivo">
          <textarea
            id="reembolso-motivo"
            className="input min-h-24"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            maxLength={500}
            placeholder="Ej. No podré asistir"
            required
          />
        </Field>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="btn-secondary btn-sm" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button type="submit" className="btn-danger btn-sm" disabled={busy || !motivo.trim()}>
            Enviar solicitud
          </button>
        </div>
      </form>
    </Modal>
  )
}

function EntradaPass({ entrada, busyId, onAmpliar, onAbrirTransferir, onAbrirReembolso }) {
  const qrRevealRef = useRef(null)
  const qrCooldownRef = useRef(null)
  const [qrPhase, setQrPhase] = useState('hidden')
  const [qrToggleLocked, setQrToggleLocked] = useState(false)
  const refFecha = fechaRefEntrada(entrada)
  const qrRevealed = qrPhase === 'revealed'
  const qrOpen = qrPhase === 'revealing' || qrPhase === 'revealed'
  const qrBusy = qrPhase === 'revealing' || qrPhase === 'hiding'
  const qrToggleDisabled = qrBusy || qrToggleLocked

  useEffect(
    () => () => {
      clearTimeout(qrCooldownRef.current)
    },
    [],
  )

  const onToggleQr = () => {
    if (qrToggleDisabled) return
    setQrToggleLocked(true)
    clearTimeout(qrCooldownRef.current)
    if (qrOpen) qrRevealRef.current?.hide()
    else qrRevealRef.current?.reveal()
    qrCooldownRef.current = setTimeout(() => setQrToggleLocked(false), QR_TOGGLE_COOLDOWN_MS)
  }

  return (
    <li className="ev-pass-item">
      <article className="ev-pass-card ev-pass-card--wallet">
        <div className="ev-pass-flyer">
          <img
            src={eventImage(entrada.evento)}
            alt=""
            className="ev-pass-img"
            width={320}
            height={480}
            loading="lazy"
          />
          <div className="ev-pass-flyer-badge">
            <span className={`badge ${estadoBadgeClass(entrada.estado)}`}>{estadoLabel(entrada.estado)}</span>
          </div>
        </div>

        <div className="ev-pass-id">
          <Link to={`/eventos/${entrada.evento.id}`} className="ev-pass-id-title text-balance">
            {entrada.evento.titulo}
          </Link>
          <div className="ev-pass-id-grid">
            <CarnetField label="Categoría" value={entrada.categoria} />
            <CarnetField label="Fecha" value={diaDeLaEntrada(entrada)} />
            <CarnetField label="Hora inicio" value={refFecha?.horaInicio} />
            <CarnetField label="Hora fin" value={refFecha?.horaFin} />
            <CarnetLugar nombre={entrada.evento.ubicacion} url={entrada.evento.ubicacionUrl} />
          </div>
          {entrada.manilla && (
            <p className="rounded-md bg-success-soft px-3 py-2 text-sm font-semibold text-success">
              Manilla {entrada.manilla.codigo}
            </p>
          )}
        </div>

        <div className="ev-pass-qr-col">
          {entrada.qr ? (
            <div className="ev-pass-qr-stack">
              <div className="ev-pass-qr-inner">
                <TapReveal
                  ref={qrRevealRef}
                  hideable={false}
                  revealOnSealClick={false}
                  className="ev-pass-qr-reveal w-full"
                  contentClassName="ev-pass-qr-reveal-content"
                  onPhaseChange={setQrPhase}
                >
                  <button
                    type="button"
                    onClick={() => qrRevealed && onAmpliar(entrada)}
                    className="ev-pass-qr-btn"
                    disabled={!qrRevealed}
                    tabIndex={qrRevealed ? 0 : -1}
                    aria-label={qrRevealed ? `Ampliar QR ${entrada.codigo}` : undefined}
                    aria-hidden={!qrRevealed}
                  >
                    <img src={entrada.qr} alt="" className="ev-pass-qr-img" width={120} height={120} />
                  </button>
                </TapReveal>
              </div>
              <button
                type="button"
                className="ev-pass-qr-toggle btn-secondary btn-sm w-full"
                disabled={qrToggleDisabled}
                onClick={onToggleQr}
              >
                {qrOpen ? 'Ocultar QR' : 'Mostrar QR'}
              </button>
            </div>
          ) : (
            <p className="px-1 text-center text-xs text-muted">QR no disponible para esta entrada.</p>
          )}
        </div>
      </article>

      {(puedeTransferir(entrada) || puedeDevolver(entrada)) && (
        <div className="ev-pass-actions">
          {puedeTransferir(entrada) && (
            <button
              type="button"
              className="btn-secondary btn-sm"
              disabled={busyId === entrada.id}
              onClick={() => onAbrirTransferir(entrada)}
            >
              Transferir entrada
            </button>
          )}
          {puedeDevolver(entrada) && (
            <button
              type="button"
              className="btn-secondary btn-sm"
              disabled={busyId === entrada.id}
              onClick={() => onAbrirReembolso(entrada)}
            >
              Solicitar devolución
            </button>
          )}
        </div>
      )}
    </li>
  )
}

const PAGE_SIZE = 20

export default function MisEntradasPage() {
  const { user } = useAuth()
  const [entradas, setEntradas] = useState(null)
  const [invitaciones, setInvitaciones] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [ampliada, setAmpliada] = useState(null)
  const [transferirEntradaSel, setTransferirEntradaSel] = useState(null)
  const [reembolsoEntradaSel, setReembolsoEntradaSel] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [page, setPage] = useState(1)
  const [meta, setMeta] = useState({ total: 0, totalPages: 0, pageSize: PAGE_SIZE })
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [dateMode, setDateMode] = useState('range')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [pendientesTitular, setPendientesTitular] = useState([])
  const [titularesModalOpen, setTitularesModalOpen] = useState(false)

  const hasActiveFilters = Boolean(q.trim() || desde || hasta)

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q), 400)
    return () => window.clearTimeout(t)
  }, [q])

  useEffect(() => {
    setPage(1)
  }, [debouncedQ, desde, hasta])

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const [entRes, inv, compradas] = await Promise.all([
        getMisEntradas({
          page,
          limit: PAGE_SIZE,
          q: debouncedQ.trim() || undefined,
          desde: desde || undefined,
          hasta: hasta || undefined,
        }),
        getMisInvitaciones()
          .then(({ data }) => data.invitaciones ?? [])
          .catch(() => []),
        getAsignacionesCompradas()
          .then(({ data }) => (data.entradas ?? []).filter(entradaNecesitaTitular))
          .catch(() => []),
      ])
      const data = entRes.data
      setEntradas(data.entradas ?? [])
      setMeta({
        total: data.total ?? 0,
        totalPages: data.totalPages ?? 0,
        pageSize: data.pageSize ?? PAGE_SIZE,
      })
      setInvitaciones(inv)
      setPendientesTitular(compradas)
      if (!compradas.length) setTitularesModalOpen(false)
      setError('')
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudieron cargar tus entradas.'))
    } finally {
      setLoading(false)
    }
  }, [page, debouncedQ, desde, hasta])

  useEffect(() => {
    cargar()
  }, [cargar])

  const withBusy = async (id, fn) => {
    setBusyId(id)
    try {
      await fn()
      await cargar()
      return true
    } catch (err) {
      toast(getErrorMessage(err), 'error')
      return false
    } finally {
      setBusyId(null)
    }
  }

  const onAceptarInv = async (inv) => {
    await withBusy(inv.id, async () => {
      const { data } = await aceptarAsignacion(inv.id)
      toast(data.mensaje || 'Entrada aceptada', 'success')
    })
  }

  const onRechazarInv = async (inv) => {
    const ok = await confirmDialog({
      title: 'Rechazar invitación',
      message: 'Esta entrada no quedará a tu nombre.',
      confirmText: 'Rechazar',
      tone: 'danger',
    })
    if (ok !== true) return
    await withBusy(inv.id, async () => {
      const { data } = await rechazarAsignacion(inv.id)
      toast(data.mensaje || 'Invitación rechazada', 'success')
    })
  }

  const onTransferir = async (entrada, email) =>
    withBusy(entrada.id, async () => {
      const { data } = await transferirEntrada(entrada.id, email)
      toast(data.mensaje || 'Invitación enviada.', 'success')
    })

  const onReembolso = async (entrada, motivo) =>
    withBusy(entrada.id, async () => {
      const { data } = await solicitarReembolsoEntrada(entrada.id, motivo)
      const msg =
        data?.correoEnviado === false
          ? 'Solicitud registrada. El aviso por correo no se pudo enviar.'
          : 'Solicitud registrada. El administrador la revisará.'
      toast(msg, 'success')
    })

  const onAsignarmeComprada = async (entrada) => {
    const ok = await confirmAsignarme()
    if (ok !== true) return
    await withBusy(entrada.id, async () => {
      const { data } = await asignarmeEntrada(entrada.id)
      toast(data.mensaje || 'Entrada asignada a tu cuenta.', 'success')
    })
  }

  const onInvitarComprada = async (entrada, email) =>
    withBusy(entrada.id, async () => {
      const { data } = await invitarEntrada(entrada.id, email)
      toast(
        data.mensaje ||
          'Se ha enviado una invitación al correo indicado. El destinatario deberá iniciar sesión o crear una cuenta para aceptar su entrada.',
        'success',
      )
    })

  const onCancelarInvitacionComprada = async (inv) => {
    const ok = await confirmDialog({
      title: 'Cancelar invitación',
      message: `Se cancelará la invitación enviada a ${inv.email}.`,
      confirmText: 'Cancelar invitación',
      tone: 'danger',
    })
    if (ok !== true) return
    await withBusy(inv.id, async () => {
      const { data } = await cancelarAsignacion(inv.id)
      toast(data.mensaje || 'Invitación cancelada.', 'success')
    })
  }

  const onReenviarInvitacionComprada = async (inv) => {
    await withBusy(inv.id, async () => {
      const { data } = await reenviarAsignacion(inv.id)
      toast(
        data.mensaje ||
          'Se ha enviado una invitación al correo indicado. El destinatario deberá iniciar sesión o crear una cuenta para aceptar su entrada.',
        'success',
      )
    })
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-10">
      <h1 className="font-display text-3xl font-bold text-ink text-balance">Mis entradas</h1>

      {pendientesTitular.length > 0 ? (
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 rounded-lg border border-danger bg-danger-soft px-4 py-3 text-left text-sm font-semibold text-danger shadow-sm transition hover:border-danger hover:bg-danger-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger"
          onClick={() => setTitularesModalOpen(true)}
        >
          <span>
            Entradas aún sin titular
            <span className="ml-1.5 tabular-nums font-bold">({pendientesTitular.length})</span>
          </span>
          <span className="text-xs font-bold uppercase tracking-wide">Gestionar</span>
        </button>
      ) : null}

      {error && (
        <p className="rounded-md border border-danger/30 bg-danger-soft p-3 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <MisEntradasExplorerToolbar
        userId={user?.id}
        q={q}
        onQueryChange={setQ}
        dateMode={dateMode}
        onDateModeChange={setDateMode}
        desde={desde}
        hasta={hasta}
        onDatesApply={({ desde: d, hasta: h }) => {
          setDesde(d)
          setHasta(h)
        }}
        onClearAll={() => {
          setQ('')
          setDesde('')
          setHasta('')
        }}
        hasActiveFilters={hasActiveFilters}
      />

      {loading && !entradas && !error && (
        <div className="space-y-5" aria-busy="true">
          <span className="sr-only">Cargando…</span>
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {invitaciones.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-xl font-bold text-ink">Invitaciones</h2>
          <ul className="space-y-3">
            {invitaciones.map((inv) => (
              <li key={inv.id} className="card-surface flex flex-wrap items-center gap-4 p-4">
                <img
                  src={eventImage(inv.entrada?.evento)}
                  alt=""
                  className="h-16 w-24 rounded-md object-cover"
                  width={96}
                  height={64}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-display font-bold text-ink">{inv.entrada?.evento?.titulo || 'Entrada'}</p>
                  <p className="text-sm text-muted">{inv.entrada?.categoria?.nombre || inv.entrada?.categoria}</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" className="btn-primary btn-sm" disabled={busyId === inv.id} onClick={() => onAceptarInv(inv)}>
                    Aceptar
                  </button>
                  <button type="button" className="btn-secondary btn-sm" disabled={busyId === inv.id} onClick={() => onRechazarInv(inv)}>
                    Rechazar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!loading && entradas && !entradas.length && !invitaciones.length && !hasActiveFilters && (
        <div className="card-surface flex flex-col items-center gap-3 p-10 text-center">
          <IconTicket className="h-10 w-10 text-muted" aria-hidden="true" />
          <p className="font-semibold text-ink">Todavía no tienes entradas</p>
          <Link to="/eventos" className="btn-primary">
            Ver eventos
          </Link>
        </div>
      )}

      {!loading && entradas && !entradas.length && hasActiveFilters && (
        <p className="text-sm text-muted">Ninguna entrada coincide con esos filtros.</p>
      )}

      <ul className="space-y-6" aria-busy={loading}>
        {(entradas ?? []).map((e) => (
          <EntradaPass
            key={e.id}
            entrada={e}
            busyId={busyId}
            onAmpliar={setAmpliada}
            onAbrirTransferir={setTransferirEntradaSel}
            onAbrirReembolso={setReembolsoEntradaSel}
          />
        ))}
      </ul>

      {meta.totalPages > 1 ? (
        <nav aria-label="Páginas de entradas" className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <p className="text-sm text-muted">
            {meta.total} {meta.total === 1 ? 'entrada' : 'entradas'} · página {page} de {meta.totalPages}
          </p>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary btn-sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
              Anterior
            </button>
            <button
              type="button"
              className="btn-secondary btn-sm"
              disabled={page >= meta.totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente
            </button>
          </div>
        </nav>
      ) : null}

      <Modal open={Boolean(ampliada)} onClose={() => setAmpliada(null)} title={ampliada?.evento.titulo} size="sm" labelledBy="qr-entrada-title">
        {ampliada && (
          <div className="space-y-4 px-6 pb-6 pt-4 text-center">
            <img src={ampliada.qr} alt={`QR ${ampliada.codigo}`} className="mx-auto w-72 rounded-md bg-surface" width={288} height={288} />
            <p className="font-mono text-lg font-bold tracking-wide text-ink">{ampliada.codigo}</p>
            <p className="text-sm text-muted">
              {ampliada.categoria} · {diaDeLaEntrada(ampliada)}
            </p>
            <a
              href={ampliada.qr}
              download={`${ampliada.codigo}.png`}
              className="btn-primary btn-sm mx-auto inline-flex justify-center"
            >
              <IconDownload />
              Descargar QR
            </a>
          </div>
        )}
      </Modal>

      <TransferirModal
        entrada={transferirEntradaSel}
        open={Boolean(transferirEntradaSel)}
        onClose={() => setTransferirEntradaSel(null)}
        busy={Boolean(transferirEntradaSel && busyId === transferirEntradaSel.id)}
        onConfirm={onTransferir}
      />

      <ReembolsoModal
        entrada={reembolsoEntradaSel}
        open={Boolean(reembolsoEntradaSel)}
        busy={Boolean(reembolsoEntradaSel && busyId === reembolsoEntradaSel.id)}
        onClose={() => setReembolsoEntradaSel(null)}
        onConfirm={onReembolso}
      />

      <TitularesPendientesModal
        open={titularesModalOpen}
        onClose={() => setTitularesModalOpen(false)}
        entradas={pendientesTitular}
        busyId={busyId}
        onAsignarme={onAsignarmeComprada}
        onInvitar={onInvitarComprada}
        onCancelar={onCancelarInvitacionComprada}
        onReenviar={onReenviarInvitacionComprada}
      />
    </div>
  )
}