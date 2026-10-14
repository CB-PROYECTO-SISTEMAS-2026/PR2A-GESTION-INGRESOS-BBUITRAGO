/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *  PRUEBA E2E (navegador) · Recorrido de pantallas por rol, en escritorio y celular
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 *  QUÉ VERIFICA
 *    1. Cada pantalla de cada rol carga sin errores de JavaScript ni respuestas 5xx de la API,
 *       en escritorio (1366 px) y en celular (390 px), y sin desbordarse a lo ancho.
 *    2. Las rutas protegidas redirigen: sin sesión al login; con un rol sin permiso, al inicio.
 *    3. En el celular, el menú de la barra superior muestra los enlaces de navegación.
 *
 *  POR QUÉ IMPORTA
 *    Es el "barrido" que se hizo a mano en el QA, ahora automático: detecta pantallas rotas
 *    (p. ej. por cambios en la base compartida) antes de que las vea el usuario.
 *
 *  CÓMO EJECUTARLA
 *    cd tests
 *    npm run test:e2e                         (todas las e2e, en orden)
 *    npx playwright test 04-navegacion        (solo este archivo; no depende de los otros)
 *
 *  REQUISITOS / SI FALLA
 *    Los mismos que 01-pos.spec.ts. El mensaje de error dice qué rol, pantalla y tamaño fallaron
 *    y qué petición devolvió 5xx o qué error de JavaScript ocurrió.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
import { expect, test } from '@playwright/test';
import { RolE2E, sesion, vigilarErrores } from './helpers/datos';

const TAMANOS = {
  escritorio: { width: 1366, height: 900 },
  celular: { width: 390, height: 844 },
};

const PANTALLAS: Record<RolE2E, string[]> = {
  cliente: ['/', '/eventos', '/perfil', '/mi-manilla'],
  organizador: ['/organizador/solicitudes', '/organizador/nueva-solicitud'],
  admin: ['/admin', '/admin/eventos', '/admin/solicitudes', '/admin/usuarios', '/admin/retiros', '/admin/recargas'],
  jefe: [
    '/negocio',
    '/negocio/productos',
    '/negocio/ayudantes',
    '/negocio/dashboard',
    '/negocio/ventas',
    '/negocio/liquidacion',
  ],
  ayudante: ['/pos', '/pos/historial'],
  recargador: ['/recargas', '/recargas/historial'],
};

for (const [nombreTamano, viewport] of Object.entries(TAMANOS)) {
  for (const [rol, rutas] of Object.entries(PANTALLAS) as [RolE2E, string[]][]) {
    test.describe(`${rol} · ${nombreTamano}`, () => {
      test.use({ viewport, storageState: sesion(rol) });

      for (const ruta of rutas) {
        test(`${ruta} carga sin errores`, async ({ page }) => {
          const errores = vigilarErrores(page);
          await page.goto(ruta);
          await page.waitForLoadState('networkidle');
          await expect(page).toHaveURL(new RegExp(`${ruta.replace(/\//g, '\\/')}$`));
          expect(errores, `Errores en ${ruta} (${rol}, ${nombreTamano})`).toEqual([]);

          const desborde = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
          expect(desborde, `${ruta} se desborda a lo ancho ${desborde}px`).toBeLessThanOrEqual(2);
        });
      }
    });
  }
}

test.describe('Rutas protegidas', () => {
  test.describe('sin sesión', () => {
    test.use({ storageState: { cookies: [], origins: [] } });
    for (const ruta of ['/pos', '/negocio/dashboard', '/admin', '/perfil', '/recargas', '/mi-manilla']) {
      test(`${ruta} lleva al login`, async ({ page }) => {
        await page.goto(ruta);
        await expect(page).toHaveURL(/\/login/);
      });
    }
  });

  const sinPermiso: [RolE2E, string][] = [
    ['ayudante', '/negocio/dashboard'],
    ['cliente', '/admin'],
    ['jefe', '/pos'],
    ['organizador', '/admin/retiros'],
    ['ayudante', '/recargas'],
    ['recargador', '/admin/recargas'],
    ['recargador', '/pos'],
  ];
  for (const [rol, ruta] of sinPermiso) {
    test.describe(`${rol} en ${ruta}`, () => {
      test.use({ storageState: sesion(rol) });
      test('vuelve al inicio (no tiene permiso)', async ({ page }) => {
        await page.goto(ruta);
        await expect(page).toHaveURL(/\/$/);
      });
    });
  }
});

test.describe('Menú de navegación en el celular', () => {
  test.use({ viewport: TAMANOS.celular, storageState: sesion('jefe') });

  test('el botón de menú de la barra superior muestra los enlaces', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Abrir menú de navegación').click();
    await page.getByRole('navigation').getByRole('link', { name: 'Negocios' }).click();
    await expect(page).toHaveURL(/\/negocio$/);
  });
});
