/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *  PRUEBA E2E (navegador) · Devolución de saldo en efectivo (Sprint 3, Módulo A)
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 *  QUÉ VERIFICA
 *    Abre la aplicación real en el navegador y recorre el Módulo A como lo harían las personas:
 *      1. El encargado de devoluciones inicia sesión y llega directo a su terminal (celular).
 *      2. Escanea la manilla del cliente (código ingresado a mano: el navegador de prueba no
 *         tiene cámara) y ve su nombre, documento, la foto del primer ingreso y el saldo.
 *      3. No puede devolver hasta marcar que verificó la identidad de la persona.
 *      4. Confirma la devolución (Figma p28–31) y ve "Devolución Exitosa" con el saldo en cero.
 *      5. Un segundo escaneo del mismo cliente ya no deja devolver (sin saldo).
 *      6. El cliente ve el saldo en cero en "Mi Manilla" y la devolución en sus movimientos.
 *      7. El administrador asigna a un encargado de devoluciones a un evento YA FINALIZADO
 *         (las devoluciones siguen 30 días después) y ve la devolución en los movimientos.
 *
 *  POR QUÉ IMPORTA
 *    Las pruebas de integración verifican el servidor; esta verifica que las pantallas
 *    realmente impidan devolver sin verificar la identidad y que el flujo se pueda completar.
 *
 *  CÓDIGO PROBADO
 *    frontend/src/modules/devoluciones/, frontend/src/modules/billetera/,
 *    frontend/src/modules/admin/{PersonalEventoPage,MovimientosEventoPage}.jsx
 *    y, por debajo, toda la API de /api/devoluciones.
 *
 *  CÓMO EJECUTARLA
 *    cd tests
 *    npm run test:e2e                          (todas las e2e, en orden)
 *    npx playwright test 06-devoluciones       (solo este archivo)
 *
 *  REQUISITOS
 *    Los mismos que 01-pos.spec.ts.
 *
 *  SI FALLA
 *    Los pasos dependen entre sí (la devolución del paso 4 es la que ven después el cliente y
 *    el administrador): arregla primero la primera prueba que falló. Revisa la captura en
 *    e2e-resultados/.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
import { expect, test, type Page } from '@playwright/test';
import { DatosE2E, leerDatos, sesion, vigilarErrores } from './helpers/datos';

const CELULAR = { width: 390, height: 844 };
let datos: DatosE2E;

test.beforeAll(() => {
  datos = leerDatos();
});

async function escanearManual(page: Page, codigo: string) {
  await page.locator('#codigo-manual').fill(codigo);
  await page.getByRole('button', { name: 'Buscar' }).click();
}

test.describe('Login del encargado de devoluciones', () => {
  test.use({ viewport: CELULAR, storageState: { cookies: [], origins: [] } });

  test('inicia sesión y llega directo a la terminal de devoluciones', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type=email]').fill(datos.emails.devoluciones);
    await page.locator('input[type=password]').fill(datos.clave);
    await page.locator('button[type=submit]').click();
    await expect(page).toHaveURL(/\/devoluciones$/);
    await expect(page.getByRole('link', { name: 'Devolver saldo' })).toBeVisible();
  });
});

test.describe.serial('Módulo A de punta a punta', () => {
  test.describe('Encargado de devoluciones (celular)', () => {
    test.use({ viewport: CELULAR, storageState: sesion('devoluciones') });

    test('escanea la manilla, ve foto y saldo, verifica la identidad y devuelve el saldo', async ({ page }) => {
      const errores = vigilarErrores(page);
      await page.goto('/devoluciones');
      await expect(page.getByRole('heading', { name: 'Devolución de Saldo' })).toBeVisible();
      await expect(page.getByText(/\[PRUEBA-AUTO\] Feria abierta/)).toBeVisible();
      await expect(page.getByText(/Devoluciones hasta el/)).toBeVisible();

      await page.getByRole('button', { name: /Escanear Manilla/ }).click();
      await escanearManual(page, datos.escenario.codigos.manilla);

      await expect(page.getByText('Prueba cliente Auto')).toBeVisible();
      await expect(page.getByRole('img', { name: /Foto del primer ingreso de Prueba cliente Auto/ })).toBeAttached();
      await expect(page.getByText('Saldo a devolver')).toBeVisible();

      // Sin confirmar la identidad no se puede devolver.
      const devolver = page.getByRole('button', { name: 'Devolver Saldo' });
      await expect(devolver).toBeDisabled();
      await page.getByRole('checkbox', { name: /Comparé la foto del primer ingreso/ }).check();
      await expect(devolver).toBeEnabled();
      await devolver.click();

      await expect(page.getByRole('heading', { name: 'Confirmar Devolución' })).toBeVisible();
      await expect(page.getByText(/no se puede deshacer/)).toBeVisible();
      await page.getByRole('button', { name: /Confirmar Devolución/ }).click();

      await expect(page.getByText('Devolución Exitosa')).toBeVisible();
      await expect(page.getByText(/TX-[0-9A-Z]{8}/)).toBeVisible();
      await expect(page.getByText('Saldo después').locator('xpath=following-sibling::dd[1]')).toHaveText(/Bs\s*0/);
      expect(errores).toEqual([]);
    });

    test('un segundo escaneo del mismo cliente ya no deja devolver (sin saldo)', async ({ page }) => {
      await page.goto('/devoluciones');
      await page.getByRole('button', { name: /Escanear Manilla/ }).click();
      await escanearManual(page, datos.escenario.codigos.manilla);
      await expect(page.getByText(/no tiene saldo para devolver/)).toBeVisible();
      await expect(page.getByText(/Última devolución/)).toBeVisible();
      await expect(page.getByRole('button', { name: 'Devolver Saldo' })).toHaveCount(0);
    });

    test('un código de otro evento se rechaza con un mensaje claro', async ({ page }) => {
      await page.goto('/devoluciones');
      await page.getByRole('button', { name: /Escanear Manilla/ }).click();
      await escanearManual(page, datos.escenario.codigos.entradaOtroEvento);
      await expect(page.getByText(/pertenece a otro evento/)).toBeVisible();
    });
  });

  test.describe('Cliente', () => {
    test.use({ storageState: sesion('cliente') });

    test('ve su saldo en cero y la devolución en sus movimientos', async ({ page }) => {
      const errores = vigilarErrores(page);
      await page.goto('/mi-manilla');
      const tarjeta = page.locator('li').filter({ hasText: /\[PRUEBA-AUTO\] Feria abierta/ });
      await expect(tarjeta.getByText(/Bs\s*0(,00)?/).first()).toBeVisible();

      await page.goto(`/mi-manilla/movimientos?evento=${datos.escenario.eventos.abierto}`);
      await expect(page.getByText('Devolución en efectivo').first()).toBeVisible();
      expect(errores).toEqual([]);
    });
  });

  test.describe('Administrador', () => {
    test.use({ storageState: sesion('admin') });

    test('asigna al encargado de devoluciones a un evento finalizado', async ({ page }) => {
      await page.goto(`/admin/eventos/${datos.eventoFinalizado}/personal`);
      await expect(page.getByText(/solo se pueden asignar encargados de devoluciones/)).toBeVisible();

      await page.getByLabel('Buscar usuario').fill(`devoluciones.${datos.sufijo}`);
      const candidato = page.locator('li').filter({ hasText: 'Prueba devoluciones Auto' });
      await candidato.getByRole('button', { name: /Asignar/ }).click();
      await expect(page.locator('tr').filter({ hasText: 'Prueba devoluciones Auto' })).toBeVisible();
    });

    test('ve la devolución en los movimientos de saldo del evento', async ({ page }) => {
      const errores = vigilarErrores(page);
      await page.goto(`/admin/eventos/${datos.escenario.eventos.abierto}/movimientos`);
      await expect(page.getByText('Saldo en circulación')).toBeVisible();
      await expect(page.getByText('Devolución en efectivo').first()).toBeVisible();
      expect(errores).toEqual([]);
    });
  });
});
