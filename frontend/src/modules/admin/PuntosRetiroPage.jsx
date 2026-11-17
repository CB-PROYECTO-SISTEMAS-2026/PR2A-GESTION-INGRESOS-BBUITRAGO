import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  asignarSupervisor,
  createPuntoRetiro,
  deletePuntoRetiro,
  getEntregasEvento,
  getPuntosRetiro,
  quitarSupervisor,
  updatePuntoRetiro,
} from '../../api/manillas.api'
import { toast } from '../../components/Toast'
import { confirmDelete, confirmDialog } from '../../components/ui/ConfirmDialog'
import { IconClock, IconMapPin, IconPencil, IconTicket, IconTrash, IconX } from '../../components/ui/icons'
import Field from '../../components/form/Field'
import EventoHeader from './components/EventoHeader'
import SupervisorPicker from './components/SupervisorPicker'
import { formatDateTime, formatDay, getErrorMessage } from '../../utils/format'
import { tipoAccesoLabel } from '../../utils/labels'
import { formatNumber } from '../../utils/validation'

const emptyForm = { nombre: '', ubicacion: '', horario: '' }

/** HU-053: puntos de entrega de manillas del evento, sus supervisores y el registro de entregas. */
export default function PuntosRetiroPage() {
  const { id } = useParams()
  const [evento, setEvento] = useState(null)
  const [puntos, setPuntos] = useState([])
  const [entregas, setEntregas] = useState({ total: 0, entregas: [] })
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const apply = (data) => {
    setEvento(data.evento)
    setPuntos(data.puntos)
  }

  const load = useCallback(async () => {
    const [{ data: res }, { data: log }] = await Promise.all([getPuntosRetiro(id), getEntregasEvento(id)])
    setEvento(res.evento)
    setPuntos(res.puntos)
    setEntregas(log)
  }, [id])

  useEffect(() => {
    let alive = true
    setLoading(true)
    load()
      .catch((err) => alive && setLoadError(getErrorMessage(err)))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [load])

  const editing = puntos.find((p) => p.id === editingId) || null

  const setField = (name, value) => {
    setForm((f) => ({ ...f, [name]: value }))
    setErrors((e) => (e[name] ? { ...e, [name]: '' } : e))
  }

  const resetForm = () => {
    setForm(emptyForm)
    setEditingId(null)
    setErrors({})
  }

  const startEdit = (p) => {
    setEditingId(p.id)
    setForm({ nombre: p.nombre, ubicacion: p.ubicacion || '', horario: p.horario || '' })
    setErrors({})
    document.getElementById('punto-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    if (form.nombre.trim().length < 2) {
      setErrors({ nombre: 'El nombre debe tener al menos 2 caracteres.' })
      return
    }
    const payload = { nombre: form.nombre.trim(), ubicacion: form.ubicacion.trim(), horario: form.horario.trim() }
    setSaving(true)
    try {
      const { data } = editingId ? await updatePuntoRetiro(editingId, payload) : await createPuntoRetiro(id, payload)
      apply(data)
      toast(editingId ? 'Punto de entrega actualizado' : 'Punto de entrega creado', 'success')
      resetForm()
    } catch (err) {
      toast(getErrorMessage(err), 'error')
    } finally {
      setSaving(false)
    }
  }

  const run = async (puntoId, action, successMessage) => {
    setBusyId(puntoId)
    try {
      const { data } = await action()
      apply(data)
      if (successMessage) toast(successMessage, 'success')
      return true
    } catch (err) {
      toast(getErrorMessage(err), 'error')
      return false
    } finally {
      setBusyId(null)
    }
  }

  const onToggleActivo = async (p) => {
    if (p.activo) {
      const ok = await confirmDialog({
        title: `Desactivar "${p.nombre}"`,
        message: 'Los supervisores ya no podrán entregar manillas en este punto. Las entregas registradas se conservan.',
        confirmText: 'Desactivar',
        cancelText: 'Cancelar',
        tone: 'danger',
      })
      if (ok !== true) return
    }
    await run(p.id, () => updatePuntoRetiro(p.id, { activo: !p.activo }), p.activo ? 'Punto desactivado' : 'Punto activado')
  }

  const onDelete = async (p) => {
    const ok = await confirmDelete({
      title: `Eliminar "${p.nombre}"`,
      message: 'Se eliminará el punto de entrega y sus supervisores asignados.',
    })
    if (!ok) return
    const done = await run(p.id, () => deletePuntoRetiro(p.id), 'Punto de entrega eliminado')
    if (done && editingId === p.id) resetForm()
  }

  const onQuitarSupervisor = async (p, s) => {
    const ok = await confirmDialog({
      title: 'Quitar supervisor',
      message: `${s.nombre} ya no podrá entregar manillas en "${p.nombre}". Sus entregas anteriores se conservan.`,
      confirmText: 'Quitar',
      cancelText: 'Cancelar',
      tone: 'danger',
    })
    if (ok !== true) return
    await run(p.id, () => quitarSupervisor(p.id, s.id), 'Supervisor quitado')
  }

  if (loading || loadError) {
    return (
      <>
        <EventoHeader eventoId={id} />
        {loadError ? <p className="p-8 text-red-600">{loadError}</p> : <div className="p-8 text-muted">Cargando…</div>}
      </>
    )
  }

  const usaManilla = evento?.usaManilla

  return (
    <>
      <EventoHeader eventoId={id} titulo={evento?.titulo} estado={evento?.estado} />

      <div className="space-y-6 p-8">
        {!usaManilla && (
          <div className="rounded-md border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
            <p className="font-semibold">Este evento usa {tipoAccesoLabel(evento?.tipoAcceso)}</p>
            <p className="mt-1">
              El QR se asigna automáticamente al perfil del comprador al aprobarse su entrada, así que no hay manillas que
              entregar. Si necesitas entrega física, cambia el tipo de acceso en{' '}
              <Link to={`/admin/eventos/${id}`} className="font-semibold underline">
                Editar evento
              </Link>
              .
            </p>
          </div>
        )}

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
          {usaManilla && (
            <form
              id="punto-form"
              onSubmit={onSubmit}
              noValidate
              className={`card-surface space-y-5 p-6 lg:sticky lg:top-6 ${editing ? 'ring-2 ring-teal/40' : ''}`}
            >
              <h2 className="font-display text-lg font-bold text-ink">
                {editing ? `Editar "${editing.nombre}"` : 'Nuevo punto de entrega'}
              </h2>
              <Field label="Nombre" htmlFor="punto-nombre" required error={errors.nombre}>
                <input
                  id="punto-nombre"
                  className="input"
                  value={form.nombre}
                  maxLength={100}
                  placeholder="Ej. Puerta principal"
                  onChange={(e) => setField('nombre', e.target.value)}
                  aria-invalid={Boolean(errors.nombre)}
                />
              </Field>
              <Field label="Ubicación" htmlFor="punto-ubicacion">
                <input
                  id="punto-ubicacion"
                  className="input"
                  value={form.ubicacion}
                  maxLength={191}
                  placeholder="Referencia para encontrar el punto"
                  onChange={(e) => setField('ubicacion', e.target.value)}
                />
              </Field>
              <Field label="Horario de entrega" htmlFor="punto-horario">
                <input
                  id="punto-horario"
                  className="input"
                  value={form.horario}
                  maxLength={100}
                  placeholder="Ej. 09:00 - 18:00"
                  onChange={(e) => setField('horario', e.target.value)}
                />
              </Field>
              <div className="flex flex-wrap gap-3 pt-1">
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Agregar punto'}
                </button>
                {editing && (
                  <button type="button" className="btn-secondary" onClick={resetForm} disabled={saving}>
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          )}

          <div className={`space-y-4 ${usaManilla ? '' : 'lg:col-span-2'}`}>
            {puntos.map((p) => {
              const busy = busyId === p.id
              return (
                <article
                  key={p.id}
                  className={`rounded-lg border border-l-4 bg-white p-5 ${
                    p.id === editingId ? 'border-teal border-l-teal' : p.activo ? 'border-border border-l-teal' : 'border-border border-l-slate-300 opacity-80'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-xl font-bold text-ink">{p.nombre}</h3>
                        {!p.activo && <span className="badge bg-slate-200 text-slate-600">Desactivado</span>}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                        {p.ubicacion && (
                          <span className="inline-flex items-center gap-1">
                            <IconMapPin className="h-4 w-4" />
                            {p.ubicacion}
                          </span>
                        )}
                        {p.horario && (
                          <span className="inline-flex items-center gap-1">
                            <IconClock className="h-4 w-4" />
                            {p.horario}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-display text-xl font-bold text-ink">{formatNumber(p.manillasEntregadas)}</p>
                      <p className="text-xs font-semibold text-muted">manillas entregadas</p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">Supervisores</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {p.supervisores.map((s) => (
                        <span
                          key={s.id}
                          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-page px-3 py-1 text-sm"
                          title={s.email}
                        >
                          {s.nombre}
                          {!s.activo && <span className="text-xs text-red-600">(cuenta inactiva)</span>}
                          <button
                            type="button"
                            className="rounded-full p-0.5 text-muted hover:bg-slate-200 hover:text-red-600"
                            onClick={() => onQuitarSupervisor(p, s)}
                            disabled={busy}
                            aria-label={`Quitar a ${s.nombre}`}
                          >
                            <IconX className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      ))}
                      {!p.supervisores.length && (
                        <span className="text-sm text-amber-700">Sin supervisores: nadie puede entregar manillas aquí.</span>
                      )}
                    </div>
                    {p.activo && (
                      <div className="mt-3">
                        <SupervisorPicker
                          puntoId={p.id}
                          disabled={busy}
                          onPick={(c) => run(p.id, () => asignarSupervisor(p.id, c.id), `${c.nombre} asignado al punto`)}
                        />
                      </div>
                    )}
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
                    <button type="button" className="btn-secondary btn-sm" onClick={() => startEdit(p)} disabled={busy}>
                      <IconPencil />
                      Editar
                    </button>
                    <button type="button" className="btn-secondary btn-sm" onClick={() => onToggleActivo(p)} disabled={busy}>
                      {p.activo ? 'Desactivar' : 'Activar'}
                    </button>
                    {p.manillasEntregadas === 0 && (
                      <button
                        type="button"
                        className="btn-secondary btn-sm !text-red-600 hover:!bg-red-50"
                        onClick={() => onDelete(p)}
                        disabled={busy}
                      >
                        <IconTrash />
                        Eliminar
                      </button>
                    )}
                  </div>
                </article>
              )
            })}
            {!puntos.length && (
              <div className="card-surface flex flex-col items-center justify-center gap-2 p-10 text-center">
                <IconMapPin className="h-10 w-10 text-slate-300" />
                <p className="font-semibold text-ink">Este evento aún no tiene puntos de entrega de manillas</p>
              </div>
            )}
          </div>
        </div>

        <section className="card-surface p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-lg font-bold text-ink">Manillas entregadas</h2>
            <span className="text-sm text-muted">
              {formatNumber(entregas.total)} en total
              {entregas.total > entregas.entregas.length ? ` · se muestran las ${formatNumber(entregas.entregas.length)} más recientes` : ''}
            </span>
          </div>
          <div className="mt-4 overflow-x-auto rounded-md border border-border">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-page text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Fecha</th>
                  <th className="px-4 py-3 font-semibold">Manilla</th>
                  <th className="px-4 py-3 font-semibold">Cliente</th>
                  <th className="px-4 py-3 font-semibold">Entrada</th>
                  <th className="px-4 py-3 font-semibold">Punto</th>
                  <th className="px-4 py-3 font-semibold">Supervisor</th>
                </tr>
              </thead>
              <tbody>
                {entregas.entregas.map((m) => (
                  <tr key={m.id} className="border-t border-border">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDateTime(m.entregadaAt)}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">{m.codigoManilla}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-ink">{m.cliente?.nombre ?? '—'}</p>
                      <p className="text-xs text-muted">{m.cliente?.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="inline-flex items-center gap-1 text-slate-700">
                        <IconTicket className="h-4 w-4 text-muted" />
                        {m.entrada?.categoria}
                      </p>
                      <p className="text-xs text-muted">
                        {m.entrada?.fecha ? formatDay(m.entrada.fecha) : 'Todos los días'} · {m.entrada?.codigo}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{m.puntoRetiro?.nombre ?? '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{m.supervisor?.nombre ?? '—'}</td>
                  </tr>
                ))}
                {!entregas.entregas.length && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted">
                      Todavía no se entregó ninguna manilla.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  )
}
