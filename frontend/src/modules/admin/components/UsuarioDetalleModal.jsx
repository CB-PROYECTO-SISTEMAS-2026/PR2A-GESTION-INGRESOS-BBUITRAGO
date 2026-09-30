import { useEffect, useState } from 'react'
import { getUsuario } from '../../../api/adminUsers.api'
import Modal from '../../../components/ui/Modal'
import { formatBs, formatDate, formatDateTime, formatDay, getErrorMessage } from '../../../utils/format'
import { estadoBadgeClass, estadoLabel } from '../../../utils/labels'
import { roleLabel } from '../../../utils/roles'

function Dato({ label, children }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium text-ink">{children || '—'}</dd>
    </div>
  )
}

function Grupo({ title, children }) {
  return (
    <section className="border-t border-border px-6 py-5 first:border-t-0">
      <h3 className="mb-4 text-sm font-bold text-ink">{title}</h3>
      <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">{children}</dl>
    </section>
  )
}

function Estado({ value }) {
  return <span className={`badge ${estadoBadgeClass(value)}`}>{estadoLabel(value)}</span>
}

/** Últimos registros de una sección, con el total cuando hay más de los que se muestran. */
function Lista({ title, total, vacio, rows }) {
  return (
    <section className="border-t border-border px-6 py-5">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h3 className="text-sm font-bold text-ink">{title}</h3>
        <span className="text-xs text-muted">
          {total === 1 ? '1 registro' : `${total} registros`}
          {total > rows.length && rows.length > 0 ? ` · últimos ${rows.length}` : ''}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">{vacio}</p>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {rows.map((r) => (
            <li key={r.key} className="flex items-center justify-between gap-4 py-2.5 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-ink">{r.titulo}</p>
                {r.detalle && <p className="truncate text-xs text-muted">{r.detalle}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {r.extra && <span className="text-sm text-slate-700">{r.extra}</span>}
                {r.estado && <Estado value={r.estado} />}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function ActividadCliente({ u }) {
  return (
    <>
      <Lista
        title="Compras"
        total={u._count.compras}
        vacio="Todavía no realizó compras."
        rows={u.compras.map((c) => ({
          key: c.id,
          titulo: c.evento.titulo,
          detalle: formatDateTime(c.createdAt),
          extra: formatBs(c.montoTotal),
          estado: c.estado,
        }))}
      />
      <Lista
        title="Entradas"
        total={u._count.entradas}
        vacio="No tiene entradas a su nombre."
        rows={u.entradas.map((e) => ({
          key: e.id,
          titulo: e.evento.titulo,
          detalle: `${e.categoria.nombre} · ${e.codigo}`,
          estado: e.estado,
        }))}
      />
    </>
  )
}

function ActividadOrganizador({ u }) {
  return (
    <>
      <Lista
        title="Solicitudes de evento"
        total={u._count.solicitudes}
        vacio="Todavía no envió solicitudes."
        rows={u.solicitudes.map((s) => ({
          key: s.id,
          titulo: s.nombreEvento,
          detalle: `Enviada el ${formatDate(s.createdAt)} · evento el ${formatDay(s.fechaInicio)}`,
          estado: s.estado,
        }))}
      />
      <Lista
        title="Eventos"
        total={u._count.eventosOrganizados}
        vacio="Todavía no tiene eventos creados."
        rows={u.eventosOrganizados.map((e) => ({
          key: e.id,
          titulo: e.titulo,
          detalle: e.fechas[0] ? formatDay(e.fechas[0].fecha) : '',
          estado: e.estado,
        }))}
      />
    </>
  )
}

function ActividadNegocio({ u }) {
  return (
    <Lista
      title="Negocios"
      total={u._count.negocios}
      vacio="Todavía no registró negocios."
      rows={u.negocios.map((n) => ({
        key: n.id,
        titulo: n.nombre,
        detalle: [
          n.evento?.titulo ?? 'Sin evento asignado',
          `${n._count.productos} ${n._count.productos === 1 ? 'producto' : 'productos'}`,
          `${n._count.ayudantes} ${n._count.ayudantes === 1 ? 'ayudante' : 'ayudantes'}`,
        ].join(' · '),
        extra: n.activo ? '' : 'Inactivo',
      }))}
    />
  )
}

function ActividadAyudante({ u }) {
  const a = u.ayudanteDe
  return (
    <Grupo title="Negocio asignado">
      {a ? (
        <>
          <Dato label="Negocio">{a.negocio.nombre}</Dato>
          <Dato label="Evento">{a.negocio.evento?.titulo}</Dato>
          <Dato label="Función">{a.rolFuncion}</Dato>
          <Dato label="Jefe de negocio">{[a.jefe.nombre, a.jefe.apellido].filter(Boolean).join(' ')}</Dato>
        </>
      ) : (
        <p className="text-sm text-muted sm:col-span-2">No está asignado a ningún negocio.</p>
      )}
    </Grupo>
  )
}

const ACTIVIDAD_POR_ROL = {
  CLIENTE: ActividadCliente,
  ORGANIZADOR: ActividadOrganizador,
  JEFE_NEGOCIO: ActividadNegocio,
  AYUDANTE: ActividadAyudante,
}

export default function UsuarioDetalleModal({ usuarioId, onClose }) {
  const [usuario, setUsuario] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!usuarioId) return undefined
    let alive = true
    setUsuario(null)
    setError('')
    getUsuario(usuarioId)
      .then(({ data }) => alive && setUsuario(data))
      .catch((err) => alive && setError(getErrorMessage(err)))
    return () => {
      alive = false
    }
  }, [usuarioId])

  const nombre = usuario ? [usuario.nombre, usuario.apellido].filter(Boolean).join(' ') : ''
  const iniciales = usuario
    ? `${(usuario.nombre?.[0] || '?').toUpperCase()}${(usuario.apellido?.[0] || '').toUpperCase()}`
    : ''

  return (
    <Modal
      open={Boolean(usuarioId)}
      onClose={onClose}
      title="Datos del usuario"
      size="lg"
      labelledBy="usuario-detalle-title"
      footer={
        <button type="button" className="btn-secondary" onClick={onClose}>
          Cerrar
        </button>
      }
    >
      {error && <p className="px-6 py-8 text-sm text-red-600">{error}</p>}
      {!usuario && !error && <p className="px-6 py-8 text-sm text-muted">Cargando…</p>}
      {usuario && (
        <>
          <div className="flex items-center gap-4 bg-page px-6 py-5">
            {usuario.fotoUrl ? (
              <img
                src={usuario.fotoUrl}
                alt=""
                className="h-16 w-16 shrink-0 rounded-full border border-border object-cover"
              />
            ) : (
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-navy font-display text-xl font-bold text-white">
                {iniciales}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate font-display text-xl font-bold text-ink">{nombre}</p>
              <p className="truncate text-sm text-muted">{usuario.email}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {usuario.roles.map((r) => (
                  <span key={r} className="badge bg-teal/10 text-teal-dark">
                    {roleLabel(r)}
                  </span>
                ))}
                <span
                  className={`badge ${
                    usuario.activo ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {usuario.activo ? 'Activo' : 'Inactivo'}
                </span>
              </div>
            </div>
          </div>

          <Grupo title="Datos personales">
            <Dato label="Nombre">{usuario.nombre}</Dato>
            <Dato label="Apellido">{usuario.apellido}</Dato>
            <Dato label="Correo electrónico">{usuario.email}</Dato>
            <Dato label="Teléfono">{usuario.telefono}</Dato>
            <Dato label="Documento de identidad">{usuario.documento}</Dato>
            <Dato label="Fecha de nacimiento">{usuario.fechaNac ? formatDay(usuario.fechaNac) : ''}</Dato>
            <Dato label="Registrado">{formatDateTime(usuario.createdAt)}</Dato>
            <Dato label="Última actualización">{formatDateTime(usuario.updatedAt)}</Dato>
          </Grupo>

          {usuario.roles.map((r) => {
            const Actividad = ACTIVIDAD_POR_ROL[r]
            return Actividad ? <Actividad key={r} u={usuario} /> : null
          })}
        </>
      )}
    </Modal>
  )
}
