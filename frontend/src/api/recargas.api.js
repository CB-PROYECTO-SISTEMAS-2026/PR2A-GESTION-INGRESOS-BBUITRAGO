import api from './axios'

// Terminal del recargador de saldo
export const getRecargasContexto = () => api.get('/recargas/contexto')
export const consultarClienteRecarga = (params) => api.get('/recargas/clientes', { params })
export const recargar = (data) => api.post('/recargas', data)
export const getMisRecargas = (params) => api.get('/recargas/historial', { params })
export const reportarIncidenciaRecarga = (id, data) => api.post(`/recargas/${id}/incidencias`, data)

// Saldo y movimientos del cliente, por evento
export const getMisSaldos = () => api.get('/users/me/saldos')
export const getMisMovimientos = (params) => api.get('/users/me/movimientos', { params })

// Administración: recargas, movimientos de un evento y personal asignado
export const getRecargasAdmin = (params) => api.get('/admin/recargas', { params })
export const anularRecarga = (id, motivo) => api.post(`/admin/recargas/${id}/anular`, { motivo })
export const resolverIncidenciaRecarga = (id, resolucion) =>
  api.post(`/admin/recargas/incidencias/${id}/resolver`, { resolucion })
export const getMovimientosEvento = (eventoId, params) => api.get(`/eventos/${eventoId}/movimientos`, { params })

export const getPersonalEvento = (eventoId) => api.get(`/admin/eventos/${eventoId}/personal`)
export const getCandidatosPersonal = (eventoId, params) =>
  api.get(`/admin/eventos/${eventoId}/personal/candidatos`, { params })
export const asignarPersonal = (eventoId, data) => api.post(`/admin/eventos/${eventoId}/personal`, data)
export const quitarPersonal = (eventoId, asignacionId) =>
  api.delete(`/admin/eventos/${eventoId}/personal/${asignacionId}`)
