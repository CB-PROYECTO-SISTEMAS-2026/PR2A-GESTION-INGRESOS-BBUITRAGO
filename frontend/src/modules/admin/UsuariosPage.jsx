import { useCallback, useEffect, useRef, useState } from 'react'
import {
  cancelarInvitacion,
  createInvitacion,
  deleteUsuario,
  getInvitaciones,
  getUsuarios,
  reenviarInvitacion,
} from '../../api/adminUsers.api'
import { useAuth } from '../../context/AuthContext'
import { toast } from '../../components/Toast'
import Modal from '../../components/ui/Modal'
import { confirmDialog } from '../../components/ui/ConfirmDialog'
import {
  IconCheck,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconEye,
  IconSearch,
  IconTrash,
  IconX,
} from '../../components/ui/icons'
import Field from '../../components/form/Field'
import UsuarioDetalleModal from './components/UsuarioDetalleModal'
import { formatDate, formatDateTime, getErrorMessage } from '../../utils/format'
import { estadoBadgeClass, estadoLabel } from '../../utils/labels'
import { INVITABLE_ROLES, ROLE_LABELS, roleLabel } from '../../utils/roles'
import { formatNumber } from '../../utils/validation'

const emptyInvite = { email: '', nombre: '', apellido: '', telefono: '', role: 'ORGANIZADOR' }

const fullName = (p) => [p.nombre, p.apellido].filter(Boolean).join(' ')

function InvitarModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState(emptyInvite)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const close = () => {
    if (saving) return
    setForm(emptyInvite)
    setError('')
    onClose()
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    if (form.nombre.trim().length < 2) {
      setError('Ingresa el nombre (mínimo 2 caracteres).')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setError('Ingresa un correo electrónico válido.')
      return
    }
    if (form.telefono.trim() && !/^[\d+\s()-]{7,20}$/.test(form.telefono.trim())) {
      setError('Ingresa un teléfono válido.')
      return
    }
    setError('')
    setSaving(true)
    try {
      await createInvitacion({
        email: form.email.trim(),
        nombre: form.nombre.trim(),
        apellido: form.apellido.trim() || undefined,
        telefono: form.telefono.trim() || undefined,
        role: form.role,
      })
      toast(`Invitación enviada a ${form.email.trim()}`, 'success')
      setForm(emptyInvite)
      await onCreated()
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudo enviar la invitación'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={close} title="Invitar usuario" labelledBy="invitar-title">
      <form onSubmit={onSubmit} noValidate className="grid gap-4 p-6 sm:grid-cols-2">
        <Field label="Nombre" htmlFor="inv-nombre" required>
          <input id="inv-nombre" className="input" value={form.nombre} onChange={set('nombre')} maxLength={100} />
        </Field>
        <Field label="Apellido" htmlFor="inv-apellido">
          <input id="inv-apellido" className="input" value={form.apellido} onChange={set('apellido')} maxLength={100} />
        </Field>
        <Field label="Correo electrónico" htmlFor="inv-email" required>
          <input id="inv-email" type="email" className="input" value={form.email} onChange={set('email')} maxLength={191} />
        </Field>
        <Field label="Celular / Teléfono" htmlFor="inv-telefono">
          <input id="inv-telefono" className="input" value={form.telefono} onChange={set('telefono')} maxLength={20} inputMode="tel" />
        </Field>
        <Field label="Rol" htmlFor="inv-role" required>
          <select id="inv-role" className="input" value={form.role} onChange={set('role')}>
            {INVITABLE_ROLES.map((r) => (
              <option key={r} value={r}>
                {roleLabel(r)}
              </option>
            ))}
          </select>
        </Field>
        {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
        <div className="flex justify-end gap-3 border-t border-border pt-4 sm:col-span-2">
          <button type="button" className="btn-secondary" onClick={close} disabled={saving}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Enviando…' : 'Enviar invitación'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function RoleFilter({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const options = [['', 'Todos los roles'], ...Object.entries(ROLE_LABELS)]

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className="btn-secondary w-full justify-between sm:w-56"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{value ? roleLabel(value) : 'Todos los roles'}</span>
        <IconChevronDown className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute right-0 z-30 mt-2 w-full min-w-56 overflow-hidden rounded-md border border-border bg-white py-1 shadow-lg"
        >
          {options.map(([key, label]) => (
            <li key={key || 'todos'}>
              <button
                type="button"
                role="option"
                aria-selected={value === key}
                onClick={() => {
                  onChange(key)
                  setOpen(false)
                }}
                className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm transition hover:bg-page ${
                  value === key ? 'font-semibold text-teal-dark' : 'text-ink'
                }`}
              >
                {label}
                {value === key && <IconCheck className="h-4 w-4" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function UsuariosPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState('usuarios')
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [role, setRole] = useState('')
  const [page, setPage] = useState(1)
  const [result, setResult] = useState({ items: [], total: 0, page: 1, totalPages: 1 })
  const [invitaciones, setInvitaciones] = useState([])
  const [showInvite, setShowInvite] = useState(false)
  const [detalleId, setDetalleId] = useState(null)
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [error, setError] = useState('')
  const [actingId, setActingId] = useState(null)
  const requestRef = useRef(0)

  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(search.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  const loadUsuarios = useCallback(async () => {
    const requestId = ++requestRef.current
    setLoadingUsers(true)
    try {
      const { data } = await getUsuarios({ q: query || undefined, role: role || undefined, page })
      if (requestId !== requestRef.current) return
      setResult(data)
      setError('')
    } catch (err) {
      if (requestId === requestRef.current) setError(getErrorMessage(err))
    } finally {
      if (requestId === requestRef.current) setLoadingUsers(false)
    }
  }, [query, role, page])

  const loadInvitaciones = useCallback(async () => {
    const { data } = await getInvitaciones()
    setInvitaciones(Array.isArray(data) ? data : [])
  }, [])

  useEffect(() => {
    loadUsuarios()
  }, [loadUsuarios])

  useEffect(() => {
    loadInvitaciones().catch((err) => setError(getErrorMessage(err)))
  }, [loadInvitaciones])

  const onCreated = async () => {
    setShowInvite(false)
    setTab('invitaciones')
    await loadInvitaciones()
  }

  const clearSearch = () => {
    setSearch('')
    setQuery('')
    setPage(1)
  }

  const onDelete = async (u) => {
    const nombre = fullName(u)
    const first = await confirmDialog({
      title: 'Eliminar usuario',
      message: (
        <>
          Vas a eliminar la cuenta de <strong className="text-ink">{nombre}</strong> ({u.email}). Ya no podrá ingresar al
          sistema.
        </>
      ),
      confirmText: 'Continuar',
      cancelText: 'Cancelar',
      tone: 'danger',
    })
    if (first !== true) return
    const second = await confirmDialog({
      title: '¿Estás seguro?',
      message: 'Esta acción no se puede deshacer. Los datos de acceso del usuario se perderán y no podrán recuperarse.',
      confirmText: 'Eliminar usuario',
      cancelText: 'Cancelar',
      tone: 'danger',
      requireText: 'ELIMINAR',
    })
    if (second !== true) return
    try {
      await deleteUsuario(u.id)
      toast(`Se eliminó la cuenta de ${nombre}`, 'success')
      if (detalleId === u.id) setDetalleId(null)
      await loadUsuarios()
    } catch (err) {
      toast(getErrorMessage(err), 'error')
    }
  }

  const runInvitacion = async (inv, action) => {
    if (action === 'cancelar') {
      const ok = await confirmDialog({
        title: 'Cancelar invitación',
        message: `La invitación enviada a ${inv.email} dejará de ser válida.`,
        confirmText: 'Sí, cancelar',
        cancelText: 'No',
        tone: 'danger',
      })
      if (ok !== true) return
    }
    setActingId(inv.id)
    try {
      if (action === 'reenviar') {
        await reenviarInvitacion(inv.id)
        toast(`Invitación reenviada a ${inv.email}`, 'success')
      } else {
        await cancelarInvitacion(inv.id)
        toast('Invitación cancelada', 'success')
      }
      await loadInvitaciones()
    } catch (err) {
      toast(getErrorMessage(err), 'error')
    } finally {
      setActingId(null)
    }
  }

  const pendientes = invitaciones.filter((i) => i.estado === 'PENDIENTE' && !i.expirada).length
  const filtrando = Boolean(query || role)

  return (
    <div className="p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold text-ink">Usuarios</h1>
        <button type="button" className="btn-primary" onClick={() => setShowInvite(true)}>
          Invitar usuario
        </button>
      </div>

      <div className="mt-6 flex gap-6 border-b border-border">
        {[
          ['usuarios', 'Usuarios'],
          ['invitaciones', `Invitaciones${pendientes ? ` (${pendientes} pendientes)` : ''}`],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`-mb-px border-b-2 px-1 pb-3 text-sm font-semibold transition ${
              tab === key ? 'border-teal text-ink' : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {tab === 'usuarios' ? (
        <>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <IconSearch className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                className="input pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre, apellido o correo"
                aria-label="Buscar usuarios"
              />
            </div>
            <button type="button" className="btn-secondary" onClick={clearSearch} disabled={!search}>
              <IconX />
              Limpiar
            </button>
            <RoleFilter
              value={role}
              onChange={(r) => {
                setRole(r)
                setPage(1)
              }}
            />
          </div>

          <div className={`mt-4 overflow-x-auto rounded-md border border-border transition ${loadingUsers ? 'opacity-60' : ''}`}>
            <table className="min-w-full text-left text-sm">
              <thead className="bg-page text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Nombre</th>
                  <th className="px-4 py-3 font-semibold">Correo</th>
                  <th className="px-4 py-3 font-semibold">Roles</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                  <th className="px-4 py-3 font-semibold">Registro</th>
                  <th className="px-4 py-3 text-right font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((u) => (
                  <tr key={u.id} className="border-t border-border hover:bg-page/60">
                    <td className="px-4 py-3 font-medium text-ink">{fullName(u)}</td>
                    <td className="px-4 py-3 text-slate-600">{u.email}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {u.roles.map((r) => (
                          <span key={r} className="badge bg-slate-100 text-slate-700">
                            {roleLabel(r)}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`badge ${
                          u.activo ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {u.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(u.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button type="button" className="btn-secondary btn-sm" onClick={() => setDetalleId(u.id)}>
                          <IconEye />
                          Ver
                        </button>
                        {u.id !== user?.id && (
                          <button
                            type="button"
                            className="btn-secondary btn-sm !text-red-600 hover:!bg-red-50"
                            onClick={() => onDelete(u)}
                          >
                            <IconTrash />
                            Eliminar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!result.items.length && !loadingUsers && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-muted">
                      {filtrando ? 'Ningún usuario coincide con la búsqueda.' : 'No hay usuarios registrados.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
            <span className="text-muted">
              {formatNumber(result.total)} {result.total === 1 ? 'usuario' : 'usuarios'}
            </span>
            {result.totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  disabled={result.page <= 1 || loadingUsers}
                  onClick={() => setPage(result.page - 1)}
                  aria-label="Página anterior"
                >
                  <IconChevronLeft />
                </button>
                <span className="font-semibold text-ink">
                  {result.page} / {result.totalPages}
                </span>
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  disabled={result.page >= result.totalPages || loadingUsers}
                  onClick={() => setPage(result.page + 1)}
                  aria-label="Página siguiente"
                >
                  <IconChevronRight />
                </button>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-md border border-border">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-page text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Invitado</th>
                <th className="px-4 py-3 font-semibold">Rol</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 font-semibold">Enviada</th>
                <th className="px-4 py-3 font-semibold">Vence / Aceptada</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {invitaciones.map((i) => {
                const estado = i.expirada ? 'EXPIRADA' : i.estado
                const busy = actingId === i.id
                return (
                  <tr key={i.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink">{fullName(i)}</p>
                      <p className="text-xs text-muted">{i.email}</p>
                    </td>
                    <td className="px-4 py-3">{roleLabel(i.role)}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${estadoBadgeClass(estado)}`}>
                        {estadoLabel(estado)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">{formatDateTime(i.createdAt)}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {i.estado === 'ACEPTADA' ? formatDateTime(i.aceptadaAt) : formatDateTime(i.expiresAt)}
                    </td>
                    <td className="px-4 py-3">
                      {i.estado === 'PENDIENTE' && (
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            className="btn-secondary btn-sm"
                            disabled={busy}
                            onClick={() => runInvitacion(i, 'reenviar')}
                          >
                            Reenviar
                          </button>
                          <button
                            type="button"
                            className="btn-secondary btn-sm !text-red-600 hover:!bg-red-50"
                            disabled={busy}
                            onClick={() => runInvitacion(i, 'cancelar')}
                          >
                            Cancelar
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
              {!invitaciones.length && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted">
                    Aún no se enviaron invitaciones.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <InvitarModal open={showInvite} onClose={() => setShowInvite(false)} onCreated={onCreated} />
      <UsuarioDetalleModal usuarioId={detalleId} onClose={() => setDetalleId(null)} />
    </div>
  )
}
