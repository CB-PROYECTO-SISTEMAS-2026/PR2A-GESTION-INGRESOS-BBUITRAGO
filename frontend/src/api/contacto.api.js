import api from './axios'

export const enviarContacto = (data) => api.post('/contacto', data)
