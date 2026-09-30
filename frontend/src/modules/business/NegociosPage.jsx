import { useEffect, useState } from 'react'
import { createNegocio, getMisNegocios, updateNegocio } from '../../api/businesses.api'
import { getPublishedEvents } from '../../api/events.api'
import { toast } from '../../components/Toast'
import { getErrorMessage } from '../../utils/format'

const empty = { nombre: '', descripcion: '', eventoId: '' }

export default function NegociosPage() {
  const [items, setItems] = useState([])
  const [eventos, setEventos] = useState([])
  const [form, setForm] = useState(empty)
  const [editingId, setEditingId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [formError, setFormError] = useState('')

  const load = async () => {
    const [{ data }, { data: evData }] = await Promise.all([
      getMisNegocios(),
      getPublishedEvents().catch(() => ({ data: [] })),
    ])
    setItems(Array.isArray(data) ? data : data?.data ?? [])
    const list = Array.isArray(evData) ? evData : evData?.data ?? evData?.items ?? []
    setEventos(list)
  }

  useEffect(() => {
    ;(async () => {
      try {
        await load()
      } catch (err) {
        toast(getErrorMessage(err), 'error')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const resetForm = () => {
    setForm(empty)
    setEditingId(null)
    setFormError('')
  }

  const startEdit = (n) => {
    setEditingId(n.id)
    setForm({
      nombre: n.nombre || '',
      descripcion: n.descripcion || '',
      eventoId: n.eventoId || n.evento?.id || '',
    })
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
      eventoId: form.eventoId || undefined,
    }
    try {
      if (editingId) {
        await updateNegocio(editingId, payload)
        toast('Negocio actualizado', 'success')
      } else {
        await createNegocio(payload)
        toast('Negocio creado', 'success')
      }
      resetForm()
      await load()
    } catch (err) {
      toast(getErrorMessage(err), 'error')
    }
  }

  return (
    <div className="p-8">
      <h1 className="font-display text-3xl font-bold">Mis negocios</h1>

      <form onSubmit={onSubmit} className="mt-6 grid max-w-xl gap-3 rounded-md border border-border bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{editingId ? 'Editar negocio' : 'Nuevo negocio'}</h2>
          {editingId && (
            <button type="button" className="text-sm font-semibold text-muted" onClick={resetForm}>
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
            placeholder="Ej. Puesto de Empanadas"
            required
            minLength={2}
          />
        </div>
        <div>
          <label className="label">Descripción</label>
          <textarea
            className="input min-h-20"
            value={form.descripcion}
            onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
            placeholder="Qué ofreces: comidas, merchandising, bebidas…"
          />
        </div>
        <div>
          <label className="label">Evento</label>
          <select
            className="input"
            value={form.eventoId}
            onChange={(e) => setForm({ ...form, eventoId: e.target.value })}
          >
            <option value="">Sin asignar aún</option>
            {eventos.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.titulo}
              </option>
            ))}
            {editingId &&
              form.eventoId &&
              !eventos.some((ev) => ev.id === form.eventoId) && (
                <option value={form.eventoId}>Evento actual (no publicado)</option>
              )}
          </select>
        </div>
        {formError && <p className="text-sm text-red-600">{formError}</p>}
        <button type="submit" className="btn-primary w-fit">
          {editingId ? 'Guardar cambios' : 'Crear negocio'}
        </button>
      </form>

      {loading ? (
        <p className="mt-6 text-muted">Cargando…</p>
      ) : (
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {items.map((n) => (
            <article key={n.id} className="rounded-md border border-border bg-white p-5">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-display text-xl font-bold">{n.nombre}</h3>
                <button
                  type="button"
                  className="text-sm font-semibold text-teal"
                  onClick={() => startEdit(n)}
                >
                  Editar
                </button>
              </div>
              <p className="mt-1 text-sm text-slate-600">{n.descripcion || 'Sin descripción'}</p>
              <p className="mt-2 text-xs text-muted">
                {n.productos?.length || 0} productos · {n.ayudantes?.length || 0} ayudantes
                {n.evento ? ` · ${n.evento.titulo}` : ''}
              </p>
            </article>
          ))}
          {!items.length && <p className="text-muted">Aún no tienes negocios.</p>}
        </div>
      )}
    </div>
  )
}
