import { useState } from 'react'
import api from '../../api/axios'
import { pagarRetiro } from '../../api/pos.api'
import Modal from '../../components/ui/Modal'
import { formatBs, getErrorMessage } from '../../utils/format'

export default function RetirosCaja() {
  const [retiro, elegir] = useState(null)
  const [mensaje, avisar] = useState('')
  async function buscar(e) {
    e.preventDefault()
    const codigo = e.currentTarget.elements.codigo.value.trim()
    avisar('')
    try {
      const { data } = await api.get('/devoluciones/retiros/' + encodeURIComponent(codigo))
      if (data.estado === 'PAGADO') avisar('Este retiro ya fue pagado.')
      else elegir(data)
    } catch (err) { avisar(getErrorMessage(err)) }
  }
  return <main className="space-y-4 p-5"><h1 className="text-2xl font-bold">Retiro en efectivo</h1>
    <form onSubmit={buscar}><label className="label">Código de retiro<input className="input" name="codigo" required /></label>
    <button className="btn-primary mt-3">Consultar retiro</button></form><p role="status">{mensaje}</p>
    {retiro && <RegistrarPagoModal retiro={retiro} onClose={() => elegir(null)} onPagado={repetido => {
      elegir(null); avisar(repetido ? 'Este retiro ya fue registrado. Verificá el comprobante antes de entregar efectivo.' : 'Pago registrado. Entregá el efectivo al titular.')
    }} />}</main>
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
      open={Boolean(retiro)}
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
      {retiro && (
        <form id="form-pago-retiro" onSubmit={enviar} className="grid gap-4 px-6 py-5">
          <p className="text-sm text-muted">
            Retiro de <strong className="text-ink">{formatBs(retiro.monto)}</strong> para{' '}
            <strong className="text-ink">{retiro.negocio}</strong> ({retiro.dueno}).
          </p>
          <label className="label">Documento del titular presente<input className="input" name="documento" required /></label>
          <div>
            <label className="label" htmlFor="evidencia-retiro">
              Comprobante del retiro en efectivo *
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
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
        </form>
      )}
    </Modal>
  )
}
