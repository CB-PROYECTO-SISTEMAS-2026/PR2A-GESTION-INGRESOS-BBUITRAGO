import { useState } from 'react'
import api from '../../api/axios'
import { pagarRetiro } from '../../api/pos.api'
import { toast } from '../../components/Toast'
import Modal from '../../components/ui/Modal'
import { formatBs, getErrorMessage } from '../../utils/format'

const ESTADO = {
  APROBADO: 'Aprobado',
  PAGADO: 'Pagado',
  RECHAZADO: 'Rechazado',
  PENDIENTE: 'Pendiente',
}

export default function RetirosCaja() {
  const [codigo, setCodigo] = useState('')
  const [retiro, setRetiro] = useState(null)
  const [error, setError] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [pagar, setPagar] = useState(false)

  async function buscar(e) {
    e.preventDefault()
    const value = codigo.trim()
    if (!value) return
    setError('')
    setRetiro(null)
    setPagar(false)
    setBuscando(true)
    try {
      const { data } = await api.get('/devoluciones/retiros/' + encodeURIComponent(value))
      setRetiro({ ...data, codigo: value })
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBuscando(false)
    }
  }

  return (
    <main className="flex flex-1 flex-col gap-4 p-4">
      <h1 className="font-display text-xl font-bold text-ink">Retiro en efectivo</h1>
      <form onSubmit={buscar} className="grid gap-2">
        <label className="label" htmlFor="codigo-retiro">
          Código de retiro
        </label>
        <input
          id="codigo-retiro"
          className="input font-mono"
          name="codigo"
          value={codigo}
          required
          autoComplete="off"
          onChange={(e) => setCodigo(e.target.value)}
          aria-invalid={Boolean(error)}
        />
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <button className="btn-primary w-full" disabled={buscando}>
          {buscando ? 'Consultando…' : 'Consultar retiro'}
        </button>
      </form>

      {retiro && (
        <article className="rounded-xl border border-border bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-xs text-muted">{retiro.codigo}</p>
              <p className="font-display text-2xl font-bold text-ink">{formatBs(retiro.monto)}</p>
              <p className="text-sm font-semibold text-ink">{retiro.negocio}</p>
              <p className="text-xs text-muted">{retiro.dueno}</p>
            </div>
            <span className={`badge ${retiro.estado === 'PAGADO' ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning'}`}>
              {ESTADO[retiro.estado] || retiro.estado}
            </span>
          </div>
          {retiro.estado !== 'PAGADO' && (
            <button type="button" className="btn-primary mt-4 w-full" onClick={() => setPagar(true)}>
              Registrar pago
            </button>
          )}
        </article>
      )}

      {retiro && pagar && (
        <RegistrarPagoModal
          retiro={retiro}
          onClose={() => setPagar(false)}
          onPagado={(repetido) => {
            setPagar(false)
            setRetiro((prev) => (prev ? { ...prev, estado: 'PAGADO' } : prev))
            toast(
              repetido
                ? {
                    title: 'Este retiro ya fue registrado',
                    body: 'Verificá el comprobante antes de entregar efectivo.',
                    variant: 'warning',
                  }
                : { title: 'Pago registrado', body: 'Entregá el efectivo al titular.', variant: 'success' },
            )
          }}
        />
      )}
    </main>
  )
}

function RegistrarPagoModal({ retiro, onClose, onPagado }) {
  const [archivo, setArchivo] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  const cerrar = () => {
    if (enviando) return
    setArchivo(null)
    setError('')
    onClose()
  }

  const enviar = async (e) => {
    e.preventDefault()
    if (!archivo) {
      setError('Adjunta el comprobante del pago.')
      return
    }
    setEnviando(true)
    setError('')
    try {
      const form = new FormData()
      form.append('documento', e.currentTarget.elements.documento.value.trim())
      form.append('evidencia', archivo)
      const { data } = await pagarRetiro(retiro.id, form)
      setArchivo(null)
      await onPagado(data.repetido)
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudo registrar el pago.'))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal
      open
      onClose={cerrar}
      title="Registrar pago del retiro"
      size="sm"
      labelledBy="pago-retiro-title"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={cerrar} disabled={enviando}>
            Cancelar
          </button>
          <button type="submit" form="form-pago-retiro" className="btn-primary" disabled={enviando}>
            {enviando ? 'Subiendo…' : 'Marcar como pagado'}
          </button>
        </>
      }
    >
      <form id="form-pago-retiro" onSubmit={enviar} className="grid gap-4 px-6 py-5">
        <p className="text-sm text-muted">
          Retiro de <strong className="text-ink">{formatBs(retiro.monto)}</strong> para{' '}
          <strong className="text-ink">{retiro.negocio}</strong> ({retiro.dueno}).
        </p>
        <label className="label">
          Documento del titular presente
          <input className="input" name="documento" required />
        </label>
        <div>
          <label className="label" htmlFor="evidencia-retiro">
            Comprobante del retiro en efectivo
          </label>
          <input
            id="evidencia-retiro"
            type="file"
            accept="image/png,image/jpeg,image/webp,application/pdf"
            className="input"
            onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
          />
          <p className="mt-1 text-xs text-muted">Imagen o PDF de hasta 10 MB.</p>
        </div>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </Modal>
  )
}
