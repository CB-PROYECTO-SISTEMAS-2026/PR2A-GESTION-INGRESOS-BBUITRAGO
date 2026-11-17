import { useEffect, useRef, useState } from 'react'
import { buscarEntrada, getMisPuntos, vincularManilla } from '../../api/manillas.api'
import { toast } from '../../components/Toast'
import { confirmDialog } from '../../components/ui/ConfirmDialog'
import { IconCheck, IconClock, IconMapPin, IconQr, IconSearch } from '../../components/ui/icons'
import { formatDateTime, formatDay, formatDayRange, getErrorMessage } from '../../utils/format'
import { estadoBadgeClass, estadoLabel } from '../../utils/labels'
import { formatNumber } from '../../utils/validation'

const PUNTO_KEY = 'eventix_punto_retiro'
const CODIGO_MANILLA_RE = /^[A-Z0-9-]{4,40}$/

function rangoEvento(evento) {
  const fechas = evento?.fechas ?? []
  if (!fechas.length) return '—'
  return formatDayRange(fechas[0].fecha, fechas[fechas.length - 1].fecha)
}

function Avatar({ cliente }) {
  if (cliente?.fotoUrl) {
    return <img src={cliente.fotoUrl} alt="" className="h-16 w-16 shrink-0 rounded-full border border-border object-cover" />
  }
  const iniciales = (cliente?.nombre || '?')
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
  return (
    <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-navy font-display text-xl font-bold text-white">
      {iniciales}
    </span>
  )
}

/** Una entrada encontrada: datos del cliente para verificar su identidad y el formulario de vinculación. */
function EntradaResultado({ entrada, onVincular, busy }) {
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState('')
  const { cliente } = entrada

  const onSubmit = async (e) => {
    e.preventDefault()
    const value = codigo.trim().toUpperCase()
    if (!CODIGO_MANILLA_RE.test(value)) {
      setError('Escanea o escribe el código de la manilla: de 4 a 40 letras, números o guiones.')
      return
    }
    setError('')
    await onVincular(entrada, value)
  }

  return (
    <article className="rounded-lg border border-border bg-white p-5">
      <div className="flex flex-wrap items-start gap-4">
        <Avatar cliente={cliente} />
        <div className="min-w-0 flex-1">
          <p className="font-display text-xl font-bold text-ink">{cliente?.nombre ?? 'Sin titular'}</p>
          {cliente && (
            <dl className="mt-1 grid gap-x-6 gap-y-0.5 text-sm text-slate-700 sm:grid-cols-2">
              <div>
                <dt className="inline text-muted">Documento: </dt>
                <dd className="inline font-semibold">{cliente.documento || '—'}</dd>
              </div>
              <div>
                <dt className="inline text-muted">Celular: </dt>
                <dd className="inline">{cliente.telefono || '—'}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="inline text-muted">Correo: </dt>
                <dd className="inline">{cliente.email}</dd>
              </div>
            </dl>
          )}
        </div>
        <div className="text-right">
          <span className={`badge ${estadoBadgeClass(entrada.estado)}`}>{estadoLabel(entrada.estado)}</span>
          <p className="mt-1 font-semibold text-ink">{entrada.categoria}</p>
          <p className="text-xs text-muted">{entrada.fecha ? formatDay(entrada.fecha) : 'Todos los días'}</p>
          <p className="mt-1 font-mono text-[11px] text-slate-500">{entrada.codigo}</p>
        </div>
      </div>

      {entrada.manilla && (
        <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          Ya tiene la manilla <strong className="font-mono">{entrada.manilla.codigo}</strong>, entregada
          {entrada.manilla.puntoRetiro ? ` en ${entrada.manilla.puntoRetiro}` : ''}
          {entrada.manilla.supervisor ? ` por ${entrada.manilla.supervisor}` : ''} el {formatDateTime(entrada.manilla.entregadaAt)}.
        </p>
      )}
      {!entrada.puedeVincular && !entrada.manilla && (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{entrada.motivo}</p>
      )}

      {entrada.puedeVincular && (
        <form onSubmit={onSubmit} noValidate className="mt-4 flex flex-wrap items-start gap-3 border-t border-border pt-4">
          <div className="min-w-56 flex-1">
            <label className="label" htmlFor={`manilla-${entrada.id}`}>
              Código de la manilla que entregas
            </label>
            <input
              id={`manilla-${entrada.id}`}
              className="input font-mono uppercase"
              value={codigo}
              maxLength={40}
              autoComplete="off"
              placeholder="Escanea el QR de la manilla"
              onChange={(e) => {
                setCodigo(e.target.value.toUpperCase())
                setError('')
              }}
              aria-invalid={Boolean(error)}
            />
            {error && <p className="field-error">{error}</p>}
          </div>
          <button type="submit" className="btn-primary mt-6" disabled={busy || !codigo.trim()}>
            <IconCheck />
            {busy ? 'Vinculando…' : 'Vincular manilla'}
          </button>
        </form>
      )}
    </article>
  )
}

/** HU-015 / HU-053: el supervisor entrega la manilla en su punto y la vincula a la cuenta del cliente. */
export default function EntregaManillasPage() {
  const [puntos, setPuntos] = useState(null)
  const [puntoId, setPuntoId] = useState(() => sessionStorage.getItem(PUNTO_KEY) || '')
  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState(null)
  const [buscando, setBuscando] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [ultima, setUltima] = useState(null)
  const [error, setError] = useState('')
  const searchRef = useRef(null)

  useEffect(() => {
    let alive = true
    getMisPuntos()
      .then(({ data }) => {
        if (!alive) return
        const lista = data.puntos ?? []
        setPuntos(lista)
        setPuntoId((actual) => (lista.some((p) => p.id === actual) ? actual : lista.length === 1 ? lista[0].id : ''))
      })
      .catch((err) => alive && setError(getErrorMessage(err, 'No se pudieron cargar tus puntos de entrega.')))
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (puntoId) sessionStorage.setItem(PUNTO_KEY, puntoId)
    else sessionStorage.removeItem(PUNTO_KEY)
  }, [puntoId])

  const punto = puntos?.find((p) => p.id === puntoId) ?? null

  const reset = () => {
    setBusqueda('')
    setResultados(null)
    searchRef.current?.focus()
  }

  const onBuscar = async (e) => {
    e.preventDefault()
    const texto = busqueda.trim()
    if (texto.length < 3 || !punto) return
    setBuscando(true)
    setUltima(null)
    try {
      const { data } = await buscarEntrada(punto.id, texto)
      setResultados(data.entradas ?? [])
    } catch (err) {
      setResultados([])
      toast(getErrorMessage(err), 'error')
    } finally {
      setBuscando(false)
    }
  }

  const onVincular = async (entrada, codigoManilla) => {
    const ok = await confirmDialog({
      title: 'Confirmar entrega',
      message: `Vas a vincular la manilla ${codigoManilla} a ${entrada.cliente?.nombre} (${entrada.categoria}). Verifica que la persona presente sea la titular antes de entregarla.`,
      confirmText: 'Confirmar y entregar',
      cancelText: 'Cancelar',
    })
    if (ok !== true) return
    setBusyId(entrada.id)
    try {
      const { data } = await vincularManilla({ puntoId: punto.id, entradaId: entrada.id, codigoManilla })
      setUltima(data)
      setPuntos((list) => list.map((p) => (p.id === punto.id ? { ...p, manillasEntregadas: p.manillasEntregadas + 1 } : p)))
      toast(`Manilla ${data.codigoManilla} vinculada`, 'success')
      reset()
    } catch (err) {
      toast(getErrorMessage(err), 'error')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="font-display text-3xl font-bold text-ink">Entrega de manillas</h1>
        <p className="mt-1 text-sm text-muted">
          Identifica la entrada del cliente, verifica que sea la persona titular y vincula la manilla que le entregas.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {!puntos && !error && <p className="text-muted">Cargando…</p>}

      {puntos && !puntos.length && (
        <div className="card-surface flex flex-col items-center gap-2 p-10 text-center">
          <IconMapPin className="h-10 w-10 text-slate-300" />
          <p className="font-semibold text-ink">No tienes puntos de entrega asignados</p>
          <p className="text-sm text-muted">El administrador debe asignarte a un punto de un evento publicado con manillas.</p>
        </div>
      )}

      {puntos && puntos.length > 0 && (
        <section className="card-surface p-5">
          <label className="label" htmlFor="punto">
            Punto de entrega
          </label>
          <select
            id="punto"
            className="input sm:max-w-xl"
            value={puntoId}
            onChange={(e) => {
              setPuntoId(e.target.value)
              setResultados(null)
              setUltima(null)
            }}
          >
            <option value="">Selecciona dónde estás entregando</option>
            {puntos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.evento.titulo} — {p.nombre}
              </option>
            ))}
          </select>
          {punto && (
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
              <span>{rangoEvento(punto.evento)}</span>
              {punto.ubicacion && (
                <span className="inline-flex items-center gap-1">
                  <IconMapPin className="h-4 w-4" />
                  {punto.ubicacion}
                </span>
              )}
              {punto.horario && (
                <span className="inline-flex items-center gap-1">
                  <IconClock className="h-4 w-4" />
                  {punto.horario}
                </span>
              )}
              <span className="font-semibold text-ink">{formatNumber(punto.manillasEntregadas)} manillas entregadas aquí</span>
            </div>
          )}
        </section>
      )}

      {punto && (
        <>
          <form onSubmit={onBuscar} className="flex flex-wrap items-end gap-3">
            <div className="min-w-64 flex-1">
              <label className="label" htmlFor="busqueda">
                Entrada del cliente
              </label>
              <div className="relative">
                <IconQr className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  id="busqueda"
                  ref={searchRef}
                  className="input !pl-9"
                  value={busqueda}
                  maxLength={191}
                  autoFocus
                  autoComplete="off"
                  placeholder="Escanea el QR de su entrada o escribe el código, correo o documento"
                  onChange={(e) => setBusqueda(e.target.value)}
                />
              </div>
            </div>
            <button type="submit" className="btn-primary" disabled={buscando || busqueda.trim().length < 3}>
              <IconSearch />
              {buscando ? 'Buscando…' : 'Buscar'}
            </button>
            {resultados && (
              <button type="button" className="btn-secondary" onClick={reset}>
                Nuevo cliente
              </button>
            )}
          </form>

          {ultima && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900" role="status">
              <p className="font-semibold">
                Manilla <span className="font-mono">{ultima.codigoManilla}</span> vinculada a {ultima.cliente?.nombre}.
              </p>
              <p className="mt-0.5">Desde ahora el cliente usa esta manilla para ingresar y moverse en el evento.</p>
            </div>
          )}

          {resultados && (
            <div className="space-y-4">
              {resultados.length > 1 && (
                <p className="text-sm text-muted">Se encontraron {resultados.length} entradas. Elige la que corresponde.</p>
              )}
              {resultados.map((r) => (
                <EntradaResultado key={r.id} entrada={r} onVincular={onVincular} busy={busyId === r.id} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
