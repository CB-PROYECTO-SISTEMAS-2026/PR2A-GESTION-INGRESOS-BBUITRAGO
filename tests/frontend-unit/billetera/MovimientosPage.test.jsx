/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *  PRUEBA DE FRONTEND · Historial de la billetera del cliente (HU-038)
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 *  QUÉ VERIFICA
 *    1. Al abrir la pantalla se ven los movimientos de todos los eventos, cada uno con el nombre
 *       de su evento, y los saldos pendientes con su plazo de retiro.
 *    2. Al elegir un evento se pide solo ese historial y se muestra su saldo y su plazo.
 *
 *  POR QUÉ IMPORTA
 *    El cliente tiene un plazo para retirar su saldo: si no ve en qué evento le queda dinero y
 *    hasta cuándo, puede perderlo.
 *
 *  CÓDIGO PROBADO
 *    frontend/src/modules/billetera/MovimientosPage.jsx
 *    (la API se simula)
 *
 *  CÓMO EJECUTARLA
 *    cd tests
 *    npm run test:frontend                                              (todas las del frontend)
 *    npx vitest run frontend-unit/billetera/MovimientosPage.test.jsx    (solo este archivo)
 *
 *  REQUISITOS
 *    Ninguno: no usa base de datos, backend ni navegador real.
 *
 *  CÓMO LEER EL RESULTADO / SI FALLA
 *    Si falla una búsqueda de texto ("Unable to find..."), Testing Library imprime la pantalla
 *    tal como quedó: busca ahí qué texto cambió. Si el cambio fue intencional, actualiza la
 *    prueba.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MovimientosPage from '../../../frontend/src/modules/billetera/MovimientosPage';
import { getMisMovimientos, getMisSaldos } from '../../../frontend/src/api/recargas.api';

vi.mock('../../../frontend/src/api/recargas.api', () => ({
  getMisMovimientos: vi.fn(),
  getMisSaldos: vi.fn(),
}));

const FERIA = { id: 'ev-1', titulo: 'Feria de Prueba' };
const FESTIVAL = { id: 'ev-2', titulo: 'Festival de Prueba' };

const saldo = (evento, monto) => ({
  eventoId: evento.id,
  titulo: evento.titulo,
  saldo: monto,
  plazoRetiro: { fechaLimite: '2026-12-07', vencido: false },
});

const movimiento = (id, evento, operacion) => ({
  id,
  codigo: `TX-${id}`,
  fecha: '2026-11-07T15:00:00.000Z',
  operacion,
  monto: '50.00',
  saldoResultante: '50.00',
  estado: 'COMPLETADA',
  evento,
});

const TODOS = [movimiento('1', FERIA, 'Recarga en la feria'), movimiento('2', FESTIVAL, 'Recarga en el festival')];

beforeEach(() => {
  getMisSaldos.mockResolvedValue({ data: { saldos: [saldo(FERIA, '50.00'), saldo(FESTIVAL, '0.00')] } });
  getMisMovimientos.mockImplementation(async ({ eventoId }) => ({
    data: {
      evento: eventoId ? FERIA : null,
      saldo: eventoId ? '50.00' : null,
      actualizado: null,
      cantidad: eventoId ? 1 : 2,
      page: 1,
      pageSize: 300,
      movimientos: eventoId ? [TODOS[0]] : TODOS,
    },
  }));
});

const renderPagina = () =>
  render(
    <MemoryRouter initialEntries={['/mi-manilla/movimientos']}>
      <MovimientosPage />
    </MemoryRouter>,
  );

describe('Historial de la billetera', () => {
  it('muestra los movimientos de todos los eventos y los saldos pendientes con su plazo', async () => {
    renderPagina();

    expect(await screen.findByText('Recarga en la feria')).toBeInTheDocument();
    expect(screen.getByText('Recarga en el festival')).toBeInTheDocument();
    expect(getMisMovimientos).toHaveBeenCalledWith({ eventoId: undefined, page: 1, tipo: undefined });
    expect(screen.getByRole('button', { name: 'Todos los eventos' })).toHaveAttribute('aria-pressed', 'true');

    expect(screen.getByText('Saldos pendientes de retiro')).toBeInTheDocument();
    // Solo el evento con saldo aparece como pendiente.
    expect(screen.getAllByText(/Puedes pedir la devolución de este saldo hasta el/)).toHaveLength(1);
    // El nombre del evento sale en su movimiento, además del filtro.
    expect(screen.getAllByText('Festival de Prueba')).toHaveLength(2);
  });

  it('al elegir un evento muestra solo su historial, su saldo y su plazo', async () => {
    const user = userEvent.setup();
    renderPagina();

    await user.click(await screen.findByRole('button', { name: 'Feria de Prueba' }));

    expect(await screen.findByText('Saldo de Feria de Prueba')).toBeInTheDocument();
    expect(getMisMovimientos).toHaveBeenLastCalledWith({ eventoId: 'ev-1', page: 1, tipo: undefined });
    expect(screen.queryByText('Recarga en el festival')).not.toBeInTheDocument();
    expect(screen.queryByText('Saldos pendientes de retiro')).not.toBeInTheDocument();
    expect(screen.getByText(/Puedes pedir la devolución de este saldo hasta el/)).toBeInTheDocument();
  });
});
