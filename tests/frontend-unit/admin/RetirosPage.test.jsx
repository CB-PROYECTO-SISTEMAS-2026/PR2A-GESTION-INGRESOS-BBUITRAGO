/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *  PRUEBA UNITARIA (FRONTEND) · Pantalla de retiros del administrador (HU-025)
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 *  QUÉ VERIFICA
 *    frontend/src/modules/admin/RetirosPage.jsx con la API SIMULADA:
 *      1. REGRESIÓN: al cambiar rápido de pestaña, una respuesta lenta de la pestaña anterior
 *         NO pisa la tabla de la pestaña nueva. (Este error lo encontraron las pruebas e2e y se
 *         corrigió descartando las respuestas viejas; esta prueba evita que vuelva.)
 *      2. Aprobar pide confirmación y llama a la API con el estado correcto.
 *      3. Registrar el pago exige el comprobante y lo envía como archivo ("evidencia").
 *
 *  POR QUÉ IMPORTA
 *    Si la tabla muestra retiros de otra pestaña, el administrador puede aprobar o pagar algo
 *    que no corresponde.
 *
 *  CÓDIGO PROBADO
 *    frontend/src/modules/admin/RetirosPage.jsx (la API se reemplaza por funciones simuladas)
 *
 *  CÓMO EJECUTARLA
 *    cd tests
 *    npm run test:frontend                                    (todas las del frontend)
 *    npx vitest run frontend-unit/admin/RetirosPage.test.jsx  (solo este archivo)
 *
 *  REQUISITOS
 *    Ninguno: no usa base de datos, backend ni navegador real.
 *
 *  SI FALLA
 *    Si falla la prueba de regresión, revisa que `cargar()` siga descartando las respuestas de
 *    peticiones anteriores (ultimaPeticion en RetirosPage.jsx).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import RetirosPage from '../../../frontend/src/modules/admin/RetirosPage';
import { ConfirmHost } from '../../../frontend/src/components/ui/ConfirmDialog';
import { ToastHost } from '../../../frontend/src/components/Toast';
import { cambiarEstadoRetiro, getRetirosAdmin, pagarRetiro } from '../../../frontend/src/api/pos.api';

vi.mock('../../../frontend/src/api/pos.api', () => ({
  getRetirosAdmin: vi.fn(),
  cambiarEstadoRetiro: vi.fn(),
  pagarRetiro: vi.fn(),
}));

const RESUMEN = ['SOLICITADO', 'APROBADO', 'PAGADO', 'RECHAZADO'].map((estado) => ({
  estado,
  cantidad: 1,
  monto: '30.00',
}));
const retiro = (estado, negocio) => ({
  id: `r-${estado}`,
  monto: '30.00',
  estado,
  evidenciaUrl: null,
  fecha: '2026-10-10T16:00:00.000Z',
  negocio,
  dueno: 'Jefe Prueba',
  email: 'jefe@prueba.test',
});
const respuesta = (estado, negocio) => ({ data: { resumen: RESUMEN, retiros: [retiro(estado, negocio)] } });

/** Promesa que se resuelve cuando la prueba lo decide (para controlar el orden de llegada). */
function diferida() {
  let resolver;
  const promesa = new Promise((r) => (resolver = r));
  return { promesa, resolver };
}

const renderRetiros = () =>
  render(
    <>
      <ToastHost />
      <ConfirmHost />
      <RetirosPage />
    </>,
  );

describe('Pestañas de estado', () => {
  it('REGRESIÓN: una respuesta lenta de la pestaña anterior no pisa la pestaña nueva', async () => {
    const user = userEvent.setup();
    const solicitados = diferida();
    const aprobados = diferida();
    getRetirosAdmin.mockImplementation(({ estado }) =>
      estado === 'SOLICITADO' ? solicitados.promesa : aprobados.promesa,
    );
    renderRetiros();

    // El administrador cambia a "Aprobados" antes de que llegue la respuesta de "Solicitados".
    await user.click(screen.getByRole('tab', { name: /Aprobados/ }));
    await act(async () => aprobados.resolver(respuesta('APROBADO', 'Negocio aprobado')));
    expect(await screen.findByText('Negocio aprobado')).toBeInTheDocument();

    // Ahora llega tarde la respuesta de "Solicitados": debe descartarse.
    await act(async () => solicitados.resolver(respuesta('SOLICITADO', 'Negocio solicitado')));
    expect(screen.getByText('Negocio aprobado')).toBeInTheDocument();
    expect(screen.queryByText('Negocio solicitado')).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Aprobados/ })).toHaveAttribute('aria-selected', 'true');
  });
});

describe('Acciones sobre un retiro', () => {
  it('aprobar pide confirmación y envía el estado APROBADO', async () => {
    const user = userEvent.setup();
    getRetirosAdmin.mockResolvedValue(respuesta('SOLICITADO', 'Puesto Prueba'));
    cambiarEstadoRetiro.mockResolvedValue({ data: {} });
    renderRetiros();

    const fila = (await screen.findByText('Puesto Prueba')).closest('tr');
    await user.click(within(fila).getByRole('button', { name: 'Aprobar' }));
    const dialogo = await screen.findByRole('dialog');
    expect(dialogo).toHaveTextContent('Se aprobará el retiro de Bs 30 para Puesto Prueba');
    await user.click(within(dialogo).getByRole('button', { name: 'Aprobar' }));

    expect(cambiarEstadoRetiro).toHaveBeenCalledWith('r-SOLICITADO', 'APROBADO');
    expect(await screen.findByText('Retiro aprobado')).toBeInTheDocument();
  });

  it('el pago exige el comprobante y lo envía como archivo "evidencia"', async () => {
    const user = userEvent.setup();
    getRetirosAdmin.mockResolvedValue(respuesta('APROBADO', 'Puesto Prueba'));
    pagarRetiro.mockResolvedValue({ data: {} });
    renderRetiros();

    await user.click(screen.getByRole('tab', { name: /Aprobados/ }));
    const fila = (await screen.findByText('Puesto Prueba')).closest('tr');
    await user.click(within(fila).getByRole('button', { name: 'Registrar pago' }));
    const modal = await screen.findByRole('dialog');

    await user.click(within(modal).getByRole('button', { name: 'Marcar como pagado' }));
    expect(within(modal).getByRole('alert')).toHaveTextContent('Adjunta el comprobante del pago.');
    expect(pagarRetiro).not.toHaveBeenCalled();

    const archivo = new File(['comprobante'], 'comprobante.png', { type: 'image/png' });
    await user.upload(within(modal).getByLabelText(/Comprobante de la transferencia/), archivo);
    await user.click(within(modal).getByRole('button', { name: 'Marcar como pagado' }));

    expect(pagarRetiro).toHaveBeenCalledTimes(1);
    const [id, formData] = pagarRetiro.mock.calls[0];
    expect(id).toBe('r-APROBADO');
    expect(formData.get('evidencia')).toBe(archivo);
    expect(await screen.findByText('Pago registrado')).toBeInTheDocument();
  });
});
