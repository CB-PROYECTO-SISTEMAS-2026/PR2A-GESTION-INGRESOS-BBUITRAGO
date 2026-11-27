import { useEffect, useMemo, useState } from 'react'
import {
  createProducto,
  deleteProducto,
  getMisNegocios,
  updateProducto,
} from '../../api/businesses.api'
import { toast } from '../../components/Toast'
import { IntegerInput, MoneyInput } from '../../components/form/NumberInputs'
import FillHoverButton from '../../components/ui/FillHoverButton'
import Modal from '../../components/ui/Modal'
import { IconChevronDown, IconChevronUp, IconSearch } from '../../components/ui/icons'
import { formatBs, getErrorMessage } from '../../utils/format'
import { validateMoney } from '../../utils/validation'

const CATEGORIAS = [
  ['COMIDA', 'Comida'],
  ['BEBIDA', 'Bebida'],
  ['SNACK', 'Snack'],
  ['POSTRE', 'Postre'],
  ['MERCHANDISING', 'Merchandising'],
  ['OTRO', 'Otro'],
]
const CATEGORIA_LABEL = Object.fromEntries(CATEGORIAS)
const MAX_STOCK = 100000
const empty = { nombre: '', precio: '', descripcion: '', categoria: 'OTRO', stock: '' }

function stockLabel(stock) {
  if (stock == null) return 'Sin control'
  if (stock === 0) return 'Agotado'
  return String(stock)
}

function stockSortValue(stock) {
  return stock == null ? Number.POSITIVE_INFINITY : Number(stock)
}

function SortHeader({ label, field, sort, onToggle }) {
  const active = sort.field === field
  const Arrow = active && sort.dir === 'asc' ? IconChevronUp : IconChevronDown
  return (
    <th className="px-4 py-3">
      <button
        type="button"
        className="inline-flex items-center gap-1 font-semibold text-muted hover:text-ink"
        onClick={() => onToggle(field)}
        aria-label={`Ordenar por ${label} ${active && sort.dir === 'asc' ? 'descendente' : 'ascendente'}`}
      >
        {label}
        <Arrow className={`h-4 w-4 ${active ? 'text-primary' : 'text-muted/70'}`} />
      </button>
    </th>
  )
}

export default function ProductosPage() {
  const [negocio, setNegocio] = useState(null)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [sort, setSort] = useState({ field: null, dir: 'asc' })
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(empty)
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = async () => {
    const { data } = await getMisNegocios()
    const list = Array.isArray(data) ? data : data?.data ?? []
    setNegocio(list[0] || null)
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

  const toggleSort = (field) => {
    setSort((prev) => {
      if (prev.field !== field) return { field, dir: 'asc' }
      if (prev.dir === 'asc') return { field, dir: 'desc' }
      return { field: null, dir: 'asc' }
    })
  }

  const productos = useMemo(() => {
    const list = [...(negocio?.productos || [])]
    const term = q.trim().toLowerCase()
    const filtered = term
      ? list.filter((p) => {
          const nombre = (p.nombre || '').toLowerCase()
          const desc = (p.descripcion || '').toLowerCase()
          const cat = (CATEGORIA_LABEL[p.categoria] || p.categoria || '').toLowerCase()
          return nombre.includes(term) || desc.includes(term) || cat.includes(term)
        })
      : list

    if (sort.field === 'precio') {
      filtered.sort((a, b) => {
        const diff = Number(a.precio) - Number(b.precio)
        return sort.dir === 'asc' ? diff : -diff
      })
    } else if (sort.field === 'stock') {
      filtered.sort((a, b) => {
        const diff = stockSortValue(a.stock) - stockSortValue(b.stock)
        return sort.dir === 'asc' ? diff : -diff
      })
    } else {
      filtered.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'))
    }
    return filtered
  }, [negocio, q, sort])

  const openCreate = () => {
    setForm(empty)
    setFormError('')
    setModal({ type: 'form', producto: null })
  }

  const openEdit = (producto) => {
    setForm({
      nombre: producto.nombre || '',
      precio: String(producto.precio ?? ''),
      descripcion: producto.descripcion || '',
      categoria: producto.categoria || 'OTRO',
      stock: producto.stock == null ? '' : String(producto.stock),
    })
    setFormError('')
    setModal({ type: 'form', producto })
  }

  const openDelete = (producto) => {
    setModal({ type: 'delete', producto })
  }

  const closeModal = () => {
    if (busy) return
    setModal(null)
    setForm(empty)
    setFormError('')
  }

  const onSave = async (e) => {
    e.preventDefault()
    if (!negocio?.id) return toast('Registra tu negocio primero', 'error')
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
      categoria: form.categoria,
      stock: form.stock === '' ? null : Number(form.stock),
    }
    setBusy(true)
    try {
      if (modal?.producto) {
        await updateProducto(modal.producto.id, payload)
        toast('Producto actualizado', 'success')
      } else {
        await createProducto(negocio.id, payload)
        toast('Producto agregado', 'success')
      }
      setModal(null)
      setForm(empty)
      await load()
    } catch (err) {
      toast(getErrorMessage(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  const onConfirmDelete = async () => {
    if (!modal?.producto) return
    setBusy(true)
    try {
      await deleteProducto(modal.producto.id)
      toast('Producto eliminado', 'success')
      setModal(null)
      await load()
    } catch (err) {
      toast(getErrorMessage(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <div className="p-8 text-muted">Cargando…</div>

  if (!negocio) {
    return (
      <div className="p-8">
        <h1 className="font-display text-3xl font-bold">Productos</h1>
        <p className="mt-4 text-muted">Registra tu negocio en Mi Negocio para cargar el catálogo.</p>
      </div>
    )
  }

  const editing = Boolean(modal?.type === 'form' && modal.producto)
  const deleting = modal?.type === 'delete' ? modal.producto : null

  return (
    <div className="p-8">
      <p className="font-display text-4xl font-bold tracking-tight text-ink sm:text-5xl">{negocio.nombre}</p>
      <h1 className="mt-2 text-sm font-semibold uppercase tracking-wide text-muted">Productos</h1>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 w-full sm:max-w-xs">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <label htmlFor="producto-buscar" className="sr-only">
            Buscar productos
          </label>
          <input
            id="producto-buscar"
            className="input pl-10"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <FillHoverButton variant="primary" className="shrink-0 self-end sm:self-auto" onClick={openCreate}>
          Añadir producto
        </FillHoverButton>
      </div>

      <div className="mt-4 overflow-x-auto rounded-md border border-border bg-surface">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-page text-muted">
            <tr>
              <th className="px-4 py-3">Producto</th>
              <th className="px-4 py-3">Categoría</th>
              <SortHeader label="Precio" field="precio" sort={sort} onToggle={toggleSort} />
              <SortHeader label="Stock" field="stock" sort={sort} onToggle={toggleSort} />
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {productos.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="px-4 py-3">
                  <p className="font-medium text-ink">{p.nombre}</p>
                  {p.descripcion && <p className="text-xs text-muted">{p.descripcion}</p>}
                </td>
                <td className="px-4 py-3 text-muted">{CATEGORIA_LABEL[p.categoria] || p.categoria}</td>
                <td className="px-4 py-3">{formatBs(p.precio)}</td>
                <td className="px-4 py-3">
                  {p.stock == null ? (
                    <span className="text-muted">—</span>
                  ) : p.stock === 0 ? (
                    'Agotado'
                  ) : (
                    p.stock
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <FillHoverButton variant="primary" className="ev-fill-btn--sm" onClick={() => openEdit(p)}>
                      Editar
                    </FillHoverButton>
                    <FillHoverButton variant="danger" className="ev-fill-btn--sm" onClick={() => openDelete(p)}>
                      Eliminar
                    </FillHoverButton>
                  </div>
                </td>
              </tr>
            ))}
            {!productos.length && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted">
                  {q.trim() ? 'Ningún producto coincide con la búsqueda.' : 'Sin productos en el catálogo.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={modal?.type === 'form'}
        onClose={closeModal}
        title={editing ? 'Editar producto' : 'Añadir producto'}
        labelledBy="producto-form-title"
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={closeModal} disabled={busy}>
              Cancelar
            </button>
            <FillHoverButton type="submit" form="producto-form" variant="primary" disabled={busy}>
              {busy ? 'Guardando…' : editing ? 'Guardar cambios' : 'Añadir producto'}
            </FillHoverButton>
          </>
        }
      >
        <form id="producto-form" onSubmit={onSave} className="grid gap-4 p-6 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="producto-nombre">
              Nombre *
            </label>
            <input
              id="producto-nombre"
              className="input"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              required
              autoComplete="off"
            />
          </div>
          <div>
            <label className="label" htmlFor="producto-precio">
              Precio *
            </label>
            <MoneyInput id="producto-precio" value={form.precio} onChange={(v) => setForm({ ...form, precio: v })} />
          </div>
          <div>
            <label className="label" htmlFor="producto-categoria">
              Categoría
            </label>
            <select
              id="producto-categoria"
              className="input"
              value={form.categoria}
              onChange={(e) => setForm({ ...form, categoria: e.target.value })}
            >
              {CATEGORIAS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="producto-stock">
              Stock
            </label>
            <IntegerInput
              id="producto-stock"
              value={form.stock}
              max={MAX_STOCK}
              placeholder="Sin control de stock"
              onChange={(v) => setForm({ ...form, stock: v })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="producto-descripcion">
              Descripción
            </label>
            <input
              id="producto-descripcion"
              className="input"
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              autoComplete="off"
            />
          </div>
          {formError && <p className="text-sm text-danger sm:col-span-2">{formError}</p>}
        </form>
      </Modal>

      <Modal
        open={Boolean(deleting)}
        onClose={closeModal}
        title="Eliminar producto"
        labelledBy="producto-delete-title"
        size="sm"
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={closeModal} disabled={busy}>
              Cancelar
            </button>
            <FillHoverButton variant="danger" onClick={onConfirmDelete} disabled={busy}>
              {busy ? 'Eliminando…' : 'Sí, eliminar'}
            </FillHoverButton>
          </>
        }
      >
        {deleting && (
          <div className="space-y-4 p-6">
            <p className="text-sm text-ink">¿Seguro que quieres borrar este producto?</p>
            <dl className="grid gap-2 rounded-md border border-border bg-page p-4 text-sm">
              <div>
                <dt className="text-muted">Nombre</dt>
                <dd className="font-semibold text-ink">{deleting.nombre}</dd>
              </div>
              <div>
                <dt className="text-muted">Categoría</dt>
                <dd>{CATEGORIA_LABEL[deleting.categoria] || deleting.categoria}</dd>
              </div>
              <div>
                <dt className="text-muted">Precio</dt>
                <dd>{formatBs(deleting.precio)}</dd>
              </div>
              <div>
                <dt className="text-muted">Stock</dt>
                <dd>{stockLabel(deleting.stock)}</dd>
              </div>
              {deleting.descripcion && (
                <div>
                  <dt className="text-muted">Descripción</dt>
                  <dd>{deleting.descripcion}</dd>
                </div>
              )}
            </dl>
            <p className="text-xs text-muted">
              Se dará de baja del catálogo. El historial de ventas que lo referencie se conserva.
            </p>
          </div>
        )}
      </Modal>
    </div>
  )
}
