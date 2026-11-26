import api from './axios'

export const getMisEntradas = (params = {}) => {
  const sp = new URLSearchParams()
  if (params.page != null) sp.set('page', String(params.page))
  if (params.limit != null) sp.set('limit', String(params.limit))
  if (params.q) sp.set('q', params.q)
  if (params.desde) sp.set('desde', params.desde)
  if (params.hasta) sp.set('hasta', params.hasta)
  const qs = sp.toString()
  return api.get(`/entradas/mias${qs ? `?${qs}` : ''}`)
}

export const solicitarReembolsoEntrada = (entradaId, motivo) =>
  api.post(`/entradas/${encodeURIComponent(entradaId)}/reembolso`, { motivo })
