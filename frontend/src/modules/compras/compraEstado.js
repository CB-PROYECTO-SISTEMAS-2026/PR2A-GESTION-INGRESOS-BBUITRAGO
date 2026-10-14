const LABELS = {
  PENDIENTE: 'Pendiente de verificación',
  APROBADA: 'Aprobada',
  RECHAZADA: 'Rechazada',
  CANCELADA: 'Cancelada',
}

const BADGES = {
  PENDIENTE: 'bg-amber-100 text-amber-800',
  APROBADA: 'bg-emerald-100 text-emerald-800',
  RECHAZADA: 'bg-red-100 text-red-700',
  CANCELADA: 'bg-slate-200 text-slate-600',
}

export const COMPRA_ESTADOS = Object.keys(LABELS)
export const compraEstadoLabel = (estado) => LABELS[estado] || estado
export const compraEstadoBadge = (estado) => BADGES[estado] || 'bg-slate-100 text-slate-700'
