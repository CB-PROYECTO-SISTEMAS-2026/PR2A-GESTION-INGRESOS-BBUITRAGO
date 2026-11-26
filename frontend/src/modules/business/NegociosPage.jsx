import { useEffect, useState } from 'react'
import {
  cancelarSolicitudNegocio,
  createNegocio,
  getEventosDisponiblesNegocio,
  getMisNegocios,
  getMisSolicitudesNegocio,
  solicitarParticipacionNegocio,
  updateNegocio,
} from '../../api/businesses.api'
import { toast } from '../../components/Toast'
import { confirmDialog } from '../../components/ui/ConfirmDialog'
import { estadoBadgeClass, estadoLabel } from '../../utils/labels'
import { formatDate, getErrorMessage } from '../../utils/format'

const empty = { nombre: '', descripcion: '' }

export default function NegociosPage() {
  const [items, setItems] = useState([])
  const [solicitudes, setSolicitudes] = useState([])
  const [eventos, setEventos] = useState([])
  const [form, setForm] = useState(empty)
  const [solicitudForm, setSolicitudForm] = useState({ eventoId: '', mensaje: '' })
  const [editingId, setEditingId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [formError, setFormError] = useState('')
  const [solError, setSolError] = useState('')
  const [busySol, setBusySol] = useState(false)

  const fillForm = (n) => {
    if (!n) {
      setForm(empty)
      return
    }
    setForm({
      nombre: n.nombre || '',
      descripcion: n.descripcion || '',
    })
  }

  const load = async () => {
    const [{ data }, { data: sols }, { data: evs }] = await Promise.all([
      getMisNegocios(),
      getMisSolicitudesNegocio().catch(() => ({ data: [] })),
      getEventosDisponiblesNegocio().catch(() => ({ data: [] })),
    ])
    const list = Array.isArray(data) ? data : data?.data ?? []
    setItems(list)
    setSolicitudes(Array.isArray(sols) ? sols : [])
    setEventos(Array.isArray(evs) ? evs : [])
    return list
  }

  useEffect(() => {
    ;(async () => {
      try {
        const list = await load()
        fillForm(list[0])
      } catch (err) {
        toast(getErrorMessage(err), 'error')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const resetForm = (negocioActual) => {
    setEditingId(null)
    setFormError('')
    fillForm(negocioActual ?? items[0])
  }

  const startEdit = (n) => {
    setEditingId(n.id)
    fillForm(n)
    setFormError('')
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    if (!form.nombre.trim() || form.nombre.trim().length < 2) {
      setFormError('El nombre del negocio es obligatorio (mínimo 2 caracteres).')
      return
    }
    setFormError('')
    const payload = {
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim() || undefined,
    }
    try {
      if (editingId) {
        await updateNegocio(editingId, payload)
        toast('Negocio actualizado', 'success')
      } else {
        await createNegocio(payload)
        toast('Negocio creado', 'success')
      }
      const list = await load()
      resetForm(list[0])
    } catch (err) {
      toast(getErrorMessage(err), 'error')
    }
  }

  const onSolicitar = async (e) => {
    e.preventDefault()
    if (!solicitudForm.eventoId) {
      setSolError('Elige el evento en el que quieres participar.')
      return
    }
    setSolError('')
    setBusySol(true)
    try {
      await solicitarParticipacionNegocio({
        eventoId: solicitudForm.eventoId,
        mensaje: solicitudForm.mensaje.trim() || undefined,
      })
      toast('Solicitud enviada. El administrador la revisará.', 'success')
      setSolicitudForm({ eventoId: '', mensaje: '' })
      await load()
    } catch (err) {
      toast(getErrorMessage(err), 'error')
    } finally {
      setBusySol(false)
    }
  }

  const onCancelar = async (id) => {
    const ok = await confirmDialog({
      title: 'Cancelar solicitud',
      message: '¿Cancelar esta solicitud de participación?',
      confirmText: 'Sí, cancelar',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await cancelarSolicitudNegocio(id)
      toast('Solicitud cancelada', 'success')
      await load()
    } catch (err) {
      toast(getErrorMessage(err), 'error')
    }
  }

  const negocio = items[0]
  const aceptadas = (negocio?.solicitudes || solicitudes).filter((s) => s.estado === 'ACEPTADA')

  return (
    <div className="p-8">
      <h1 className="font-display text-3xl font-bold">Mi negocio</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Primero registra tu puesto. Después solicita participar en cada evento: solo cuando el
        administrador acepte la solicitud tus ayudantes podrán cobrar con puntos en el POS.
      </p>

      <form onSubmit={onSubmit} className="mt-6 grid max-w-xl gap-3 rounded-md border border-border bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{editingId ? 'Editar negocio' : negocio ? 'Datos del negocio' : 'Nuevo negocio'}</h2>
          {editingId && (
            <button type="button" className="text-sm font-semibold text-muted" onClick={() => resetForm()}>
              Cancelar
            </button>
          )}
        </div>
        <div>
          <label className="label">Nombre del negocio *</label>
          <input
            className="input"
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            placeholder={negocio ? undefined : 'Ej. Puesto de Empanadas'}
            required
            minLength={2}
            disabled={!editingId && Boolean(negocio)}
          />
        </div>
        <div>
          <label className="label">Descripción</label>
          <textarea
            className="input min-h-20"
            value={form.descripcion}
            onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
            placeholder={negocio ? undefined : 'Qué ofreces: comidas, merchandising, bebidas…'}
            disabled={!editingId && Boolean(negocio)}
          />
        </div>
        {formError && <p className="text-sm text-red-600">{formError}</p>}
        {negocio && !editingId ? (
          <button type="button" className="btn-secondary w-fit" onClick={() => startEdit(negocio)}>
            Editar datos
          </button>
        ) : (
          <button type="submit" className="btn-primary w-fit">
            {editingId ? 'Guardar cambios' : 'Crear negocio'}
          </button>
        )}
      </form>

      {negocio && (
        <section className="mt-8 max-w-2xl space-y-4">
          <h2 className="font-display text-2xl font-bold">Participación en eventos</h2>
          {aceptadas.length > 0 && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm">
              <p className="font-semibold text-emerald-900">Habilitado para vender en:</p>
              <ul className="mt-2 list-disc pl-5 text-emerald-800">
                {aceptadas.map((s) => (
                  <li key={s.id}>{s.evento?.titulo || 'Evento'}</li>
                ))}
              </ul>
            </div>
          )}

          <form onSubmit={onSolicitar} className="grid gap-3 rounded-md border border-border bg-white p-5">
            <h3 className="font-semibold">Solicitar participar en un evento</h3>
            <div>
              <label className="label">Evento *</label>
              <select
                className="input"
                value={solicitudForm.eventoId}
                onChange={(e) => setSolicitudForm({ ...solicitudForm, eventoId: e.target.value })}
                required
              >
                <option value="">Selecciona un evento</option>
                {eventos.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.titulo}
                    {ev.estado === 'BORRADOR' ? ' (borrador)' : ''}
                  </option>
                ))}
              </select>
              {!eventos.length && (
                <p className="mt-1 text-xs text-muted">
                  No hay eventos disponibles para solicitar, o ya pediste participar en todos.
                </p>
              )}
            </div>
            <div>
              <label className="label">Mensaje para el administrador (opcional)</label>
              <textarea
                className="input min-h-16"
                value={solicitudForm.mensaje}
                onChange={(e) => setSolicitudForm({ ...solicitudForm, mensaje: e.target.value })}
                placeholder="Rubro, ubicación del puesto, necesidades…"
                maxLength={1000}
              />
            </div>
            {solError && <p className="text-sm text-red-600">{solError}</p>}
            <button type="submit" className="btn-primary w-fit" disabled={busySol || !eventos.length}>
              {busySol ? 'Enviando…' : 'Enviar solicitud'}
            </button>
          </form>

          <div className="space-y-3">
            <h3 className="font-semibold">Historial de solicitudes</h3>
            {loading ? (
              <p className="text-muted">Cargando…</p>
            ) : solicitudes.length === 0 ? (
              <p className="text-muted">Aún no enviaste solicitudes de participación.</p>
            ) : (
              solicitudes.map((s) => (
                <article key={s.id} className="rounded-md border border-border bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{s.evento?.titulo || 'Evento'}</p>
                      <p className="text-xs text-muted">
                        Enviada {formatDate(s.createdAt)}
                        {s.evento?.fechas?.[0]?.fecha
                          ? ` · Inicio ${formatDate(s.evento.fechas[0].fecha)}`
                          : ''}
                      </p>
                    </div>
                    <span className={`badge ${estadoBadgeClass(s.estado)}`}>{estadoLabel(s.estado)}</span>
                  </div>
                  {s.mensaje && <p className="mt-2 text-sm text-slate-600">{s.mensaje}</p>}
                  {s.respuesta && (
                    <p className="mt-2 rounded bg-page p-2 text-sm">
                      Respuesta del admin: {s.respuesta}
                    </p>
                  )}
                  {s.estado === 'PENDIENTE' && (
                    <button
                      type="button"
                      className="mt-3 text-sm font-semibold text-red-600"
                      onClick={() => onCancelar(s.id)}
                    >
                      Cancelar solicitud
                    </button>
                  )}
                </article>
              ))
            )}
          </div>
        </section>
      )}

      {!loading && !negocio && (
        <p className="mt-6 text-muted">Crea tu negocio para poder solicitar participación en eventos.</p>
      )}
    </div>
  )
}
