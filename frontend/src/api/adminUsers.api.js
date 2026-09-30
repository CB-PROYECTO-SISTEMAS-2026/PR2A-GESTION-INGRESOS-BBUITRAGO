import api from './axios'

export const getUsuarios = (params) => api.get('/admin/usuarios', { params })
export const getUsuario = (id) => api.get(`/admin/usuarios/${id}`)
export const deleteUsuario = (id) => api.delete(`/admin/usuarios/${id}`)
export const getInvitaciones = (params) => api.get('/admin/invitaciones', { params })
export const createInvitacion = (data) => api.post('/admin/invitaciones', data)
export const reenviarInvitacion = (id) => api.post(`/admin/invitaciones/${id}/reenviar`)
export const cancelarInvitacion = (id) => api.patch(`/admin/invitaciones/${id}/cancelar`)

export const verificarInvitacion = (token) => api.post('/invitaciones/verificar', { token })
export const aceptarInvitacion = (data) => api.post('/invitaciones/aceptar', data)
