/** Tipos de problema que el recargador puede reportar sobre una recarga (HU-047). */
export const TIPOS_INCIDENCIA = [
  { value: 'MONTO_INCORRECTO', label: 'Monto incorrecto' },
  { value: 'CLIENTE_EQUIVOCADO', label: 'Cliente equivocado' },
  { value: 'RECARGA_DUPLICADA', label: 'Recarga duplicada' },
  { value: 'NO_SE_REFLEJA', label: 'El saldo no se refleja' },
  { value: 'OTRO', label: 'Otro' },
]

export const INCIDENCIA_TEXTO_MAX = 500

export const tipoIncidenciaLabel = (tipo) => TIPOS_INCIDENCIA.find((t) => t.value === tipo)?.label ?? tipo
