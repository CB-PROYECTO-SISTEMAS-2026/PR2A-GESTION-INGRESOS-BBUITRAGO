/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *  PRUEBA UNITARIA (FRONTEND) · Pantalla del punto de venta del ayudante (Módulo E)
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 *  QUÉ VERIFICA
 *    La pantalla real del POS (frontend/src/modules/pos/PosPage.jsx) con la API SIMULADA, para
 *    probar en milisegundos situaciones que contra el servidor real serían lentas o difíciles
 *    de provocar:
 *      1. Catálogo: negocio, evento abierto con su horario, productos y stock ("Quedan 2",
 *         "Agotado"); no deja agregar más de lo que hay.
 *      2. Carrito: el total se calcula sin errores de redondeo (en centavos).
 *      3. Cobro completo: carrito → código del cliente → confirmación → pago exitoso, enviando
 *         al servidor solo productos, cantidades y la clave anti-cobro-duplicado (nunca precios).
 *      4. Saldo insuficiente (HU-023): rechazo visible, aviso sonoro y sin botón para confirmar.
 *      5. Cobro duplicado: si se pierde la respuesta, reintentar usa la MISMA clave; un cobro
 *         nuevo usa una clave distinta.
 *      6. Saldo que cambió mientras se cobraba (409): muestra el saldo actualizado.
 *      7. Errores: código inexistente, ayudante inactivo, sin eventos abiertos.
 *      8. Recuerda el evento elegido por cada usuario.
 *
 *  POR QUÉ IMPORTA
 *    Es la pantalla que usa el ayudante en la fila. Estas pruebas detectan, por ejemplo, que un
 *    cambio en la pantalla vuelva a mandar el precio desde el navegador o que un reintento
 *    genere una clave nueva (y cobre dos veces).
 *
 *  CÓDIGO PROBADO
 *    frontend/src/modules/pos/PosPage.jsx
 *    (la API, la sesión, el escáner de cámara y los sonidos se reemplazan por versiones simuladas)
 *
 *  CÓMO EJECUTARLA
 *    cd tests
 *    npm install                                          (solo la primera vez)
 *    npm run test:frontend                                (todas las del frontend)
 *    npx vitest run frontend-unit/pos/PosPage.test.jsx    (solo este archivo)
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
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PosPage from '../../../frontend/src/modules/pos/PosPage';
import { cobrar, consultarCliente, getPosContexto } from '../../../frontend/src/api/pos.api';
import { feedbackError, feedbackOk } from '../../../frontend/src/utils/feedback';

vi.mock('../../../frontend/src/api/pos.api', () => ({
  getPosContexto: vi.fn(),
  consultarCliente: vi.fn(),
  cobrar: vi.fn(),
}));
vi.mock('../../../frontend/src/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'ayudante-1' } }),
}));
vi.mock('../../../frontend/src/utils/feedback', () => ({
  feedbackOk: vi.fn(),
  feedbackError: vi.fn(),
}));
// El escáner real usa la cámara; aquí un botón "escanea" la manilla MNL-1.
vi.mock('../../../frontend/src/modules/pos/components/CodigoScanner', () => ({
  default: ({ onCodigo }) => (
    <button type="button" onClick={() => onCodigo('MNL-1')}>
      Simular escaneo
    </button>
  ),
}));

const EVENTO_ABIERTO = {
  id: 'ev1',
  titulo: 'Feria abierta',
  fechaInicio: '2026-10-10',
  fechaFin: '2026-10-10',
  enCurso: true,
  horarioHoy: '08:00 – 22:00',
};
const EVENTO_FUTURO = {
  id: 'ev2',
  titulo: 'Concierto',
  fechaInicio: '2026-10-18',
  fechaFin: '2026-10-18',
  enCurso: false,
  horarioHoy: null,
};
const contexto = (cambios = {}) => ({
  negocio: { id: 'n1', nombre: 'Puesto Prueba' },
  hoy: '2026-10-10',
  eventos: [EVENTO_ABIERTO, EVENTO_FUTURO],
  productos: [
    { id: 'p1', nombre: 'Empanada', precio: '10.00', descripcion: null, stock: null },
    { id: 'p2', nombre: 'Refresco', precio: '6.50', descripcion: 'Botella 500 ml', stock: null },
    { id: 'p3', nombre: 'Api', precio: '8.00', descripcion: null, stock: 2 },
    { id: 'p4', nombre: 'Salteña', precio: '7.00', descripcion: null, stock: 0 },
  ],
  ...cambios,
});
const CLIENTE = (saldo) => ({
  cliente: { nombre: 'Ana Pérez', medio: 'MANILLA', identificador: 'MNL-1', categoria: 'General' },
  saldo,
});
const COBRO_OK = {
  ventaId: 'v1',
  codigo: 'TX-ABCDEFGH',
  fecha: '2026-10-10T18:05:00.000Z',
  repetido: false,
  negocio: 'Puesto Prueba',
  cliente: { nombre: 'Ana Pérez' },
  total: '20.00',
  saldoResultante: '30.00',
};

const renderPos = () =>
  render(
    <MemoryRouter>
      <PosPage />
    </MemoryRouter>,
  );

/** Agrega productos, abre el carrito, "escanea" la manilla y llega a la confirmación. */
async function llegarAConfirmacion(user, productos) {
  for (const [nombre, veces] of productos) {
    for (let i = 0; i < veces; i++) await user.click(await screen.findByLabelText(`Agregar ${nombre}`));
  }
  await user.click(screen.getByRole('button', { name: 'Ver carrito' }));
  await user.click(screen.getByRole('button', { name: /Cobrar con manilla o QR/ }));
  await user.click(await screen.findByRole('button', { name: 'Simular escaneo' }));
  await screen.findByText('Ana Pérez');
}

beforeEach(() => {
  getPosContexto.mockResolvedValue({ data: contexto() });
});

describe('Catálogo', () => {
  it('muestra el negocio, el evento abierto con su horario y los productos', async () => {
    renderPos();
    expect(await screen.findByRole('heading', { name: 'Puesto Prueba — Ventas' })).toBeInTheDocument();
    expect(screen.getByText(/Evento: Feria abierta/)).toHaveTextContent('Hoy 08:00 – 22:00');
    expect(screen.getByText('Empanada')).toBeInTheDocument();
    expect(screen.getByText('Botella 500 ml')).toBeInTheDocument();
  });

  it('respeta el stock: "Quedan 2" permite solo 2 unidades y un producto agotado no se agrega', async () => {
    const user = userEvent.setup();
    renderPos();
    expect(await screen.findByText('Quedan 2')).toBeInTheDocument();
    expect(screen.getByText('Agotado')).toBeInTheDocument();
    expect(screen.getByLabelText('Agregar Salteña')).toBeDisabled();

    const agregarApi = screen.getByLabelText('Agregar Api');
    await user.click(agregarApi);
    await user.click(agregarApi);
    expect(agregarApi).toBeDisabled();
  });

  it('calcula el total en centavos, sin errores de redondeo', async () => {
    const user = userEvent.setup();
    renderPos();
    for (let i = 0; i < 3; i++) await user.click(await screen.findByLabelText('Agregar Refresco'));
    expect(screen.getByText('Bs 19,50')).toBeInTheDocument(); // 3 × 6,50
    await user.click(screen.getByLabelText('Agregar Empanada'));
    expect(screen.getByText('Bs 29,50')).toBeInTheDocument();
    expect(screen.getByText('4 artículos')).toBeInTheDocument();
  });
});

describe('Cobro', () => {
  it('flujo completo: envía solo productos, cantidades y la clave, y muestra el comprobante', async () => {
    const user = userEvent.setup();
    consultarCliente.mockResolvedValue({ data: CLIENTE('50.00') });
    cobrar.mockResolvedValue({ data: COBRO_OK });
    renderPos();

    await llegarAConfirmacion(user, [['Empanada', 2]]);
    expect(consultarCliente).toHaveBeenCalledWith({ eventoId: 'ev1', codigo: 'MNL-1' });
    expect(screen.getByText('Nuevo saldo aproximado').nextSibling).toHaveTextContent('Bs 30');
    await user.click(screen.getByRole('button', { name: /Confirmar cobro/ }));

    expect(await screen.findByText('Pago exitoso')).toBeInTheDocument();
    expect(screen.getByText('Transacción TX-ABCDEFGH')).toBeInTheDocument();
    expect(cobrar).toHaveBeenCalledTimes(1);
    const enviado = cobrar.mock.calls[0][0];
    expect(enviado).toEqual({
      eventoId: 'ev1',
      codigo: 'MNL-1',
      items: [{ productoId: 'p1', cantidad: 2 }],
      idempotencyKey: expect.stringMatching(/^[A-Za-z0-9-]{20,64}$/),
    });
    expect(JSON.stringify(enviado)).not.toMatch(/precio|total|subtotal/);
    expect(feedbackOk).toHaveBeenCalled();
  });

  it('con saldo insuficiente muestra el rechazo, avisa con sonido y no deja confirmar (HU-023)', async () => {
    const user = userEvent.setup();
    consultarCliente.mockResolvedValue({ data: CLIENTE('5.00') });
    renderPos();

    await llegarAConfirmacion(user, [['Empanada', 2]]); // Bs 20 con saldo Bs 5
    const alerta = screen.getByRole('alert');
    expect(within(alerta).getByText('Cobro rechazado')).toBeInTheDocument();
    expect(alerta).toHaveTextContent('faltan Bs 15');
    expect(screen.queryByRole('button', { name: /Confirmar cobro/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Escanear otra manilla' })).toBeInTheDocument();
    expect(feedbackError).toHaveBeenCalled();
    expect(cobrar).not.toHaveBeenCalled();
  });

  it('si se pierde la respuesta, reintentar usa la MISMA clave; un cobro nuevo usa otra', async () => {
    const user = userEvent.setup();
    consultarCliente.mockResolvedValue({ data: CLIENTE('50.00') });
    cobrar
      .mockRejectedValueOnce({ request: {} }) // sin respuesta: corte de red
      .mockResolvedValue({ data: COBRO_OK });
    renderPos();

    await llegarAConfirmacion(user, [['Empanada', 2]]);
    await user.click(screen.getByRole('button', { name: /Confirmar cobro/ }));
    expect(await screen.findByText(/problema de conexión/)).toHaveTextContent('no se cobrará dos veces');

    await user.click(screen.getByRole('button', { name: /Confirmar cobro/ }));
    await screen.findByText('Pago exitoso');
    const [primero, reintento] = cobrar.mock.calls.map(([body]) => body.idempotencyKey);
    expect(reintento).toBe(primero);

    await user.click(screen.getByRole('button', { name: /Nueva venta/ }));
    await llegarAConfirmacion(user, [['Refresco', 1]]);
    await user.click(screen.getByRole('button', { name: /Confirmar cobro/ }));
    await screen.findByText('Pago exitoso');
    expect(cobrar.mock.calls[2][0].idempotencyKey).not.toBe(primero);
  });

  it('si el saldo cambió mientras se cobraba (409), muestra el saldo actualizado y bloquea el cobro', async () => {
    const user = userEvent.setup();
    consultarCliente.mockResolvedValue({ data: CLIENTE('50.00') });
    cobrar.mockRejectedValue({
      response: {
        status: 409,
        data: {
          code: 'SALDO_INSUFICIENTE',
          saldo: '3.00',
          message: 'Saldo insuficiente. El cliente tiene Bs 3.00 y el cobro es de Bs 20.00.',
        },
      },
    });
    renderPos();

    await llegarAConfirmacion(user, [['Empanada', 2]]);
    await user.click(screen.getByRole('button', { name: /Confirmar cobro/ }));

    expect(await screen.findByText(/El cliente tiene Bs 3.00/)).toBeInTheDocument();
    expect(screen.getByText('Bs 3')).toBeInTheDocument(); // saldo disponible actualizado
    expect(screen.queryByRole('button', { name: /Confirmar cobro/ })).not.toBeInTheDocument();
  });

  it('muestra el mensaje del servidor si el código no existe', async () => {
    const user = userEvent.setup();
    consultarCliente.mockRejectedValue({
      response: { status: 404, data: { message: 'No se encontró ninguna entrada o manilla con ese código.' } },
    });
    renderPos();

    await user.click(await screen.findByLabelText('Agregar Empanada'));
    await user.click(screen.getByRole('button', { name: 'Ver carrito' }));
    await user.click(screen.getByRole('button', { name: /Cobrar con manilla o QR/ }));
    await user.click(await screen.findByRole('button', { name: 'Simular escaneo' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se encontró ninguna entrada o manilla con ese código.',
    );
    expect(feedbackError).toHaveBeenCalled();
  });
});

describe('Situaciones en las que no se puede vender', () => {
  it('sin eventos abiertos lo explica y muestra los próximos eventos', async () => {
    getPosContexto.mockResolvedValue({ data: contexto({ eventos: [EVENTO_FUTURO] }) });
    renderPos();
    expect(await screen.findByText(/No hay eventos abiertos ahora/)).toBeInTheDocument();
    expect(screen.getByText('Concierto')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ver carrito' })).not.toBeInTheDocument();
  });

  it('si el servidor rechaza al ayudante (p. ej. inactivo) muestra el motivo y permite reintentar', async () => {
    const user = userEvent.setup();
    getPosContexto.mockRejectedValueOnce({
      response: { status: 403, data: { message: 'Tu cuenta de ayudante no está activa.' } },
    });
    renderPos();

    expect(await screen.findByText('No puedes vender por ahora')).toBeInTheDocument();
    expect(screen.getByText('Tu cuenta de ayudante no está activa.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('heading', { name: 'Puesto Prueba — Ventas' })).toBeInTheDocument();
  });
});

describe('Evento elegido', () => {
  it('recuerda el evento elegido por cada usuario al volver a abrir el POS', async () => {
    const user = userEvent.setup();
    const otroAbierto = { ...EVENTO_ABIERTO, id: 'ev3', titulo: 'Segunda feria' };
    getPosContexto.mockResolvedValue({ data: contexto({ eventos: [EVENTO_ABIERTO, otroAbierto] }) });

    const { unmount } = renderPos();
    await user.selectOptions(await screen.findByLabelText('Evento'), 'ev3');
    expect(localStorage.getItem('eventix_pos_evento:ayudante-1')).toBe('ev3');
    unmount();

    renderPos();
    await waitFor(() => expect(screen.getByLabelText('Evento')).toHaveValue('ev3'));
  });
});
