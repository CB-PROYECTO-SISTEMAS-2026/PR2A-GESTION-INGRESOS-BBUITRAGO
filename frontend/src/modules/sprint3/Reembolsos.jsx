import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../../api/axios'
import { formatBs, formatDateTime, getErrorMessage } from '../../utils/format'
import { Aviso, Paginas, useDatos } from './comun'

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
      await accion()
      avisar(ok)
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
                await api.post('/entradas/' + encodeURIComponent(entrada) + '/reembolso', { motivo })
                setParams({})
                pagina(1)
              }, 'Solicitud registrada.')
          }}
        >
          <p>Entrada {entrada}</p>
          <label className="label">
            Motivo de devolución
            <textarea className="input" name="motivo" required maxLength={500} />
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
            {formatDateTime(r.createdAt)} · {{ SOLICITADO: 'Pendiente de revisión', APROBADO: 'Aprobado', RECHAZADO: 'Rechazado', PAGADO: 'Pagado en efectivo' }[r.estado]}
          </p>
          {admin && <p>Titular: {[r.usuario.nombre, r.usuario.apellido].filter(Boolean).join(' ')}</p>}
          <p>{r.motivo}</p>
          {admin && (
            <div className="flex gap-2">
              {(r.estado === 'SOLICITADO'
                ? ['APROBADO', 'RECHAZADO']
                : r.estado === 'APROBADO'
                  ? ['PAGADO']
                  : []
              ).map((estado) => (
                <button
                  key={estado}
                  disabled={busy}
                  className="btn-secondary"
                  onClick={() => {
                    const pregunta = {
                      APROBADO: '¿Aprobar e invalidar esta entrada y su QR?',
                      RECHAZADO: '¿Rechazar la solicitud?',
                      PAGADO: '¿Confirmás que entregaste el efectivo al titular?',
                    }[estado]
                    if (window.confirm(pregunta))
                      ejecutar(
                        () => api.patch('/admin/reembolsos/' + r.id, { estado }),
                        'Estado actualizado.',
                      )
                  }}
                >
                  {
                    { APROBADO: 'Aprobar', RECHAZADO: 'Rechazar', PAGADO: 'Registrar pago en efectivo' }[
                      estado
                    ]
                  }
                </button>
              ))}
            </div>
          )}
        </article>
      ))}
      <Paginas page={page} onChange={pagina} mas={data?.length === 50} />
    </main>
  )
}
