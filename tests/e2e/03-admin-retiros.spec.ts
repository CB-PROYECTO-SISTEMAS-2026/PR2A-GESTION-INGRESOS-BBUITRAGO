/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *  PRUEBA E2E (navegador) · Gestión de retiros del administrador (HU-025)
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 *  QUÉ VERIFICA
 *    Como administrador, sobre el retiro que solicitó el dueño en 02-panel-negocio:
 *      1. Lo encuentra en "Solicitados" y lo aprueba (con diálogo de confirmación).
 *      2. En "Aprobados", el formulario de pago no deja marcarlo como pagado sin comprobante.
 *      3. Lo rechaza y pasa a "Rechazados".
 *    NO sube un comprobante real: eso enviaría un archivo a la cuenta de Cloudinary del equipo.
 *    El pago con comprobante está cubierto por integracion/pos-liquidacion.test.ts.
 *
 *  POR QUÉ IMPORTA
 *    Es el paso que cierra el ciclo del dinero de los negocios: si la pantalla falla, nadie
 *    puede aprobar ni registrar los pagos.
 *
 *  CÓDIGO PROBADO
 *    frontend/src/modules/admin/RetirosPage.jsx y la API /api/admin/retiros.
 *
 *  CÓMO EJECUTARLA
 *    cd tests
 *    npm run test:e2e                         (todas las e2e, en orden)
 *    Este archivo necesita el retiro creado por 02-panel-negocio: no lo corras solo.
 *
 *  CÓMO LEER EL RESULTADO / SI FALLA
 *    Igual que 01-pos.spec.ts. Si falla la primera prueba, revisa antes que 02-panel-negocio
 *    haya pasado (sin solicitud no hay nada que aprobar).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
import { expect, test } from '@playwright/test';
import { leerDatos, sesion, vigilarErrores } from './helpers/datos';

test.describe.serial('Retiros del administrador', () => {
  test.use({ viewport: { width: 1366, height: 900 }, storageState: sesion('admin') });

  let negocio: string;
  test.beforeAll(() => {
    negocio = `[PRUEBA-AUTO] Puesto ${leerDatos().sufijo.toUpperCase()}`;
  });

  const filaDelNegocio = (page: import('@playwright/test').Page) =>
    page.getByRole('row').filter({ hasText: negocio });

  test('aprueba la solicitud del negocio de prueba', async ({ page }) => {
    const errores = vigilarErrores(page);
    await page.goto('/admin/retiros');
    await page.getByRole('tab', { name: /Solicitados/ }).click();
    const fila = filaDelNegocio(page);
    await expect(fila).toContainText('Bs 30');
    await expect(fila).toContainText('Prueba jefe Auto');

    await fila.getByRole('button', { name: 'Aprobar' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Aprobar' }).click();
    await expect(page.getByText('Retiro aprobado')).toBeVisible();
    expect(errores).toEqual([]);
  });

  test('el pago exige adjuntar el comprobante', async ({ page }) => {
    await page.goto('/admin/retiros');
    await page.getByRole('tab', { name: /Aprobados/ }).click();
    await filaDelNegocio(page).getByRole('button', { name: 'Registrar pago' }).click();

    const modal = page.getByRole('dialog');
    await expect(modal.getByText('Registrar pago del retiro')).toBeVisible();
    await modal.getByRole('button', { name: 'Marcar como pagado' }).click();
    await expect(modal.getByRole('alert')).toHaveText('Adjunta el comprobante del pago.');
    await modal.getByRole('button', { name: 'Cancelar' }).click();
    await expect(modal).toBeHidden();
  });

  test('rechaza el retiro y pasa a "Rechazados"', async ({ page }) => {
    await page.goto('/admin/retiros');
    await page.getByRole('tab', { name: /Aprobados/ }).click();
    await filaDelNegocio(page).getByRole('button', { name: 'Rechazar' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Rechazar' }).click();
    await expect(page.getByText('Retiro rechazado')).toBeVisible();

    await page.getByRole('tab', { name: /Rechazados/ }).click();
    await expect(filaDelNegocio(page)).toContainText('RECHAZADO');
  });
});
