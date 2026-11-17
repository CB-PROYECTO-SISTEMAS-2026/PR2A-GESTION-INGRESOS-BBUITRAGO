import axios from 'axios'

const baseURL = import.meta.env.VITE_API_URL
if (!baseURL) {
  throw new Error('Falta VITE_API_URL. Copia frontend/.env.example como frontend/.env.')
}

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('eventix_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const path = window.location.pathname
      const isAuthPage = path.startsWith('/login') || path.startsWith('/register')
      if (!isAuthPage && localStorage.getItem('eventix_token')) {
        localStorage.removeItem('eventix_token')
        localStorage.removeItem('eventix_user')
      }
    }
    return Promise.reject(error)
  },
)

export default api
