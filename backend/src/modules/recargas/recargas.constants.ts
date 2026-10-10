/** Límites de las recargas de saldo (HU-047), en Bs. */
export const RECARGA_MIN = 10;
export const RECARGA_MAX = 1000;
/** Saldo máximo que un cliente puede acumular en un mismo evento. */
export const SALDO_MAX_EVENTO = 5000;

/** Montos que el recargador puede elegir con un toque (Figma: Recargar Saldo). */
export const MONTOS_RAPIDOS = [20, 50, 100, 200];

/**
 * Medios de pago aceptados al recargar. Por ahora solo efectivo; para agregar tarjeta basta con
 * sumarla aquí y a su texto en `NOTA_METODO`.
 */
export const METODOS_PAGO = ['EFECTIVO'] as const;
export type MetodoPago = (typeof METODOS_PAGO)[number];

export const NOTA_METODO: Record<MetodoPago, string> = {
  EFECTIVO: 'Recarga en efectivo',
};

/** Longitud máxima del motivo de anulación (la nota de la transacción es VARCHAR(191)). */
export const MOTIVO_ANULACION_MAX = 120;
