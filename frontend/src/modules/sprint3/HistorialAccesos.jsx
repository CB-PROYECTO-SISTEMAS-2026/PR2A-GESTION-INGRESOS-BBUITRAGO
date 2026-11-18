import { useState } from 'react'
import { formatDateTime, formatDay } from '../../utils/format'
import { useDatos, Aviso, Paginas, Tabla } from './comun'
export default function HistorialAccesos() {
  const ctx = useDatos('/acceso/historial/mis-eventos'),
    [id, cambiar] = useState(''),
    [fecha, seleccionar] = useState(''),
    [page, pagina] = useState(1)
  const evento = ctx.data?.eventos.find((e) => e.id === id) || ctx.data?.eventos[0]
  const { data, error } = useDatos(
    evento
      ? '/acceso/eventos/' + evento.id + '/registros?' + new URLSearchParams(fecha ? { fechaId: fecha, page } : { page })
      : null,
  )
  return (
    <main className="space-y-4 p-5">
      <h1 className="font-display text-2xl font-bold">Mi historial de accesos</h1>
      <Aviso error={ctx.error || error} />
      {evento && (
        <>
          <label className="label">
            Evento
            <select
              className="input"
              value={evento.id}
              onChange={(e) => {
                cambiar(e.target.value)
                seleccionar('')
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
          <label className="label">
            Fecha
            <select className="input" value={fecha || data?.fechaId || ''} onChange={(e) => { seleccionar(e.target.value); pagina(1) }}>
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
      {!ctx.error && !error && (!ctx.data || (evento && !data)) && <p role="status">Cargando historial…</p>}
      {ctx.data && !evento && <p>Sin eventos asignados.</p>}
      {data && (
        <>
          <p>
            {data.total === 1 ? '1 registro' : data.total + ' registros'}
          </p>
          <Tabla
            titulo="Ingresos y salidas"
            columnas={['Fecha y hora', 'Titular', 'Movimiento']}
            filas={data.registros.map((r) => [formatDateTime(r.createdAt), r.persona || r.codigo, r.tipo])}
          />
          <Paginas page={page} onChange={pagina} mas={page * data.pageSize < data.total} />
        </>
      )}
    </main>
  )
}
