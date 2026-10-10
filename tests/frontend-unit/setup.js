/**
 * Preparación común de las pruebas del frontend (Vitest + jsdom):
 *   - agrega los comparadores de Testing Library (toBeInTheDocument, toBeDisabled, ...);
 *   - desmonta los componentes y limpia el localStorage después de cada prueba.
 */
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
  localStorage.clear();
});
