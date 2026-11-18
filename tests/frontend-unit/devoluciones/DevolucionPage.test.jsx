/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *  PRUEBA UNITARIA (FRONTEND) · Terminal de devolución de saldo (Sprint 3, Módulo A)
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 *  QUÉ VERIFICA
 *    La pantalla real del encargado de devoluciones
 *    (frontend/src/modules/devoluciones/DevolucionPage.jsx) con la API SIMULADA:
 *      1. Inicio: evento con su plazo y botón "Escanear Manilla"; avisos si no hay eventos
 *         asignados o si el plazo de todos ya venció.
 *      2. Devolución completa (Figma p28–31): escanear → ver foto, nombre y saldo → confirmar la
 *         identidad → "Confirmar Devolución" → "Devolución Exitosa", enviando el monto visto,
 *         la identidad verificada y la clave anti-duplicado.
 *      3. Identidad (regla 3 del backlog): sin marcar la casilla no se puede devolver; sin foto
 *         de ingreso se pide verificar el carnet.
 *      4. Sin saldo o plazo vencido: no aparece el botón de devolver.
 *      5. Rechazos: si el saldo cambió se vuelve a consultar y se muestra el monto nuevo; sin
 *         conexión se avisa que NO entregue el efectivo y el reintento usa la MISMA clave.
 *
 *  POR QUÉ IMPORTA
 *    El encargado entrega efectivo. Estas pruebas detectan, por ejemplo, que se pueda devolver
 *    sin confirmar la identidad o que un reintento genere una clave nueva (y pague dos veces).
 *
 *  CÓDIGO PROBADO
 *    frontend/src/modules/devoluciones/DevolucionPage.jsx
 *    (la API, la sesión, el escáner de cámara y los sonidos se simulan)
 *
 *  CÓMO EJECUTARLA
 *    cd tests
 *    npm run test:frontend                                               (todas las del frontend)
 *    npx vitest run frontend-unit/devoluciones/DevolucionPage.test.jsx   (solo este archivo)
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
import DevolucionPage from '../../../frontend/src/modules/devoluciones/DevolucionPage';
import {
  consultarClienteDevolucion,
  devolverSaldo,
  getDevolucionesContexto,
} from '../../../frontend/src/api/recargas.api';

vi.mock('../../../frontend/src/api/recargas.api', () => ({
  getDevolucionesContexto: vi.fn(),
  consultarClienteDevolucion: vi.fn(),
  devolverSaldo: vi.fn(),
}));
vi.mock('../../../frontend/src/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'encargado-1' } }),
}));
vi.mock('../../../frontend/src/utils/feedback', () => ({
  feedbackOk: vi.fn(),
  feedbackError: vi.fn(),
}));
// El escáner real usa la cámara; aquí un botón "escanea" la manilla MNL-0847.
vi.mock('../../../frontend/src/modules/pos/components/CodigoScanner', () => ({
  default: ({ onCodigo }) => (
    <button type="button" onClick={() => onCodigo('MNL-0847')}>
      Simular escaneo
    </button>
  ),
}));

const PLAZO = { fechaLimite: '2026-12-07', vencido: false, diasRestantes: 26 };
const contexto = (eventos) => ({
  hoy: '2026-11-12',
  eventos: eventos ?? [
    {
      id: 'ev1',
      titulo: 'TechSummit 2026',
      fechaInicio: '2026-11-07',
      fechaFin: '2026-11-07',
      momento: 'FINALIZADO',
      cancelado: false,
      plazo: PLAZO,
      disponible: true,
    },
  ],
});
const CLIENTE = (cambios = {}) => ({
  evento: { id: 'ev1', titulo: 'TechSummit 2026' },
  cliente: { nombre: 'Juan Pérez', documento: '1234567', medio: 'MANILLA', identificador: 'MNL-0847', categoria: 'General' },
  fotoIngreso: { url: 'https://img.test/foto.jpg', tomadaAt: '2026-11-07T15:00:00.000Z' },
  saldo: '120.00',
  montoDevolvible: '120.00',
  plazo: PLAZO,
  puedeDevolver: true,
  motivo: null,
  ultimaDevolucion: null,
  ...cambios,
});
const DEVOLUCION_OK = {
  transaccionId: 'tx1',
  codigo: 'TX-0000ABCD',
  fecha: '2026-11-12T18:05:00.000Z',
  repetido: false,
  evento: 'TechSummit 2026',
  cliente: { nombre: 'Juan Pérez', medio: 'MANILLA', identificador: 'MNL-0847' },
  monto: '120.00',
  saldoAnterior: '120.00',
  saldoResultante: '0.00',
};
const SIN_CONEXION = Object.assign(new Error('Network Error'), { request: {} });
const httpError = (status, data) => Object.assign(new Error('HTTP'), { response: { status, data } });

const renderPagina = () =>
  render(
    <MemoryRouter>
      <DevolucionPage />
    </MemoryRouter>,
  );

async function escanear(user) {
  await user.click(await screen.findByRole('button', { name: /Escanear Manilla/ }));
  await user.click(await screen.findByRole('button', { name: 'Simular escaneo' }));
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  getDevolucionesContexto.mockResolvedValue({ data: contexto() });
  consultarClienteDevolucion.mockResolvedValue({ data: CLIENTE() });
  devolverSaldo.mockResolvedValue({ data: DEVOLUCION_OK });
});

describe('Inicio', () => {
  it('muestra el evento, su plazo y el botón para escanear', async () => {
    renderPagina();
    expect(await screen.findByText('TechSummit 2026')).toBeInTheDocument();
    expect(screen.getByText(/Devoluciones hasta el/)).toHaveTextContent('26 días');
    expect(screen.getByRole('button', { name: /Escanear Manilla/ })).toBeInTheDocument();
  });

  it('sin eventos asignados pide al administrador que lo asigne', async () => {
    getDevolucionesContexto.mockResolvedValue({ data: contexto([]) });
    renderPagina();
    expect(await screen.findByText(/no estás asignado a ningún evento/)).toBeInTheDocument();
  });

  it('si el plazo de todos sus eventos venció, lo avisa y no deja escanear', async () => {
    getDevolucionesContexto.mockResolvedValue({
      data: contexto([
        {
          ...contexto().eventos[0],
          plazo: { fechaLimite: '2026-11-01', vencido: true, diasRestantes: 0 },
          disponible: false,
        },
      ]),
    });
    renderPagina();
    expect(await screen.findByText(/El plazo de devolución de tus eventos ya venció/)).toBeInTheDocument();
    expect(screen.getByText(/Plazo vencido el/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Escanear Manilla/ })).not.toBeInTheDocument();
  });
});

describe('Devolución completa (Figma p28–31)', () => {
  it('escanear → foto y saldo → verificar identidad → confirmar → éxito', async () => {
    const user = userEvent.setup();
    renderPagina();
    await escanear(user);

    expect(consultarClienteDevolucion).toHaveBeenCalledWith({ eventoId: 'ev1', codigo: 'MNL-0847' });
    expect(await screen.findByText('Juan Pérez')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Foto del primer ingreso de Juan Pérez/ })).toHaveAttribute(
      'src',
      'https://img.test/foto.jpg',
    );
    expect(screen.getByText('Documento: 1234567')).toBeInTheDocument();
    expect(screen.getByText('Saldo a devolver')).toBeInTheDocument();

    const devolver = screen.getByRole('button', { name: 'Devolver Saldo' });
    expect(devolver).toBeDisabled();
    await user.click(screen.getByRole('checkbox', { name: /Comparé la foto del primer ingreso/ }));
    await user.click(devolver);

    expect(await screen.findByText('Confirmar Devolución', { selector: 'h1' })).toBeInTheDocument();
    expect(screen.getByText(/Esta acción no se puede deshacer/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Confirmar Devolución/ }));

    expect(await screen.findByText('Devolución Exitosa')).toBeInTheDocument();
    expect(screen.getByText('TX-0000ABCD')).toBeInTheDocument();
    expect(devolverSaldo).toHaveBeenCalledTimes(1);
    const enviado = devolverSaldo.mock.calls[0][0];
    expect(enviado).toEqual({
      eventoId: 'ev1',
      codigo: 'MNL-0847',
      montoEsperado: 120,
      identidadVerificada: true,
      idempotencyKey: expect.any(String),
    });

    await user.click(screen.getByRole('button', { name: 'Nueva Devolución' }));
    expect(await screen.findByRole('button', { name: 'Simular escaneo' })).toBeInTheDocument();
  });

  it('sin foto de ingreso bloquea la devolución', async () => {
    consultarClienteDevolucion.mockResolvedValue({ data: CLIENTE({ fotoIngreso: null }) });
    const user = userEvent.setup();
    renderPagina();
    await escanear(user);
    expect(await screen.findByText('Sin foto de ingreso')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name:'Devolver Saldo'})).not.toBeInTheDocument();
  });

  it('sin saldo no muestra el botón de devolver y explica por qué', async () => {
    consultarClienteDevolucion.mockResolvedValue({
      data: CLIENTE({
        saldo: '0.00',
        montoDevolvible: '0.00',
        puedeDevolver: false,
        motivo: 'El cliente no tiene saldo para devolver en este evento.',
        ultimaDevolucion: { codigo: 'TX-11112222', fecha: '2026-11-10T15:00:00.000Z', monto: '50.00' },
      }),
    });
    const user = userEvent.setup();
    renderPagina();
    await escanear(user);
    expect(await screen.findByText(/no tiene saldo para devolver/)).toBeInTheDocument();
    expect(screen.getByText(/TX-11112222/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Devolver Saldo' })).not.toBeInTheDocument();
  });
});

describe('Rechazos', () => {
  async function hastaConfirmar(user) {
    renderPagina();
    await escanear(user);
    await user.click(await screen.findByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Devolver Saldo' }));
    await user.click(await screen.findByRole('button', { name: /Confirmar Devolución/ }));
  }

  it('si el saldo cambió, vuelve a consultar y muestra el monto nuevo', async () => {
    devolverSaldo.mockRejectedValueOnce(
      httpError(409, { code: 'SALDO_CAMBIO', message: 'El saldo del cliente cambió: ahora tiene Bs 94.00.', saldo: '94.00' }),
    );
    consultarClienteDevolucion
      .mockResolvedValueOnce({ data: CLIENTE() })
      .mockResolvedValueOnce({ data: CLIENTE({ saldo: '94.00', montoDevolvible: '94.00' }) });
    const user = userEvent.setup();
    await hastaConfirmar(user);

    expect(await screen.findByText(/El saldo del cliente cambió/)).toBeInTheDocument();
    expect(consultarClienteDevolucion).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Saldo a devolver').previousSibling).toHaveTextContent('94');
  });

  it('sin conexión pide NO entregar el efectivo y reintenta con la misma clave', async () => {
    devolverSaldo.mockRejectedValueOnce(SIN_CONEXION);
    const user = userEvent.setup();
    await hastaConfirmar(user);

    expect(await screen.findByText(/NO entregues el efectivo todavía/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Reintentar esta devolución/ }));
    expect(await screen.findByText('Devolución Exitosa')).toBeInTheDocument();

    await waitFor(() => expect(devolverSaldo).toHaveBeenCalledTimes(2));
    const [primera, segunda] = devolverSaldo.mock.calls.map((c) => c[0].idempotencyKey);
    expect(segunda).toBe(primera);
  });
});
