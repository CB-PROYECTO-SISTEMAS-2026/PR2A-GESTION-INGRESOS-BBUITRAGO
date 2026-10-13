import api from './axios'

// Administración de puntos de entrega (HU-053)
export const getPuntosRetiro = (eventoId) => api.get(`/eventos/${eventoId}/puntos-retiro`)
export const createPuntoRetiro = (eventoId, data) => api.post(`/eventos/${eventoId}/puntos-retiro`, data)
export const updatePuntoRetiro = (puntoId, data) => api.patch(`/puntos-retiro/${puntoId}`, data)
export const deletePuntoRetiro = (puntoId) => api.delete(`/puntos-retiro/${puntoId}`)
export const getCandidatosSupervisor = (puntoId, q) =>
  api.get(`/puntos-retiro/${puntoId}/candidatos`, { params: q ? { q } : undefined })
export const asignarSupervisor = (puntoId, usuarioId) =>
  api.post(`/puntos-retiro/${puntoId}/supervisores`, { usuarioId })
export const quitarSupervisor = (puntoId, usuarioId) =>
  api.delete(`/puntos-retiro/${puntoId}/supervisores/${usuarioId}`)
export const getEntregasEvento = (eventoId) => api.get(`/eventos/${eventoId}/manillas`)

// Supervisor en el punto de entrega (HU-015, HU-053)
export const getMisPuntos = () => api.get('/manillas/mis-puntos')
export const buscarEntrada = (puntoId, busqueda) => api.post('/manillas/buscar', { puntoId, busqueda })
export const vincularManilla = (data) => api.post('/manillas/vincular', data)
export const getMisEntregas = (puntoId) =>
  api.get('/manillas/mis-entregas', { params: puntoId ? { puntoId } : undefined })
