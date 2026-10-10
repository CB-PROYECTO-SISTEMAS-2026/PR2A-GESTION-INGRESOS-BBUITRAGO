import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { consultarClienteRecarga, getRecargasContexto, recargar } from '../../api/recargas.api'
import { toast } from '../../components/Toast'
import { IconCheck, IconQr, IconWallet, IconWarning } from '../../components/ui/icons'
import { useAuth } from '../../context/AuthContext'
import { feedbackError, feedbackOk } from '../../utils/feedback'
import { formatBs, formatDayRange, formatTime, getErrorMessage } from '../../utils/format'
import { nuevaClave, readJson, readStorage, writeJson, writeStorage } from '../../utils/storage'

// La librería de escaneo solo se descarga cuando el recargador va a escanear.
const CodigoScanner = lazy(() => import('../pos/components/CodigoScanner'))

const toCents = (value) => Math.round(Number(value) * 100)

/** Sin respuesta del servidor o error 5xx: la recarga pudo registrarse o no, se puede reintentar. */
const esReintentable = (err) => !err?.response || err.response.status >= 500

/**
 * Recargas enviadas cuya respuesta no llegó (HU-047). Se guardan en el celular con su clave para
 * reintentarlas: el servidor nunca acredita dos veces la misma clave.
 */
function usePendientes(userId) {
  const key = `eventix_recargas_pendientes:${userId ?? ''}`
  const [pendientes, setPendientes] = useState(() => readJson(key, []))

  const guardar = useCallback(
    (update) =>
      setPendientes((prev) => {
        const next = typeof update === 'function' ? update(prev) : update
        writeJson(key, next.length ? next : null)
        return next
      }),
    [key],
  )
  const agregar = useCallback((p) => guardar((prev) => [...prev.filter((x) => x.clave !== p.clave), p]), [guardar])
  const quitar = useCallback((clave) => guardar((prev) => prev.filter((x) => x.clave !== clave)), [guardar])
  /** Lectura directa del almacenamiento: el estado de React puede ir un render atrasado. */
  const leer = useCallback(() => readJson(key, []), [key])
  return { pendientes, agregar, quitar, leer }
}

/** HU-019 / HU-047: el recargador escanea la manilla o el QR del cliente y acredita saldo en efectivo. */
export default function RecargaPage() {
  const { user } = useAuth()
  const eventoKey = `eventix_recargas_evento:${user?.id ?? ''}`
  const [ctx, setCtx] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [eventoId, setEventoId] = useState(() => readStorage(eventoKey))
  const [paso, setPaso] = useState('inicio')
  const [cliente, setCliente] = useState(null)
  const [buscando, setBuscando] = useState(false)
  const [scanError, setScanError] = useState('')
  const [monto, setMonto] = useState('')
  const [clave, setClave] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [rechazo, setRechazo] = useState('')
  const [resultado, setResultado] = useState(null)
  const { pendientes, agregar, quitar, leer } = usePendientes(user?.id)
  const reintentando = useRef(false)

  const cargar = useCallback(async () => {
    try {
      const { data } = await getRecargasContexto()
      setCtx(data)
      setLoadError('')
      const enCurso = data.eventos.filter((e) => e.enCurso)
      setEventoId((prev) => (enCurso.some((e) => e.id === prev) ? prev : enCurso[0]?.id || ''))
    } catch (err) {
      setLoadError(getErrorMessage(err, 'No se pudo cargar la terminal de recargas.'))
    }
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  useEffect(() => {
    if (eventoId) writeStorage(eventoKey, eventoId)
  }, [eventoKey, eventoId])

  /** Reenvía las recargas pendientes con su misma clave. */
  const reintentarPendientes = useCallback(async () => {
    if (reintentando.current) return
    reintentando.current = true
    try {
      for (const p of leer()) {
        try {
          const { data } = await recargar({
            eventoId: p.eventoId,
            codigo: p.codigo,
            monto: p.monto,
            metodoPago: 'EFECTIVO',
            idempotencyKey: p.clave,
          })
          quitar(p.clave)
          toast(`Recarga de ${formatBs(data.monto)} a ${data.cliente.nombre} confirmada.`, 'success')
        } catch (err) {
          if (esReintentable(err)) break // Sigue sin conexión: se intentará más tarde.
          quitar(p.clave)
          toast(
            `La recarga de ${formatBs(p.monto)} a ${p.cliente} no se registró: ${getErrorMessage(err)} Devuelve el efectivo al cliente.`,
            'error',
          )
        }
      }
    } finally {
      reintentando.current = false
    }
  }, [leer, quitar])

  // Al abrir la terminal y al recuperar la conexión se reintentan las recargas pendientes.
  useEffect(() => {
    reintentarPendientes()
    window.addEventListener('online', reintentarPendientes)
    return () => window.removeEventListener('online', reintentarPendientes)
  }, [reintentarPendientes])

  const eventosHoy = ctx?.eventos.filter((e) => e.enCurso) ?? []
  const evento = eventosHoy.find((e) => e.id === eventoId)

  const reiniciar = () => {
    setCliente(null)
    setMonto('')
    setClave(null)
    setRechazo('')
    setScanError('')
    setResultado(null)
  }

  const nuevaRecarga = () => {
    reiniciar()
    setPaso('escanear')
  }

  const volverAlInicio = () => {
    reiniciar()
    setPaso('inicio')
    cargar()
  }

  const onCodigo = async (codigo) => {
    if (buscando) return
    setBuscando(true)
    setScanError('')
    try {
      const { data } = await consultarClienteRecarga({ eventoId, codigo })
      setCliente({ ...data, codigo })
      setMonto('')
      setPaso('monto')
      feedbackOk()
    } catch (err) {
      setScanError(getErrorMessage(err, 'No se pudo identificar al cliente.'))
      feedbackError()
    } finally {
      setBuscando(false)
    }
  }

  const irAConfirmar = () => {
    // Nueva clave por cada recarga que se va a confirmar; se conserva en los reintentos.
    setClave(nuevaClave())
    setRechazo('')
    setPaso('confirmar')
  }

  const confirmar = async () => {
    if (enviando) return
    setEnviando(true)
    setRechazo('')
    const pendiente = {
      clave,
      eventoId,
      codigo: cliente.codigo,
      monto: Number(monto),
      cliente: cliente.cliente.nombre,
      creada: new Date().toISOString(),
    }
    // Se guarda ANTES de enviar: si el celular se queda sin red o se cierra, la recarga no se pierde.
    agregar(pendiente)
    try {
      const { data } = await recargar({
        eventoId,
        codigo: cliente.codigo,
        monto: Number(monto),
        metodoPago: 'EFECTIVO',
        idempotencyKey: clave,
      })
      quitar(clave)
      setResultado(data)
      setPaso('resultado')
      feedbackOk()
    } catch (err) {
      const body = err?.response?.data
      if (esReintentable(err)) {
        setRechazo(
          'No se pudo confirmar la recarga por un problema de conexión. Quedó pendiente y se reintentará sola: no vuelvas a cobrarle al cliente ni repitas la recarga.',
        )
      } else {
        quitar(clave)
        if (body?.code === 'SALDO_MAXIMO') {
          setCliente((c) => ({ ...c, saldo: body.saldo, maxRecargable: body.maxRecargable }))
        }
        setRechazo(getErrorMessage(err, 'No se pudo completar la recarga.'))
      }
      feedbackError()
    } finally {
      setEnviando(false)
    }
  }

  if (loadError) {
    return (
      <div className="m-4 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800" role="alert">
        <p className="font-semibold">No puedes recargar por ahora</p>
        <p className="mt-1">{loadError}</p>
        <button type="button" className="btn-secondary btn-sm mt-4" onClick={cargar}>
          Reintentar
        </button>
      </div>
    )
  }

  if (!ctx) return <p className="p-6 text-center text-muted">Cargando terminal de recargas…</p>

  const avisoPendientes = pendientes.length > 0 && (
    <PendientesAviso pendientes={pendientes} onReintentar={reintentarPendientes} />
  )

  if (!eventosHoy.length) {
    const proximos = ctx.eventos.filter((e) => !e.enCurso)
    return (
      <div className="grid gap-4 p-4">
        {avisoPendientes}
        <div className="rounded-xl border border-border bg-white p-5">
          <h1 className="font-display text-xl font-bold">Recargador de Saldo</h1>
          <p className="mt-2 text-sm text-muted">
            {ctx.eventos.length
              ? 'No hay eventos abiertos ahora. Solo se puede recargar durante los días y el horario del evento.'
              : 'Todavía no estás asignado a ningún evento. Pide al administrador que te asigne como recargador.'}
          </p>
          {proximos.length > 0 && (
            <ul className="mt-4 divide-y divide-border text-sm">
              {proximos.map((e) => (
                <li key={e.id} className="py-2">
                  <p className="font-medium">{e.titulo}</p>
                  <p className="text-xs text-muted">
                    {e.horarioHoy
                      ? `Hoy de ${e.horarioHoy} (fuera de horario en este momento)`
                      : formatDayRange(e.fechaInicio, e.fechaFin)}
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
      {avisoPendientes && <div className="px-4 pt-4">{avisoPendientes}</div>}

      {paso === 'inicio' && (
        <div className="flex flex-1 flex-col items-center gap-6 p-4 text-center">
          <div className="mt-6">
            <h1 className="font-display text-2xl font-bold">Recargador de Saldo</h1>
            <p className="mt-1 text-sm text-muted">Escanea la manilla del asistente para recargar saldo</p>
          </div>
          <div className="flex h-40 w-40 items-center justify-center rounded-3xl bg-teal/10 text-teal-dark">
            <IconQr className="h-20 w-20" />
          </div>
          <button type="button" className="btn-primary w-full" onClick={() => setPaso('escanear')}>
            <IconQr className="h-5 w-5" /> Escanear Manilla
          </button>
          {eventosHoy.length > 1 ? (
            <select
              className="input !py-1.5 text-sm"
              value={eventoId}
              onChange={(e) => setEventoId(e.target.value)}
              aria-label="Evento"
            >
              {eventosHoy.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.titulo}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-sm text-muted">
              Evento: <span className="font-semibold text-ink">{evento?.titulo}</span>
              {evento?.horarioHoy && <span> · Hoy {evento.horarioHoy}</span>}
            </p>
          )}
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
          {scanError && (
            <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
              {scanError}
            </p>
          )}
          <button type="button" className="py-2 text-sm font-semibold text-muted" onClick={volverAlInicio}>
            Volver
          </button>
        </div>
      )}

      {paso === 'monto' && cliente && (
        <ElegirMonto
          ctx={ctx}
          cliente={cliente}
          monto={monto}
          onMonto={setMonto}
          onContinuar={irAConfirmar}
          onCancelar={volverAlInicio}
        />
      )}

      {paso === 'confirmar' && cliente && (
        <ConfirmarRecarga
          cliente={cliente}
          monto={monto}
          rechazo={rechazo}
          enviando={enviando}
          pendiente={pendientes.some((p) => p.clave === clave)}
          onConfirmar={confirmar}
          onCambiarMonto={() => {
            setRechazo('')
            setPaso('monto')
          }}
          onCancelar={volverAlInicio}
        />
      )}

      {paso === 'resultado' && resultado && (
        <RecargaExitosa resultado={resultado} onNueva={nuevaRecarga} onInicio={volverAlInicio} />
      )}
    </div>
  )
}

function ClienteCard({ cliente, saldoLabel = 'Saldo actual', saldo }) {
  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-teal/10 font-bold text-teal-dark">
          {cliente.nombre.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{cliente.nombre}</p>
          {cliente.identificador && (
            <p className="text-xs text-muted">
              {cliente.medio === 'MANILLA' ? 'Manilla' : 'Entrada digital'} {cliente.identificador}
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="text-xs text-muted">{saldoLabel}</p>
          <p className="font-display text-lg font-bold text-teal-dark">{formatBs(saldo)}</p>
        </div>
      </div>
    </div>
  )
}

/** Valida el monto contra los límites de la API y el saldo máximo del cliente en el evento. */
function errorDeMonto(monto, ctx, cliente) {
  if (monto === '') return ''
  if (!/^\d+(\.\d{1,2})?$/.test(String(monto))) return 'Ingresa un monto válido (hasta 2 decimales).'
  const cents = toCents(monto)
  if (cents < toCents(ctx.limites.minimo)) return `El monto mínimo es ${formatBs(ctx.limites.minimo)}.`
  if (cents > toCents(ctx.limites.maximo)) return `El monto máximo por recarga es ${formatBs(ctx.limites.maximo)}.`
  if (cents > toCents(cliente.maxRecargable)) {
    return `El saldo máximo por evento es ${formatBs(ctx.limites.saldoMaximo)}: a este cliente solo se le pueden recargar ${formatBs(cliente.maxRecargable)}.`
  }
  return ''
}

function ElegirMonto({ ctx, cliente, monto, onMonto, onContinuar, onCancelar }) {
  const error = errorDeMonto(monto, ctx, cliente)
  const sinCupo = toCents(cliente.maxRecargable) < toCents(ctx.limites.minimo)

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div>
        <h1 className="font-display text-xl font-bold">Recargar Saldo</h1>
        <p className="text-sm text-muted">Selecciona el monto que deseas recargar</p>
      </div>
      <ClienteCard cliente={cliente.cliente} saldo={cliente.saldo} />

      {sinCupo ? (
        <div className="flex gap-3 rounded-xl border-2 border-amber-400 bg-amber-50 p-4 text-amber-900" role="alert">
          <IconWarning className="mt-0.5 h-6 w-6 shrink-0" />
          <p className="text-sm">
            Este cliente ya tiene el saldo máximo permitido por evento ({formatBs(ctx.limites.saldoMaximo)}). No se le
            puede recargar más.
          </p>
        </div>
      ) : (
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (monto !== '' && !error) onContinuar()
          }}
        >
          <fieldset>
            <legend className="label">Selecciona el monto</legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {ctx.montosRapidos.map((m) => {
                const activo = monto !== '' && toCents(monto) === toCents(m)
                const excede = toCents(m) > toCents(cliente.maxRecargable)
                return (
                  <button
                    key={m}
                    type="button"
                    disabled={excede}
                    aria-pressed={activo}
                    onClick={() => onMonto(String(Number(m)))}
                    className={`rounded-xl border py-4 font-display text-xl font-bold transition disabled:opacity-40 ${
                      activo ? 'border-teal bg-teal/10 text-teal-dark ring-1 ring-teal' : 'border-border bg-white'
                    }`}
                  >
                    {formatBs(m)}
                  </button>
                )
              })}
            </div>
          </fieldset>
          <div>
            <label className="label" htmlFor="otro-monto">
              Otro monto
            </label>
            <div className="relative mt-1">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted">
                Bs
              </span>
              <input
                id="otro-monto"
                className="input pl-10 text-lg font-semibold tabular-nums"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0"
                value={monto}
                onChange={(e) => onMonto(e.target.value.replace(',', '.').trim())}
                aria-invalid={Boolean(error)}
                aria-describedby="monto-ayuda"
              />
            </div>
            <p id="monto-ayuda" className={`mt-1 text-xs ${error ? 'text-red-600' : 'text-muted'}`} role={error ? 'alert' : undefined}>
              {error ||
                `Entre ${formatBs(ctx.limites.minimo)} y ${formatBs(
                  Math.min(Number(ctx.limites.maximo), Number(cliente.maxRecargable)),
                )}. Pago en efectivo.`}
            </p>
          </div>
          <div className="mt-2 grid gap-2">
            <button type="submit" className="btn-primary w-full" disabled={monto === '' || Boolean(error)}>
              Recargar
            </button>
            <button type="button" className="py-2 text-sm font-semibold text-red-600" onClick={onCancelar}>
              Cancelar
            </button>
          </div>
        </form>
      )}
      {sinCupo && (
        <button type="button" className="btn-secondary w-full" onClick={onCancelar}>
          Volver al inicio
        </button>
      )}
    </div>
  )
}

function ConfirmarRecarga({ cliente, monto, rechazo, enviando, pendiente, onConfirmar, onCambiarMonto, onCancelar }) {
  const nuevoSaldo = (toCents(cliente.saldo) + toCents(monto)) / 100
  const filas = [
    ['Usuario', cliente.cliente.nombre],
    [cliente.cliente.medio === 'MANILLA' ? 'Manilla' : 'Entrada', cliente.cliente.identificador],
    ['Saldo actual', formatBs(cliente.saldo)],
  ]

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div>
        <h1 className="font-display text-xl font-bold">Confirmar Recarga</h1>
        <p className="text-sm text-muted">Verifica los detalles antes de procesar la transacción</p>
      </div>
      <dl className="grid gap-2 rounded-xl border border-border bg-white p-4 text-sm">
        {filas.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3">
            <dt className="text-muted">{k}</dt>
            <dd className="text-right font-semibold">{v}</dd>
          </div>
        ))}
        <div className="mt-1 flex justify-between gap-3 border-t border-border pt-3 text-base">
          <dt className="text-muted">Monto a recargar</dt>
          <dd className="font-bold text-teal-dark">+ {formatBs(monto)}</dd>
        </div>
        <div className="flex justify-between gap-3 text-base">
          <dt className="text-muted">Nuevo saldo</dt>
          <dd className="font-display text-xl font-bold">{formatBs(nuevoSaldo)}</dd>
        </div>
      </dl>

      <div className="flex gap-3 rounded-xl bg-teal/10 p-4 text-sm text-teal-dark">
        <IconWallet className="mt-0.5 h-5 w-5 shrink-0" />
        <p>
          Recibe <strong>{formatBs(monto)} en efectivo</strong> del cliente antes de confirmar.
        </p>
      </div>

      {rechazo && (
        <div
          className={`flex gap-3 rounded-xl border-2 p-4 ${
            pendiente ? 'border-amber-400 bg-amber-50 text-amber-900' : 'border-red-500 bg-red-50 text-red-800'
          }`}
          role="alert"
        >
          <IconWarning className="mt-0.5 h-6 w-6 shrink-0" />
          <div>
            <p className="font-bold">{pendiente ? 'Recarga pendiente' : 'Recarga rechazada'}</p>
            <p className="text-sm">{rechazo}</p>
          </div>
        </div>
      )}

      <div className="mt-auto grid gap-2">
        <button type="button" className="btn-primary w-full" onClick={onConfirmar} disabled={enviando}>
          <IconCheck className="h-5 w-5" />{' '}
          {enviando ? 'Procesando…' : pendiente ? 'Reintentar esta recarga' : 'Confirmar Recarga'}
        </button>
        {!pendiente && (
          <button type="button" className="btn-secondary w-full" onClick={onCambiarMonto} disabled={enviando}>
            Cambiar monto
          </button>
        )}
        <button type="button" className="py-2 text-sm font-semibold text-red-600" onClick={onCancelar} disabled={enviando}>
          {pendiente ? 'Volver al inicio' : 'Cancelar'}
        </button>
      </div>
    </div>
  )
}

function RecargaExitosa({ resultado, onNueva, onInicio }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-4 p-4">
      <div className="mt-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-white">
        <IconCheck className="h-8 w-8" strokeWidth={2.5} />
      </div>
      <div className="text-center">
        <p className="font-display text-2xl font-bold">Recarga Exitosa</p>
        <p className="text-sm text-muted">El saldo ha sido actualizado</p>
        {resultado.repetido && (
          <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Esta recarga ya se había registrado: se muestra el comprobante original y no se acreditó otra vez.
          </p>
        )}
      </div>
      <div className="w-full rounded-xl border border-border bg-white p-4 text-center">
        <p className="font-semibold">{resultado.cliente.nombre}</p>
        {resultado.cliente.identificador && (
          <p className="text-xs text-muted">
            {resultado.cliente.medio === 'MANILLA' ? 'Manilla' : 'Entrada digital'} {resultado.cliente.identificador}
          </p>
        )}
        <p className="mt-3 text-xs text-muted">Nuevo saldo</p>
        <p className="font-display text-3xl font-bold text-teal-dark">{formatBs(resultado.saldoResultante)}</p>
      </div>
      <dl className="grid w-full gap-2 rounded-xl border border-border bg-white p-4 text-sm">
        {[
          ['Monto recargado', `+ ${formatBs(resultado.monto)}`],
          ['Pago', 'Efectivo'],
          ['Transacción', resultado.codigo],
          ['Hora', formatTime(resultado.fecha)],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3">
            <dt className="text-muted">{k}</dt>
            <dd className="text-right font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-auto grid w-full gap-2">
        <button type="button" className="btn-primary w-full" onClick={onNueva}>
          + Nueva Recarga
        </button>
        <button type="button" className="py-2 text-sm font-semibold text-muted" onClick={onInicio}>
          Volver al inicio
        </button>
        <Link to="/recargas/historial" className="text-center text-xs font-semibold text-teal-dark">
          Ver mis recargas
        </Link>
      </div>
    </div>
  )
}

function PendientesAviso({ pendientes, onReintentar }) {
  return (
    <div className="rounded-xl border-2 border-amber-400 bg-amber-50 p-4 text-sm text-amber-900" role="status">
      <p className="font-bold">
        {pendientes.length === 1 ? '1 recarga sin confirmar' : `${pendientes.length} recargas sin confirmar`}
      </p>
      <ul className="mt-2 grid gap-1">
        {pendientes.map((p) => (
          <li key={p.clave} className="flex justify-between gap-2">
            <span className="truncate">{p.cliente}</span>
            <span className="shrink-0 font-semibold tabular-nums">{formatBs(p.monto)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs">
        Se reintentan solas al recuperar la conexión. No las repitas: el sistema nunca las acredita dos veces.
      </p>
      <button type="button" className="btn-secondary btn-sm mt-3" onClick={onReintentar}>
        Reintentar ahora
      </button>
    </div>
  )
}
