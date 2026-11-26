import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../api/axios'
import TarjetaLectura from '../../components/terminal/TarjetaLectura'
import PendingRegion from '../../components/ui/PendingRegion'
import { formatDateTime, formatDay, getErrorMessage } from '../../utils/format'
import { movimientoLabel } from '../acceso/accesoLabels'
import { Paginas } from './comun'

export default function HistorialAccesos() {
  const [eventos, setEventos] = useState(null)
  const [ctxError, setCtxError] = useState('')
  const [id, setId] = useState('')
  const [fecha, setFecha] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [actualizando, setActualizando] = useState(false)
  const req = useRef(0)

  useEffect(() => {
    let alive = true
    api
      .get('/acceso/historial/mis-eventos')
      .then(({ data: res }) => {
        if (alive) setEventos(res.eventos ?? [])
      })
      .catch((err) => {
        if (alive) setCtxError(getErrorMessage(err))
      })
    return () => {
      alive = false
    }
  }, [])

  const evento = eventos?.find((e) => e.id === id) || eventos?.[0] || null
  const eventoId = evento?.id ?? ''

  useEffect(() => {
    if (!eventoId) return undefined
    const n = ++req.current
    const params = new URLSearchParams(fecha ? { fechaId: fecha, page: String(page) } : { page: String(page) })
    api
      .get(`/acceso/eventos/${eventoId}/registros?${params}`)
      .then(({ data: res }) => {
        if (n !== req.current) return
        setData(res)
        setError('')
      })
      .catch((err) => {
        if (n !== req.current) return
        setError(getErrorMessage(err))
      })
      .finally(() => {
        if (n === req.current) setActualizando(false)
      })
    return undefined
  }, [eventoId, fecha, page])

  return (
    <main className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-xl font-bold text-ink">Historial de accesos</h1>
        <Link to="/supervisor" className="text-sm font-semibold text-primary">
          Volver
        </Link>
      </div>
      {(ctxError || error) && (
        <p className="rounded-md bg-danger-soft p-3 text-sm text-danger" role="alert">
          {ctxError || error}
        </p>
      )}
      {!eventos && !ctxError && (
        <p className="text-sm text-muted" role="status">
          Cargando historial…
        </p>
      )}
      {eventos && !evento && <p className="text-sm text-muted">Sin eventos asignados.</p>}
      {evento && (
        <>
          <label className="label">
            Evento
            <select
              className="input"
              value={evento.id}
              onChange={(e) => {
                setId(e.target.value)
                setFecha('')
                setPage(1)
                setActualizando(true)
              }}
            >
              {eventos.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.titulo}
                </option>
              ))}
            </select>
          </label>
          <label className="label">
            Fecha
            <select
              className="input"
              value={fecha || data?.fechaId || ''}
              onChange={(e) => {
                setFecha(e.target.value)
                setPage(1)
                setActualizando(true)
              }}
            >
              {!fecha && !data?.fechaId && <option value="">Seleccionar fecha</option>}
              {evento.fechas.map((f) => (
                <option value={f.id} key={f.id}>
                  {formatDay(f.fecha)}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
      {evento && !data && !error && (
        <p className="text-sm text-muted" role="status">
          Cargando historial…
        </p>
      )}
      {data && (
        <PendingRegion pending={actualizando}>
          <ListaAccesos data={data} />
          <div className="mt-3">
            <Paginas
              page={page}
              onChange={(next) => {
                setPage(next)
                setActualizando(true)
              }}
              mas={page * data.pageSize < data.total}
            />
          </div>
        </PendingRegion>
      )}
    </main>
  )
}

function ListaAccesos({ data }) {
  const filas = [
    ...data.registros.map((r) => ({
      id: `ok-${r.id}`,
      tono: 'success',
      titulo: movimientoLabel(r.tipo),
      nombre: r.persona || r.codigo,
      codigo: r.codigo,
      extra: formatDateTime(r.createdAt),
      at: r.createdAt,
    })),
    ...(data.rechazos ?? []).map((r) => ({
      id: `no-${r.id}`,
      tono: 'danger',
      titulo: r.motivo || 'Rechazado',
      nombre: r.persona || r.codigo,
      codigo: r.codigo,
      extra: formatDateTime(r.createdAt),
      at: r.createdAt,
    })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at))

  if (!filas.length) {
    return <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">Sin lecturas en esta fecha.</p>
  }

  return (
    <ul className="grid gap-2">
      {filas.map((fila) => (
        <li key={fila.id}>
          <TarjetaLectura tono={fila.tono} titulo={fila.titulo} nombre={fila.nombre} codigo={fila.codigo} extra={fila.extra} />
        </li>
      ))}
    </ul>
  )
}
