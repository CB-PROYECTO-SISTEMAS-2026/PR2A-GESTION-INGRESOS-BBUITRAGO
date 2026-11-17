import { useEffect, useState } from 'react'
import { asignarAyudante, createAyudante, getMisNegocios } from '../../api/businesses.api'
import { toast } from '../../components/Toast'
import { getErrorMessage } from '../../utils/format'
import { validatePassword } from '../../utils/password'

export default function AyudantesPage() {
  const [negocios, setNegocios] = useState([])
  const [negocioId, setNegocioId] = useState('')
  const [form, setForm] = useState({
    email: '',
    password: '',
    nombre: '',
    apellido: '',
    rolFuncion: 'cajero',
  })
  const [loading, setLoading] = useState(true)

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

  const allAyudantes = negocios.flatMap((n) =>
    (n.ayudantes || []).map((a) => ({ ...a, negocioNombre: n.nombre })),
  )

  const onSubmit = async (e) => {
    e.preventDefault()
    if (!negocioId) return toast('Selecciona un negocio', 'error')
    const invalidPassword = validatePassword(form.password)
    if (invalidPassword) return toast(invalidPassword, 'error')
    try {
      const { data } = await createAyudante(negocioId, {
        email: form.email.trim(),
        password: form.password,
        nombre: form.nombre.trim(),
        apellido: form.apellido.trim() || undefined,
        rolFuncion: form.rolFuncion.trim() || undefined,
      })
      setForm({ email: '', password: '', nombre: '', apellido: '', rolFuncion: 'cajero' })
      if (data?.correoEnviado === false) {
        toast('Ayudante creado, pero no se pudo enviarle el correo de bienvenida.', 'error')
      } else {
        toast('Ayudante creado. Le enviamos un correo con sus datos de acceso.', 'success')
      }
      await load()
    } catch (err) {
      toast(getErrorMessage(err), 'error')
    }
  }

  const onReasignar = async (ayudanteId, nuevoNegocioId) => {
    try {
      await asignarAyudante(ayudanteId, { negocioId: nuevoNegocioId })
      toast('Ayudante reasignado', 'success')
      await load()
    } catch (err) {
      toast(getErrorMessage(err), 'error')
    }
  }

  if (loading) return <div className="p-8 text-muted">Cargando…</div>

  return (
    <div className="p-8">
      <h1 className="font-display text-3xl font-bold">Ayudantes</h1>

      <form onSubmit={onSubmit} className="mt-6 grid max-w-2xl gap-3 rounded-md border border-border bg-white p-5">
        <div>
          <label className="label">Asignar a negocio</label>
          <select className="input" value={negocioId} onChange={(e) => setNegocioId(e.target.value)} required>
            <option value="">Seleccionar…</option>
            {negocios.map((n) => (
              <option key={n.id} value={n.id}>
                {n.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Nombre *</label>
            <input
              className="input"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              placeholder="Ej. Luis"
              required
            />
          </div>
          <div>
            <label className="label">Apellido</label>
            <input
              className="input"
              value={form.apellido}
              onChange={(e) => setForm({ ...form, apellido: e.target.value })}
              placeholder="Ej. Mamani"
            />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Correo *</label>
            <input
              className="input"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="ayudante@correo.com"
              required
            />
          </div>
          <div>
            <label className="label">Contraseña *</label>
            <input
              className="input"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Mínimo 8 caracteres"
              autoComplete="new-password"
              required
              minLength={8}
            />
          </div>
        </div>
        <div>
          <label className="label">Rol / función</label>
          <input
            className="input"
            value={form.rolFuncion}
            onChange={(e) => setForm({ ...form, rolFuncion: e.target.value })}
            placeholder="Ej. cajero"
          />
        </div>
        <button type="submit" className="btn-primary w-fit">
          Crear ayudante
        </button>
      </form>

      <div className="mt-8 space-y-3">
        {allAyudantes.map((a) => (
          <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-white px-4 py-3">
            <div>
              <p className="font-semibold">
                {a.usuario?.nombre} {a.usuario?.apellido}
              </p>
              <p className="text-sm text-muted">
                {a.usuario?.email} · {a.rolFuncion} · {a.negocioNombre}
              </p>
            </div>
            <select
              className="input !w-auto"
              value={a.negocioId}
              onChange={(e) => onReasignar(a.id, e.target.value)}
            >
              {negocios.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.nombre}
                </option>
              ))}
            </select>
          </div>
        ))}
        {!allAyudantes.length && <p className="text-muted">Sin ayudantes registrados.</p>}
      </div>
    </div>
  )
}
