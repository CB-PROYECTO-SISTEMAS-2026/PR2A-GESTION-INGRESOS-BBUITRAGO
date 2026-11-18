/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *  PRUEBA DE INTEGRACIÓN · Seguridad de la API de devoluciones de saldo (Sprint 3, Módulo A)
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 *  QUÉ VERIFICA
 *    Levanta la API real y le hace peticiones HTTP de verdad, como lo haría el navegador o un
 *    atacante, contra los endpoints de /api/devoluciones:
 *      1. Autenticación: sin token → 401.
 *      2. Roles: solo el rol DEVOLUCIONES usa la terminal (ni el admin, ni el recargador).
 *      3. Datos ajenos: un encargado no asignado al evento no consulta ni devuelve.
 *      4. Entrada: "identidadVerificada" como texto "false", montos inválidos o campos
 *         inventados (p. ej. "usuarioId" para cobrar el saldo de otro) se rechazan con 400.
 *      5. Flujo completo por HTTP: devolución 201, saldo en cero y reintento sin duplicar.
 *
 *  POR QUÉ IMPORTA
 *    Un endpoint de devoluciones sin el guard correcto permitiría sacar efectivo de la caja con
 *    el saldo de cualquiera. Estas pruebas fallan si alguien cambia el controlador y olvida
 *    protegerlo.
 *
 *  CÓDIGO PROBADO
 *    backend/src/modules/devoluciones/devoluciones.controller.ts
 *    backend/src/modules/devoluciones/dto/devoluciones.dto.ts
 *    backend/src/common/guards/                          (JWT y roles)
 *
 *  CÓMO EJECUTARLA
 *    cd tests
 *    npm run test:integracion                                 (todas las de integración)
 *    npx jest --runInBand integracion/devoluciones-seguridad  (solo este archivo)
 *
 *  REQUISITOS
 *    - backend/.env y backend/prisma/ca.pem (usa la misma base compartida de Aiven).
 *    - Internet. Tarda alrededor de 1 minuto.
 *    - NO hace falta levantar el backend: la prueba levanta su propia API en un puerto libre.
 *
 *  QUÉ DATOS USA
 *    El escenario "[PRUEBA-AUTO]" de siempre más dos encargados de devoluciones (uno asignado al
 *    evento abierto y otro sin asignar). Contraseñas aleatorias por ejecución. Todo se borra al
 *    terminar.
 *
 *  CÓMO LEER EL RESULTADO
 *    En la tabla de roles, cada caso dice "<método> <ruta> como <rol> → <esperado>". Un 2xx/4xx
 *    donde se esperaba 403 indica un endpoint DESPROTEGIDO (grave).
 *
 *  SI FALLA
 *    - Un 403 que no llega: revisa @Roles/@UseGuards de devoluciones.controller.ts.
 *    - Un 201 con datos inválidos: revisa el DTO (y que el ValidationPipe global siga activo).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
import { randomUUID } from 'crypto';
import { Role, TipoTransaccionSaldo } from '@prisma/client';
import { ApiDePrueba, levantarApi } from './helpers/app';
import {
  Escenario,
  asignarClave,
  crearEscenario,
  crearUsuario,
  getSaldo,
  nuevaClave,
  nuevoSufijo,
  setSaldo,
} from './helpers/escenario';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { limpiarDatosPrueba, DOMINIO } = require('./helpers/limpieza');

const DOS_HORAS = 2 * 60 * 60 * 1000;

type Rol = 'cliente' | 'recargador' | 'ayudante' | 'organizador' | 'admin' | 'devoluciones';
const ROLES: Rol[] = ['cliente', 'recargador', 'ayudante', 'organizador', 'admin', 'devoluciones'];

let api: ApiDePrueba;
let esc: Escenario;
const sufijo = nuevoSufijo();
const clave = nuevaClave();
const tokens = {} as Record<Rol | 'devoluciones2', string>;

const ALIAS: Record<keyof typeof tokens, string> = {
  cliente: 'cliente',
  recargador: 'recargador',
  ayudante: 'ayudante',
  organizador: 'organizador',
  admin: 'admin-saldo',
  devoluciones: 'devoluciones',
  devoluciones2: 'devoluciones2',
};

/** Cuerpo válido de una devolución del saldo del cliente en el evento abierto. */
const cuerpoDevolucion = (montoEsperado: number, extra: Record<string, unknown> = {}) => ({
  eventoId: esc.eventos.abierto,
  codigo: esc.codigos.manilla,
  montoEsperado,
  identidadVerificada: true,
  ...extra,
});

beforeAll(async () => {
  api = await levantarApi();
  await limpiarDatosPrueba(api.prisma, { creadosAntesDe: new Date(Date.now() - DOS_HORAS) });
  esc = await crearEscenario(api.prisma, sufijo);
  const [encargado, encargado2] = await Promise.all([
    crearUsuario(api.prisma, 'devoluciones', sufijo, [Role.DEVOLUCIONES]),
    crearUsuario(api.prisma, 'devoluciones2', sufijo, [Role.DEVOLUCIONES]),
  ]);
  await Promise.all([
    api.prisma.staffEvento.create({
      data: { usuarioId: encargado, eventoId: esc.eventos.abierto, role: Role.DEVOLUCIONES },
    }),
    asignarClave(api.prisma, [...Object.values(esc.usuarios), encargado, encargado2], clave),
  ]);

  await Promise.all(
    Object.entries(ALIAS).map(async ([rol, alias]) => {
      const r = await api.pedir('POST', '/api/auth/login', {
        body: { email: `${alias}.${sufijo}${DOMINIO}`, password: clave },
      });
      expect(r.status).toBe(200);
      tokens[rol as keyof typeof tokens] = r.body.accessToken;
    }),
  );
});

afterAll(async () => {
  if (api) {
    await limpiarDatosPrueba(api.prisma, { sufijo });
    await api.cerrar();
  }
});

describe('Autenticación', () => {
  it.each([
    ['GET', '/api/devoluciones/contexto'],
    ['GET', '/api/devoluciones/clientes'],
    ['POST', '/api/devoluciones'],
  ])('%s %s sin token → 401', async (metodo, ruta) => {
    expect((await api.pedir(metodo, ruta)).status).toBe(401);
  });
});

describe('Roles: solo el encargado de devoluciones usa la terminal', () => {
  const endpoints: [string, string, unknown][] = [
    ['GET', '/api/devoluciones/contexto', undefined],
    ['GET', '/api/devoluciones/clientes?eventoId=:evento&codigo=:manilla', undefined],
    ['POST', '/api/devoluciones', {}],
  ];
  const casos = endpoints.flatMap(([metodo, ruta, body]) =>
    ROLES.map((rol) => [metodo, ruta, rol, rol === 'devoluciones' ? 'permitido' : '403', body] as const),
  );

  it.each(casos)('%s %s como %s → %s', async (metodo, ruta, rol, esperado, body) => {
    const url = ruta.replace(/:evento/g, esc.eventos.abierto).replace(/:manilla/g, esc.codigos.manilla);
    const r = await api.pedir(metodo, url, { token: tokens[rol], body });
    if (esperado === '403') {
      expect(r.status).toBe(403);
    } else {
      expect([401, 403]).not.toContain(r.status);
      expect(r.status).toBeLessThan(500);
    }
  });
});

describe('Datos ajenos', () => {
  it('un encargado no asignado al evento no puede consultar ni devolver', async () => {
    const consulta = await api.pedir(
      'GET',
      `/api/devoluciones/clientes?eventoId=${esc.eventos.abierto}&codigo=${esc.codigos.manilla}`,
      { token: tokens.devoluciones2 },
    );
    expect(consulta.status).toBe(403);

    await setSaldo(api.prisma, esc, 100);
    const r = await api.pedir('POST', '/api/devoluciones', {
      token: tokens.devoluciones2,
      body: cuerpoDevolucion(100),
    });
    expect(r.status).toBe(403);
    expect(await getSaldo(api.prisma, esc)).toBe('100.00');
  });
});

describe('Entrada inválida: 400 y el saldo no se toca', () => {
  beforeAll(() => setSaldo(api.prisma, esc, 100));

  it.each([
    ['identidad sin confirmar', { identidadVerificada: false }],
    ['identidad como texto "false"', { identidadVerificada: 'false' }],
    ['identidad como texto "true"', { identidadVerificada: 'true' }],
    ['monto negativo', { montoEsperado: -100 }],
    ['monto con 3 decimales', { montoEsperado: 100.001 }],
    ['usuarioId inventado (saldo de otro)', { usuarioId: 'otro-usuario' }],
    ['saldoResultante inventado', { saldoResultante: 500 }],
    ['clave anti-duplicado mal formada', { idempotencyKey: 'x' }],
  ])('%s → 400', async (_caso, extra) => {
    const r = await api.pedir('POST', '/api/devoluciones', {
      token: tokens.devoluciones,
      body: cuerpoDevolucion(100, extra),
    });
    expect(r.status).toBe(400);
    expect(await getSaldo(api.prisma, esc)).toBe('100.00');
  });

  it('un cuerpo que no es JSON válido → 400, no 500', async () => {
    const r = await api.pedir('POST', '/api/devoluciones', { token: tokens.devoluciones, rawBody: '{"eventoId":' });
    expect(r.status).toBe(400);
  });
});

describe('Flujo completo por HTTP', () => {
  it('consulta → devolución 201 → saldo en cero → el reintento no duplica', async () => {
    await setSaldo(api.prisma, esc, 75);
    const sinFoto = await api.pedir('POST', '/api/devoluciones', { token: tokens.devoluciones, body: cuerpoDevolucion(75) });
    expect(sinFoto.status).toBe(400);
    expect(sinFoto.body.message).toContain('foto del primer ingreso');
    expect(await getSaldo(api.prisma, esc)).toBe('75.00');
    const manilla = await api.prisma.manilla.findFirstOrThrow({ where: { eventoId: esc.eventos.abierto, codigoFisico: esc.codigos.manilla } });
    await api.prisma.accesoEvento.create({ data: { entradaId: manilla.entradaId!, eventoId: esc.eventos.abierto, tipo: 'INGRESO', fotoIngresoUrl: 'https://example.invalid/ingreso.jpg' } });
    const consulta = await api.pedir(
      'GET',
      `/api/devoluciones/clientes?eventoId=${esc.eventos.abierto}&codigo=${esc.codigos.manilla}`,
      { token: tokens.devoluciones },
    );
    expect(consulta.status).toBe(200);
    expect(consulta.body).toMatchObject({ montoDevolvible: '75.00', puedeDevolver: true });

    const idempotencyKey = randomUUID();
    const body = cuerpoDevolucion(Number(consulta.body.montoDevolvible), { idempotencyKey });
    const r = await api.pedir('POST', '/api/devoluciones', { token: tokens.devoluciones, body });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ monto: '75.00', saldoResultante: '0.00', repetido: false });
    expect(await getSaldo(api.prisma, esc)).toBe('0.00');

    const reintento = await api.pedir('POST', '/api/devoluciones', { token: tokens.devoluciones, body });
    expect(reintento.status).toBe(201);
    expect(reintento.body).toMatchObject({ repetido: true, transaccionId: r.body.transaccionId });
    const registradas = await api.prisma.transaccionSaldo.count({
      where: { id: idempotencyKey, tipo: TipoTransaccionSaldo.DEVOLUCION },
    });
    expect(registradas).toBe(1);
  });
});

it('reembolsa una entrada sin usar una sola vez y desactiva su QR al aprobar', async () => {
  const db = api.prisma;
  const eventoId = esc.eventos.abierto, usuarioId = esc.usuarios.cliente;
  const entrada = await db.entrada.findFirstOrThrow({ where: { eventoId, titularId: usuarioId, estado: { in: ['GENERADA','ASIGNADA'] }, accesos: { none: {} } } });
  const compra = await db.compraEntrada.create({ data: { usuarioId, eventoId, estado: 'APROBADA', montoTotal: 32, items: { create: { categoriaId: entrada.categoriaId, precioUnit: 32 } } } });
  try {
    await db.entrada.update({ where: { id: entrada.id }, data: { compraId: compra.id } });
    const solicitar = () => api.pedir('POST', '/api/entradas/' + entrada.id + '/reembolso', { token: tokens.cliente, body: { motivo: 'No podré asistir' } });
    const [a,b] = await Promise.all([solicitar(), solicitar()]);
    expect([a.status,b.status]).toEqual([201,201]);
    expect(a.body.id).toBe(b.body.id);
    expect(Number(a.body.monto)).toBe(32);
    const ruta = '/api/admin/reembolsos/' + a.body.id;
    expect((await api.pedir('PATCH', ruta, { token: tokens.cliente, body: { estado: 'APROBADO' } })).status).toBe(403);
    for (const estado of ['APROBADO','PAGADO','PAGADO']) {
      const r = await api.pedir('PATCH', ruta, { token: tokens.admin, body: { estado } });
      expect(r.status).toBe(200);
      expect(r.body.estado).toBe(estado);
    }
    expect((await db.entrada.findUniqueOrThrow({ where: { id: entrada.id } })).estado).toBe('REEMBOLSADA');
  } finally {
    await db.reembolsoEntrada.deleteMany({ where: { entradaId: entrada.id } });
    await db.entrada.update({ where: { id: entrada.id }, data: { compraId: null } });
    await db.compraEntrada.delete({ where: { id: compra.id } });
  }
});
