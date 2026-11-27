import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { buscarEntrada, getMisPuntos, vincularManilla } from '../../api/manillas.api'
import { toast } from '../../components/Toast'
import TarjetaLectura from '../../components/terminal/TarjetaLectura'
import { confirmDialog } from '../../components/ui/ConfirmDialog'
import { IconCheck, IconClock, IconMapPin, IconSearch } from '../../components/ui/icons'
import { formatDateTime, formatDay, formatDayRange, getErrorMessage } from '../../utils/format'
import { estadoBadgeClass, estadoLabel } from '../../utils/labels'
import { formatNumber } from '../../utils/validation'

const CodigoScanner = lazy(() => import('../pos/components/CodigoScanner'))

const PUNTO_KEY = 'eventix_punto_retiro'
const CODIGO_MANILLA_RE = /^[A-Z0-9-]{4,40}$/

function rangoEvento(evento) {
  const fechas = evento?.fechas ?? []
  if (!fechas.length) return '—'
  return formatDayRange(fechas[0].fecha, fechas[fechas.length - 1].fecha)
}

function Camara({ onCodigo, disabled }) {
  return (
    <Suspense fallback={<p className="text-sm text-muted" role="status">Cargando cámara…</p>}>
      <CodigoScanner onCodigo={onCodigo} disabled={disabled} />
    </Suspense>
  )
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
    <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-sidebar font-display text-xl font-bold text-white">
      {iniciales}
    </span>
  )
}

/** Una entrada encontrada: datos del cliente para verificar su identidad y el formulario de vinculación. */
function EntradaResultado({ entrada, onVincular, busy }) {
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState('')
  const [escanear, setEscanear] = useState(false)
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
    <article className="rounded-xl border border-border bg-white p-4">
      <div className="flex items-start gap-3">
        <Avatar cliente={cliente} />
        <div className="min-w-0 flex-1">
          <p className="font-display text-xl font-bold text-ink">{cliente?.nombre ?? 'Sin titular'}</p>
          <p className="mt-1 text-sm font-semibold text-ink">{entrada.categoria}</p>
          <p className="text-xs text-muted">{entrada.fecha ? formatDay(entrada.fecha) : 'Todos los días'}</p>
          <span className={`badge mt-2 ${estadoBadgeClass(entrada.estado)}`}>{estadoLabel(entrada.estado)}</span>
        </div>
      </div>
      {cliente && (
        <dl className="mt-3 grid gap-1 text-sm text-ink">
          <div>
            <dt className="inline text-muted">Documento: </dt>
            <dd className="inline font-semibold">{cliente.documento || '—'}</dd>
          </div>
          <div>
            <dt className="inline text-muted">Celular: </dt>
            <dd className="inline">{cliente.telefono || '—'}</dd>
          </div>
          <div>
            <dt className="inline text-muted">Correo: </dt>
            <dd className="inline break-all">{cliente.email}</dd>
          </div>
        </dl>
      )}
      <p className="mt-2 font-mono text-[11px] text-muted">{entrada.codigo}</p>

      {entrada.manilla && (
        <p className="mt-4 rounded-md border border-success bg-success-soft p-3 text-sm text-success">
          Ya tiene la manilla <strong className="font-mono">{entrada.manilla.codigo}</strong>, entregada
          {entrada.manilla.puntoRetiro ? ` en ${entrada.manilla.puntoRetiro}` : ''}
          {entrada.manilla.supervisor ? ` por ${entrada.manilla.supervisor}` : ''} el {formatDateTime(entrada.manilla.entregadaAt)}.
        </p>
      )}
      {!entrada.puedeVincular && !entrada.manilla && (
        <p className="mt-4 rounded-md border border-danger bg-danger-soft p-3 text-sm text-danger">{entrada.motivo}</p>
      )}

      {entrada.puedeVincular && (
        <div className="mt-4 space-y-3 border-t border-border pt-4">
          <button type="button" className="btn-secondary w-full" onClick={() => setEscanear((v) => !v)}>
            {escanear ? 'Cerrar cámara' : 'Escanear manilla'}
          </button>
          {escanear && (
            <Camara
              disabled={busy}
              onCodigo={(value) => {
                setCodigo(value.trim().toUpperCase())
                setError('')
                setEscanear(false)
              }}
            />
          )}
          <form onSubmit={onSubmit} noValidate className="grid gap-2">
            <label className="label" htmlFor={`manilla-${entrada.id}`}>
              Código de la manilla que entregas
            </label>
            <input
              id={`manilla-${entrada.id}`}
              className="input font-mono uppercase"
              value={codigo}
              maxLength={40}
              autoComplete="off"
              placeholder="Escanea el QR o escríbelo"
              onChange={(e) => {
                setCodigo(e.target.value.toUpperCase())
                setError('')
              }}
              aria-invalid={Boolean(error)}
            />
            {error && <p className="field-error">{error}</p>}
            <button type="submit" className="btn-primary w-full" disabled={busy || !codigo.trim()}>
              <IconCheck />
              {busy ? 'Vinculando…' : 'Vincular manilla'}
            </button>
          </form>
        </div>
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
  const buscandoRef = useRef(false)

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

  const buscar = async (texto) => {
    const q = texto.trim()
    if (q.length < 3 || !punto || buscandoRef.current) return
    buscandoRef.current = true
    setBuscando(true)
    setBusqueda(q)
    setUltima(null)
    try {
      const { data } = await buscarEntrada(punto.id, q)
      setResultados(data.entradas ?? [])
    } catch (err) {
      setResultados([])
      toast(getErrorMessage(err), 'error')
    } finally {
      buscandoRef.current = false
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
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-xl font-bold text-ink">Manillas</h1>
        <Link to="/supervisor/entregas" className="text-sm font-semibold text-primary">
          Mis entregas
        </Link>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
      {!puntos && !error && (
        <p className="text-sm text-muted" role="status">
          Cargando…
        </p>
      )}

      {puntos && !puntos.length && (
        <div className="card-surface flex flex-col items-center gap-2 p-8 text-center">
          <IconMapPin className="h-10 w-10 text-muted" />
          <p className="font-semibold text-ink">No tienes puntos de entrega asignados</p>
          <p className="text-sm text-muted">El administrador debe asignarte a un punto de un evento publicado con manillas.</p>
        </div>
      )}

      {puntos && puntos.length > 0 && (
        <section className="space-y-3">
          <label className="label" htmlFor="punto">
            Punto de entrega
          </label>
          <select
            id="punto"
            className="input"
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
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
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
              <span className="font-semibold text-ink">
                {formatNumber(punto.manillasEntregadas)}{' '}
                {punto.manillasEntregadas === 1 ? 'manilla entregada aquí' : 'manillas entregadas aquí'}
              </span>
            </div>
          )}
        </section>
      )}

      {punto && !resultados && (
        <Camara disabled={buscando} onCodigo={buscar} />
      )}

      {punto && (
        <>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              buscar(busqueda)
            }}
            className="grid gap-2"
          >
            <label className="label" htmlFor="busqueda">
              Correo, documento o código
            </label>
            <input
              id="busqueda"
              ref={searchRef}
              className="input"
              value={busqueda}
              maxLength={191}
              autoComplete="off"
              placeholder="Si el QR no abre"
              onChange={(e) => setBusqueda(e.target.value)}
            />
            <button type="submit" className="btn-primary w-full" disabled={buscando || busqueda.trim().length < 3}>
              <IconSearch />
              {buscando ? 'Buscando…' : 'Buscar'}
            </button>
            {resultados && (
              <button type="button" className="btn-secondary w-full" onClick={reset}>
                Nuevo cliente
              </button>
            )}
          </form>

          {ultima && (
            <TarjetaLectura
              tono="success"
              titulo="Manilla vinculada"
              nombre={ultima.cliente?.nombre}
              codigo={ultima.codigoManilla}
            />
          )}

          {resultados && (
            <div className="space-y-3">
              {resultados.length > 1 && (
                <p className="text-sm text-muted">Se encontraron {resultados.length} entradas. Elige la que corresponde.</p>
              )}
              {!resultados.length && <p className="text-sm text-muted">No hay entradas con ese dato.</p>}
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
