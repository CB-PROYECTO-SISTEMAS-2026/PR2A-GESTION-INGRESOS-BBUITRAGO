/**
 * Limpieza de las pruebas e2e (se ejecuta UNA vez, al terminar, aunque las pruebas fallen):
 * borra el escenario [PRUEBA-AUTO] de esta ejecución y las sesiones guardadas en e2e/.auth/.
 */
import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { AUTH_DIR, leerDatos } from '../helpers/datos';

// eslint-disable-next-line @typescript-eslint/no-require-imports
require('../../integracion/helpers/entorno');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { limpiarDatosPrueba } = require('../../integracion/helpers/limpieza');

export default async function globalTeardown() {
  if (!fs.existsSync(AUTH_DIR)) return;
  const prisma = new PrismaClient();
  try {
    const { sufijo } = leerDatos();
    await limpiarDatosPrueba(prisma, { sufijo });
  } finally {
    await prisma.$disconnect();
    fs.rmSync(AUTH_DIR, { recursive: true, force: true });
  }
}
