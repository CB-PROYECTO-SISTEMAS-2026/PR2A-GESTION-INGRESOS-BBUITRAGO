import { useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import api from '../../api/axios'
import { formatBs, formatDateTime, getErrorMessage } from '../../utils/format'
import { tipoMovimientoLabel } from '../../utils/movimientos'
import { Aviso, Paginas, Tabla, useDatos } from './comun'

const TIPOS_INCIDENCIA = [
  { value: 'ACCESO', label: 'Control de acceso / manillas' },
  { value: 'AFORO', label: 'Aforo o congestión' },
  { value: 'CAJA', label: 'Caja, recargas o devoluciones' },
  { value: 'NEGOCIO', label: 'Puesto o POS' },
  { value: 'SEGURIDAD', label: 'Seguridad' },
  { value: 'INFRAESTRUCTURA', label: 'Infraestructura / espacio' },
  { value: 'OTRO', label: 'Otro' },
]
const PRIORIDADES = [
  { value: 'ALTA', label: 'Alta · requiere atención inmediata' },
  { value: 'MEDIA', label: 'Media' },
  { value: 'BAJA', label: 'Baja · seguimiento' },
]
const tipoLabel = (v) => TIPOS_INCIDENCIA.find((t) => t.value === v)?.label || v
const prioridadClass = {
  ALTA: 'bg-red-100 text-red-800',
  MEDIA: 'bg-amber-100 text-amber-800',
  BAJA: 'bg-slate-100 text-slate-700',
}

function Incidencias({ ruta, admin, resumen }) {
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
        const tipo = form.elements.tipo.value
        const prioridad = form.elements.prioridad.value
        const firma = tipo + '|' + prioridad + '|' + texto
        if (intento.current?.firma !== firma)
          intento.current = { firma, clave: crypto.randomUUID() }
        await api.post(ruta + '/incidencias', {
          descripcion: texto,
          tipo,
          prioridad,
          idempotencyKey: intento.current.clave,
        })
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
      <div>
        <h2 className="font-semibold">Incidencias del evento</h2>
        <p className="mt-1 text-sm text-muted">
          Canal del organizador hacia el administrador para problemas operativos durante el evento
          (acceso, aforo, caja, puestos). No reemplaza el reporte de ventas: sirve para actuar a tiempo
          y dejar constancia de qué se resolvió.
        </p>
        {resumen && (
          <p className="mt-2 text-sm">
            <strong>{resumen.abiertas}</strong> abiertas
            {resumen.abiertasPorPrioridad?.ALTA
              ? ` · ${resumen.abiertasPorPrioridad.ALTA} de prioridad alta`
              : ''}
            {' · '}
            {resumen.resueltas} resueltas
          </p>
        )}
      </div>
      <Aviso error={fallo || error} />
      {!admin && (
        <form onSubmit={(e) => enviar(e)} className="space-y-3 rounded-md border border-border p-4">
          <p className="text-sm font-semibold">Reportar una incidencia</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="label">
              Tipo
              <select name="tipo" className="input" defaultValue="ACCESO" required>
                {TIPOS_INCIDENCIA.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="label">
              Prioridad
              <select name="prioridad" className="input" defaultValue="MEDIA" required>
                {PRIORIDADES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="label">
            Qué ocurrió y dónde
            <textarea
              name="texto"
              required
              maxLength={450}
              className="input"
              placeholder="Ej. Fila en el punto norte; faltan dos supervisores de acceso."
            />
          </label>
          <button disabled={busy} className="btn-secondary">
            Enviar al administrador
          </button>
        </form>
      )}
      {data?.map((i) => (
        <article key={i.id} className="border-t border-border pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`badge ${prioridadClass[i.prioridad] || prioridadClass.MEDIA}`}>
              {i.prioridad || 'MEDIA'}
            </span>
            <span className="text-sm font-semibold">{tipoLabel(i.tipo)}</span>
            <span className="text-xs text-muted">
              {i.abierta || !i.resueltaAt ? 'Abierta' : 'Resuelta'} · {formatDateTime(i.createdAt)}
            </span>
          </div>
          <p className="mt-2">{i.descripcion}</p>
          {i.resolucion && <p className="mt-1 text-sm text-slate-600">Resolución: {i.resolucion}</p>}
          {admin && !i.resueltaAt && (
            <form onSubmit={(e) => enviar(e, i.id)} className="mt-2 space-y-2">
              <label className="label">
                Cómo se resolvió
                <input
                  className="input"
                  name="texto"
                  required
                  maxLength={500}
                  placeholder="Acción tomada y responsable"
                />
              </label>
              <button disabled={busy} className="btn-secondary">
                Marcar resuelta
              </button>
            </form>
          )}
        </article>
      ))}
      {data?.length === 0 && (
        <p className="text-muted">Sin incidencias. Úsalas cuando algo operativo ponga en riesgo el evento.</p>
      )}
      <Paginas page={page} onChange={pagina} mas={data?.length === 50} />
    </section>
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
          <Tabla
            titulo="Actividad por operador"
            columnas={['Operador', 'Tipo', 'Operaciones', 'Total']}
            filas={data.operadores.map((o) => [o.nombre, tipoMovimientoLabel(o.tipo), o.cantidad, formatBs(o.total)])}
          />
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
          {id && (
            <Incidencias key={id} ruta={ruta} admin={admin} resumen={data.incidencias} />
          )}
        </>
      )}
    </main>
  )
}
