import api from './axios'

const multipart = { headers: { 'Content-Type': 'multipart/form-data' } }

// Comprador (HU-010, HU-011, HU-012)
export const getCheckout = (eventoId) => api.get(`/compras/eventos/${eventoId}/checkout`)
export const crearCompra = (eventoId, { items, referencia, comprobante }) => {
  const fd = new FormData()
  fd.append('items', JSON.stringify(items))
  if (referencia) fd.append('referencia', referencia)
  if (comprobante) fd.append('comprobante', comprobante)
  return api.post(`/compras/eventos/${eventoId}`, fd, multipart)
}
export const getMisCompras = () => api.get('/compras/mias')
export const cancelarCompra = (id) => api.patch(`/compras/${id}/cancelar`)

// Administración (HU-012, HU-013)
export const getComprasAdmin = (params) => api.get('/admin/compras', { params })
export const getCompraAdmin = (id) => api.get(`/admin/compras/${id}`)
export const aprobarCompra = (id) => api.patch(`/admin/compras/${id}/aprobar`)
export const rechazarCompra = (id, motivo) => api.patch(`/admin/compras/${id}/rechazar`, { motivo })

export const getPagoEvento = (eventoId) => api.get(`/eventos/${eventoId}/pago`)
export const updatePagoEvento = (eventoId, { qr, instruccionesPago }) => {
  const fd = new FormData()
  if (qr) fd.append('qr', qr)
  if (instruccionesPago !== undefined) fd.append('instruccionesPago', instruccionesPago)
  return api.post(`/eventos/${eventoId}/pago`, fd, multipart)
}
export const quitarQrPago = (eventoId) => api.delete(`/eventos/${eventoId}/pago/qr`)
