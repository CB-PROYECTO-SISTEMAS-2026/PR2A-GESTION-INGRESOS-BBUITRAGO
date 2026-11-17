/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *  PRUEBA E2E (navegador) · Panel del dueño del negocio: ventas, exportación y retiro (HU-025)
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 *  QUÉ VERIFICA
 *    En el navegador de escritorio, como dueño del negocio de prueba:
 *      1. El dashboard muestra lo vendido en los últimos 7 días (la venta de 01-pos más la del
 *         evento finalizado de ayer).
 *      2. El registro de ventas lista la venta de hoy y exporta el CSV para Excel.
 *      3. La liquidación muestra lo disponible (lo del evento finalizado) y permite solicitar
 *         el retiro, que aparece en la lista como SOLICITADO.
 *      4. En el celular, el menú lateral se abre con el botón "Menú".
 *
 *  POR QUÉ IMPORTA
 *    Es lo que usa el dueño para cuadrar la caja y cobrar su dinero al terminar el evento.
 *
 *  CÓDIGO PROBADO
 *    frontend/src/modules/business/ (DashboardPage, VentasPage, LiquidacionPage)
 *    frontend/src/components/layout/ (PanelLayout, PanelSidebar)
 *
 *  CÓMO EJECUTARLA
 *    cd tests
 *    npm run test:e2e                         (todas las e2e, en orden)
 *    npx playwright test 02-panel-negocio     (solo este archivo; ver la nota de abajo)
 *
 *  REQUISITOS
 *    Los mismos que 01-pos.spec.ts. Corriendo solo este archivo, los montos del dashboard no
 *    incluyen la venta de 01-pos (las pruebas 1 y 2 fallarían): córrelo junto con 01.
 *
 *  CÓMO LEER EL RESULTADO / SI FALLA
 *    Igual que 01-pos.spec.ts: revisa la captura y el informe (npx playwright show-report e2e-reporte).
 *    Montos del escenario: hoy Bs 16 (01-pos) + ayer Bs 30 (evento finalizado) = Bs 46.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
import fs from 'fs';
import { expect, test } from '@playwright/test';
import { sesion, vigilarErrores } from './helpers/datos';

test.describe.serial('Panel del dueño (escritorio)', () => {
  test.use({ viewport: { width: 1366, height: 900 }, storageState: sesion('jefe') });

  test('el dashboard muestra lo vendido en los últimos 7 días', async ({ page }) => {
    const errores = vigilarErrores(page);
    await page.goto('/negocio/dashboard');
    // El valor está en la misma tarjeta que el título "Ventas totales".
    const kpi = page.getByText('Ventas totales', { exact: true }).locator('..');
    await expect(kpi).toContainText('Bs 46');
    await expect(page.getByText('Ventas por día')).toBeVisible();
    await expect(page.getByText('Prueba cliente Auto').first()).toBeVisible();
    expect(errores).toEqual([]);
  });

  test('el registro de ventas lista la venta de hoy y exporta el CSV', async ({ page }) => {
    await page.goto('/negocio/ventas');
    const fila = page.getByRole('row', { name: /Prueba cliente Auto/ });
    await expect(fila).toContainText('Empanada');
    await expect(fila).toContainText('Bs 16');

    const [descarga] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /Exportar Excel/ }).click(),
    ]);
    expect(descarga.suggestedFilename()).toMatch(/^ventas_\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}\.csv$/);
    const csv = fs.readFileSync((await descarga.path())!, 'utf8');
    expect(csv).toContain('Fecha;Hora;Negocio;Evento;Cliente;Ayudante;Productos;Total (Bs)');
    expect(csv).toContain('Prueba cliente Auto');
  });

  test('solicita el retiro de lo vendido en el evento finalizado', async ({ page }) => {
    await page.goto('/negocio/liquidacion');
    // El monto está junto al título "Disponible para retiro" (mismo contenedor).
    const disponible = page.getByText('Disponible para retiro').locator('..');
    await expect(disponible).toContainText('Bs 30');

    await page.getByRole('button', { name: 'Solicitar retiro' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Solicitar retiro' }).click();

    await expect(page.getByText('Solicitud de retiro enviada')).toBeVisible();
    await expect(page.getByText('SOLICITADO', { exact: true })).toBeVisible();
    await expect(disponible).toContainText('Bs 0');
  });
});

test.describe('Panel del dueño (celular)', () => {
  test.use({ viewport: { width: 390, height: 844 }, storageState: sesion('jefe') });

  test('el menú lateral se abre con el botón "Menú" y navega', async ({ page }) => {
    await page.goto('/negocio/dashboard');
    const menuLateral = page.locator('#panel-sidebar');
    await expect(menuLateral).toBeHidden();

    await page.getByRole('button', { name: 'Menú', exact: true }).click();
    await expect(menuLateral).toBeVisible();
    await menuLateral.getByRole('link', { name: 'Liquidación' }).click();

    await expect(page).toHaveURL(/\/negocio\/liquidacion$/);
    await expect(menuLateral).toBeHidden();
  });
});
