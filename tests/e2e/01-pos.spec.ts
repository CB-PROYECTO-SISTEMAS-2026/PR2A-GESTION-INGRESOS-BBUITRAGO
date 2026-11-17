/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *  PRUEBA E2E (navegador) · Login y punto de venta del ayudante en el celular (Módulo E)
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 *  QUÉ VERIFICA
 *    Abre la aplicación real en un navegador con tamaño de celular y hace lo mismo que haría el
 *    ayudante en la fila:
 *      1. Inicia sesión con el formulario y llega directo al punto de venta.
 *      2. Arma un pedido, lo cobra con la manilla (ingresando el código a mano, porque el
 *         navegador de prueba no tiene cámara) y ve el comprobante y el nuevo saldo.
 *      3. Ve la venta en "Mis ventas" con el total del día.
 *      4. Con un pedido mayor al saldo, el cobro aparece RECHAZADO y no se puede confirmar.
 *      5. No puede agregar más unidades de las que hay en stock.
 *      6. Un código inexistente muestra un mensaje claro.
 *
 *  POR QUÉ IMPORTA
 *    Las pruebas de integración verifican el servidor; esta verifica que la pantalla del
 *    celular realmente permita cobrar (botones, pasos, mensajes) de punta a punta.
 *
 *  CÓDIGO PROBADO
 *    frontend/src/modules/auth/LoginPage.jsx, frontend/src/modules/pos/ (POS completo)
 *    y, por debajo, toda la API del Módulo E.
 *
 *  CÓMO EJECUTARLA
 *    cd tests
 *    npm run test:e2e                         (todas las e2e, en orden)
 *    npx playwright test 01-pos               (solo este archivo)
 *    npm run test:e2e:ver                     (con el navegador visible, para mirar)
 *
 *  REQUISITOS
 *    backend/.env, backend/prisma/ca.pem, frontend/.env e internet. El backend y el frontend se
 *    levantan solos si no están corriendo. Usa Microsoft Edge (ver playwright.config.ts).
 *
 *  CÓMO LEER EL RESULTADO
 *    Si una prueba falla, Playwright guarda una captura y un "trace" en e2e-resultados/ y un
 *    informe en e2e-reporte/ (`npx playwright show-report e2e-reporte` lo abre en el navegador,
 *    con cada paso, captura y petición de red).
 *
 *  SI FALLA
 *    Los pasos de este archivo dependen entre sí (el saldo baja con cada cobro): arregla primero
 *    la primera prueba que falló. Revisa la captura: suele mostrar el mensaje de error de la
 *    pantalla.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
import { expect, test } from '@playwright/test';
import { DatosE2E, leerDatos, sesion, vigilarErrores } from './helpers/datos';

const CELULAR = { width: 390, height: 844 };
let datos: DatosE2E;

test.beforeAll(() => {
  datos = leerDatos();
});

test.describe('Login', () => {
  test.use({ viewport: CELULAR, storageState: { cookies: [], origins: [] } });

  test('el ayudante inicia sesión y llega directo al punto de venta', async ({ page }) => {
    const errores = vigilarErrores(page);
    await page.goto('/login');
    await page.locator('input[type=email]').fill(datos.emails.ayudante);
    await page.locator('input[type=password]').fill(datos.clave);
    await page.locator('button[type=submit]').click();

    await expect(page).toHaveURL(/\/pos$/);
    await expect(page.getByRole('link', { name: 'Vender' })).toBeVisible();
    expect(errores).toEqual([]);
  });

  test('una contraseña incorrecta muestra un error y no entra', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type=email]').fill(datos.emails.ayudante);
    await page.locator('input[type=password]').fill('ContraseñaIncorrecta1!');
    await page.locator('button[type=submit]').click();

    await expect(page.getByText('Credenciales inválidas')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe.serial('Punto de venta del ayudante', () => {
  test.use({ viewport: CELULAR, storageState: sesion('ayudante') });

  test('cobra un pedido con la manilla y muestra el comprobante', async ({ page }) => {
    const errores = vigilarErrores(page);
    await page.goto('/pos');
    await expect(page.getByRole('heading', { name: /Puesto .* — Ventas/ })).toBeVisible();
    await expect(page.getByText(/Evento: \[PRUEBA-AUTO\] Feria abierta/)).toBeVisible();

    await page.getByLabel('Agregar Empanada').click();
    await page.getByLabel('Agregar Refresco').click();
    await expect(page.getByText('Bs 16').first()).toBeVisible();
    await page.getByRole('button', { name: 'Ver carrito' }).click();
    await page.getByRole('button', { name: /Cobrar con manilla/ }).click();

    // El navegador de prueba no tiene cámara: se usa el ingreso manual del código.
    await page.locator('#codigo-manual').fill(datos.escenario.codigos.manilla);
    await page.getByRole('button', { name: 'Buscar' }).click();
    await expect(page.getByText('Prueba cliente Auto')).toBeVisible();
    await expect(page.getByText('Saldo disponible')).toBeVisible();
    await page.getByRole('button', { name: /Confirmar cobro/ }).click();

    await expect(page.getByText('Pago exitoso')).toBeVisible();
    await expect(page.getByText(/Transacción TX-[0-9A-Z]{8}/)).toBeVisible();
    const comprobante = page.locator('dl');
    await expect(comprobante.getByText('Bs 16')).toBeVisible(); // total cobrado
    await expect(comprobante.getByText('Bs 84')).toBeVisible(); // nuevo saldo (100 - 16)
    expect(errores).toEqual([]);
  });

  test('la venta aparece en "Mis ventas" con el total del día', async ({ page }) => {
    await page.goto('/pos/historial');
    await expect(page.getByText('Total del día')).toBeVisible();
    await expect(page.getByText('Prueba cliente Auto')).toBeVisible();
    await expect(page.getByText(/1x Empanada/)).toBeVisible();
    await expect(page.getByText('Bs 16').first()).toBeVisible();
  });

  test('si el pedido supera el saldo, el cobro aparece rechazado y no se puede confirmar', async ({ page }) => {
    await page.goto('/pos');
    for (let i = 0; i < 9; i++) await page.getByLabel('Agregar Empanada').click(); // Bs 90 > Bs 84
    await page.getByRole('button', { name: 'Ver carrito' }).click();
    await page.getByRole('button', { name: /Cobrar con manilla/ }).click();
    await page.locator('#codigo-manual').fill(datos.escenario.codigos.qr);
    await page.getByRole('button', { name: 'Buscar' }).click();

    await expect(page.getByText('Cobro rechazado')).toBeVisible();
    await expect(page.getByText(/faltan Bs 6/)).toBeVisible();
    await expect(page.getByRole('button', { name: /Confirmar cobro/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Escanear otra manilla' })).toBeVisible();
  });

  test('no deja agregar más unidades de las que hay en stock', async ({ page }) => {
    await page.goto('/pos');
    await expect(page.getByText('Quedan 2')).toBeVisible();
    const agregar = page.getByLabel('Agregar Producto con stock');
    await agregar.click();
    await agregar.click();
    await expect(agregar).toBeDisabled();
  });

  test('un código inexistente muestra un mensaje claro', async ({ page }) => {
    await page.goto('/pos');
    await page.getByLabel('Agregar Refresco').click();
    await page.getByRole('button', { name: 'Ver carrito' }).click();
    await page.getByRole('button', { name: /Cobrar con manilla/ }).click();
    await page.locator('#codigo-manual').fill('CODIGO-QUE-NO-EXISTE');
    await page.getByRole('button', { name: 'Buscar' }).click();

    await expect(page.getByRole('alert')).toHaveText('No se encontró ninguna entrada o manilla con ese código.');
  });
});
