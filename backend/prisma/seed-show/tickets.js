const { randomBytes } = require('crypto');

const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';

function newTicketCode() {
  const bytes = randomBytes(12);
  let chars = '';
  for (const b of bytes) chars += ALPHABET[b % ALPHABET.length];
  return `EVX-${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`;
}

function buildPoolRows(categoriaId, cantidad, codes = new Set()) {
  const rows = [];
  while (rows.length < cantidad) {
    const codigo = newTicketCode();
    if (codes.has(codigo)) continue;
    codes.add(codigo);
    rows.push({
      categoriaId,
      codigo,
      codigoQr: codigo,
      estado: 'GENERADO',
    });
  }
  return rows;
}

module.exports = { newTicketCode, buildPoolRows };