/**
 * Configuración de Playwright para las pruebas de punta a punta (carpeta e2e/).
 *
 * - Usa Microsoft Edge instalado en Windows (no descarga navegadores). Para usar el Chromium de
 *   Playwright: `npx playwright install chromium` y luego `set PW_CHANNEL=chromium` (cmd) o
 *   `$env:PW_CHANNEL="chromium"` (PowerShell) antes de correr las pruebas.
 * - Levanta el backend (puerto 3000) y el frontend (puerto 5173) si no están corriendo; si ya lo
 *   están (p. ej. con `npm run start:dev` y `npm run dev`), los reutiliza.
 * - Corre los archivos en orden (01-, 02-, ...) y de a uno: comparten el escenario de prueba.
 */
import path from 'path';
import { defineConfig } from '@playwright/test';

// El escenario de prueba (integracion/helpers/escenario.ts) importa @prisma/client y otras
// librerías del backend: se resuelven desde backend/node_modules, como en las pruebas de Jest.
// Los procesos de Playwright heredan esta variable.
process.env.NODE_PATH = [path.resolve(__dirname, '../backend/node_modules'), process.env.NODE_PATH]
  .filter(Boolean)
  .join(path.delimiter);
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('module').Module._initPaths();

export const FRONTEND_URL = process.env.E2E_FRONTEND_URL || 'http://localhost:5173';
export const API_URL = process.env.E2E_API_URL || 'http://127.0.0.1:3000/api';

export default defineConfig({
  testDir: './e2e',
  testMatch: /\d+-.*\.spec\.ts$/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // La base remota es lenta (~180 ms por consulta): cada prueba tiene hasta 2 minutos.
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: [['list'], ['html', { outputFolder: 'e2e-reporte', open: 'never' }]],
  globalSetup: './e2e/setup/global-setup.ts',
  globalTeardown: './e2e/setup/global-teardown.ts',
  outputDir: 'e2e-resultados',
  use: {
    baseURL: FRONTEND_URL,
    // PW_CHANNEL=chromium usa el navegador que descarga Playwright (sin channel).
    channel: process.env.PW_CHANNEL === 'chromium' ? undefined : process.env.PW_CHANNEL || 'msedge',
    navigationTimeout: 30_000,
    actionTimeout: 20_000,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    locale: 'es-BO',
    timezoneId: 'America/La_Paz',
  },
  webServer: [
    {
      command: 'npm run start:dev',
      cwd: path.resolve(__dirname, '../backend'),
      url: `${API_URL}/eventos/public`,
      reuseExistingServer: true,
      timeout: 180_000,
    },
    {
      command: 'npm run dev',
      cwd: path.resolve(__dirname, '../frontend'),
      url: FRONTEND_URL,
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
