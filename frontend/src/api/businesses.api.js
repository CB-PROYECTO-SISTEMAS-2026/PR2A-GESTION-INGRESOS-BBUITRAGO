import api from './axios'

export const getMisNegocios = () => api.get('/negocios/mios')
export const getNegocios = () => getMisNegocios()
export const createNegocio = (data) => api.post('/negocios', data)
export const updateNegocio = (id, data) => api.patch(`/negocios/${id}`, data)

export const createProducto = (negocioId, data) =>
  api.post(`/negocios/${negocioId}/productos`, data)
export const updateProducto = (productoId, data) => api.patch(`/productos/${productoId}`, data)
export const deleteProducto = (productoId) => api.delete(`/productos/${productoId}`)

export const createAyudante = (negocioId, data) =>
  api.post(`/negocios/${negocioId}/ayudantes`, data)
export const asignarAyudante = (ayudanteId, data) =>
  api.patch(`/ayudantes/${ayudanteId}/asignar`, data)
