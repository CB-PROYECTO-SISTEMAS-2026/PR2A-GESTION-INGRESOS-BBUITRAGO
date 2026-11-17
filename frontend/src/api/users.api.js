import api from './axios'

export const getMe = () => api.get('/users/me')
export const getMyProfile = () => api.get('/users/me/profile')
export const updateMe = (data) => api.patch('/users/me', data)
export const getMySaldo = () => api.get('/users/me/saldo')
export const uploadMyFoto = (formData) =>
  api.post('/users/me/foto', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
export const removeMyFoto = () => api.delete('/users/me/foto')
