import { useEffect, useRef, useState } from 'react'
import api from '../../api/axios'
import PendingRegion from '../../components/ui/PendingRegion'
import { formatBs, formatDateTime, getErrorMessage } from '../../utils/format'
import { Aviso, Paginas } from './comun'

export function Comprobante({ id }) {
  const [busy, setBusy] = useState(false),
    [listo, setListo] = useState(false),
    [error, setError] = useState('')
  const [file, setFile] = useState(null)
  async function subir(e) {
    e.preventDefault()
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      setError('La imagen debe pesar como máximo 10 MB.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const form = new FormData()
      form.append('foto', file)
      await api.post('/devoluciones/' + id + '/comprobante', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setListo(true)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }
  if (listo) return <p role="status">Comprobante guardado.</p>
  return (
    <form className="w-full space-y-2 rounded-xl border border-border p-4" onSubmit={subir}>
      <label className="label">
        Foto del comprobante (opcional)
        <input
          className="input"
          type="file"
          name="foto"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={e => setFile(e.target.files[0] ?? null)}
        />
      </label>
      <Aviso error={error} />
      <button disabled={busy || !file} className="btn-secondary">
        Guardar comprobante
      </button>
    </form>
  )
}

export function HistorialDevoluciones() {
  const [eventos, setEventos] = useState(null)
  const [ctxError, setCtxError] = useState('')
  const [elegido, elegir] = useState('')
  const [page, pagina] = useState(1)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [actualizando, setActualizando] = useState(false)
  const req = useRef(0)

  useEffect(() => {
    let alive = true
    api
      .get('/devoluciones/contexto')
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

  const evento = elegido || eventos?.[0]?.id || ''

  useEffect(() => {
    if (!evento) return undefined
    const n = ++req.current
    const params = new URLSearchParams({ eventoId: evento, page: String(page) })
    api
      .get(`/historiales/devoluciones?${params}`)
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
  }, [evento, page])

  return (
    <main className="flex flex-1 flex-col gap-4 p-4">
      <h1 className="font-display text-xl font-bold text-ink">Mis devoluciones</h1>
      <Aviso error={ctxError || error} />
      {!eventos && !ctxError && (
        <p className="text-sm text-muted" role="status">
          Cargando historial…
        </p>
      )}
      {eventos && !evento && <p className="text-sm text-muted">Sin eventos asignados.</p>}
      {evento && (
        <label className="label">
          Evento
          <select
            className="input"
            value={evento}
            onChange={(e) => {
              elegir(e.target.value)
              pagina(1)
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
      )}
      {evento && !data && !error && (
        <p className="text-sm text-muted" role="status">
          Cargando historial…
        </p>
      )}
      {data && (
        <PendingRegion pending={actualizando} >
          <ul className="grid gap-2">
            {data.devoluciones.map((d, i) => (
              <li key={d.id || i} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-white p-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">{d.usuario}</p>
                  <p className="text-xs text-muted">{formatDateTime(d.fecha)}</p>
                </div>
                <p className="shrink-0 font-semibold text-ink">{formatBs(d.monto)}</p>
              </li>
            ))}
            {!data.devoluciones.length && (
              <li className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">
                Sin devoluciones en este evento.
              </li>
            )}
          </ul>
          <div className="mt-3">
            <Paginas
              page={page}
              onChange={(next) => {
                pagina(next)
                setActualizando(true)
              }}
              mas={page * data.pageSize < data.cantidad}
            />
          </div>
        </PendingRegion>
      )}
    </main>
  )
}
