import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getEventAdminById } from '../../api/events.api'
import { asignarPersonal, getCandidatosPersonal, getPersonalEvento, quitarPersonal } from '../../api/recargas.api'
import { toast } from '../../components/Toast'
import { confirmDialog } from '../../components/ui/ConfirmDialog'
import { IconPlus, IconSearch } from '../../components/ui/icons'
import PendingRegion from '../../components/ui/PendingRegion'
import { formatDateTime, getErrorMessage } from '../../utils/format'
import { roleLabel } from '../../utils/roles'
import EventoHeader from './components/EventoHeader'

/** Roles de personal que se asignan por evento (deben coincidir con ROLES_PERSONAL del backend). */
const ROLES_PERSONAL = ['RECARGADOR', 'DEVOLUCIONES']
/** Roles que se pueden asignar con el evento ya terminado: las devoluciones siguen 30 días más. */
const ROLES_POST_EVENTO = ['DEVOLUCIONES']

const esCerrado = (evento) => ['FINALIZADO', 'CANCELADO'].includes(evento?.estado)

/**
 * Personal del evento: el administrador asigna qué recargadores y encargados de devoluciones
 * trabajan en cada evento. Cada uno solo puede operar en los eventos donde está asignado.
 */
export default function PersonalEventoPage() {
  const { id } = useParams()
  const [evento, setEvento] = useState(null)
  const [personal, setPersonal] = useState(null)
  const [error, setError] = useState('')
  const [role, setRole] = useState(ROLES_PERSONAL[0])
  const [q, setQ] = useState('')
  const [candidatos, setCandidatos] = useState([])
  const [buscando, setBuscando] = useState(false)
  const [ocupado, setOcupado] = useState(null)
  const ultimaBusqueda = useRef(0)

  useEffect(() => {
    let cancel = false
    Promise.all([getEventAdminById(id), getPersonalEvento(id)])
      .then(([ev, p]) => {
        if (cancel) return
        const datos = ev.data?.data ?? ev.data
        setEvento(datos)
        setPersonal(p.data.personal)
        if (esCerrado(datos)) setRole(ROLES_POST_EVENTO[0])
      })
      .catch((err) => !cancel && setError(getErrorMessage(err, 'No se pudo cargar el personal del evento.')))
    return () => {
      cancel = true
    }
  }, [id])

  const buscar = useCallback(async () => {
    const peticion = ++ultimaBusqueda.current
    setBuscando(true)
    try {
      const { data } = await getCandidatosPersonal(id, { role, q: q.trim() || undefined })
      if (peticion === ultimaBusqueda.current) setCandidatos(data.candidatos)
    } catch (err) {
      if (peticion === ultimaBusqueda.current) toast(getErrorMessage(err), 'error')
    } finally {
      if (peticion === ultimaBusqueda.current) setBuscando(false)
    }
  }, [id, role, q])

  // Busca mientras se escribe, con una pausa corta para no consultar en cada tecla.
  useEffect(() => {
    const t = setTimeout(buscar, 300)
    return () => clearTimeout(t)
  }, [buscar])

  const asignar = async (usuario) => {
    setOcupado(usuario.id)
    try {
      const { data } = await asignarPersonal(id, { usuarioId: usuario.id, role })
      setPersonal(data.personal)
      setCandidatos((prev) => prev.filter((c) => c.id !== usuario.id))
      toast(`${usuario.nombre} asignado como ${roleLabel(role).toLowerCase()}`, 'success')
    } catch (err) {
      toast(getErrorMessage(err), 'error')
    } finally {
      setOcupado(null)
    }
  }

  const quitar = async (p) => {
    const ok = await confirmDialog({
      title: 'Quitar del evento',
      message: `${p.usuario.nombre} dejará de poder trabajar como ${roleLabel(p.role).toLowerCase()} en este evento. Sus operaciones anteriores se conservan.`,
      confirmText: 'Quitar',
      cancelText: 'Cancelar',
      tone: 'danger',
    })
    if (!ok) return
    setOcupado(p.id)
    try {
      const { data } = await quitarPersonal(id, p.id)
      setPersonal(data.personal)
      toast('Asignación quitada', 'success')
      buscar()
    } catch (err) {
      toast(getErrorMessage(err), 'error')
    } finally {
      setOcupado(null)
    }
  }

  const cerrado = esCerrado(evento)
  const rolesDisponibles = cerrado ? ROLES_POST_EVENTO : ROLES_PERSONAL

  return (
    <>
      <EventoHeader eventoId={id} titulo={evento?.titulo} estado={evento?.estado} />
      <div className="grid gap-6 p-4 sm:p-8 xl:grid-cols-[1fr_380px]">
        <section className="card-surface p-6">
          <h2 className="font-display text-xl font-bold">Personal asignado</h2>
          <p className="mt-1 text-sm text-muted">
            Los recargadores y los encargados de devoluciones solo pueden operar en los eventos donde están asignados.
          </p>
          {error && (
            <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
              {error}
            </p>
          )}
          {!personal && !error && <p className="mt-6 text-muted">Cargando…</p>}
          {personal && (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-muted">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Nombre</th>
                    <th className="py-2 pr-4 font-medium">Rol</th>
                    <th className="py-2 pr-4 font-medium">Asignado</th>
                    <th className="py-2 text-right font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {personal.map((p) => (
                    <tr key={p.id} className="border-t border-border">
                      <td className="py-3 pr-4">
                        <p className="font-medium">{p.usuario.nombre}</p>
                        <p className="text-xs text-muted">{p.usuario.email}</p>
                        {!p.usuario.activo && <span className="badge bg-red-50 text-red-700">Cuenta inactiva</span>}
                      </td>
                      <td className="py-3 pr-4">
                        <span className="badge bg-teal/10 text-teal-dark">{roleLabel(p.role)}</span>
                      </td>
                      <td className="whitespace-nowrap py-3 pr-4 text-muted">{formatDateTime(p.asignadoAt)}</td>
                      <td className="py-3 text-right">
                        <button
                          type="button"
                          className="btn-secondary btn-sm text-red-700"
                          disabled={ocupado === p.id}
                          onClick={() => quitar(p)}
                        >
                          Quitar
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!personal.length && (
                    <tr>
                      <td colSpan={4} className="py-10 text-center text-muted">
                        Todavía no hay personal asignado a este evento.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card-surface h-fit p-6">
          <h2 className="font-display text-lg font-bold">Asignar personal</h2>
          {cerrado && (
            <p className="mt-2 text-sm text-muted">
              El evento está finalizado o cancelado: solo se pueden asignar encargados de devoluciones, que atienden
              hasta 30 días después del fin del evento.
            </p>
          )}
          <>
              <p className="mt-1 text-sm text-muted">
                Aparecen los usuarios con el rol elegido. Si no encuentras a alguien, invítalo desde{' '}
                <Link to="/admin/usuarios" className="font-semibold text-teal-dark hover:underline">
                  Usuarios
                </Link>
                .
              </p>
              {rolesDisponibles.length > 1 && (
                <select className="input mt-4" value={role} onChange={(e) => setRole(e.target.value)} aria-label="Rol">
                  {rolesDisponibles.map((r) => (
                    <option key={r} value={r}>
                      {roleLabel(r)}
                    </option>
                  ))}
                </select>
              )}
              <div className="relative mt-4">
                <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  className="input pl-9"
                  placeholder={`Buscar ${roleLabel(role).toLowerCase()} por nombre o correo`}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  aria-label="Buscar usuario"
                />
              </div>
              <PendingRegion pending={buscando}  className="mt-3">
              <ul className="divide-y divide-border">
                {candidatos.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{c.nombre}</p>
                      <p className="truncate text-xs text-muted">{c.email}</p>
                    </div>
                    <button
                      type="button"
                      className="btn-primary btn-sm shrink-0"
                      disabled={ocupado === c.id}
                      onClick={() => asignar(c)}
                    >
                      <IconPlus className="h-4 w-4" /> Asignar
                    </button>
                  </li>
                ))}
                {!candidatos.length && !buscando && (
                  <li className="py-6 text-center text-sm text-muted">
                    {q.trim() ? 'Sin resultados.' : `No hay más usuarios con rol ${roleLabel(role).toLowerCase()} para asignar.`}
                  </li>
                )}
              </ul>
              </PendingRegion>
          </>
        </section>
      </div>
    </>
  )
}
