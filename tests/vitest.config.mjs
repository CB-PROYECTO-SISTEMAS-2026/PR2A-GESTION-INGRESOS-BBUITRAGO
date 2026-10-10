/**
 * Configuración de Vitest para las pruebas unitarias del FRONTEND (carpeta frontend-unit/).
 *
 * - Prueban el código real de frontend/src con React Testing Library, en un navegador simulado
 *   (jsdom): no hace falta levantar el frontend, el backend ni la base de datos.
 * - React, React DOM y React Router se toman de frontend/node_modules (una sola copia; dos
 *   copias de React rompen los hooks). Por eso tests/.npmrc no instala las dependencias "peer".
 * - Las llamadas a la API se reemplazan en cada prueba con vi.mock (nunca se llama al backend).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const frontendModules = path.resolve(aqui, '../frontend/node_modules');
const testingLibrary = path.resolve(aqui, 'node_modules/@testing-library');

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Versiones ESM de Testing Library: así sus `import 'react'` pasan por estos alias.
      '@testing-library/react': path.join(testingLibrary, 'react/dist/@testing-library/react.esm.js'),
      '@testing-library/dom': path.join(testingLibrary, 'dom/dist/@testing-library/dom.esm.js'),
      react: path.join(frontendModules, 'react'),
      'react-dom': path.join(frontendModules, 'react-dom'),
      'react-router-dom': path.join(frontendModules, 'react-router-dom'),
      'react-router': path.join(frontendModules, 'react-router'),
    },
    dedupe: ['react', 'react-dom'],
  },
  test: {
    include: ['frontend-unit/**/*.test.{js,jsx}'],
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./frontend-unit/setup.js'],
    // La API real nunca se usa (se simula), pero axios.js exige la variable para cargar.
    env: { VITE_API_URL: 'http://api.prueba.test/api', TZ: 'America/La_Paz' },
    server: {
      // Se procesan con Vite (y no con Node) para que usen el mismo React de frontend/node_modules.
      deps: { inline: [/@testing-library/, /react-router/] },
    },
    restoreMocks: true,
  },
});
