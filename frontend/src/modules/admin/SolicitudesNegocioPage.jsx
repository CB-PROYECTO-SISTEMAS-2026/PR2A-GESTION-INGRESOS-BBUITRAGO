import { useEffect, useState } from 'react'
import {
  getAdminSolicitudesNegocio,
  revisarSolicitudNegocio,
} from '../../api/businesses.api'
import { toast } from '../../components/Toast'
import { confirmDialog } from '../../components/ui/ConfirmDialog'
import { estadoBadgeClass, estadoLabel } from '../../utils/labels'
import { formatDateTime, getErrorMessage } from '../../utils/format'

const FILTROS = [
  { value: '', label: 'Todas' },
  { value: 'PENDIENTE', label: 'Pendientes' },
  { value: 'ACEPTADA', label: 'Aceptadas' },
  { value: 'RECHAZADA', label: 'Rechazadas' },
  { value: 'CANCELADA', label: 'Canceladas' },
]

export default function SolicitudesNegocioPage() {
  const [items, setItems] = useState([])
  const [filtro, setFiltro] = useState('PENDIENTE')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [respuestas, setRespuestas] = useState({})

  const load = async (estado = filtro) => {
    setLoading(true)
    try {
      const { data } = await getAdminSolicitudesNegocio(
        estado ? { estado } : undefined,
      )
      setItems(Array.isArray(data) ? data : [])
    } catch (err) {
      toast(getErrorMessage(err), 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(filtro)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro])

  const revisar = async (id, estado) => {
    const respuesta = (respuestas[id] || '').trim()
    if (estado === 'RECHAZADA' && !respuesta) {
      toast('Indica el motivo del rechazo.', 'error')
      return
    }
    const ok = await confirmDialog({
      title: estado === 'ACEPTADA' ? 'Aceptar participación' : 'Rechazar solicitud',
      message:
        estado === 'ACEPTADA'
          ? 'El negocio podrá vender con puntos en este evento desde el POS.'
          : 'El negocio no podrá vender en este evento hasta una nueva solicitud aceptada.',
      confirmText: estado === 'ACEPTADA' ? 'Aceptar' : 'Rechazar',
      tone: estado === 'RECHAZADA' ? 'danger' : 'default',
    })
    if (!ok) return
    setBusyId(id)
    try {
      const { data } = await revisarSolicitudNegocio(id, {
        estado,
        respuesta: respuesta || undefined,
      })
      toast(
        data?.correoEnviado === false
          ? 'Solicitud actualizada, pero el correo no se pudo enviar.'
          : 'Solicitud actualizada.',
        data?.correoEnviado === false ? 'info' : 'success',
      )
      await load(filtro)
    } catch (err) {
      toast(getErrorMessage(err), 'error')
    } finally {
      setBusyId('')
    }
  }

  return (
    <div className="p-8">
      <h1 className="font-display text-3xl font-bold">Participación de negocios</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Aquí aceptas o rechazas qué puestos pueden vender en cada evento. Sin aceptación, el POS
        bloquea el cobro aunque el negocio exista.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {FILTROS.map((f) => (
          <button
            key={f.value || 'all'}
            type="button"
            className={filtro === f.value ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
            onClick={() => setFiltro(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="mt-6 text-muted">Cargando…</p>
      ) : items.length === 0 ? (
        <p className="mt-6 text-muted">No hay solicitudes con este filtro.</p>
      ) : (
        <div className="mt-6 grid gap-4">
          {items.map((s) => {
            const dueno = s.negocio?.dueno
            const nombreDueno = [dueno?.nombre, dueno?.apellido].filter(Boolean).join(' ')
            return (
              <article key={s.id} className="rounded-md border border-border bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-xl font-bold">{s.negocio?.nombre}</h2>
                    <p className="text-sm text-slate-600">
                      Evento: <strong>{s.evento?.titulo}</strong>
                      {s.evento?.estado ? ` · ${estadoLabel(s.evento.estado)}` : ''}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {nombreDueno || 'Dueño'}
                      {dueno?.email ? ` · ${dueno.email}` : ''}
                      {' · '}
                      {formatDateTime(s.createdAt)}
                    </p>
                  </div>
                  <span className={`badge ${estadoBadgeClass(s.estado)}`}>
                    {estadoLabel(s.estado)}
                  </span>
                </div>
                {s.negocio?.descripcion && (
                  <p className="mt-3 text-sm text-slate-600">{s.negocio.descripcion}</p>
                )}
                {s.mensaje && (
                  <p className="mt-3 rounded bg-page p-3 text-sm">
                    Mensaje del negocio: {s.mensaje}
                  </p>
                )}
                {s.respuesta && s.estado !== 'PENDIENTE' && (
                  <p className="mt-2 text-sm">Respuesta: {s.respuesta}</p>
                )}
                {s.estado === 'PENDIENTE' && (
                  <div className="mt-4 space-y-3 border-t border-border pt-4">
                    <label className="label">
                      Respuesta (obligatoria si rechazas)
                      <textarea
                        className="input mt-1 min-h-16"
                        value={respuestas[s.id] || ''}
                        onChange={(e) =>
                          setRespuestas((prev) => ({ ...prev, [s.id]: e.target.value }))
                        }
                        maxLength={1000}
                        placeholder="Ubicación asignada, motivo de rechazo, etc."
                      />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={busyId === s.id}
                        onClick={() => revisar(s.id, 'ACEPTADA')}
                      >
                        Aceptar participación
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={busyId === s.id}
                        onClick={() => revisar(s.id, 'RECHAZADA')}
                      >
                        Rechazar
                      </button>
                    </div>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
