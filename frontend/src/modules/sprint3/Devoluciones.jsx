import { useState } from 'react'
import api from '../../api/axios'
import { formatBs, formatDateTime, getErrorMessage } from '../../utils/format'
import { Aviso, Paginas, Tabla, useDatos } from './comun'

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
  const ctx = useDatos('/devoluciones/contexto'),
    [elegido, elegir] = useState(''),
    [page, pagina] = useState(1)
  const evento = elegido || ctx.data?.eventos[0]?.id
  const { data, error } = useDatos(
    evento ? '/historiales/devoluciones?' + new URLSearchParams({ eventoId: evento, page }) : null,
  )
  return (
    <main className="space-y-4 p-4">
      <h1 className="font-display text-2xl font-bold">Mis devoluciones</h1>
      <Aviso error={ctx.error || error} />
      {evento && (
        <label className="label">
          Evento
          <select
            className="input"
            value={evento}
            onChange={(e) => {
              elegir(e.target.value)
              pagina(1)
            }}
          >
            {ctx.data.eventos.map((e) => (
              <option key={e.id} value={e.id}>
                {e.titulo}
              </option>
            ))}
          </select>
        </label>
      )}
      {ctx.data && !evento && <p>Sin eventos asignados.</p>}
      {!ctx.error && !error && (!ctx.data || (evento && !data)) && <p>Cargando historial…</p>}
      {data && (
        <>
          <Tabla
            titulo="Devoluciones realizadas"
            columnas={['Fecha', 'Usuario', 'Monto']}
            filas={data.devoluciones.map((d) => [formatDateTime(d.fecha), d.usuario, formatBs(d.monto)])}
          />
          <Paginas page={page} onChange={pagina} mas={page * data.pageSize < data.cantidad} />
        </>
      )}
    </main>
  )
}
