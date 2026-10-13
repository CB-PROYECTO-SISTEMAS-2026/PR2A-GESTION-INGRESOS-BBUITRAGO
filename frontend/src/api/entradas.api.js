import api from './axios'

export const getMisEntradas = () => api.get('/entradas/mias')
