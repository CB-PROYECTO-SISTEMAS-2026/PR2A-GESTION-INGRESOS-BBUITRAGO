import { Comprobante } from '../sprint3/Devoluciones'
import { Suspense, lazy, useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { consultarClienteDevolucion, devolverSaldo, getDevolucionesContexto } from '../../api/recargas.api'
import TarjetaLectura from '../../components/terminal/TarjetaLectura'
import { IconCheck, IconQr, IconWallet, IconWarning } from '../../components/ui/icons'
import { useAuth } from '../../context/AuthContext'
import { feedbackError, feedbackOk } from '../../utils/feedback'
import { formatBs, formatDateTime, formatDay, formatDayRange, formatTime, getErrorMessage } from '../../utils/format'
import { nuevaClave, readStorage, writeStorage } from '../../utils/storage'

// La librería de escaneo solo se descarga cuando el encargado va a escanear.
const CodigoScanner = lazy(() => import('../pos/components/CodigoScanner'))

/** Sin respuesta del servidor o error 5xx: la devolución pudo registrarse o no, se reintenta con la misma clave. */
const esReintentable = (err) => !err?.response || err.response.status >= 500

function textoPlazo(plazo) {
  if (!plazo) return ''
  if (plazo.vencido) return `Plazo vencido el ${formatDay(plazo.fechaLimite)}`
  return `Devoluciones hasta el ${formatDay(plazo.fechaLimite)} (${
    plazo.diasRestantes === 1 ? 'último día' : `${plazo.diasRestantes} días`
  })`
}

/**
 * Módulo A (HU-026, HU-027, HU-028): el encargado de devoluciones escanea la manilla o el QR del
 * cliente, verifica su identidad con la foto del primer ingreso y le entrega en efectivo el saldo
 * que le quedó en el evento. Se puede devolver durante el evento y hasta 30 días después.
 */
export default function DevolucionPage() {
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const eventoKey = `eventix_devoluciones_evento:${user?.id ?? ''}`
  const [ctx, setCtx] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [eventoId, setEventoId] = useState(() => readStorage(eventoKey))
  const [paso, setPaso] = useState('inicio')
  const [cliente, setCliente] = useState(null)
  const [buscando, setBuscando] = useState(false)
  const [scanError, setScanError] = useState('')
  const [verificado, setVerificado] = useState(false)
  const [clave, setClave] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [rechazo, setRechazo] = useState(null)
  const [resultado, setResultado] = useState(null)

  const cargar = useCallback(async () => {
    try {
      const { data } = await getDevolucionesContexto()
      setCtx(data)
      setLoadError('')
      const disponibles = data.eventos.filter((e) => e.disponible)
      setEventoId((prev) => (disponibles.some((e) => e.id === prev) ? prev : disponibles[0]?.id || ''))
    } catch (err) {
      setLoadError(getErrorMessage(err, 'No se pudo cargar la terminal de devoluciones.'))
    }
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  useEffect(() => {
    if (eventoId) writeStorage(eventoKey, eventoId)
  }, [eventoKey, eventoId])

  useEffect(() => {
    if (!location.state?.openLector) return
    setPaso('escanear')
    navigate('.', { replace: true, state: {} })
  }, [location.state?.openLector, navigate])

  const disponibles = ctx?.eventos.filter((e) => e.disponible) ?? []
  const evento = disponibles.find((e) => e.id === eventoId)

  const reiniciar = () => {
    setCliente(null)
    setVerificado(false)
    setClave(null)
    setRechazo(null)
    setScanError('')
    setResultado(null)
  }

  const nuevaDevolucion = () => {
    reiniciar()
    setPaso('escanear')
  }

  const volverAlInicio = () => {
    reiniciar()
    setPaso('inicio')
    cargar()
  }

  const consultar = async (codigo) => {
    const { data } = await consultarClienteDevolucion({ eventoId, codigo })
    setCliente({ ...data, codigo })
    return data
  }

  const onCodigo = async (codigo) => {
    if (buscando) return
    setBuscando(true)
    setScanError('')
    try {
      await consultar(codigo)
      setVerificado(false)
      setPaso('detalle')
      feedbackOk()
    } catch (err) {
      setScanError(getErrorMessage(err, 'No se pudo identificar al cliente.'))
      feedbackError()
    } finally {
      setBuscando(false)
    }
  }

  const irAConfirmar = () => {
    // Nueva clave por cada devolución que se va a confirmar; se conserva en los reintentos.
    setClave(nuevaClave())
    setRechazo(null)
    setPaso('confirmar')
  }

  const confirmar = async () => {
    if (enviando) return
    setEnviando(true)
    setRechazo(null)
    try {
      const { data } = await devolverSaldo({
        eventoId,
        codigo: cliente.codigo,
        montoEsperado: Number(cliente.montoDevolvible),
        identidadVerificada: verificado,
        idempotencyKey: clave,
      })
      setResultado(data)
      setPaso('resultado')
      feedbackOk()
    } catch (err) {
      const body = err?.response?.data
      if (esReintentable(err)) {
        setRechazo({
          pendiente: true,
          mensaje:
            'No se pudo confirmar la devolución por un problema de conexión. NO entregues el efectivo todavía: reintenta hasta que se confirme.',
        })
      } else {
        setRechazo({ pendiente: false, mensaje: getErrorMessage(err, 'No se pudo completar la devolución.') })
        if (body?.code === 'SALDO_CAMBIO' || body?.code === 'SIN_SALDO') {
          // El saldo cambió desde que se escaneó: se vuelve a consultar para mostrar el monto real.
          try {
            await consultar(cliente.codigo)
          } catch {
            /* se mantiene el mensaje de rechazo */
          }
          setPaso('detalle')
        }
      }
      feedbackError()
    } finally {
      setEnviando(false)
    }
  }

  if (loadError) {
    return (
      <div className="m-4 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800" role="alert">
        <p className="font-semibold">No puedes hacer devoluciones por ahora</p>
        <p className="mt-1">{loadError}</p>
        <button type="button" className="btn-secondary btn-sm mt-4" onClick={cargar}>
          Reintentar
        </button>
      </div>
    )
  }

  if (!ctx) return <p className="p-6 text-center text-muted">Cargando terminal de devoluciones…</p>

  if (!disponibles.length) {
    const vencidos = ctx.eventos.filter((e) => !e.disponible)
    return (
      <div className="grid gap-4 p-4">
        <div className="rounded-xl border border-border bg-white p-5">
          <h1 className="font-display text-xl font-bold">Devolución de Saldo</h1>
          <p className="mt-2 text-sm text-muted">
            {ctx.eventos.length
              ? 'El plazo de devolución de tus eventos ya venció. Solo se devuelve saldo durante el evento y hasta 30 días después.'
              : 'Todavía no estás asignado a ningún evento. Pide al administrador que te asigne a devoluciones.'}
          </p>
          {vencidos.length > 0 && (
            <ul className="mt-4 divide-y divide-border text-sm">
              {vencidos.map((e) => (
                <li key={e.id} className="py-2">
                  <p className="font-medium">{e.titulo}</p>
                  <p className="text-xs text-muted">
                    {formatDayRange(e.fechaInicio, e.fechaFin)} · {textoPlazo(e.plazo)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col">
      {paso === 'inicio' && (
        <div className="flex flex-1 flex-col items-center gap-6 p-4 text-center">
          <div className="mt-6">
            <h1 className="font-display text-2xl font-bold">Devolución de Saldo</h1>
            <p className="mt-1 text-sm text-muted">Escanea la manilla para devolver el saldo restante</p>
          </div>
          <div className="flex h-40 w-40 items-center justify-center rounded-3xl bg-teal/10 text-teal-dark">
            <IconQr className="h-20 w-20" />
          </div>
          <button type="button" className="btn-primary w-full" onClick={() => setPaso('escanear')}>
            <IconQr className="h-5 w-5" /> Escanear Manilla
          </button>
          {disponibles.length > 1 ? (
            <select
              className="input !py-1.5 text-sm"
              value={eventoId}
              onChange={(e) => setEventoId(e.target.value)}
              aria-label="Evento"
            >
              {disponibles.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.titulo}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-sm text-muted">
              Evento: <span className="font-semibold text-ink">{evento?.titulo}</span>
            </p>
          )}
          {evento?.plazo && <p className="-mt-4 text-xs text-muted">{textoPlazo(evento.plazo)}</p>}
        </div>
      )}

      {paso === 'escanear' && (
        <div className="flex flex-1 flex-col gap-4 p-4">
          <div className="text-center">
            <h1 className="font-display text-xl font-bold">Escanear cliente</h1>
            <p className="text-sm text-muted">Evento: {evento?.titulo}</p>
          </div>
          <Suspense fallback={<p className="py-16 text-center text-sm text-muted">Iniciando cámara…</p>}>
            <CodigoScanner onCodigo={onCodigo} disabled={buscando} />
          </Suspense>
          {buscando && <p className="text-center text-sm text-muted">Buscando cliente…</p>}
          {scanError && <TarjetaLectura tono="danger" titulo="No se pudo leer" motivo={scanError} />}
          <button type="button" className="py-2 text-sm font-semibold text-muted" onClick={volverAlInicio}>
            Volver
          </button>
        </div>
      )}

      {paso === 'detalle' && cliente && (
        <DetalleCliente
          cliente={cliente}
          verificado={verificado}
          onVerificado={setVerificado}
          rechazo={rechazo}
          onContinuar={irAConfirmar}
          onCancelar={volverAlInicio}
        />
      )}

      {paso === 'confirmar' && cliente && (
        <ConfirmarDevolucion
          cliente={cliente}
          rechazo={rechazo}
          enviando={enviando}
          onConfirmar={confirmar}
          onCancelar={volverAlInicio}
        />
      )}

      {paso === 'resultado' && resultado && (
        <DevolucionExitosa resultado={resultado} onNueva={nuevaDevolucion} onInicio={volverAlInicio} />
      )}
    </div>
  )
}

function Rechazo({ rechazo }) {
  if (!rechazo) return null
  return (
    <TarjetaLectura
      tono={rechazo.pendiente ? 'warning' : 'danger'}
      titulo={rechazo.pendiente ? 'Devolución sin confirmar' : 'Devolución rechazada'}
      motivo={rechazo.mensaje}
    />
  )
}

/**
 * HU-026 / HU-027: quién es el cliente, la foto de su primer ingreso para compararla con la
 * persona y el saldo que se le puede devolver. Sin foto, se verifica con su documento.
 */
function DetalleCliente({ cliente, verificado, onVerificado, rechazo, onContinuar, onCancelar }) {
  const { cliente: c, fotoIngreso } = cliente
  const medio = c.medio === 'MANILLA' ? 'Manilla' : 'Entrada digital'

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div>
        <h1 className="font-display text-xl font-bold">Devolución de Saldo</h1>
        <p className="text-sm text-muted">Confirma el monto restante a ser devuelto</p>
      </div>

      <div className="rounded-xl border border-border bg-white p-4">
        <div className="flex items-start gap-4">
          {fotoIngreso ? (
            <img
              src={fotoIngreso.url}
              alt={`Foto del primer ingreso de ${c.nombre}`}
              className="h-28 w-24 shrink-0 rounded-lg border border-border object-cover"
            />
          ) : (
            <div className="flex h-28 w-24 shrink-0 items-center justify-center rounded-lg border border-dashed border-border px-2 text-center text-xs text-muted">
              Sin foto de ingreso
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{c.nombre}</p>
            <p className="text-xs text-muted">
              {medio} {c.identificador}
            </p>
            {c.documento && <p className="mt-1 text-xs text-muted">Documento: {c.documento}</p>}
            {fotoIngreso && (
              <p className="mt-1 text-xs text-muted">Foto del {formatDateTime(fotoIngreso.tomadaAt)}</p>
            )}
          </div>
        </div>
        <div className="mt-4 border-t border-border pt-4 text-center">
          <p className="font-display text-4xl font-bold text-teal-dark">{formatBs(cliente.montoDevolvible)}</p>
          <p className="text-xs text-muted">Saldo a devolver</p>
          {cliente.plazo && <p className="mt-1 text-xs text-muted">{textoPlazo(cliente.plazo)}</p>}
        </div>
      </div>

      <Rechazo rechazo={rechazo} />

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-ink">Últimos movimientos</h2>
        {(cliente.movimientos || []).length ? (
          <ul className="grid gap-2">
            {cliente.movimientos.map((m, i) => (
              <li key={m.id || i} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-white p-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">{m.tipo}</p>
                  <p className="text-xs text-muted">{formatDateTime(m.createdAt)}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-semibold text-ink">{formatBs(m.monto)}</p>
                  <p className="text-xs text-muted">{m.estado}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Sin movimientos en este evento.</p>
        )}
      </section>
      {cliente.puedeDevolver && fotoIngreso ? (
        <>
          <p className="rounded-xl bg-teal/10 p-4 text-sm text-teal-dark">
            El saldo será devuelto al asistente y su saldo en este evento quedará en {formatBs(0)}.
          </p>
          <label className="flex items-start gap-3 rounded-xl border border-border bg-white p-4 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 h-5 w-5 shrink-0"
              checked={verificado}
              onChange={(e) => onVerificado(e.target.checked)}
            />
            <span>
              Comparé la foto del primer ingreso y la persona es la misma.
            </span>
          </label>
          <div className="mt-auto grid gap-2">
            <button type="button" className="btn-primary w-full" onClick={onContinuar} disabled={!verificado}>
              Devolver Saldo
            </button>
            <button type="button" className="py-2 text-sm font-semibold text-red-600" onClick={onCancelar}>
              Cancelar
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="flex gap-3 rounded-xl border-2 border-amber-400 bg-amber-50 p-4 text-amber-900" role="alert">
            <IconWarning className="mt-0.5 h-6 w-6 shrink-0" />
            <div className="text-sm">
              <p>{cliente.motivo || 'No se pueden devolver puntos sin la foto del primer ingreso.'}</p>
              {cliente.ultimaDevolucion && (
                <p className="mt-1">
                  Última devolución: {formatBs(cliente.ultimaDevolucion.monto)} el{' '}
                  {formatDateTime(cliente.ultimaDevolucion.fecha)} ({cliente.ultimaDevolucion.codigo}).
                </p>
              )}
            </div>
          </div>
          <button type="button" className="btn-secondary mt-auto w-full" onClick={onCancelar}>
            Volver al inicio
          </button>
        </>
      )}
    </div>
  )
}

function ConfirmarDevolucion({ cliente, rechazo, enviando, onConfirmar, onCancelar }) {
  const pendiente = Boolean(rechazo?.pendiente)
  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div>
        <h1 className="font-display text-xl font-bold">Confirmar Devolución</h1>
        <p className="text-sm text-muted">Verifica la información antes de liquidar la manilla</p>
      </div>
      <dl className="grid gap-2 rounded-xl border border-border bg-white p-4 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Usuario</dt>
          <dd className="text-right font-semibold">{cliente.cliente.nombre}</dd>
        </div>
        <div className="mt-1 flex justify-between gap-3 border-t border-border pt-3 text-base">
          <dt className="text-muted">Monto a devolver</dt>
          <dd className="font-display text-xl font-bold text-teal-dark">{formatBs(cliente.montoDevolvible)}</dd>
        </div>
        <div className="flex justify-between gap-3 text-base">
          <dt className="text-muted">Saldo después</dt>
          <dd className="font-bold">{formatBs(0)}</dd>
        </div>
      </dl>

      <div className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        <IconWarning className="mt-0.5 h-5 w-5 shrink-0" />
        <p>
          Esta acción no se puede deshacer. Entrega <strong>{formatBs(cliente.montoDevolvible)} en efectivo</strong> solo
          cuando la devolución quede confirmada.
        </p>
      </div>

      <Rechazo rechazo={rechazo} />

      <div className="mt-auto grid gap-2">
        <button type="button" className="btn-primary w-full" onClick={onConfirmar} disabled={enviando}>
          <IconCheck className="h-5 w-5" />{' '}
          {enviando ? 'Procesando…' : pendiente ? 'Reintentar esta devolución' : 'Confirmar Devolución'}
        </button>
        <button type="button" className="py-2 text-sm font-semibold text-red-600" onClick={onCancelar} disabled={enviando}>
          Cancelar
        </button>
      </div>
    </div>
  )
}

function DevolucionExitosa({ resultado, onNueva, onInicio }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-4 p-4">
      <TarjetaLectura
        tono="success"
        titulo="Devolución exitosa"
        nombre={resultado.cliente.nombre}
        codigo={resultado.codigo}
        motivo={
          resultado.repetido
            ? 'Esta devolución ya se había registrado: se muestra el comprobante original y no se descontó otra vez.'
            : null
        }
      />
      <div className="w-full rounded-xl border border-border bg-white p-4 text-center">
        <p className="font-semibold">{resultado.cliente.nombre}</p>
        {resultado.cliente.identificador && (
          <p className="text-xs text-muted">
            {resultado.cliente.medio === 'MANILLA' ? 'Manilla' : 'Entrada digital'} {resultado.cliente.identificador}
          </p>
        )}
        <p className="mt-3 text-xs text-muted">Monto devuelto</p>
        <p className="font-display text-3xl font-bold text-teal-dark">{formatBs(resultado.monto)}</p>
      </div>
      <Comprobante id={resultado.transaccionId}/>
        <dl className="grid w-full gap-2 rounded-xl border border-border bg-white p-4 text-sm">
        {[
          ['Pago', 'Efectivo'],
          ['Saldo después', formatBs(resultado.saldoResultante)],
          ['Transacción', resultado.codigo],
          ['Hora', formatTime(resultado.fecha)],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3">
            <dt className="text-muted">{k}</dt>
            <dd className="text-right font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="flex w-full gap-3 rounded-xl bg-teal/10 p-4 text-sm text-teal-dark">
        <IconWallet className="mt-0.5 h-5 w-5 shrink-0" />
        <p>Entrega ahora el efectivo al asistente.</p>
      </div>
      <div className="mt-auto grid w-full gap-2">
        <button type="button" className="btn-primary w-full" onClick={onNueva}>
          Nueva Devolución
        </button>
        <button type="button" className="py-2 text-sm font-semibold text-muted" onClick={onInicio}>
          Volver al inicio
        </button>
      </div>
    </div>
  )
}
