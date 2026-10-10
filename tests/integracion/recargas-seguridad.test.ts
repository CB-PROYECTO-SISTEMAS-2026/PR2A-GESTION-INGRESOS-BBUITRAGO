/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *  PRUEBA DE INTEGRACIÓN · Seguridad de la API del Módulo D (recargas, movimientos, personal)
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 *  QUÉ VERIFICA
 *    Levanta la API real y le hace peticiones HTTP de verdad, como lo haría el navegador o un
 *    atacante, contra los endpoints nuevos del Módulo D:
 *      1. Autenticación: sin token → 401.
 *      2. Roles: solo el RECARGADOR recarga; solo el ADMIN anula recargas y asigna personal;
 *         solo el CLIENTE ve "sus" saldos; admin y organizador ven movimientos de un evento.
 *      3. Datos ajenos: un cliente solo ve sus propios movimientos (el usuario sale del token,
 *         no de la petición); un organizador no ve eventos ajenos; un recargador no asignado al
 *         evento no puede recargar ni consultar clientes.
 *      4. Entrada: montos fuera de límite, campos inventados (p. ej. "saldo") o anulaciones sin
 *         motivo se rechazan con 400 y sin errores 500.
 *      5. Flujo completo por HTTP: recarga 201 y reintento con la misma clave sin duplicar.
 *
 *  POR QUÉ IMPORTA
 *    Un endpoint de recargas sin el guard correcto permitiría crear saldo de la nada. Estas
 *    pruebas fallan si alguien agrega o cambia un endpoint y olvida protegerlo.
 *
 *  CÓDIGO PROBADO
 *    backend/src/modules/recargas/recargas.controller.ts
 *    backend/src/modules/saldo/movimientos.controller.ts
 *    backend/src/modules/personal-evento/personal-evento.controller.ts
 *    backend/src/common/guards/                          (JWT y roles)
 *
 *  CÓMO EJECUTARLA
 *    cd tests
 *    npm run test:integracion                              (todas las de integración)
 *    npx jest --runInBand integracion/recargas-seguridad   (solo este archivo)
 *
 *  REQUISITOS
 *    - backend/.env y backend/prisma/ca.pem (usa la misma base compartida de Aiven).
 *    - Internet. Tarda alrededor de 1 a 2 minutos.
 *    - NO hace falta levantar el backend: la prueba levanta su propia API en un puerto libre.
 *
 *  QUÉ DATOS USA
 *    El escenario "[PRUEBA-AUTO]" de siempre (incluye recargadores, un administrador y un segundo
 *    organizador). Contraseñas aleatorias por ejecución. Todo se borra al terminar.
 *
 *  CÓMO LEER EL RESULTADO
 *    En la tabla de roles, cada caso dice "<método> <ruta> como <rol> → <esperado>". Un 2xx/4xx
 *    donde se esperaba 403 indica un endpoint DESPROTEGIDO (grave).
 *
 *  SI FALLA
 *    - Un 403 que no llega: revisa @Roles/@UseGuards del controlador de esa ruta.
 *    - Datos ajenos: revisa que el servicio use el id del token (@CurrentUser) y no uno recibido.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
import { randomUUID } from 'crypto';
import { ApiDePrueba, levantarApi } from './helpers/app';
import {
  Escenario,
  asignarClave,
  crearEscenario,
  getSaldo,
  nuevaClave,
  nuevoSufijo,
  setSaldo,
} from './helpers/escenario';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { limpiarDatosPrueba, DOMINIO } = require('./helpers/limpieza');

const DOS_HORAS = 2 * 60 * 60 * 1000;

type Rol = 'cliente' | 'recargador' | 'ayudante' | 'organizador' | 'admin';
const ROLES: Rol[] = ['cliente', 'recargador', 'ayudante', 'organizador', 'admin'];

let api: ApiDePrueba;
let esc: Escenario;
const sufijo = nuevoSufijo();
const clave = nuevaClave();
const tokens = {} as Record<Rol | 'recargador2' | 'organizador2' | 'cliente2', string>;

const ALIAS: Record<keyof typeof tokens, string> = {
  cliente: 'cliente',
  recargador: 'recargador',
  ayudante: 'ayudante',
  organizador: 'organizador',
  admin: 'admin-saldo',
  recargador2: 'recargador2',
  organizador2: 'organizador2',
  cliente2: 'cliente2',
};

beforeAll(async () => {
  api = await levantarApi();
  await limpiarDatosPrueba(api.prisma, { creadosAntesDe: new Date(Date.now() - DOS_HORAS) });
  esc = await crearEscenario(api.prisma, sufijo);
  await asignarClave(api.prisma, Object.values(esc.usuarios), clave);

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
    ['GET', '/api/recargas/contexto'],
    ['POST', '/api/recargas'],
    ['GET', '/api/recargas/historial'],
    ['GET', '/api/admin/recargas'],
    ['GET', '/api/users/me/saldos'],
    ['GET', '/api/users/me/movimientos'],
    ['GET', '/api/eventos/cualquiera/movimientos'],
    ['GET', '/api/admin/eventos/cualquiera/personal'],
  ])('%s %s sin token → 401', async (metodo, ruta) => {
    expect((await api.pedir(metodo, ruta)).status).toBe(401);
  });
});

describe('Roles: cada endpoint solo responde al rol que corresponde', () => {
  /**
   * [método, ruta, cuerpo, roles permitidos]. Con un cuerpo vacío, el rol permitido recibe 400.
   * :evento y :manilla se reemplazan por los del escenario (que existe recién en beforeAll).
   */
  const endpoints: [string, string, unknown, Rol[]][] = [
    ['GET', '/api/recargas/contexto', undefined, ['recargador']],
    ['GET', '/api/recargas/clientes?eventoId=:evento&codigo=:manilla', undefined, ['recargador']],
    ['POST', '/api/recargas', {}, ['recargador']],
    ['GET', '/api/recargas/historial', undefined, ['recargador']],
    ['GET', '/api/admin/recargas', undefined, ['admin']],
    ['POST', '/api/admin/recargas/no-existe/anular', {}, ['admin']],
    ['GET', '/api/users/me/saldos', undefined, ['cliente']],
    ['GET', '/api/users/me/movimientos?eventoId=:evento', undefined, ['cliente']],
    ['GET', '/api/eventos/:evento/movimientos', undefined, ['admin', 'organizador']],
    ['GET', '/api/admin/eventos/:evento/personal', undefined, ['admin']],
    ['POST', '/api/admin/eventos/:evento/personal', {}, ['admin']],
    ['DELETE', '/api/admin/eventos/:evento/personal/no-existe', undefined, ['admin']],
  ];

  const casos = endpoints.flatMap(([metodo, ruta, body, permitidos]) =>
    ROLES.map((rol) => [metodo, ruta, rol, permitidos.includes(rol) ? 'permitido' : '403', body] as const),
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
  it('un recargador no asignado al evento no puede consultar clientes ni recargar', async () => {
    const consulta = await api.pedir(
      'GET',
      `/api/recargas/clientes?eventoId=${esc.eventos.abierto}&codigo=${esc.codigos.manilla}`,
      { token: tokens.recargador2 },
    );
    expect(consulta.status).toBe(403);

    await setSaldo(api.prisma, esc, 100);
    const r = await api.pedir('POST', '/api/recargas', {
      token: tokens.recargador2,
      body: { eventoId: esc.eventos.abierto, codigo: esc.codigos.manilla, monto: 50 },
    });
    expect(r.status).toBe(403);
    expect(await getSaldo(api.prisma, esc)).toBe('100.00');
  });

  it('el recargador no puede anular sus propias recargas (solo el administrador)', async () => {
    const r = await api.pedir('POST', '/api/recargas', {
      token: tokens.recargador,
      body: { eventoId: esc.eventos.abierto, codigo: esc.codigos.manilla, monto: 20 },
    });
    expect(r.status).toBe(201);
    const anular = await api.pedir('POST', `/api/admin/recargas/${r.body.transaccionId}/anular`, {
      token: tokens.recargador,
      body: { motivo: 'Quiero quedarme con el efectivo' },
    });
    expect(anular.status).toBe(403);
  });

  it('un cliente solo ve sus propios movimientos, aunque mande el id de otro usuario', async () => {
    const r = await api.pedir(
      'GET',
      `/api/users/me/movimientos?eventoId=${esc.eventos.abierto}&usuarioId=${esc.usuarios.cliente}`,
      { token: tokens.cliente2 },
    );
    // El parámetro extra se rechaza; sin él, solo aparecen los movimientos de cliente2.
    expect(r.status).toBe(400);
    const propio = await api.pedir('GET', `/api/users/me/movimientos?eventoId=${esc.eventos.abierto}`, {
      token: tokens.cliente2,
    });
    expect(propio.status).toBe(200);
    const ids = propio.body.movimientos.map((m: { id: string }) => m.id);
    const ajenos = await api.prisma.transaccionSaldo.findMany({
      where: { usuarioId: esc.usuarios.cliente, eventoId: esc.eventos.abierto },
      select: { id: true },
    });
    expect(ajenos.length).toBeGreaterThan(0);
    for (const a of ajenos) expect(ids).not.toContain(a.id);
  });

  it('un organizador no ve los movimientos de un evento que no es suyo', async () => {
    const r = await api.pedir('GET', `/api/eventos/${esc.eventos.abierto}/movimientos`, {
      token: tokens.organizador2,
    });
    expect(r.status).toBe(403);
  });
});

describe('Validación de la entrada', () => {
  const recarga = (extra: Record<string, unknown>) => ({
    eventoId: esc.eventos.abierto,
    codigo: esc.codigos.manilla,
    monto: 50,
    ...extra,
  });

  it.each([
    ['un monto menor al mínimo', { monto: 5 }, 'El monto mínimo por recarga es Bs 10.'],
    ['un monto mayor al máximo', { monto: 5000 }, 'El monto máximo por recarga es Bs 1000.'],
    ['un pago con tarjeta (aún no habilitado)', { metodoPago: 'TARJETA' }, 'Por ahora solo se aceptan pagos en efectivo.'],
  ])('rechaza %s', async (_caso, extra, mensaje) => {
    const r = await api.pedir('POST', '/api/recargas', { token: tokens.recargador, body: recarga(extra) });
    expect(r.status).toBe(400);
    expect(r.body.message).toContain(mensaje);
  });

  it('rechaza un saldo o un operador enviados desde el navegador', async () => {
    const r = await api.pedir('POST', '/api/recargas', {
      token: tokens.recargador,
      body: recarga({ saldo: 99999, operadorId: esc.usuarios.admin }),
    });
    expect(r.status).toBe(400);
  });

  it('rechaza una anulación sin motivo', async () => {
    const r = await api.pedir('POST', '/api/admin/recargas/no-existe/anular', { token: tokens.admin, body: {} });
    expect(r.status).toBe(400);
  });

  it('un intento de inyección SQL en el código del cliente no rompe nada', async () => {
    const r = await api.pedir(
      'GET',
      `/api/recargas/clientes?eventoId=${esc.eventos.abierto}&codigo=${encodeURIComponent("' OR 1=1 --")}`,
      { token: tokens.recargador },
    );
    expect(r.status).toBe(404);
  });
});

describe('Flujo completo por HTTP', () => {
  it('recarga 201 y el reintento con la misma clave no acredita otra vez', async () => {
    await setSaldo(api.prisma, esc, 100);
    const idempotencyKey = randomUUID();
    const body = { eventoId: esc.eventos.abierto, codigo: esc.codigos.manilla, monto: 25, idempotencyKey };

    const primera = await api.pedir('POST', '/api/recargas', { token: tokens.recargador, body });
    const segunda = await api.pedir('POST', '/api/recargas', { token: tokens.recargador, body });
    expect(primera.status).toBe(201);
    expect(segunda.status).toBe(201);
    expect(primera.body).toMatchObject({ repetido: false, saldoResultante: '125.00' });
    expect(segunda.body).toMatchObject({ repetido: true, transaccionId: idempotencyKey });
    expect(await getSaldo(api.prisma, esc)).toBe('125.00');
  });
});
