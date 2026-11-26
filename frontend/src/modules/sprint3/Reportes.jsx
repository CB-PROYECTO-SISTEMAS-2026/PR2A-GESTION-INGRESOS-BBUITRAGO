import { useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import api from '../../api/axios'
import { formatBs, formatDateTime, getErrorMessage } from '../../utils/format'
import { tipoMovimientoLabel } from '../../utils/movimientos'
import { Aviso, Paginas, Tabla, useDatos } from './comun'

function Incidencias({ ruta, admin }) {
  const [page, pagina] = useState(1),
    { data, error, refresh } = useDatos(ruta + '/incidencias?page=' + page)
  const [fallo, fallar] = useState(''),
    [busy, ocupar] = useState(false)
  const intento = useRef(null)
  async function enviar(e, id) {
    e.preventDefault()
    const form = e.currentTarget,
      texto = form.elements.texto.value.trim()
    if (!texto || busy) return
    ocupar(true)
    fallar('')
    try {
      if (id) await api.patch(ruta + '/incidencias/' + id, { resolucion: texto })
      else {
        if (intento.current?.texto !== texto) intento.current = { texto, clave: crypto.randomUUID() }
        await api.post(ruta + '/incidencias', { descripcion: texto, idempotencyKey: intento.current.clave })
        intento.current = null
        pagina(1)
      }
      form.reset()
      refresh()
    } catch (err) {
      fallar(getErrorMessage(err))
    } finally {
      ocupar(false)
    }
  }
  return (
    <section className="card-surface space-y-4 p-5">
      <h2 className="font-semibold">Incidencias del evento</h2>
      <Aviso error={fallo || error} />
      {!admin && (
        <form onSubmit={(e) => enviar(e)} className="space-y-2">
          <label className="label">
            Descripción
            <textarea name="texto" required maxLength={500} className="input" />
          </label>
          <button disabled={busy} className="btn-secondary">
            Reportar incidencia
          </button>
        </form>
      )}
      {data?.map((i) => (
        <article key={i.id} className="border-t border-border pt-3">
          <p>{i.descripcion}</p>
          <small>
            {formatDateTime(i.createdAt)} · {i.resueltaAt ? 'Resuelta' : 'Abierta'}
          </small>
          {i.resolucion && <p>Resolución: {i.resolucion}</p>}
          {admin && !i.resueltaAt && (
            <form onSubmit={(e) => enviar(e, i.id)}>
              <label className="label">
                Resolución
                <input className="input" name="texto" required maxLength={500} />
              </label>
              <button disabled={busy} className="btn-secondary">
                Marcar resuelta
              </button>
            </form>
          )}
        </article>
      ))}
      {data?.length === 0 && <p>Sin incidencias.</p>}
      <Paginas page={page} onChange={pagina} mas={data?.length === 50} />
    </section>
  )
}

/** Tabla con posiciones; las filas ya llegan ordenadas de mayor a menor monto. */
function Ranking({ titulo, quien, filas }) {
  return (
    <Tabla
      titulo={titulo}
      columnas={['#', quien, 'Operaciones', 'Total']}
      filas={filas.map((f, i) => [i + 1, f.nombre, f.cantidad, formatBs(f.total)])}
    />
  )
}

export default function Reportes({ admin = false }) {
  const { id } = useParams(),
    ruta = id ? '/reportes/evento/' + id : '/reportes/global'
  const { data, error } = useDatos(ruta),
    [fallo, fallar] = useState(''),
    [exportando, setExportando] = useState(false)
  async function descargar(formato) {
    setExportando(true)
    fallar('')
    try {
      const { data: blob } = await api.get(ruta + '/ventas', { params: { formato }, responseType: 'blob' })
      const url = URL.createObjectURL(blob),
        a = document.createElement('a')
      a.href = url
      a.download = 'ventas-' + id + '.' + formato
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (e) {
      fallar(getErrorMessage(e))
    } finally {
      setExportando(false)
    }
  }
  return (
    <main className="mx-auto max-w-6xl space-y-5 p-5">
      <h1 className="font-display text-3xl font-bold">
        {data?.evento?.titulo || (id ? 'Reporte del evento' : 'Reporte global')}
      </h1>
      <Aviso error={error || fallo} />
      {!data && !error && <p>Cargando reporte…</p>}
      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ['Entradas vendidas (bruto)', data.entradas.bruto],
              ['Ingreso neto por entradas', data.entradas.ingresoNeto],
              ['Ventas de negocios', data.negocios.total],
            ].map(([k, v]) => (
              <div className="card-surface p-4" key={k}>
                <p>{k}</p>
                <strong className="text-xl">{formatBs(v)}</strong>
              </div>
            ))}
          </div>
          <p>
            {data.cantidadEventos} {data.cantidadEventos === 1 ? 'evento' : 'eventos'} · {data.entradas.compras} {data.entradas.compras === 1 ? 'compra de entradas' : 'compras de entradas'} ·{' '}
            {formatBs(data.entradas.reembolsos)} en reembolsos aprobados · {data.negocios.ventas} {data.negocios.ventas === 1 ? 'venta de negocio' : 'ventas de negocios'}
          </p>
          {id && (
            <div className="flex gap-3">
              {['csv', 'xlsx'].map((f) => (
                <button disabled={exportando} key={f} className="btn-secondary" onClick={() => descargar(f)}>
                  Descargar {f === 'csv' ? 'CSV' : 'Excel'}
                </button>
              ))}
            </div>
          )}
          <Tabla
            titulo="Accesos"
            columnas={['Ingresos', 'Salidas', 'Reingresos', 'Pendientes de ingresar']}
            filas={[
              [data.accesos.INGRESO, data.accesos.SALIDA, data.accesos.REINGRESO, data.accesos.porIngresar],
            ]}
          />
          <Tabla
            titulo="Movimientos completados"
            columnas={['Tipo', 'Cantidad', 'Total']}
            filas={data.movimientos.map((m) => [tipoMovimientoLabel(m.tipo), m.cantidad, formatBs(m.total)])}
          />
          <div className="grid gap-5 lg:grid-cols-2">
            {data.clientes && (
              <>
                <Ranking titulo="Clientes que más recargan" quien="Cliente" filas={data.clientes.recargas} />
                <Ranking titulo="Clientes con más saldo devuelto" quien="Cliente" filas={data.clientes.devoluciones} />
              </>
            )}
            {[
              ['Recargadores', 'Recargador', 'RECARGA'],
              ['Encargados de devoluciones', 'Encargado', 'DEVOLUCION'],
            ].map(([titulo, quien, tipo]) => (
              <Ranking key={tipo} titulo={titulo} quien={quien} filas={data.operadores.filter((o) => o.tipo === tipo)} />
            ))}
          </div>
          <Tabla
            titulo="Saldos pendientes"
            columnas={['Evento', 'Usuarios', 'Saldo', 'Fecha límite']}
            filas={data.saldos.map((s) => [
              s.titulo,
              s.usuarios,
              formatBs(s.saldoRegistrado),
              s.plazo ? s.plazo.fechaLimite + (s.plazo.vencido ? ' (vencido)' : '') : 'Sin plazo',
            ])}
          />
          {id && <Incidencias key={id} ruta={ruta} admin={admin} />}
        </>
      )}
    </main>
  )
}
