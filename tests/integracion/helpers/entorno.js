/**
 * Carga la configuración del backend (backend/.env) para las pruebas que usan la base de datos.
 *
 * - No reemplaza variables que ya existan en el entorno (así se puede apuntar a otra base
 *   exportando DATABASE_URL antes de correr las pruebas).
 * - El certificado SSL de Aiven se indica en DATABASE_URL con una ruta relativa al backend
 *   (sslcert=./ca.pem); aquí se convierte a ruta absoluta para que funcione desde tests/.
 *
 * Lo usan las pruebas de integración (setupFiles de Jest) y scripts/limpiar-datos-prueba.js.
 */
const fs = require('fs');
const path = require('path');

const backendDir = path.resolve(__dirname, '../../../backend');
const envFile = path.join(backendDir, '.env');

if (!fs.existsSync(envFile)) {
  throw new Error(
    `No se encontró ${envFile}. Las pruebas de integración necesitan el .env del backend (ver backend/.env.example).`,
  );
}

for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
  const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
  if (!match || process.env[match[1]] !== undefined) continue;
  process.env[match[1]] = match[2].replace(/^"(.*)"$/, '$1');
}

const caPem = path.join(backendDir, 'prisma', 'ca.pem').split(path.sep).join('/');
if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace(
    'sslcert=./ca.pem',
    `sslcert=${caPem}`,
  );
}
process.env.APP_TIMEZONE = process.env.APP_TIMEZONE || 'America/La_Paz';
