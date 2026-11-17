import api from './axios'

const multipart = { headers: { 'Content-Type': 'multipart/form-data' } }

// Supervisor en la puerta (HU-016, HU-017, HU-046)
export const getMisEventosAcceso = () => api.get('/acceso/mis-eventos')
export const verificarAcceso = (data) => api.post('/acceso/verificar', data)
export const registrarAcceso = ({ eventoId, codigo, sentido, foto, fotoVerificada }) => {
  const fd = new FormData()
  fd.append('eventoId', eventoId)
  fd.append('codigo', codigo)
  fd.append('sentido', sentido)
  if (fotoVerificada) fd.append('fotoVerificada', 'true')
  if (foto) fd.append('foto', foto, 'ingreso.jpg')
  return api.post('/acceso/registrar', fd, multipart)
}
export const rechazarAcceso = (data) => api.post('/acceso/rechazos', data)
export const getAforoSupervisor = (eventoId) => api.get(`/acceso/eventos/${eventoId}/aforo`)
export const getRegistrosSupervisor = (eventoId) => api.get(`/acceso/eventos/${eventoId}/registros`)

// Administración
export const getAccesosHoy = () => api.get('/admin/accesos/hoy')
export const getAccesoEvento = (eventoId, fechaId) =>
  api.get(`/eventos/${eventoId}/acceso`, { params: fechaId ? { fechaId } : undefined })
export const getCandidatosAcceso = (eventoId, q) =>
  api.get(`/eventos/${eventoId}/acceso/candidatos`, { params: q ? { q } : undefined })
export const asignarSupervisorAcceso = (eventoId, usuarioId) =>
  api.post(`/eventos/${eventoId}/acceso/supervisores`, { usuarioId })
export const quitarSupervisorAcceso = (eventoId, usuarioId) =>
  api.delete(`/eventos/${eventoId}/acceso/supervisores/${usuarioId}`)
