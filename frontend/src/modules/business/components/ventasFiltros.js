import { useState } from 'react'
import { localDay } from '../../../utils/format'

export const RANGOS = [
  { label: 'Hoy', desde: () => localDay(), hasta: () => localDay() },
  { label: '7 días', desde: () => localDay(-6), hasta: () => localDay() },
  { label: '30 días', desde: () => localDay(-29), hasta: () => localDay() },
]

export function useFiltrosVentas(diasIniciales = 6) {
  return useState({ desde: localDay(-diasIniciales), hasta: localDay(), negocioId: '', eventoId: '' })
}
