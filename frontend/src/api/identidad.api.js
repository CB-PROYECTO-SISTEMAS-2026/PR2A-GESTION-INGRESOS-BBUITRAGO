import api from './axios'

export const getMiIdentidad = () => api.get('/users/me/identidad')

export const registrarIdentidad = (data) => api.post('/users/me/identidad', data)

export const actualizarIdentidad = (data) => api.patch('/users/me/identidad', data)
