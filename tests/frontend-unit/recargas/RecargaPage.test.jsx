/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *  PRUEBA UNITARIA (FRONTEND) · Terminal del recargador de saldo (Módulo D)
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 *  QUÉ VERIFICA
 *    La pantalla real del recargador (frontend/src/modules/recargas/RecargaPage.jsx) con la API
 *    SIMULADA:
 *      1. Inicio: evento abierto y botón "Escanear Manilla"; aviso si no está asignado a eventos.
 *      2. Recarga completa (Figma p24–27): escanear → elegir monto → confirmar → "Recarga
 *         Exitosa", enviando solo evento, código, monto, efectivo y la clave anti-duplicado.
 *      3. Montos (HU-047): mínimo, máximo, decimales y saldo máximo del cliente en el evento.
 *      4. Sin conexión (HU-047): la recarga queda PENDIENTE en el celular, se avisa que no se
 *         repita y se reintenta con la MISMA clave (al tocar el botón o al abrir la pantalla).
 *         Si el servidor la rechaza, se descarta y se pide devolver el efectivo.
 *      5. Rechazos del servidor (saldo máximo, recargador no asignado).
 *
 *  POR QUÉ IMPORTA
 *    El recargador recibe efectivo en la fila. Estas pruebas detectan, por ejemplo, que un
 *    reintento genere una clave nueva (y acredite dos veces) o que una recarga sin respuesta
 *    se pierda sin aviso.
 *
 *  CÓDIGO PROBADO
 *    frontend/src/modules/recargas/RecargaPage.jsx
 *    frontend/src/utils/storage.js
 *    (la API, la sesión, el escáner de cámara, los avisos y los sonidos se simulan)
 *
 *  CÓMO EJECUTARLA
 *    cd tests
 *    npm run test:frontend                                        (todas las del frontend)
 *    npx vitest run frontend-unit/recargas/RecargaPage.test.jsx   (solo este archivo)
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
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RecargaPage from '../../../frontend/src/modules/recargas/RecargaPage';
import {
  consultarClienteRecarga,
  getRecargasContexto,
  recargar,
} from '../../../frontend/src/api/recargas.api';
import { toast } from '../../../frontend/src/components/Toast';

vi.mock('../../../frontend/src/api/recargas.api', () => ({
  getRecargasContexto: vi.fn(),
  consultarClienteRecarga: vi.fn(),
  recargar: vi.fn(),
}));
vi.mock('../../../frontend/src/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'recargador-1' } }),
}));
vi.mock('../../../frontend/src/utils/feedback', () => ({
  feedbackOk: vi.fn(),
  feedbackError: vi.fn(),
}));
vi.mock('../../../frontend/src/components/Toast', () => ({ toast: vi.fn() }));
// El escáner real usa la cámara; aquí un botón "escanea" la manilla MNL-1.
vi.mock('../../../frontend/src/modules/pos/components/CodigoScanner', () => ({
  default: ({ onCodigo }) => (
    <button type="button" onClick={() => onCodigo('MNL-1')}>
      Simular escaneo
    </button>
  ),
}));

const PENDIENTES_KEY = 'eventix_recargas_pendientes:recargador-1';

const contexto = (cambios = {}) => ({
  hoy: '2026-10-10',
  limites: { minimo: '10.00', maximo: '1000.00', saldoMaximo: '5000.00' },
  montosRapidos: ['20.00', '50.00', '100.00', '200.00'],
  metodosPago: ['EFECTIVO'],
  eventos: [
    { id: 'ev1', titulo: 'Feria abierta', fechaInicio: '2026-10-10', fechaFin: '2026-10-10', enCurso: true, horarioHoy: '08:00 – 22:00' },
  ],
  ...cambios,
});
const CLIENTE = (saldo = '120.00', maxRecargable = '1000.00') => ({
  cliente: { nombre: 'Juan Pérez', medio: 'MANILLA', identificador: 'MNL-1', categoria: 'General' },
  saldo,
  maxRecargable,
});
const RECARGA_OK = (cambios = {}) => ({
  transaccionId: 'tx1',
  codigo: 'TX-0000ABCD',
  fecha: '2026-10-10T18:05:00.000Z',
  repetido: false,
  estado: 'COMPLETADA',
  metodoPago: 'EFECTIVO',
  evento: 'Feria abierta',
  cliente: { nombre: 'Juan Pérez', medio: 'MANILLA', identificador: 'MNL-1' },
  monto: '50.00',
  saldoAnterior: '120.00',
  saldoResultante: '170.00',
  ...cambios,
});
const SIN_CONEXION = Object.assign(new Error('Network Error'), { request: {} });
const httpError = (status, data) => Object.assign(new Error('HTTP'), { response: { status, data } });

const renderPagina = () =>
  render(
    <MemoryRouter>
      <RecargaPage />
    </MemoryRouter>,
  );

/** Escanea la manilla y llega a la pantalla de elegir monto. */
async function llegarAMonto(user) {
  await user.click(await screen.findByRole('button', { name: /Escanear Manilla/ }));
  await user.click(await screen.findByRole('button', { name: 'Simular escaneo' }));
  await screen.findByText('Recargar Saldo');
}

/** Elige el monto y llega a la confirmación. */
async function llegarAConfirmar(user, monto = 'Bs 50') {
  await llegarAMonto(user);
  await user.click(screen.getByRole('button', { name: monto }));
  await user.click(screen.getByRole('button', { name: 'Recargar' }));
  await screen.findByRole('heading', { name: 'Confirmar Recarga' });
}

beforeEach(() => {
  vi.clearAllMocks();
  getRecargasContexto.mockResolvedValue({ data: contexto() });
  consultarClienteRecarga.mockResolvedValue({ data: CLIENTE() });
});

describe('Inicio', () => {
  it('muestra el evento abierto y el botón para escanear', async () => {
    renderPagina();
    expect(await screen.findByText('Recargador de Saldo')).toBeInTheDocument();
    expect(screen.getByText('Feria abierta')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Escanear Manilla/ })).toBeInTheDocument();
  });

  it('avisa si el recargador no está asignado a ningún evento', async () => {
    getRecargasContexto.mockResolvedValue({ data: contexto({ eventos: [] }) });
    renderPagina();
    expect(await screen.findByText(/no estás asignado a ningún evento/)).toBeInTheDocument();
  });

  it('muestra el error del servidor si no se puede identificar al cliente', async () => {
    consultarClienteRecarga.mockRejectedValue(httpError(403, { message: 'No estás asignado como recargador en este evento.' }));
    const user = userEvent.setup();
    renderPagina();
    await user.click(await screen.findByRole('button', { name: /Escanear Manilla/ }));
    await user.click(await screen.findByRole('button', { name: 'Simular escaneo' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No estás asignado como recargador en este evento.');
  });
});

describe('Recarga completa', () => {
  it('escanear → monto → confirmar → Recarga Exitosa, enviando solo lo necesario', async () => {
    recargar.mockResolvedValue({ data: RECARGA_OK() });
    const user = userEvent.setup();
    renderPagina();
    await llegarAConfirmar(user);

    expect(screen.getByText('Bs 170')).toBeInTheDocument(); // 120 + 50
    expect(screen.getByText(/en efectivo/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Confirmar Recarga/ }));

    expect(await screen.findByText('Recarga Exitosa')).toBeInTheDocument();
    expect(screen.getByText('TX-0000ABCD')).toBeInTheDocument();
    expect(recargar).toHaveBeenCalledTimes(1);
    const body = recargar.mock.calls[0][0];
    expect(Object.keys(body).sort()).toEqual(['codigo', 'eventoId', 'idempotencyKey', 'metodoPago', 'monto']);
    expect(body).toMatchObject({ eventoId: 'ev1', codigo: 'MNL-1', monto: 50, metodoPago: 'EFECTIVO' });
    expect(body.idempotencyKey).toMatch(/^[A-Za-z0-9-]{20,64}$/);
    expect(localStorage.getItem(PENDIENTES_KEY)).toBeNull();
  });

  it('"Nueva Recarga" vuelve a escanear con una clave nueva', async () => {
    recargar.mockResolvedValue({ data: RECARGA_OK() });
    const user = userEvent.setup();
    renderPagina();
    await llegarAConfirmar(user);
    await user.click(screen.getByRole('button', { name: /Confirmar Recarga/ }));
    await user.click(await screen.findByRole('button', { name: /Nueva Recarga/ }));

    await user.click(await screen.findByRole('button', { name: 'Simular escaneo' }));
    await screen.findByText('Recargar Saldo');
    await user.click(screen.getByRole('button', { name: 'Bs 20' }));
    await user.click(screen.getByRole('button', { name: 'Recargar' }));
    await user.click(await screen.findByRole('button', { name: /Confirmar Recarga/ }));
    await screen.findByText('Recarga Exitosa');

    const [primera, segunda] = recargar.mock.calls.map(([b]) => b.idempotencyKey);
    expect(primera).not.toBe(segunda);
  });
});

describe('Montos (HU-047)', () => {
  it.each([
    ['5', 'El monto mínimo es Bs 10.'],
    ['1500', 'El monto máximo por recarga es Bs 1.000.'],
    ['10.555', 'Ingresa un monto válido (hasta 2 decimales).'],
  ])('"Otro monto" %s muestra el error y no deja continuar', async (monto, mensaje) => {
    const user = userEvent.setup();
    renderPagina();
    await llegarAMonto(user);
    await user.type(screen.getByLabelText('Otro monto'), monto);
    expect(screen.getByRole('alert')).toHaveTextContent(mensaje);
    expect(screen.getByRole('button', { name: 'Recargar' })).toBeDisabled();
  });

  it('acepta otro monto con coma decimal', async () => {
    recargar.mockResolvedValue({ data: RECARGA_OK({ monto: '12.50' }) });
    const user = userEvent.setup();
    renderPagina();
    await llegarAMonto(user);
    await user.type(screen.getByLabelText('Otro monto'), '12,5');
    await user.click(screen.getByRole('button', { name: 'Recargar' }));
    await user.click(await screen.findByRole('button', { name: /Confirmar Recarga/ }));
    await screen.findByText('Recarga Exitosa');
    expect(recargar.mock.calls[0][0].monto).toBe(12.5);
  });

  it('no deja pasar el saldo máximo del cliente en el evento', async () => {
    consultarClienteRecarga.mockResolvedValue({ data: CLIENTE('4940.00', '60.00') });
    const user = userEvent.setup();
    renderPagina();
    await llegarAMonto(user);
    expect(screen.getByRole('button', { name: 'Bs 50' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Bs 100' })).toBeDisabled();
    await user.type(screen.getByLabelText('Otro monto'), '70');
    expect(screen.getByRole('alert')).toHaveTextContent('solo se le pueden recargar Bs 60');
  });

  it('si el cliente ya tiene el saldo máximo, no ofrece recargar', async () => {
    consultarClienteRecarga.mockResolvedValue({ data: CLIENTE('5000.00', '0.00') });
    const user = userEvent.setup();
    renderPagina();
    await llegarAMonto(user);
    expect(screen.getByRole('alert')).toHaveTextContent('ya tiene el saldo máximo');
    expect(screen.queryByRole('button', { name: 'Recargar' })).not.toBeInTheDocument();
  });
});

describe('Sin conexión: recargas pendientes (HU-047)', () => {
  it('si no llega la respuesta, la recarga queda pendiente y el reintento usa la MISMA clave', async () => {
    recargar.mockRejectedValueOnce(SIN_CONEXION).mockResolvedValueOnce({ data: RECARGA_OK({ repetido: true }) });
    const user = userEvent.setup();
    renderPagina();
    await llegarAConfirmar(user);
    await user.click(screen.getByRole('button', { name: /Confirmar Recarga/ }));

    expect(await screen.findByText('Recarga pendiente')).toBeInTheDocument();
    expect(screen.getByText(/no vuelvas a cobrarle al cliente/)).toBeInTheDocument();
    expect(screen.getByText('1 recarga sin confirmar')).toBeInTheDocument();
    const guardadas = JSON.parse(localStorage.getItem(PENDIENTES_KEY));
    expect(guardadas).toHaveLength(1);
    expect(guardadas[0]).toMatchObject({ eventoId: 'ev1', codigo: 'MNL-1', monto: 50, cliente: 'Juan Pérez' });

    await user.click(screen.getByRole('button', { name: /Reintentar esta recarga/ }));
    expect(await screen.findByText('Recarga Exitosa')).toBeInTheDocument();
    expect(screen.getByText(/no se acreditó otra vez/)).toBeInTheDocument();

    const [primera, reintento] = recargar.mock.calls.map(([b]) => b.idempotencyKey);
    expect(reintento).toBe(primera);
    expect(guardadas[0].clave).toBe(primera);
    expect(localStorage.getItem(PENDIENTES_KEY)).toBeNull();
  });

  it('al abrir la pantalla reintenta sola las recargas pendientes con su clave', async () => {
    localStorage.setItem(
      PENDIENTES_KEY,
      JSON.stringify([{ clave: 'clave-pendiente-0000000001', eventoId: 'ev1', codigo: 'MNL-1', monto: 30, cliente: 'Juan Pérez' }]),
    );
    recargar.mockResolvedValue({ data: RECARGA_OK({ monto: '30.00', repetido: true }) });
    renderPagina();

    await waitFor(() => expect(localStorage.getItem(PENDIENTES_KEY)).toBeNull());
    expect(recargar).toHaveBeenCalledWith({
      eventoId: 'ev1',
      codigo: 'MNL-1',
      monto: 30,
      metodoPago: 'EFECTIVO',
      idempotencyKey: 'clave-pendiente-0000000001',
    });
    expect(toast).toHaveBeenCalledWith(expect.stringContaining('confirmada'), 'success');
  });

  it('si sigue sin conexión, la recarga pendiente se conserva', async () => {
    localStorage.setItem(
      PENDIENTES_KEY,
      JSON.stringify([{ clave: 'clave-pendiente-0000000002', eventoId: 'ev1', codigo: 'MNL-1', monto: 30, cliente: 'Juan Pérez' }]),
    );
    recargar.mockRejectedValue(SIN_CONEXION);
    renderPagina();

    expect(await screen.findByText('1 recarga sin confirmar')).toBeInTheDocument();
    await waitFor(() => expect(recargar).toHaveBeenCalled());
    expect(JSON.parse(localStorage.getItem(PENDIENTES_KEY))).toHaveLength(1);
  });

  it('si el servidor rechaza una pendiente, se descarta y se pide devolver el efectivo', async () => {
    localStorage.setItem(
      PENDIENTES_KEY,
      JSON.stringify([{ clave: 'clave-pendiente-0000000003', eventoId: 'ev1', codigo: 'MNL-1', monto: 30, cliente: 'Juan Pérez' }]),
    );
    recargar.mockRejectedValue(httpError(400, { message: 'Solo se puede recargar durante el horario del evento.' }));
    renderPagina();

    await waitFor(() => expect(localStorage.getItem(PENDIENTES_KEY)).toBeNull());
    expect(toast).toHaveBeenCalledWith(expect.stringContaining('Devuelve el efectivo'), 'error');
  });
});

describe('Rechazos del servidor', () => {
  it('saldo máximo superado (409): rechazo visible y la recarga no queda pendiente', async () => {
    recargar.mockRejectedValue(
      httpError(409, {
        code: 'SALDO_MAXIMO',
        message: 'El saldo máximo por evento es Bs 5000.00. El cliente tiene Bs 4990.00 y solo se le pueden recargar Bs 10.00.',
        saldo: '4990.00',
        maxRecargable: '10.00',
      }),
    );
    const user = userEvent.setup();
    renderPagina();
    await llegarAConfirmar(user);
    await user.click(screen.getByRole('button', { name: /Confirmar Recarga/ }));

    expect(await screen.findByText('Recarga rechazada')).toBeInTheDocument();
    expect(screen.getByText(/solo se le pueden recargar Bs 10.00/)).toBeInTheDocument();
    expect(localStorage.getItem(PENDIENTES_KEY)).toBeNull();
    expect(screen.queryByText(/sin confirmar/)).not.toBeInTheDocument();
  });
});
