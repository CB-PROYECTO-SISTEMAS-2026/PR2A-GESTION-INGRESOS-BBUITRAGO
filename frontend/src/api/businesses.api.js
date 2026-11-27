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
export const updateAyudante = (ayudanteId, data) =>
  api.patch(`/ayudantes/${ayudanteId}`, data)
export const deleteAyudante = (ayudanteId) => api.delete(`/ayudantes/${ayudanteId}`)
export const asignarAyudante = (ayudanteId, data) =>
  api.patch(`/ayudantes/${ayudanteId}/asignar`, data)

export const getEventosDisponiblesNegocio = () => api.get('/negocios/eventos-disponibles')
export const getMisSolicitudesNegocio = () => api.get('/negocios/solicitudes/mias')
export const solicitarParticipacionNegocio = (data) => api.post('/negocios/solicitudes', data)
export const cancelarSolicitudNegocio = (id) =>
  api.patch(`/negocios/solicitudes/${id}/cancelar`)
export const getAdminSolicitudesNegocio = (params) =>
  api.get('/admin/negocios/solicitudes', { params })
export const revisarSolicitudNegocio = (id, data) =>
  api.patch(`/admin/negocios/solicitudes/${id}`, data)
