const MOVIMIENTOS = {
  INGRESO: 'Ingreso',
  REINGRESO: 'Reingreso',
  SALIDA: 'Salida',
}

const MOVIMIENTO_BADGES = {
  INGRESO: 'bg-emerald-100 text-emerald-800',
  REINGRESO: 'bg-teal/15 text-teal-dark',
  SALIDA: 'bg-slate-200 text-slate-700',
}

export const movimientoLabel = (tipo) => MOVIMIENTOS[tipo] || tipo
export const movimientoBadge = (tipo) => MOVIMIENTO_BADGES[tipo] || 'bg-slate-100 text-slate-700'
export const medioLabel = (medio) => (medio === 'MANILLA' ? 'Manilla' : medio === 'QR_DIGITAL' ? 'QR digital' : '—')
