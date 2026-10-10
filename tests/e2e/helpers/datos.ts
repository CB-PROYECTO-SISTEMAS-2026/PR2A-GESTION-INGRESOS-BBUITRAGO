/**
 * Datos compartidos por las pruebas e2e: el escenario creado en setup/global-setup.ts y las
 * sesiones guardadas por rol. También reúne utilidades comunes de las pruebas.
 */
import fs from 'fs';
import path from 'path';
import type { Page } from '@playwright/test';
import type { Escenario } from '../../integracion/helpers/escenario';

export const AUTH_DIR = path.resolve(__dirname, '../.auth');

export const ROLES_E2E = ['cliente', 'ayudante', 'jefe', 'organizador', 'admin'] as const;
export type RolE2E = (typeof ROLES_E2E)[number];

export interface DatosE2E {
  escenario: Escenario;
  sufijo: string;
  /** Contraseña aleatoria de esta ejecución (solo para la prueba del formulario de login). */
  clave: string;
  emails: Record<RolE2E, string>;
  eventoFinalizado: string;
}

export function leerDatos(): DatosE2E {
  return JSON.parse(fs.readFileSync(path.join(AUTH_DIR, 'escenario.json'), 'utf8'));
}

/** Archivo de sesión del navegador para `test.use({ storageState: sesion('jefe') })`. */
export const sesion = (rol: RolE2E) => path.join(AUTH_DIR, `${rol}.json`);

/**
 * Registra los errores de JavaScript de la página y las respuestas 5xx de la API para que cada
 * prueba pueda comprobar que no hubo ninguno.
 */
export function vigilarErrores(page: Page) {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(`JS: ${e.message}`));
  page.on('response', (r) => {
    if (r.status() >= 500 && r.url().includes('/api/')) {
      errores.push(`${r.status()} ${r.request().method()} ${r.url().replace(/^.*\/api/, '/api')}`);
    }
  });
  return errores;
}
