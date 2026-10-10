import api from './axios'

// Terminal de punto de venta (ayudante)
export const getPosContexto = () => api.get('/pos/contexto')
export const consultarCliente = (params) => api.get('/pos/clientes', { params })
export const cobrar = (data) => api.post('/pos/cobros', data)
export const getMisVentas = (params) => api.get('/pos/ventas', { params })

// Panel del dueño del negocio
export const getResumenVentas = (params) => api.get('/negocio-panel/resumen', { params })
export const getVentasNegocio = (params) => api.get('/negocio-panel/ventas', { params })
export const exportarVentas = (params) =>
  api.get('/negocio-panel/ventas/export', { params, responseType: 'blob' })
export const getLiquidacion = (params) => api.get('/negocio-panel/liquidacion', { params })
export const solicitarRetiro = (negocioId) => api.post('/negocio-panel/retiros', { negocioId })

// Retiros de los negocios (administrador)
export const getRetirosAdmin = (params) => api.get('/admin/retiros', { params })
export const cambiarEstadoRetiro = (id, estado) => api.patch(`/admin/retiros/${id}/estado`, { estado })
export const pagarRetiro = (id, formData) =>
  api.post(`/admin/retiros/${id}/pagar`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
