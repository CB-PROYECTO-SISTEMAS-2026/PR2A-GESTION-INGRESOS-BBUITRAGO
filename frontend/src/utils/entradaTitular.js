/** Entradas compradas por el usuario que aún requieren definir titular. */
export function entradaNecesitaTitular(entrada) {
  if (!entrada) return false
  return ['SIN_ASIGNAR', 'REVOCADA', 'INVITACION_PENDIENTE'].includes(entrada.titularEstado)
}