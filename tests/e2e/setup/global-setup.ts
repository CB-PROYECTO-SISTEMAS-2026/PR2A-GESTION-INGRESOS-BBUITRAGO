/**
 * Preparación de las pruebas e2e (se ejecuta UNA vez, antes de todos los archivos):
 *   1. Borra restos [PRUEBA-AUTO] de más de 2 horas (ejecuciones cortadas).
 *   2. Crea el escenario de prueba (el mismo de las pruebas de integración) más:
 *        - un administrador de prueba,
 *        - un evento FINALIZADO ayer con una venta (para que el dueño tenga dinero que retirar),
 *        - stock 2 en el "Producto con stock".
 *   3. Inicia sesión una vez por rol contra la API y guarda la sesión del navegador
 *      (e2e/.auth/<rol>.json). Así las pruebas no repiten el login en cada caso.
 *   4. Guarda los datos del escenario en e2e/.auth/escenario.json para que las pruebas los lean.
 *
 * e2e/.auth/ está en .gitignore: contiene tokens de cuentas de prueba (que se borran al terminar).
 */
import fs from 'fs';
import path from 'path';
import { EventoEstado, PrismaClient, Role } from '@prisma/client';
import { API_URL, FRONTEND_URL } from '../../playwright.config';
import {
  asignarClave,
  crearEscenario,
  crearEventoPasado,
  crearUsuario,
  diaLaPaz,
  instanteLaPaz,
  nuevaClave,
  nuevoSufijo,
  registrarVenta,
  setStock,
} from '../../integracion/helpers/escenario';
import { AUTH_DIR, DatosE2E, ROLES_E2E, RolE2E } from '../helpers/datos';

// eslint-disable-next-line @typescript-eslint/no-require-imports
require('../../integracion/helpers/entorno');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { limpiarDatosPrueba, DOMINIO } = require('../../integracion/helpers/limpieza');

const DOS_HORAS = 2 * 60 * 60 * 1000;

async function iniciarSesion(email: string, password: string) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`No se pudo iniciar sesión como ${email}: HTTP ${res.status}`);
  return (await res.json()) as { accessToken: string; user: unknown };
}

export default async function globalSetup() {
  const prisma = new PrismaClient();
  try {
    await limpiarDatosPrueba(prisma, { creadosAntesDe: new Date(Date.now() - DOS_HORAS) });

    const sufijo = nuevoSufijo();
    const clave = nuevaClave();
    // PrismaClient y PrismaService tienen la misma API; el escenario solo usa sus consultas.
    const db = prisma as unknown as Parameters<typeof crearEscenario>[0];
    const esc = await crearEscenario(db, sufijo);
    const admin = await crearUsuario(db, 'admin', sufijo, [Role.ADMIN]);
    await asignarClave(db, [...Object.values(esc.usuarios), admin], clave);
    await setStock(db, esc.productos.limitado, 2);

    const finalizado = await crearEventoPasado(db, esc, 'Feria finalizada e2e', EventoEstado.FINALIZADO, 1);
    await registrarVenta(db, esc, {
      eventoId: finalizado,
      fecha: instanteLaPaz(diaLaPaz(1), '15:00'),
      items: [{ productoId: esc.productos.empanada, cantidad: 3 }],
    });

    const emails: Record<RolE2E, string> = {
      cliente: `cliente.${sufijo}${DOMINIO}`,
      ayudante: `ayudante.${sufijo}${DOMINIO}`,
      jefe: `jefe.${sufijo}${DOMINIO}`,
      organizador: `organizador.${sufijo}${DOMINIO}`,
      admin: `admin.${sufijo}${DOMINIO}`,
    };

    fs.mkdirSync(AUTH_DIR, { recursive: true });
    for (const rol of ROLES_E2E) {
      const sesion = await iniciarSesion(emails[rol], clave);
      // Mismo formato que guarda el frontend (src/context/AuthContext.jsx).
      const estado = {
        cookies: [],
        origins: [
          {
            origin: FRONTEND_URL,
            localStorage: [
              { name: 'eventix_token', value: sesion.accessToken },
              { name: 'eventix_user', value: JSON.stringify(sesion.user) },
            ],
          },
        ],
      };
      fs.writeFileSync(path.join(AUTH_DIR, `${rol}.json`), JSON.stringify(estado));
    }

    const datos: DatosE2E = { escenario: esc, sufijo, clave, emails, eventoFinalizado: finalizado };
    fs.writeFileSync(path.join(AUTH_DIR, 'escenario.json'), JSON.stringify(datos, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}
