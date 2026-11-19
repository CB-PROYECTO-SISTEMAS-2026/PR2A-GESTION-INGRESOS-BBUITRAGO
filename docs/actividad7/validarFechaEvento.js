/**
 * Validación del rango de fechas de un evento (EvenTix).
 * Generado con asistencia de Cursor y revisado manualmente.
 * @param {string} fechaInicio ISO date YYYY-MM-DD
 * @param {string} fechaFin ISO date YYYY-MM-DD
 * @param {string} fechaReferencia ISO date YYYY-MM-DD (p. ej. hoy)
 * @returns {{ ok: boolean, mensaje: string }}
 */
function validarRangoFechasEvento(fechaInicio, fechaFin, fechaReferencia) {
  const inicio = parseISODate(fechaInicio);
  const fin = parseISODate(fechaFin);
  const ref = parseISODate(fechaReferencia);

  if (!inicio || !fin) {
    return { ok: false, mensaje: 'Las fechas de inicio y fin deben tener formato YYYY-MM-DD.' };
  }
  if (!ref) {
    return { ok: false, mensaje: 'La fecha de referencia debe tener formato YYYY-MM-DD.' };
  }

  if (inicio.getTime() > fin.getTime()) {
    return { ok: false, mensaje: 'La fecha de inicio no puede ser posterior a la fecha de fin.' };
  }

  if (inicio.getTime() < ref.getTime()) {
    return { ok: false, mensaje: 'La fecha de inicio no puede ser anterior a hoy.' };
  }

  if (inicio.getTime() === fin.getTime()) {
    return { ok: true, mensaje: 'Evento de un solo día válido.' };
  }

  return { ok: true, mensaje: 'Rango de fechas válido.' };
}

function parseISODate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    return null;
  }
  return date;
}

module.exports = { validarRangoFechasEvento, parseISODate };
