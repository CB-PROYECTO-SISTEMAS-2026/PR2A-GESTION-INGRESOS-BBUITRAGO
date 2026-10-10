import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { cobrar, consultarCliente, getPosContexto } from '../../api/pos.api'
import { IconCheck, IconQr, IconWarning } from '../../components/ui/icons'
import { formatBs, formatDayRange, formatTime, getErrorMessage } from '../../utils/format'
import { feedbackError, feedbackOk } from '../../utils/feedback'

// La librería de escaneo solo se descarga cuando el ayudante va a cobrar.
const CodigoScanner = lazy(() => import('./components/CodigoScanner'))

const EVENTO_KEY = 'eventix_pos_evento'
const MAX_CANTIDAD = 99

function toCents(value) {
  return Math.round(Number(value) * 100)
}

export default function PosPage() {
  const [ctx, setCtx] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [eventoId, setEventoId] = useState(() => localStorage.getItem(EVENTO_KEY) || '')
  const [carrito, setCarrito] = useState({})
  const [paso, setPaso] = useState('catalogo')
  const [cliente, setCliente] = useState(null)
  const [buscando, setBuscando] = useState(false)
  const [scanError, setScanError] = useState('')
  const [cobrando, setCobrando] = useState(false)
  const [rechazo, setRechazo] = useState(null)
  const [resultado, setResultado] = useState(null)

  const cargar = useCallback(async () => {
    try {
      const { data } = await getPosContexto()
      setCtx(data)
      setLoadError('')
      const enCurso = data.eventos.filter((e) => e.enCurso)
      setEventoId((prev) => (enCurso.some((e) => e.id === prev) ? prev : enCurso[0]?.id || ''))
      // Quita del carrito productos que ya no estén disponibles.
      setCarrito((prev) =>
        Object.fromEntries(Object.entries(prev).filter(([id]) => data.productos.some((p) => p.id === id))),
      )
    } catch (err) {
      setLoadError(getErrorMessage(err, 'No se pudo cargar el punto de venta.'))
    }
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  useEffect(() => {
    if (eventoId) localStorage.setItem(EVENTO_KEY, eventoId)
  }, [eventoId])

  const productos = useMemo(() => ctx?.productos ?? [], [ctx])
  const eventosHoy = ctx?.eventos.filter((e) => e.enCurso) ?? []
  const evento = eventosHoy.find((e) => e.id === eventoId)

  const lineas = useMemo(
    () =>
      productos
        .filter((p) => carrito[p.id] > 0)
        .map((p) => ({ ...p, cantidad: carrito[p.id], subtotalCents: toCents(p.precio) * carrito[p.id] })),
    [productos, carrito],
  )
  const totalCents = lineas.reduce((acc, l) => acc + l.subtotalCents, 0)
  const total = totalCents / 100
  const articulos = lineas.reduce((acc, l) => acc + l.cantidad, 0)

  const cambiarCantidad = (id, delta) =>
    setCarrito((prev) => {
      const next = Math.min(MAX_CANTIDAD, Math.max(0, (prev[id] || 0) + delta))
      const copy = { ...prev }
      if (next) copy[id] = next
      else delete copy[id]
      return copy
    })

  const nuevaVenta = () => {
    setCarrito({})
    setCliente(null)
    setRechazo(null)
    setResultado(null)
    setScanError('')
    setPaso('catalogo')
    cargar()
  }

  const onCodigo = async (codigo) => {
    if (buscando) return
    setBuscando(true)
    setScanError('')
    try {
      const { data } = await consultarCliente({ eventoId, codigo })
      setCliente({ ...data, codigo })
      setRechazo(null)
      setPaso('confirmar')
      if (toCents(data.saldo) < totalCents) feedbackError()
      else feedbackOk()
    } catch (err) {
      setScanError(getErrorMessage(err, 'No se pudo identificar al cliente.'))
      feedbackError()
    } finally {
      setBuscando(false)
    }
  }

  const confirmarCobro = async () => {
    if (cobrando) return
    setCobrando(true)
    try {
      const { data } = await cobrar({
        eventoId,
        codigo: cliente.codigo,
        items: lineas.map((l) => ({ productoId: l.id, cantidad: l.cantidad })),
      })
      setResultado(data)
      setPaso('resultado')
      feedbackOk()
    } catch (err) {
      const body = err?.response?.data
      if (body?.code === 'SALDO_INSUFICIENTE') {
        // El saldo cambió entre la consulta y el cobro (otro cobro simultáneo).
        setCliente((c) => ({ ...c, saldo: body.saldo }))
        setRechazo(body.message)
      } else {
        setRechazo(getErrorMessage(err, 'No se pudo completar el cobro.'))
      }
      feedbackError()
    } finally {
      setCobrando(false)
    }
  }

  if (loadError) {
    return (
      <div className="m-4 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800" role="alert">
        <p className="font-semibold">No puedes vender por ahora</p>
        <p className="mt-1">{loadError}</p>
        <button type="button" className="btn-secondary btn-sm mt-4" onClick={cargar}>
          Reintentar
        </button>
      </div>
    )
  }

  if (!ctx) return <p className="p-6 text-center text-muted">Cargando punto de venta…</p>

  if (!eventosHoy.length) {
    const proximos = ctx.eventos.filter((e) => !e.enCurso)
    return (
      <div className="m-4 rounded-xl border border-border bg-white p-5">
        <h1 className="font-display text-xl font-bold">{ctx.negocio.nombre}</h1>
        <p className="mt-2 text-sm text-muted">
          Hoy no hay eventos en curso donde tu negocio esté habilitado. Solo se puede cobrar durante los días del
          evento.
        </p>
        {proximos.length > 0 && (
          <ul className="mt-4 divide-y divide-border text-sm">
            {proximos.map((e) => (
              <li key={e.id} className="py-2">
                <p className="font-medium">{e.titulo}</p>
                <p className="text-xs text-muted">{formatDayRange(e.fechaInicio, e.fechaFin)}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b border-border bg-white px-4 pb-3">
        <h1 className="font-display text-xl font-bold leading-tight">{ctx.negocio.nombre} — Ventas</h1>
        {eventosHoy.length > 1 ? (
          <select
            className="input mt-2 !py-1.5 text-sm"
            value={eventoId}
            onChange={(e) => setEventoId(e.target.value)}
            disabled={paso !== 'catalogo'}
            aria-label="Evento"
          >
            {eventosHoy.map((e) => (
              <option key={e.id} value={e.id}>
                {e.titulo}
              </option>
            ))}
          </select>
        ) : (
          <p className="mt-1 truncate text-sm text-muted">Evento: {evento?.titulo}</p>
        )}
      </div>

      {paso === 'catalogo' && (
        <>
          <ul className="grid flex-1 content-start gap-2 p-4">
            {productos.map((p) => {
              const cantidad = carrito[p.id] || 0
              return (
                <li
                  key={p.id}
                  className={`flex items-center gap-3 rounded-xl border bg-white p-3 transition ${
                    cantidad ? 'border-teal ring-1 ring-teal' : 'border-border'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{p.nombre}</p>
                    {p.descripcion && <p className="truncate text-xs text-muted">{p.descripcion}</p>}
                    <p className="text-sm font-semibold text-teal-dark">{formatBs(p.precio)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="h-9 w-9 rounded-md border border-border text-lg font-bold text-muted disabled:opacity-40"
                      onClick={() => cambiarCantidad(p.id, -1)}
                      disabled={!cantidad}
                      aria-label={`Quitar ${p.nombre}`}
                    >
                      −
                    </button>
                    <span className="w-6 text-center font-semibold tabular-nums" aria-live="polite">
                      {cantidad}
                    </span>
                    <button
                      type="button"
                      className="h-9 w-9 rounded-md bg-teal text-lg font-bold text-white hover:bg-teal-dark disabled:opacity-40"
                      onClick={() => cambiarCantidad(p.id, 1)}
                      disabled={cantidad >= MAX_CANTIDAD}
                      aria-label={`Agregar ${p.nombre}`}
                    >
                      +
                    </button>
                  </div>
                </li>
              )
            })}
            {!productos.length && (
              <li className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">
                Tu negocio aún no tiene productos activos.
              </li>
            )}
          </ul>
          <div className="sticky bottom-0 border-t border-border bg-white p-4">
            <div className="mb-3 flex items-end justify-between">
              <div>
                <p className="text-xs text-muted">Total a pagar</p>
                <p className="font-display text-2xl font-bold">{formatBs(total)}</p>
              </div>
              <span className="badge bg-page text-muted">
                {articulos} {articulos === 1 ? 'artículo' : 'artículos'}
              </span>
            </div>
            <button type="button" className="btn-primary w-full" disabled={!articulos} onClick={() => setPaso('carrito')}>
              Ver carrito
            </button>
          </div>
        </>
      )}

      {paso === 'carrito' && (
        <div className="flex flex-1 flex-col p-4">
          <div className="rounded-xl border border-border bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Artículos seleccionados</p>
            <ul className="mt-3 grid gap-2 text-sm">
              {lineas.map((l) => (
                <li key={l.id} className="flex justify-between gap-3">
                  <span>
                    <span className="mr-2 rounded bg-page px-1.5 text-xs font-semibold text-muted">{l.cantidad}x</span>
                    {l.nombre}
                  </span>
                  <span className="font-medium tabular-nums">{formatBs(l.subtotalCents / 100)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex justify-between border-t border-border pt-3 text-lg font-bold">
              <span>Total</span>
              <span className="text-teal-dark">{formatBs(total)}</span>
            </div>
          </div>
          <div className="mt-auto grid gap-2 pt-6">
            <button type="button" className="btn-primary w-full" onClick={() => setPaso('escanear')}>
              <IconQr className="h-5 w-5" /> Cobrar con manilla o QR
            </button>
            <button type="button" className="py-2 text-sm font-semibold text-teal-dark" onClick={() => setPaso('catalogo')}>
              Seguir comprando
            </button>
          </div>
        </div>
      )}

      {paso === 'escanear' && (
        <div className="flex flex-1 flex-col gap-4 p-4">
          <div className="text-center">
            <p className="text-sm text-muted">Monto a cobrar</p>
            <p className="font-display text-3xl font-bold text-teal-dark">{formatBs(total)}</p>
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
          <button type="button" className="py-2 text-sm font-semibold text-muted" onClick={() => setPaso('carrito')}>
            Volver al carrito
          </button>
        </div>
      )}

      {paso === 'confirmar' && cliente && (
        <ConfirmarCobro
          cliente={cliente}
          lineas={lineas}
          totalCents={totalCents}
          rechazo={rechazo}
          cobrando={cobrando}
          onConfirmar={confirmarCobro}
          onOtroCliente={() => {
            setCliente(null)
            setRechazo(null)
            setPaso('escanear')
          }}
          onEditar={() => {
            setCliente(null)
            setRechazo(null)
            setPaso('catalogo')
          }}
        />
      )}

      {paso === 'resultado' && resultado && <CobroExitoso resultado={resultado} onNuevaVenta={nuevaVenta} />}
    </div>
  )
}

function ConfirmarCobro({ cliente, lineas, totalCents, rechazo, cobrando, onConfirmar, onOtroCliente, onEditar }) {
  const saldoCents = toCents(cliente.saldo)
  const insuficiente = saldoCents < totalCents
  const nuevoSaldo = (saldoCents - totalCents) / 100

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="rounded-xl border border-border bg-white p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-teal/10 font-bold text-teal-dark">
            {cliente.cliente.nombre.charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold">{cliente.cliente.nombre}</p>
            <p className="text-xs text-muted">
              {cliente.cliente.medio === 'MANILLA' ? 'Manilla' : 'Entrada digital'} {cliente.cliente.identificador} ·{' '}
              {cliente.cliente.categoria}
            </p>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-sm">
          <span className="text-muted">Saldo disponible</span>
          <span
            className={`badge text-sm ${insuficiente ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}
          >
            {formatBs(cliente.saldo)}
          </span>
        </div>
      </div>

      {(insuficiente || rechazo) && (
        <div className="flex gap-3 rounded-xl border-2 border-red-500 bg-red-50 p-4 text-red-800" role="alert">
          <IconWarning className="mt-0.5 h-6 w-6 shrink-0" />
          <div>
            <p className="font-bold">Cobro rechazado</p>
            <p className="text-sm">
              {rechazo ||
                `Saldo insuficiente: faltan ${formatBs((totalCents - saldoCents) / 100)}. El cliente debe recargar saldo antes de pagar.`}
            </p>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-white p-4 text-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Resumen del cobro</p>
        <ul className="mt-3 grid gap-1.5">
          {lineas.map((l) => (
            <li key={l.id} className="flex justify-between">
              <span>
                {l.cantidad}x {l.nombre}
              </span>
              <span className="tabular-nums">{formatBs(l.subtotalCents / 100)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex justify-between border-t border-border pt-3 font-bold">
          <span>Monto a descontar</span>
          <span className="text-teal-dark">− {formatBs(totalCents / 100)}</span>
        </div>
        {!insuficiente && (
          <div className="mt-2 flex justify-between text-muted">
            <span>Nuevo saldo aproximado</span>
            <span className="tabular-nums">{formatBs(nuevoSaldo)}</span>
          </div>
        )}
      </div>

      <div className="mt-auto grid gap-2">
        {insuficiente ? (
          <>
            <button type="button" className="btn-primary w-full" onClick={onOtroCliente}>
              Escanear otra manilla
            </button>
            <button type="button" className="btn-secondary w-full" onClick={onEditar}>
              Editar pedido
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn-primary w-full" onClick={onConfirmar} disabled={cobrando}>
              <IconCheck className="h-5 w-5" /> {cobrando ? 'Procesando…' : 'Confirmar cobro'}
            </button>
            <button type="button" className="py-2 text-sm font-semibold text-red-600" onClick={onOtroCliente} disabled={cobrando}>
              Cancelar
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function CobroExitoso({ resultado, onNuevaVenta }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-4 p-4">
      <div className="mt-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-white">
        <IconCheck className="h-8 w-8" strokeWidth={2.5} />
      </div>
      <div className="text-center">
        <p className="font-display text-2xl font-bold">Pago exitoso</p>
        <p className="text-sm text-muted">Transacción {resultado.codigo}</p>
      </div>
      <dl className="grid w-full gap-2 rounded-xl border border-border bg-white p-4 text-sm">
        {[
          ['Cliente', resultado.cliente.nombre],
          ['Total cobrado', formatBs(resultado.total)],
          ['Nuevo saldo', formatBs(resultado.saldoResultante)],
          ['Negocio', resultado.negocio],
          ['Hora', formatTime(resultado.fecha)],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3">
            <dt className="text-muted">{k}</dt>
            <dd className="text-right font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-auto grid w-full gap-2">
        <button type="button" className="btn-primary w-full" onClick={onNuevaVenta}>
          + Nueva venta
        </button>
        <Link to="/pos/historial" className="py-2 text-center text-sm font-semibold text-muted">
          Ver historial
        </Link>
      </div>
    </div>
  )
}
