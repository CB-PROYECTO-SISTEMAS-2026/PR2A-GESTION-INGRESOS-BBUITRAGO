import { useEffect, useMemo, useState } from 'react'
import {
  createAyudante,
  deleteAyudante,
  getMisNegocios,
  updateAyudante,
} from '../../api/businesses.api'
import { toast } from '../../components/Toast'
import FillHoverButton from '../../components/ui/FillHoverButton'
import Modal from '../../components/ui/Modal'
import { IconChevronDown, IconChevronUp, IconSearch } from '../../components/ui/icons'
import { estadoBadgeClass, estadoLabel } from '../../utils/labels'
import { getErrorMessage } from '../../utils/format'
import { validatePassword } from '../../utils/password'

const emptyCreate = {
  email: '',
  password: '',
  nombre: '',
  apellido: '',
}

const emptyEdit = {
  nombre: '',
  apellido: '',
  estado: 'ACTIVO',
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

function nombreCompleto(a) {
  return [a.usuario?.nombre, a.usuario?.apellido].filter(Boolean).join(' ').trim()
}

export default function AyudantesPage() {
  const [negocio, setNegocio] = useState(null)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [sort, setSort] = useState({ field: null, dir: 'asc' })
  const [modal, setModal] = useState(null)
  const [createForm, setCreateForm] = useState(emptyCreate)
  const [editForm, setEditForm] = useState(emptyEdit)
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

  const eventosHabilitados = useMemo(
    () => (negocio?.solicitudes || []).filter((s) => s.estado === 'ACEPTADA'),
    [negocio],
  )

  const toggleSort = (field) => {
    setSort((prev) => {
      if (prev.field !== field) return { field, dir: 'asc' }
      if (prev.dir === 'asc') return { field, dir: 'desc' }
      return { field: null, dir: 'asc' }
    })
  }

  const ayudantes = useMemo(() => {
    const list = [...(negocio?.ayudantes || [])]
    const term = q.trim().toLowerCase()
    const filtered = term
      ? list.filter((a) => {
          const nombre = nombreCompleto(a).toLowerCase()
          const email = (a.usuario?.email || '').toLowerCase()
          const estado = estadoLabel(a.estado).toLowerCase()
          return nombre.includes(term) || email.includes(term) || estado.includes(term)
        })
      : list

    if (sort.field === 'nombre') {
      filtered.sort((a, b) => {
        const diff = nombreCompleto(a).localeCompare(nombreCompleto(b), 'es')
        return sort.dir === 'asc' ? diff : -diff
      })
    } else if (sort.field === 'estado') {
      filtered.sort((a, b) => {
        const diff = String(a.estado || '').localeCompare(String(b.estado || ''), 'es')
        return sort.dir === 'asc' ? diff : -diff
      })
    } else {
      filtered.sort((a, b) => nombreCompleto(a).localeCompare(nombreCompleto(b), 'es'))
    }
    return filtered
  }, [negocio, q, sort])

  const openCreate = () => {
    setCreateForm(emptyCreate)
    setFormError('')
    setModal({ type: 'create' })
  }

  const openEdit = (ayudante) => {
    setEditForm({
      nombre: ayudante.usuario?.nombre || '',
      apellido: ayudante.usuario?.apellido || '',
      estado: ayudante.estado === 'INACTIVO' ? 'INACTIVO' : 'ACTIVO',
    })
    setFormError('')
    setModal({ type: 'edit', ayudante })
  }

  const openDelete = (ayudante) => {
    setModal({ type: 'delete', ayudante })
  }

  const closeModal = () => {
    if (busy) return
    setModal(null)
    setFormError('')
  }

  const onCreate = async (e) => {
    e.preventDefault()
    if (!negocio?.id) return toast('Registra tu negocio primero', 'error')
    if (!createForm.nombre.trim()) {
      setFormError('El nombre es obligatorio.')
      return
    }
    if (!createForm.email.trim()) {
      setFormError('El correo es obligatorio.')
      return
    }
    const invalidPassword = validatePassword(createForm.password)
    if (invalidPassword) {
      setFormError(invalidPassword)
      return
    }
    setFormError('')
    setBusy(true)
    try {
      const { data } = await createAyudante(negocio.id, {
        email: createForm.email.trim(),
        password: createForm.password,
        nombre: createForm.nombre.trim(),
        apellido: createForm.apellido.trim() || undefined,
      })
      if (data?.correoEnviado === false) {
        toast('Ayudante creado, pero no se pudo enviarle el correo de bienvenida.', 'error')
      } else {
        toast('Ayudante creado. Le enviamos un correo con sus datos de acceso.', 'success')
      }
      setModal(null)
      setCreateForm(emptyCreate)
      await load()
    } catch (err) {
      toast(getErrorMessage(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  const onEdit = async (e) => {
    e.preventDefault()
    if (!modal?.ayudante) return
    if (!editForm.nombre.trim()) {
      setFormError('El nombre es obligatorio.')
      return
    }
    setFormError('')
    setBusy(true)
    try {
      await updateAyudante(modal.ayudante.id, {
        nombre: editForm.nombre.trim(),
        apellido: editForm.apellido.trim() || '',
        estado: editForm.estado,
      })
      toast('Ayudante actualizado', 'success')
      setModal(null)
      await load()
    } catch (err) {
      toast(getErrorMessage(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  const onConfirmDelete = async () => {
    if (!modal?.ayudante) return
    setBusy(true)
    try {
      await deleteAyudante(modal.ayudante.id)
      toast('Ayudante eliminado', 'success')
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
        <h1 className="font-display text-3xl font-bold">Ayudantes</h1>
        <p className="mt-4 text-muted">Registra tu negocio en Mi Negocio para gestionar ayudantes.</p>
      </div>
    )
  }

  const deleting = modal?.type === 'delete' ? modal.ayudante : null
  const editing = modal?.type === 'edit' ? modal.ayudante : null

  return (
    <div className="p-8">
      <p className="font-display text-4xl font-bold tracking-tight text-ink sm:text-5xl">{negocio.nombre}</p>
      <h1 className="mt-2 text-sm font-semibold uppercase tracking-wide text-muted">Ayudantes</h1>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 w-full sm:max-w-xs">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <label htmlFor="ayudante-buscar" className="sr-only">
            Buscar ayudantes
          </label>
          <input
            id="ayudante-buscar"
            className="input pl-10"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <FillHoverButton variant="primary" className="shrink-0 self-end sm:self-auto" onClick={openCreate}>
          Añadir ayudante
        </FillHoverButton>
      </div>

      <div className="mt-4 overflow-x-auto rounded-md border border-border bg-surface">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-page text-muted">
            <tr>
              <SortHeader label="Ayudante" field="nombre" sort={sort} onToggle={toggleSort} />
              <SortHeader label="Estado" field="estado" sort={sort} onToggle={toggleSort} />
              <th className="px-4 py-3">Eventos</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {ayudantes.map((a) => (
              <tr key={a.id} className="border-t border-border">
                <td className="px-4 py-3">
                  <p className="font-medium text-ink">{nombreCompleto(a) || '—'}</p>
                  <p className="text-xs text-muted">{a.usuario?.email}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`badge ${estadoBadgeClass(a.estado)}`}>{estadoLabel(a.estado)}</span>
                </td>
                <td className="px-4 py-3 text-muted">
                  {a.estado === 'ACTIVO'
                    ? eventosHabilitados.length
                      ? `${eventosHabilitados.length} habilitado${eventosHabilitados.length === 1 ? '' : 's'}`
                      : 'Ninguno aún'
                    : 'Sin acceso al POS'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <FillHoverButton variant="primary" className="ev-fill-btn--sm" onClick={() => openEdit(a)}>
                      Editar
                    </FillHoverButton>
                    <FillHoverButton variant="danger" className="ev-fill-btn--sm" onClick={() => openDelete(a)}>
                      Eliminar
                    </FillHoverButton>
                  </div>
                </td>
              </tr>
            ))}
            {!ayudantes.length && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted">
                  {q.trim() ? 'Ningún ayudante coincide con la búsqueda.' : 'Sin ayudantes registrados.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={modal?.type === 'create'}
        onClose={closeModal}
        title="Añadir ayudante"
        labelledBy="ayudante-create-title"
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={closeModal} disabled={busy}>
              Cancelar
            </button>
            <FillHoverButton type="submit" form="ayudante-create-form" variant="primary" disabled={busy}>
              {busy ? 'Creando…' : 'Añadir ayudante'}
            </FillHoverButton>
          </>
        }
      >
        <form id="ayudante-create-form" onSubmit={onCreate} className="grid gap-4 p-6 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="ayudante-nombre">
              Nombre *
            </label>
            <input
              id="ayudante-nombre"
              className="input"
              value={createForm.nombre}
              onChange={(e) => setCreateForm({ ...createForm, nombre: e.target.value })}
              required
              autoComplete="off"
            />
          </div>
          <div>
            <label className="label" htmlFor="ayudante-apellido">
              Apellido
            </label>
            <input
              id="ayudante-apellido"
              className="input"
              value={createForm.apellido}
              onChange={(e) => setCreateForm({ ...createForm, apellido: e.target.value })}
              autoComplete="off"
            />
          </div>
          <div>
            <label className="label" htmlFor="ayudante-email">
              Correo *
            </label>
            <input
              id="ayudante-email"
              className="input"
              type="email"
              value={createForm.email}
              onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
              required
              autoComplete="off"
            />
          </div>
          <div>
            <label className="label" htmlFor="ayudante-password">
              Contraseña *
            </label>
            <input
              id="ayudante-password"
              className="input"
              type="password"
              value={createForm.password}
              onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          {formError && <p className="text-sm text-danger sm:col-span-2">{formError}</p>}
        </form>
      </Modal>

      <Modal
        open={Boolean(editing)}
        onClose={closeModal}
        title="Editar ayudante"
        labelledBy="ayudante-edit-title"
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={closeModal} disabled={busy}>
              Cancelar
            </button>
            <FillHoverButton type="submit" form="ayudante-edit-form" variant="primary" disabled={busy}>
              {busy ? 'Guardando…' : 'Guardar cambios'}
            </FillHoverButton>
          </>
        }
      >
        {editing && (
          <form id="ayudante-edit-form" onSubmit={onEdit} className="grid gap-4 p-6 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="edit-ayudante-nombre">
                Nombre *
              </label>
              <input
                id="edit-ayudante-nombre"
                className="input"
                value={editForm.nombre}
                onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })}
                required
                autoComplete="off"
              />
            </div>
            <div>
              <label className="label" htmlFor="edit-ayudante-apellido">
                Apellido
              </label>
              <input
                id="edit-ayudante-apellido"
                className="input"
                value={editForm.apellido}
                onChange={(e) => setEditForm({ ...editForm, apellido: e.target.value })}
                autoComplete="off"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="edit-ayudante-estado">
                Acceso al POS
              </label>
              <select
                id="edit-ayudante-estado"
                className="input"
                value={editForm.estado}
                onChange={(e) => setEditForm({ ...editForm, estado: e.target.value })}
              >
                <option value="ACTIVO">Activo — puede cobrar</option>
                <option value="INACTIVO">Inactivo — sin acceso</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <p className="label">Correo</p>
              <p className="rounded-md border border-border bg-page px-3 py-2 text-sm text-muted">
                {editing.usuario?.email}
              </p>
            </div>
            <div className="sm:col-span-2 rounded-md border border-border bg-page p-4">
              <p className="text-sm font-semibold text-ink">Eventos del negocio</p>
              <p className="mt-1 text-xs text-muted">
                La participación se gestiona en Mi Negocio. Si el ayudante está activo, puede cobrar en el
                POS de todos estos eventos aceptados.
              </p>
              {eventosHabilitados.length ? (
                <ul className="mt-3 space-y-2">
                  {eventosHabilitados.map((s) => (
                    <li
                      key={s.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded border border-border bg-surface px-3 py-2 text-sm"
                    >
                      <span className="font-medium text-ink">{s.evento?.titulo || 'Evento'}</span>
                      <span className={`badge ${estadoBadgeClass(s.evento?.estado)}`}>
                        {estadoLabel(s.evento?.estado)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-muted">
                  Aún no hay eventos aceptados. Solicita participación desde Mi Negocio.
                </p>
              )}
            </div>
            {formError && <p className="text-sm text-danger sm:col-span-2">{formError}</p>}
          </form>
        )}
      </Modal>

      <Modal
        open={Boolean(deleting)}
        onClose={closeModal}
        title="Eliminar ayudante"
        labelledBy="ayudante-delete-title"
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
            <p className="text-sm text-ink">¿Seguro que quieres dar de baja a este ayudante?</p>
            <dl className="grid gap-2 rounded-md border border-border bg-page p-4 text-sm">
              <div>
                <dt className="text-muted">Nombre</dt>
                <dd className="font-semibold text-ink">{nombreCompleto(deleting) || '—'}</dd>
              </div>
              <div>
                <dt className="text-muted">Correo</dt>
                <dd>{deleting.usuario?.email}</dd>
              </div>
              <div>
                <dt className="text-muted">Estado</dt>
                <dd>
                  <span className={`badge ${estadoBadgeClass(deleting.estado)}`}>
                    {estadoLabel(deleting.estado)}
                  </span>
                </dd>
              </div>
            </dl>
            <p className="text-xs text-muted">
              Baja lógica: deja de aparecer en el panel y pierde el acceso al POS. El historial de ventas se
              conserva.
            </p>
          </div>
        )}
      </Modal>
    </div>
  )
}
