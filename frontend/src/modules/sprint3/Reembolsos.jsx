import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api from '../../api/axios'
import { formatBs, formatDateTime, getErrorMessage } from '../../utils/format'
import { Aviso, Paginas, useDatos } from './comun'

const ESTADOS = {
  SOLICITADO: 'Pendiente de revisión',
  APROBADO: 'Aprobado · pendiente de pago en efectivo',
  RECHAZADO: 'Rechazado',
  PAGADO: 'Pagado en efectivo',
}

const PASOS = ['SOLICITADO', 'APROBADO', 'PAGADO']

function Paso({ estado }) {
  if (estado === 'RECHAZADO') {
    return <p className="text-sm text-red-700">Solicitud rechazada. La entrada sigue vigente si no fue invalidada.</p>
  }
  const idx = PASOS.indexOf(estado === 'APROBADO' || estado === 'PAGADO' ? estado : 'SOLICITADO')
  return (
    <ol className="mt-2 flex flex-wrap gap-2 text-xs">
      {[
        ['Solicitud', 0],
        ['Aprobación (invalida QR)', 1],
        ['Pago en efectivo', 2],
      ].map(([label, step]) => (
        <li
          key={label}
          className={`rounded-full px-2.5 py-1 ${
            step <= idx ? 'bg-teal/15 font-semibold text-teal-dark' : 'bg-page text-muted'
          }`}
        >
          {label}
        </li>
      ))}
    </ol>
  )
}

export default function Reembolsos({ admin = false }) {
  const [params, setParams] = useSearchParams(),
    entrada = params.get('entrada')
  const [page, pagina] = useState(1),
    [busy, ocupar] = useState(false),
    [fallo, fallar] = useState(''),
    [mensaje, avisar] = useState('')
  const { data, error, refresh } = useDatos(
    (admin ? '/admin/reembolsos' : '/users/me/reembolsos') + '?page=' + page,
  )
  async function ejecutar(accion, ok) {
    ocupar(true)
    fallar('')
    avisar('')
    try {
      const res = await accion()
      avisar(
        res?.data?.correoEnviado === false
          ? ok + ' El correo de aviso no se pudo enviar.'
          : ok,
      )
      refresh()
    } catch (e) {
      fallar(getErrorMessage(e))
    } finally {
      ocupar(false)
    }
  }
  return (
    <main className="mx-auto max-w-4xl space-y-4 p-5">
      <h1 className="font-display text-3xl font-bold">
        {admin ? 'Reembolsos de entradas' : 'Mis reembolsos de entradas'}
      </h1>
      <p className="text-sm text-muted">
        {admin
          ? 'Flujo real: el comprador solicita → tú apruebas (se invalida la entrada y se libera el cupo) → registras el pago en efectivo cuando entregas el dinero.'
          : 'Puedes pedir la devolución del dinero de una entrada no usada, dentro del plazo informado al comprar. Si el evento se cancela, el plazo no aplica.'}
      </p>
      {!admin && (
        <p className="text-sm">
          ¿Necesitas una entrada? Ve a <Link className="font-semibold text-teal" to="/mis-entradas">Mis entradas</Link> y
          elige “Solicitar devolución”.
        </p>
      )}
      <Aviso error={fallo || error} />
      <p role="status">{mensaje}</p>
      {entrada && !admin && (
        <form
          className="card-surface space-y-3 p-5"
          onSubmit={(e) => {
            e.preventDefault()
            const motivo = e.currentTarget.elements.motivo.value.trim()
            if (motivo)
              ejecutar(async () => {
                const res = await api.post('/entradas/' + encodeURIComponent(entrada) + '/reembolso', {
                  motivo,
                })
                setParams({})
                pagina(1)
                return res
              }, 'Solicitud registrada. El administrador la revisará.')
          }}
        >
          <h2 className="font-semibold">Nueva solicitud</h2>
          <p className="text-sm text-muted">Entrada {entrada}</p>
          <label className="label">
            Motivo de la devolución
            <textarea className="input" name="motivo" required maxLength={500} placeholder="Ej. No podré asistir" />
          </label>
          <button disabled={busy} className="btn-primary">
            Solicitar reembolso
          </button>
        </form>
      )}
      {!data && !error && <p>Cargando solicitudes…</p>}
      {data?.length === 0 && <p>Sin solicitudes de reembolso.</p>}
      {data?.map((r) => (
        <article key={r.id} className="card-surface space-y-2 p-4">
          <p className="font-semibold">
            {r.entrada.evento.titulo} · Entrada {r.entrada.codigo} · {formatBs(r.monto)}
          </p>
          <p>
            {formatDateTime(r.createdAt)} · {ESTADOS[r.estado] || r.estado}
          </p>
          <Paso estado={r.estado} />
          {admin && (
            <p className="text-sm">
              Titular: {[r.usuario.nombre, r.usuario.apellido].filter(Boolean).join(' ')}
            </p>
          )}
          <p className="text-sm text-slate-600">{r.motivo}</p>
          {admin && r.estado === 'SOLICITADO' && (
            <div className="flex flex-wrap gap-2 pt-1">
              {['APROBADO', 'RECHAZADO'].map((estado) => (
                <button
                  key={estado}
                  disabled={busy}
                  className="btn-secondary"
                  onClick={() => {
                    const pregunta = {
                      APROBADO:
                        '¿Aprobar? Se invalidará la entrada y su QR, y el cupo quedará libre para otra venta.',
                      RECHAZADO: '¿Rechazar la solicitud? La entrada seguirá válida.',
                    }[estado]
                    if (window.confirm(pregunta))
                      ejecutar(
                        () => api.patch('/admin/reembolsos/' + r.id, { estado }),
                        {
                          APROBADO: 'Reembolso aprobado. Entrada invalidada y cupo liberado.',
                          RECHAZADO: 'Solicitud rechazada.',
                        }[estado],
                      )
                  }}
                >
                  {estado === 'APROBADO' ? 'Aprobar e invalidar entrada' : 'Rechazar'}
                </button>
              ))}
            </div>
          )}
          {admin && r.estado === 'APROBADO' && (
            <form
              className="space-y-2 border-t border-border pt-3"
              onSubmit={(e) => {
                e.preventDefault()
                const file = e.currentTarget.elements.evidencia.files?.[0]
                if (!file) {
                  fallar('Adjunta la foto del efectivo entregado.')
                  return
                }
                if (!window.confirm('¿Confirmás que entregaste el efectivo al titular?')) return
                const fd = new FormData()
                fd.append('estado', 'PAGADO')
                fd.append('evidencia', file)
                ejecutar(
                  () =>
                    api.patch('/admin/reembolsos/' + r.id, fd, {
                      headers: { 'Content-Type': 'multipart/form-data' },
                    }),
                  'Pago en efectivo registrado con evidencia.',
                )
              }}
            >
              <label className="label">
                Foto del efectivo entregado *
                <input className="input" type="file" name="evidencia" accept="image/*,application/pdf" required />
              </label>
              <button disabled={busy} className="btn-secondary">
                Registrar entrega de efectivo
              </button>
            </form>
          )}
          {r.evidenciaUrl && (
            <p className="text-sm">
              Evidencia:{' '}
              <a className="font-semibold text-teal" href={r.evidenciaUrl} target="_blank" rel="noreferrer">
                Ver comprobante
              </a>
            </p>
          )}
        </article>
      ))}
      <Paginas page={page} onChange={pagina} mas={data?.length === 50} />
    </main>
  )
}
