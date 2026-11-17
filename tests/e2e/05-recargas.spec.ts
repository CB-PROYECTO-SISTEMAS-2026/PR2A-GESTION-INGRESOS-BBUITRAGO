/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *  PRUEBA E2E (navegador) · Recargas de saldo, Mi Manilla y administración (Módulo D)
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 *  QUÉ VERIFICA
 *    Abre la aplicación real en el navegador y recorre el Módulo D como lo harían las personas:
 *      1. El recargador inicia sesión y llega directo a la terminal de recargas (celular).
 *      2. Recarga Bs 50 en efectivo a la manilla del cliente (código ingresado a mano: el
 *         navegador de prueba no tiene cámara) y ve "Recarga Exitosa" con el nuevo saldo.
 *      3. La recarga aparece en "Mis recargas" con el efectivo del día.
 *      4. Un monto menor al mínimo no deja continuar.
 *      5. El cliente ve su saldo en "Mi Manilla" y la recarga en su historial de movimientos.
 *      6. El administrador ve la recarga, la anula con un motivo y queda "Anulado".
 *      7. El administrador asigna y quita un recargador en "Personal" del evento, y ve los
 *         movimientos de saldo del evento.
 *
 *  POR QUÉ IMPORTA
 *    Las pruebas de integración verifican el servidor; esta verifica que las pantallas
 *    realmente permitan recargar, consultar y anular (botones, pasos, mensajes).
 *
 *  CÓDIGO PROBADO
 *    frontend/src/modules/recargas/, frontend/src/modules/billetera/,
 *    frontend/src/modules/admin/{RecargasAdminPage,PersonalEventoPage,MovimientosEventoPage}.jsx
 *    y, por debajo, toda la API del Módulo D.
 *
 *  CÓMO EJECUTARLA
 *    cd tests
 *    npm run test:e2e                         (todas las e2e, en orden)
 *    npx playwright test 05-recargas          (solo este archivo)
 *
 *  REQUISITOS
 *    Los mismos que 01-pos.spec.ts.
 *
 *  SI FALLA
 *    Los pasos dependen entre sí (la recarga del paso 2 es la que se ve y se anula después):
 *    arregla primero la primera prueba que falló. Revisa la captura en e2e-resultados/.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
import { expect, test, type Page } from '@playwright/test';
import { DatosE2E, leerDatos, sesion, vigilarErrores } from './helpers/datos';

const CELULAR = { width: 390, height: 844 };
let datos: DatosE2E;

test.beforeAll(() => {
  datos = leerDatos();
});

/** "Bs 1.234,5" → 1234.5 (formato es-BO de la pantalla). */
const aNumero = (texto: string) => Number(texto.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.'));

async function escanearManual(page: Page, codigo: string) {
  await page.locator('#codigo-manual').fill(codigo);
  await page.getByRole('button', { name: 'Buscar' }).click();
}

test.describe('Login del recargador', () => {
  test.use({ viewport: CELULAR, storageState: { cookies: [], origins: [] } });

  test('inicia sesión y llega directo a la terminal de recargas', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type=email]').fill(datos.emails.recargador);
    await page.locator('input[type=password]').fill(datos.clave);
    await page.locator('button[type=submit]').click();
    await expect(page).toHaveURL(/\/recargas$/);
    await expect(page.getByRole('link', { name: 'Recargar' })).toBeVisible();
  });
});

test.describe.serial('Módulo D de punta a punta', () => {
  test.describe('Recargador (celular)', () => {
    test.use({ viewport: CELULAR, storageState: sesion('recargador') });

    test('recarga Bs 50 en efectivo con la manilla y ve "Recarga Exitosa"', async ({ page }) => {
      const errores = vigilarErrores(page);
      await page.goto('/recargas');
      await expect(page.getByText('Recargador de Saldo')).toBeVisible();
      await expect(page.getByText(/\[PRUEBA-AUTO\] Feria abierta/)).toBeVisible();

      await page.getByRole('button', { name: /Escanear Manilla/ }).click();
      await escanearManual(page, datos.escenario.codigos.manilla);
      await expect(page.getByRole('heading', { name: 'Recargar Saldo' })).toBeVisible();
      await expect(page.getByText('Prueba cliente Auto')).toBeVisible();
      const saldoActual = aNumero(
        (await page.getByText('Saldo actual').locator('xpath=following-sibling::p[1]').textContent()) ?? '',
      );

      await page.getByRole('button', { name: 'Bs 50', exact: true }).click();
      await page.getByRole('button', { name: 'Recargar', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Confirmar Recarga' })).toBeVisible();
      await expect(page.getByText(/en efectivo/)).toBeVisible();
      await page.getByRole('button', { name: /Confirmar Recarga/ }).click();

      await expect(page.getByText('Recarga Exitosa')).toBeVisible();
      await expect(page.getByText(/TX-[0-9A-Z]{8}/)).toBeVisible();
      const nuevo = aNumero(
        (await page.getByText('Nuevo saldo').locator('xpath=following-sibling::p[1]').textContent()) ?? '',
      );
      expect(nuevo).toBe(saldoActual + 50);
      expect(errores).toEqual([]);
    });

    test('la recarga aparece en "Mis recargas" con el efectivo del día', async ({ page }) => {
      await page.goto('/recargas/historial');
      await expect(page.getByText('Efectivo del día')).toBeVisible();
      await expect(page.getByText('Prueba cliente Auto').first()).toBeVisible();
      await expect(page.getByText('+ Bs 50').first()).toBeVisible();
    });

    test('un monto menor al mínimo no deja continuar', async ({ page }) => {
      await page.goto('/recargas');
      await page.getByRole('button', { name: /Escanear Manilla/ }).click();
      await escanearManual(page, datos.escenario.codigos.qr);
      await page.getByLabel('Otro monto').fill('5');
      await expect(page.getByText('El monto mínimo es Bs 10.')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Recargar', exact: true })).toBeDisabled();
    });
  });

  test.describe('Cliente', () => {
    test.use({ storageState: sesion('cliente') });

    test('ve su saldo en "Mi Manilla" y la recarga en sus movimientos', async ({ page }) => {
      const errores = vigilarErrores(page);
      await page.goto('/');
      await page.getByRole('link', { name: 'Mi Manilla' }).first().click();
      await expect(page.getByRole('heading', { name: 'Mis saldos' })).toBeVisible();

      const tarjeta = page.locator('li').filter({ hasText: /\[PRUEBA-AUTO\] Feria abierta/ });
      await expect(tarjeta.getByText('En curso')).toBeVisible();
      await tarjeta.getByRole('link', { name: 'Ver movimientos' }).click();

      await expect(page.getByRole('heading', { name: 'Historial de Transacciones' })).toBeVisible();
      await expect(page.getByText('Recarga en efectivo').first()).toBeVisible();
      await page.getByRole('button', { name: 'Recarga', exact: true }).click();
      await expect(page.getByText('Recarga en efectivo').first()).toBeVisible();
      await expect(page.getByText(/Compra en/)).toHaveCount(0);
      expect(errores).toEqual([]);
    });
  });

  test.describe('Cliente (celular)', () => {
    test.use({ viewport: CELULAR, storageState: sesion('cliente') });

    test('el historial de movimientos no se desborda a lo ancho en el celular', async ({ page }) => {
      await page.goto(`/mi-manilla/movimientos?evento=${datos.escenario.eventos.abierto}`);
      await expect(page.getByText('Recarga en efectivo').first()).toBeVisible();
      const desborde = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(desborde).toBeLessThanOrEqual(2);
    });
  });

  test.describe('Administrador', () => {
    test.use({ storageState: sesion('admin') });

    test('anula la recarga con un motivo y queda "Anulado"', async ({ page }) => {
      const errores = vigilarErrores(page);
      await page.goto('/admin/recargas');
      await page.getByLabel('Evento').selectOption({ value: datos.escenario.eventos.abierto });
      const fila = page.locator('tr').filter({ hasText: 'Prueba cliente Auto' }).filter({ hasText: 'Bs 50' }).first();
      await expect(fila).toBeVisible();
      await fila.getByRole('button', { name: 'Anular' }).click();

      await page.getByLabel('Motivo *').fill('Prueba e2e: monto equivocado');
      await page.getByRole('button', { name: 'Anular recarga' }).click();
      await expect(page.getByText(/anulada\. Nuevo saldo del cliente/)).toBeVisible();

      await page.getByRole('tab', { name: 'Anuladas' }).click();
      await expect(page.getByText('Prueba e2e: monto equivocado', { exact: false }).first()).toBeVisible();
      expect(errores).toEqual([]);
    });

    test('asigna y quita un recargador en "Personal" del evento', async ({ page }) => {
      await page.goto(`/admin/eventos/${datos.escenario.eventos.abierto}/personal`);
      await expect(page.getByRole('heading', { name: 'Personal asignado' })).toBeVisible();
      await expect(page.getByText('Prueba recargador Auto')).toBeVisible();

      await page.getByLabel('Buscar usuario').fill(`recargador2.${datos.sufijo}`);
      const candidato = page.locator('li').filter({ hasText: 'Prueba recargador2 Auto' });
      await candidato.getByRole('button', { name: /Asignar/ }).click();
      const asignado = page.locator('tr').filter({ hasText: 'Prueba recargador2 Auto' });
      await expect(asignado).toBeVisible();

      await asignado.getByRole('button', { name: 'Quitar' }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Quitar' }).click();
      await expect(asignado).toHaveCount(0);
    });

    test('ve los movimientos de saldo del evento', async ({ page }) => {
      const errores = vigilarErrores(page);
      await page.goto(`/admin/eventos/${datos.escenario.eventos.abierto}/movimientos`);
      await expect(page.getByText('Saldo en circulación')).toBeVisible();
      await expect(page.getByText('Recarga en efectivo · Anulada: Prueba e2e: monto equivocado')).toBeVisible();
      expect(errores).toEqual([]);
    });
  });
});
