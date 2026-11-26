import api from './axios'

export const getAsignacionesCompradas = () => api.get('/asignaciones/compradas')

export const getMisInvitaciones = () => api.get('/asignaciones/mias')

export const previewInvitacion = (token) =>
  api.get('/asignaciones/preview', { params: { token } })

export const asignarmeEntrada = (entradaId) =>
  api.post(`/asignaciones/entradas/${entradaId}/asignarme`)

export const invitarEntrada = (entradaId, email) =>
  api.post(`/asignaciones/entradas/${entradaId}/invitar`, { email })

export const transferirEntrada = (entradaId, email) =>
  api.post(`/asignaciones/entradas/${entradaId}/transferir`, { email })

export const cancelarAsignacion = (id) => api.post(`/asignaciones/${id}/cancelar`)

export const reenviarAsignacion = (id) => api.post(`/asignaciones/${id}/reenviar`)

export const aceptarAsignacion = (id, token) =>
  api.post(`/asignaciones/${id}/aceptar`, token ? { token } : {})

export const rechazarAsignacion = (id) => api.post(`/asignaciones/${id}/rechazar`)
