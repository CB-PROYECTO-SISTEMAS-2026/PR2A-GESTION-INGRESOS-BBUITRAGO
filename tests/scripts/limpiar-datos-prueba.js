/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *  SCRIPT · Limpieza de los datos que crean las pruebas automatizadas
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 *  QUÉ HACE
 *    Busca en la base compartida los datos creados por las pruebas de integración y, solo si
 *    se lo pides, los borra:
 *      · eventos cuyo título empieza con "[PRUEBA-AUTO]",
 *      · usuarios con correo "@pruebas.eventix.test",
 *      · negocios de prueba de esos usuarios,
 *      · y todo lo que cuelga de ellos (ventas, saldos, entradas, manillas, retiros...).
 *    No toca ningún otro dato, ni el seed manual "[PRUEBA POS]" del Módulo E.
 *
 *  CUÁNDO USARLO
 *    Las pruebas ya limpian solas al empezar y al terminar. Úsalo si una ejecución se cortó a
 *    la mitad (Ctrl+C, corte de internet) y ves eventos "[PRUEBA-AUTO]" en la landing.
 *
 *  CÓMO USARLO (desde la carpeta tests/)
 *    npm run limpiar              → VISTA PREVIA: muestra lo que borraría, no borra nada
 *    npm run limpiar:confirmar    → borra (en una transacción: todo o nada)
 *
 *  REQUISITOS
 *    backend/.env y backend/prisma/ca.pem (la misma conexión que usa el backend).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
const path = require('path');

require('../integracion/helpers/entorno');
const { PrismaClient } = require(path.resolve(__dirname, '../../backend/node_modules/@prisma/client'));
const { buscarDatosPrueba, limpiarDatosPrueba, describirDatos } = require('../integracion/helpers/limpieza');

async function main() {
  const confirmar = process.argv.includes('--confirmar');
  const prisma = new PrismaClient();
  try {
    const datos = await buscarDatosPrueba(prisma);
    console.log(describirDatos(datos));
    if (datos.vacio) return;

    if (!confirmar) {
      console.log('\nVista previa: no se borró nada. Para borrar ejecuta: npm run limpiar:confirmar');
      return;
    }
    await limpiarDatosPrueba(prisma);
    const despues = await buscarDatosPrueba(prisma);
    console.log(
      despues.vacio
        ? '\nListo: se borraron todos los datos de prueba.'
        : `\nATENCIÓN: quedaron datos sin borrar:\n${describirDatos(despues)}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('No se pudo completar la limpieza:', err.message);
  process.exitCode = 1;
});
