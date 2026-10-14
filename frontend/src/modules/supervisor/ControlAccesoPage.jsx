import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getAforoSupervisor,
  getMisEventosAcceso,
  getRegistrosSupervisor,
  rechazarAcceso,
  registrarAcceso,
  verificarAcceso,
} from '../../api/acceso.api'
import QrScanner from '../../components/acceso/QrScanner'
import FotoCaptura from '../../components/acceso/FotoCaptura'
import AforoResumen from '../../components/acceso/AforoResumen'
import { toast } from '../../components/Toast'
import { IconCalendar, IconCheck, IconQr, IconWarning, IconX } from '../../components/ui/icons'
import { formatDateTime, formatDay, getErrorMessage } from '../../utils/format'
import { estadoBadgeClass, estadoLabel } from '../../utils/labels'
import { medioLabel, movimientoBadge, movimientoLabel } from '../acceso/accesoLabels'

const EVENTO_KEY = 'eventix_evento_acceso'
const AFORO_REFRESH_MS = 15_000
const diaLargo = (fecha) => formatDay(fecha, { weekday: 'long', day: 'numeric', month: 'long' })
const hora = (value) => new Date(value).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })

const BANNERS = {
  VALIDO: { box: 'border-emerald-300 bg-emerald-50 text-emerald-900', icon: IconCheck, iconBox: 'bg-emerald-600' },
  YA_USADO: { box: 'border-amber-300 bg-amber-50 text-amber-900', icon: IconWarning, iconBox: 'bg-amber-500' },
  INVALIDO: { box: 'border-red-300 bg-red-50 text-red-900', icon: IconX, iconBox: 'bg-red-600' },
}

function tituloResultado(r) {
  if (r.estado === 'VALIDO') {
    return r.movimiento === 'SALIDA' ? 'Salida válida' : r.movimiento === 'REINGRESO' ? 'Reingreso válido' : 'Acceso válido: primer ingreso'
  }
  if (r.estado === 'YA_USADO') return 'Entrada ya usada: está dentro del evento'
  return 'Acceso inválido'
}

function Resultado({ resultado, foto, setFoto, coincide, setCoincide, onRegistrar, onRechazar, onSiguiente, registrando }) {
  const banner = BANNERS[resultado.estado]
  const Icon = banner.icon
  const valido = resultado.estado === 'VALIDO'
  const debeComparar = valido && !resultado.requiereFoto && Boolean(resultado.fotoIngreso)
  const listo = valido && (resultado.requiereFoto ? Boolean(foto) : !debeComparar || coincide)
  const { persona, entrada } = resultado

  return (
    <section className="card-surface space-y-5 p-5">
      <div className={`flex items-start gap-3 rounded-md border-2 p-4 ${banner.box}`} role="status">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white ${banner.iconBox}`}>
          <Icon className="h-6 w-6" />
        </span>
        <div>
          <p className="font-display text-xl font-bold">{tituloResultado(resultado)}</p>
          {resultado.motivo && <p className="mt-0.5 text-sm">{resultado.motivo}</p>}
        </div>
      </div>

      {resultado.rechazosHoy > 0 && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          Atención: hoy {resultado.rechazosHoy === 1 ? 'ya hubo 1 intento' : `ya hubo ${resultado.rechazosHoy} intentos`} con
          esta entrada de una persona que no coincidía con la foto.
        </p>
      )}

      {entrada && (
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              {persona?.fotoPerfilUrl ? (
                <img src={persona.fotoPerfilUrl} alt="" className="h-14 w-14 rounded-full border border-border object-cover" />
              ) : (
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-navy font-display text-lg font-bold text-white">
                  {(persona?.nombre || '?').slice(0, 1).toUpperCase()}
                </span>
              )}
              <div className="min-w-0">
                <p className="font-display text-lg font-bold text-ink">{persona?.nombre ?? 'Sin titular asignado'}</p>
                <p className="text-sm text-muted">Documento: {persona?.documento || '—'}</p>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <dt className="text-muted">Categoría</dt>
                <dd className="font-semibold text-ink">{entrada.categoria}</dd>
              </div>
              <div>
                <dt className="text-muted">Válida para</dt>
                <dd className="font-semibold text-ink">{entrada.dia ? diaLargo(entrada.dia) : 'Todos los días'}</dd>
              </div>
              <div>
                <dt className="text-muted">Escaneado con</dt>
                <dd className="font-semibold text-ink">
                  {medioLabel(resultado.medio)}
                  {entrada.manilla ? ` ${entrada.manilla}` : ''}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Entrada</dt>
                <dd>
                  <span className={`badge ${estadoBadgeClass(entrada.estado)}`}>{estadoLabel(entrada.estado)}</span>
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-muted">Último movimiento hoy</dt>
                <dd className="font-semibold text-ink">
                  {resultado.ultimoMovimiento
                    ? `${movimientoLabel(resultado.ultimoMovimiento.tipo)} a las ${hora(resultado.ultimoMovimiento.at)}`
                    : 'Ninguno'}
                </dd>
              </div>
            </dl>
            <p className="font-mono text-xs text-slate-500">{entrada.codigo}</p>
          </div>

          <div>
            {resultado.fotoIngreso ? (
              <>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Foto del primer ingreso · {formatDateTime(resultado.fotoIngreso.tomadaAt)}
                </p>
                <img
                  src={resultado.fotoIngreso.url}
                  alt="Foto del primer ingreso"
                  className="mt-2 aspect-video w-full rounded-md border-2 border-teal bg-slate-900 object-contain"
                />
                {debeComparar && (
                  <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-md border border-border bg-page p-3 text-sm text-ink">
                    <input type="checkbox" className="mt-0.5 h-4 w-4 accent-teal" checked={coincide} onChange={(e) => setCoincide(e.target.checked)} />
                    Comparé la foto con la persona presente y es la misma.
                  </label>
                )}
              </>
            ) : valido && resultado.requiereFoto ? (
              <>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Foto de la persona (obligatoria en el primer ingreso)</p>
                <div className="mt-2">
                  <FotoCaptura value={foto} onChange={setFoto} />
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3 border-t border-border pt-4">
        {valido && (
          <button type="button" className="btn-primary" onClick={onRegistrar} disabled={!listo || registrando}>
            <IconCheck />
            {registrando ? 'Registrando…' : `Registrar ${movimientoLabel(resultado.movimiento).toLowerCase()}`}
          </button>
        )}
        {debeComparar && (
          <button type="button" className="btn-secondary !text-red-600 hover:!bg-red-50" onClick={onRechazar} disabled={registrando}>
            No es la misma persona
          </button>
        )}
        <button type="button" className="btn-secondary" onClick={() => onSiguiente()} disabled={registrando}>
          {valido ? 'Cancelar' : 'Escanear siguiente'}
        </button>
      </div>
    </section>
  )
}

/** HU-016, HU-017, HU-046: control de ingresos y salidas en la puerta del evento. */
export default function ControlAccesoPage() {
  const [eventos, setEventos] = useState(null)
  const [eventoId, setEventoId] = useState(() => sessionStorage.getItem(EVENTO_KEY) || '')
  const [sentido, setSentido] = useState('ENTRADA')
  const [camara, setCamara] = useState(true)
  const [manual, setManual] = useState('')
  const [resultado, setResultado] = useState(null)
  const [codigo, setCodigo] = useState('')
  const [foto, setFoto] = useState(null)
  const [coincide, setCoincide] = useState(false)
  const [verificando, setVerificando] = useState(false)
  const [registrando, setRegistrando] = useState(false)
  const [aforo, setAforo] = useState(null)
  const [registros, setRegistros] = useState([])
  const [error, setError] = useState('')
  const busyRef = useRef(false)
  const manualRef = useRef(null)

  useEffect(() => {
    let alive = true
    getMisEventosAcceso()
      .then(({ data }) => {
        if (!alive) return
        const lista = data.eventos ?? []
        setEventos(lista)
        setEventoId((actual) => {
          if (lista.some((e) => e.id === actual)) return actual
          const deHoy = lista.filter((e) => e.hoy)
          return deHoy.length === 1 ? deHoy[0].id : ''
        })
      })
      .catch((err) => alive && setError(getErrorMessage(err, 'No se pudieron cargar tus eventos.')))
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (eventoId) sessionStorage.setItem(EVENTO_KEY, eventoId)
    else sessionStorage.removeItem(EVENTO_KEY)
  }, [eventoId])

  const evento = eventos?.find((e) => e.id === eventoId) ?? null
  const operativo = Boolean(evento?.hoy)

  const cargarPanel = useCallback(async () => {
    if (!eventoId) return
    const [{ data: a }, { data: r }] = await Promise.all([getAforoSupervisor(eventoId), getRegistrosSupervisor(eventoId)])
    setAforo(a)
    const rechazos = (r.rechazos ?? []).map((x) => ({ ...x, rechazado: true }))
    setRegistros([...(r.registros ?? []), ...rechazos].sort((x, y) => new Date(y.createdAt) - new Date(x.createdAt)))
  }, [eventoId])

  useEffect(() => {
    if (!operativo) return undefined
    cargarPanel().catch(() => {})
    const timer = setInterval(() => cargarPanel().catch(() => {}), AFORO_REFRESH_MS)
    return () => clearInterval(timer)
  }, [operativo, cargarPanel])

  const siguiente = (aviso) => {
    if (aviso) toast(aviso, 'error')
    setResultado(null)
    setCodigo('')
    setFoto(null)
    setCoincide(false)
    setManual('')
    busyRef.current = false
    manualRef.current?.focus()
  }

  const verificar = async (valor) => {
    const texto = valor.trim()
    if (!texto || busyRef.current || !operativo) return
    busyRef.current = true
    setVerificando(true)
    try {
      const { data } = await verificarAcceso({ eventoId, codigo: texto, sentido })
      setCodigo(texto)
      setResultado(data)
      setFoto(null)
      setCoincide(false)
      if (navigator.vibrate) navigator.vibrate(data.estado === 'VALIDO' ? 80 : [80, 60, 80])
    } catch (err) {
      toast(getErrorMessage(err), 'error')
      busyRef.current = false
    } finally {
      setVerificando(false)
    }
  }

  const registrar = async () => {
    setRegistrando(true)
    try {
      const { data } = await registrarAcceso({
        eventoId,
        codigo,
        sentido,
        foto: resultado.requiereFoto ? foto : null,
        fotoVerificada: Boolean(resultado.fotoIngreso) && coincide,
      })
      toast(`${movimientoLabel(data.registro.tipo)} registrado: ${resultado.persona?.nombre ?? resultado.entrada.codigo}`, 'success')
      setAforo(data.aforo)
      cargarPanel().catch(() => {})
      siguiente()
    } catch (err) {
      toast(getErrorMessage(err), 'error')
    } finally {
      setRegistrando(false)
    }
  }

  const rechazar = async () => {
    setRegistrando(true)
    try {
      await rechazarAcceso({ eventoId, codigo, sentido })
      cargarPanel().catch(() => {})
      siguiente('No coincide con la foto: no se registró el paso y el intento quedó registrado.')
    } catch (err) {
      toast(getErrorMessage(err), 'error')
    } finally {
      setRegistrando(false)
    }
  }

  const cambiarSentido = (s) => {
    setSentido(s)
    if (resultado) siguiente()
  }

  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="font-display text-3xl font-bold text-ink">Control de acceso</h1>
        <p className="mt-1 text-sm text-muted">
          Escanea la manilla o el QR digital de cada persona. Solo pasan entradas válidas para el día de hoy.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {!eventos && !error && <p className="text-muted">Cargando…</p>}

      {eventos && !eventos.length && (
        <div className="card-surface flex flex-col items-center gap-2 p-10 text-center">
          <IconCalendar className="h-10 w-10 text-slate-300" />
          <p className="font-semibold text-ink">No tienes eventos asignados</p>
          <p className="text-sm text-muted">El administrador debe asignarte al control de acceso de un evento publicado.</p>
        </div>
      )}

      {eventos && eventos.length > 0 && (
        <section className="card-surface flex flex-wrap items-end gap-4 p-5">
          <div className="min-w-64 flex-1">
            <label className="label" htmlFor="evento-acceso">
              Evento
            </label>
            <select
              id="evento-acceso"
              className="input"
              value={eventoId}
              onChange={(e) => {
                setEventoId(e.target.value)
                setAforo(null)
                setRegistros([])
                siguiente()
              }}
            >
              <option value="">Selecciona el evento</option>
              {eventos.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.titulo} — {e.hoy ? 'hoy' : `próximo: ${formatDay(e.proximo)}`}
                </option>
              ))}
            </select>
          </div>
          {operativo && (
            <div>
              <span className="label">Puerta</span>
              <div className="inline-flex rounded-md border border-border bg-page p-1" role="group" aria-label="Sentido del paso">
                {[
                  ['ENTRADA', 'Entrada'],
                  ['SALIDA', 'Salida'],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => cambiarSentido(value)}
                    aria-pressed={sentido === value}
                    className={`rounded px-5 py-2 text-sm font-semibold transition ${
                      sentido === value ? (value === 'ENTRADA' ? 'bg-teal text-white' : 'bg-navy text-white') : 'text-slate-600 hover:text-ink'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {evento && !operativo && (
        <div className="flex gap-3 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <IconWarning className="mt-0.5 h-5 w-5 shrink-0" />
          <p>
            Este evento no se realiza hoy. Podrás controlar el acceso el {diaLargo(evento.proximo)}
            {evento.fechas.find((f) => f.fecha.startsWith(evento.proximo))?.horaInicio
              ? ` desde las ${evento.fechas.find((f) => f.fecha.startsWith(evento.proximo)).horaInicio}`
              : ''}
            .
          </p>
        </div>
      )}

      {operativo && (
        <div className="grid items-start gap-6 xl:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            {!resultado && (
              <section className="card-surface space-y-4 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-display text-lg font-bold text-ink">
                    Escanear {sentido === 'ENTRADA' ? 'ingreso' : 'salida'}
                  </h2>
                  <button type="button" className="btn-secondary btn-sm" onClick={() => setCamara((v) => !v)}>
                    {camara ? 'Apagar cámara' : 'Usar cámara'}
                  </button>
                </div>
                {camara && <QrScanner active={!resultado && !verificando} onDetect={verificar} />}
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    verificar(manual)
                  }}
                  className="flex flex-wrap gap-3"
                >
                  <div className="relative min-w-56 flex-1">
                    <IconQr className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                    <input
                      ref={manualRef}
                      className="input !pl-9 font-mono"
                      value={manual}
                      maxLength={191}
                      autoComplete="off"
                      autoFocus={!camara}
                      placeholder="Lector de QR o código de la manilla"
                      onChange={(e) => setManual(e.target.value)}
                      aria-label="Código escaneado"
                    />
                  </div>
                  <button type="submit" className="btn-primary" disabled={verificando || manual.trim().length < 3}>
                    {verificando ? 'Verificando…' : 'Verificar'}
                  </button>
                </form>
              </section>
            )}

            {resultado && (
              <Resultado
                resultado={resultado}
                foto={foto}
                setFoto={setFoto}
                coincide={coincide}
                setCoincide={setCoincide}
                onRegistrar={registrar}
                onRechazar={rechazar}
                onSiguiente={siguiente}
                registrando={registrando}
              />
            )}
          </div>

          <aside className="space-y-4">
            <section className="card-surface p-5">
              <h2 className="font-display text-lg font-bold text-ink">Aforo de hoy</h2>
              <p className="text-xs text-muted">Se actualiza cada 15 segundos con lo registrado en todas las puertas.</p>
              <div className="mt-3">
                <AforoResumen aforo={aforo} compacto />
              </div>
            </section>
            <section className="card-surface p-5">
              <h2 className="font-display text-lg font-bold text-ink">Mis últimos registros</h2>
              <ul className="mt-3 divide-y divide-border text-sm">
                {registros.slice(0, 12).map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 py-2">
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-ink">{r.persona ?? r.codigo}</span>
                      <span className="text-xs text-muted">
                        {r.categoria}
                        {r.manilla ? ` · ${r.manilla}` : ''}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      {r.rechazado ? (
                        <span className="badge bg-red-100 text-red-700">Rechazado</span>
                      ) : (
                        <span className={`badge ${movimientoBadge(r.tipo)}`}>{movimientoLabel(r.tipo)}</span>
                      )}
                      <span className="block text-xs text-muted">{hora(r.createdAt)}</span>
                    </span>
                  </li>
                ))}
                {!registros.length && <li className="py-2 text-muted">Aún no registraste movimientos hoy.</li>}
              </ul>
            </section>
          </aside>
        </div>
      )}
    </div>
  )
}
