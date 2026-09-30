import { useEffect, useState } from 'react'
import {
  createProducto,
  deleteProducto,
  getMisNegocios,
  updateProducto,
} from '../../api/businesses.api'
import { toast } from '../../components/Toast'
import { confirmDelete } from '../../components/ui/ConfirmDialog'
import { MoneyInput } from '../../components/form/NumberInputs'
import { formatBs, getErrorMessage } from '../../utils/format'
import { validateMoney } from '../../utils/validation'

const empty = { nombre: '', precio: '', descripcion: '' }

export default function ProductosPage() {
  const [negocios, setNegocios] = useState([])
  const [negocioId, setNegocioId] = useState('')
  const [form, setForm] = useState(empty)
  const [editingId, setEditingId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [formError, setFormError] = useState('')

  const load = async () => {
    const { data } = await getMisNegocios()
    const list = Array.isArray(data) ? data : data?.data ?? []
    setNegocios(list)
    if (!negocioId && list[0]) setNegocioId(list[0].id)
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

  const selected = negocios.find((n) => n.id === negocioId)
  const productos = selected?.productos || []

  const resetForm = () => {
    setForm(empty)
    setEditingId(null)
    setFormError('')
  }

  const startEdit = (p) => {
    setEditingId(p.id)
    setForm({
      nombre: p.nombre || '',
      precio: String(p.precio ?? ''),
      descripcion: p.descripcion || '',
    })
    setFormError('')
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    if (!negocioId) return toast('Selecciona un negocio', 'error')
    if (!form.nombre.trim()) {
      setFormError('El nombre del producto es obligatorio.')
      return
    }
    const precioError = validateMoney(form.precio)
    if (precioError) {
      setFormError(precioError)
      return
    }
    setFormError('')
    const payload = {
      nombre: form.nombre.trim(),
      precio: form.precio,
      descripcion: form.descripcion.trim() || undefined,
    }
    try {
      if (editingId) {
        await updateProducto(editingId, payload)
        toast('Producto actualizado', 'success')
      } else {
        await createProducto(negocioId, payload)
        toast('Producto agregado', 'success')
      }
      resetForm()
      await load()
    } catch (err) {
      toast(getErrorMessage(err), 'error')
    }
  }

  const onDelete = async (id) => {
    const producto = productos.find((p) => p.id === id)
    const ok = await confirmDelete({
      title: 'Eliminar producto',
      message: `Se eliminará "${producto?.nombre}" del catálogo de ${selected?.nombre}.`,
    })
    if (!ok) return
    try {
      await deleteProducto(id)
      if (editingId === id) resetForm()
      toast('Producto eliminado', 'success')
      await load()
    } catch (err) {
      toast(getErrorMessage(err), 'error')
    }
  }

  if (loading) return <div className="p-8 text-muted">Cargando…</div>

  return (
    <div className="p-8">
      <h1 className="font-display text-3xl font-bold">Productos</h1>

      <div className="mt-4 max-w-xs">
        <label className="label">Negocio</label>
        <select
          className="input"
          value={negocioId}
          onChange={(e) => {
            setNegocioId(e.target.value)
            resetForm()
          }}
        >
          <option value="">Seleccionar…</option>
          {negocios.map((n) => (
            <option key={n.id} value={n.id}>
              {n.nombre}
            </option>
          ))}
        </select>
      </div>

      <form onSubmit={onSubmit} className="mt-6 grid max-w-xl gap-3 rounded-md border border-border bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{editingId ? 'Editar producto' : 'Nuevo producto'}</h2>
          {editingId && (
            <button type="button" className="text-sm font-semibold text-muted" onClick={resetForm}>
              Cancelar
            </button>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Nombre *</label>
            <input
              className="input"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              placeholder="Ej. Hamburguesa clásica"
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="producto-precio">
              Precio *
            </label>
            <MoneyInput id="producto-precio" value={form.precio} onChange={(v) => setForm({ ...form, precio: v })} />
          </div>
        </div>
        <div>
          <label className="label">Descripción</label>
          <input
            className="input"
            value={form.descripcion}
            onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
          />
        </div>
        {formError && <p className="text-sm text-red-600">{formError}</p>}
        <button type="submit" className="btn-primary w-fit">
          {editingId ? 'Guardar cambios' : 'Agregar producto'}
        </button>
      </form>

      <div className="mt-8 overflow-x-auto rounded-md border border-border bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-page text-muted">
            <tr>
              <th className="px-4 py-3">Producto</th>
              <th className="px-4 py-3">Precio</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {productos.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="px-4 py-3">
                  <p className="font-medium">{p.nombre}</p>
                  {p.descripcion && <p className="text-xs text-muted">{p.descripcion}</p>}
                </td>
                <td className="px-4 py-3">{formatBs(p.precio)}</td>
                <td className="px-4 py-3 text-right space-x-3">
                  <button type="button" className="text-sm font-semibold text-teal" onClick={() => startEdit(p)}>
                    Editar
                  </button>
                  <button type="button" className="text-sm font-semibold text-red-600" onClick={() => onDelete(p.id)}>
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
            {!productos.length && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-muted">
                  Sin productos en este negocio.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
