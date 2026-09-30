import api from './axios'

const multipart = { headers: { 'Content-Type': 'multipart/form-data' } }

export const getPublishedEvents = () => api.get('/eventos/public')
export const getEventById = (id) => api.get(`/eventos/public/${id}`)
export const getAllEventsAdmin = () => api.get('/eventos/admin/all')
export const getEventAdminById = (id) => api.get(`/eventos/admin/${id}`)
export const getOrganizadores = () => api.get('/eventos/admin/organizadores')
export const createEvent = (data) => api.post('/eventos', data)
export const updateEvent = (id, data) => api.patch(`/eventos/${id}`, data)
export const uploadEventFoto = (id, formData) => api.post(`/eventos/${id}/foto`, formData, multipart)
export const updateEventMapa = (id, formData) => api.post(`/eventos/${id}/mapa`, formData, multipart)
export const getEventMapHistory = (id) => api.get(`/eventos/${id}/mapa/historial`)

export const getCategorias = (eventoId) => api.get(`/eventos/${eventoId}/categorias`)
export const createCategoria = (eventoId, data) =>
  api.post(`/eventos/${eventoId}/categorias`, data)
export const updateCategoria = (categoriaId, data) =>
  api.patch(`/categorias/${categoriaId}`, data)
export const deleteCategoria = (categoriaId) => api.delete(`/categorias/${categoriaId}`)
export const getCodigos = (categoriaId, params) => api.get(`/categorias/${categoriaId}/codigos`, { params })

export const getSolicitudes = (params) => api.get('/solicitudes', { params })
export const getMisSolicitudes = () => api.get('/solicitudes/mias')
export const getSolicitudById = (id) => api.get(`/solicitudes/${id}`)
export const createSolicitud = (formData) => api.post('/solicitudes', formData, multipart)
export const updateSolicitudMapa = (id, formData) =>
  api.post(`/solicitudes/${id}/mapa`, formData, multipart)
export const revisarSolicitud = (id, data) => api.patch(`/solicitudes/${id}/revisar`, data)
