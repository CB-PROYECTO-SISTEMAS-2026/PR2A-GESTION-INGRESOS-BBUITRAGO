/** Tipos de movimiento de saldo, con su texto y estilo (Figma: Historial de Transacciones). */
export const TIPOS_MOVIMIENTO = [
  { value: 'RECARGA', label: 'Recarga' },
  { value: 'COMPRA_PRODUCTO', label: 'Consumo' },
  { value: 'DEVOLUCION', label: 'Devolución' },
  { value: 'AJUSTE', label: 'Ajuste' },
]

const TIPO_LABELS = Object.fromEntries(TIPOS_MOVIMIENTO.map((t) => [t.value, t.label]))
export const tipoMovimientoLabel = (tipo) => TIPO_LABELS[tipo] || tipo

const ESTADOS = {
  COMPLETADA: { label: 'Confirmado', badge: 'bg-emerald-50 text-emerald-700' },
  PENDIENTE: { label: 'Pendiente', badge: 'bg-amber-50 text-amber-700' },
  ANULADA: { label: 'Anulado', badge: 'bg-slate-100 text-slate-600' },
  ERROR: { label: 'Con error', badge: 'bg-red-50 text-red-700' },
}
export const estadoMovimientoLabel = (estado) => ESTADOS[estado]?.label || estado
export const estadoMovimientoBadge = (estado) => ESTADOS[estado]?.badge || 'bg-page text-muted'

/** "+Bs 100" / "−Bs 35": el monto ya llega con signo desde la API. */
export function montoConSigno(monto, formatBs) {
  const n = Number(monto)
  if (Number.isNaN(n)) return formatBs(monto)
  return `${n < 0 ? '−' : '+'}${formatBs(Math.abs(n))}`
}

/** Momento del evento para las tarjetas de saldo del cliente. */
export const MOMENTO_EVENTO = {
  EN_CURSO: { label: 'En curso', badge: 'bg-emerald-50 text-emerald-700' },
  HOY: { label: 'Hoy', badge: 'bg-sky-50 text-sky-700' },
  PROXIMO: { label: 'Próximo evento', badge: 'bg-indigo-50 text-indigo-700' },
  FINALIZADO: { label: 'Finalizado', badge: 'bg-slate-100 text-slate-600' },
}
