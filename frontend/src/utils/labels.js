export const TIPO_ACCESO_OPTIONS = [
  { value: 'QR_DIGITAL', label: 'QR (Digital)' },
  { value: 'MANILLA', label: 'Manilla (Físico)' },
  { value: 'AMBOS', label: 'Ambos (QR y Manilla)' },
]

export const ESTADO_EVENTO_OPTIONS = [
  { value: 'PUBLICADO', label: 'Publicado (visible al público)' },
  { value: 'BORRADOR', label: 'Borrador (no visible al público)' },
  { value: 'FINALIZADO', label: 'Finalizado' },
  { value: 'CANCELADO', label: 'Cancelado' },
]

const TIPO_ACCESO_LABELS = Object.fromEntries(TIPO_ACCESO_OPTIONS.map((o) => [o.value, o.label]))

const ESTADO_LABELS = {
  BORRADOR: 'Borrador',
  PUBLICADO: 'Publicado',
  FINALIZADO: 'Finalizado',
  CANCELADO: 'Cancelado',
  PENDIENTE: 'Pendiente',
  APROBADA: 'Aprobada',
  RECHAZADA: 'Rechazada',
  EVENTO_CREADO: 'Evento creado',
  ACEPTADA: 'Aceptada',
  CANCELADA: 'Cancelada',
  EXPIRADA: 'Vencida',
  GENERADA: 'Emitida',
  ASIGNADA: 'Asignada',
  USADA: 'Usada',
  REEMBOLSADA: 'Reembolsada',
  ANULADA: 'Anulada',
}

const ESTADO_BADGES = {
  BORRADOR: 'bg-slate-100 text-slate-700',
  PUBLICADO: 'bg-emerald-100 text-emerald-800',
  FINALIZADO: 'bg-indigo-100 text-indigo-800',
  CANCELADO: 'bg-red-100 text-red-700',
  PENDIENTE: 'bg-amber-100 text-amber-800',
  APROBADA: 'bg-teal/15 text-teal-dark',
  RECHAZADA: 'bg-red-100 text-red-700',
  EVENTO_CREADO: 'bg-emerald-100 text-emerald-800',
  ACEPTADA: 'bg-emerald-100 text-emerald-800',
  CANCELADA: 'bg-red-100 text-red-700',
  EXPIRADA: 'bg-slate-200 text-slate-600',
}

const MAPA_CAMBIO_LABELS = {
  CREACION: 'Versión inicial',
  ACTUALIZACION: 'Actualización',
}

export const tipoAccesoLabel = (tipo) => TIPO_ACCESO_LABELS[tipo] || '—'
export const estadoLabel = (estado) => ESTADO_LABELS[estado] || String(estado || '').replace(/_/g, ' ')
export const estadoBadgeClass = (estado) => ESTADO_BADGES[estado] || 'bg-slate-100 text-slate-700'
export const mapaCambioLabel = (tipo) => MAPA_CAMBIO_LABELS[tipo] || tipo
