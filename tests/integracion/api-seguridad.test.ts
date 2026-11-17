/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *  PRUEBA DE INTEGRACIÓN · Seguridad de la API (autenticación, roles, validación, límites)
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 *  QUÉ VERIFICA
 *    Levanta la API real (la misma configuración que backend/src/main.ts) y le hace peticiones
 *    HTTP de verdad, como lo haría el navegador o un atacante:
 *      1. Autenticación: sin token, token falsificado, vencido, sin firma ("alg: none") o de un
 *         usuario desactivado → 401. El login no revela si un correo está registrado y nunca
 *         devuelve el hash de la contraseña.
 *      2. Roles: cada endpoint del Módulo E (y algunos del Sprint 1) solo responde al rol que
 *         corresponde; el resto recibe 403.
 *      3. Datos ajenos: un dueño no ve ni retira el negocio de otro; un ayudante no ve las
 *         ventas de otro.
 *      4. Entrada: campos no permitidos, parámetros extra, JSON mal formado, cuerpos de más de
 *         1 MB e intentos de inyección SQL se rechazan sin errores 500.
 *      5. Cabeceras de seguridad (helmet) y CORS: solo el frontend configurado puede llamar a
 *         la API desde el navegador.
 *      6. Límite de peticiones: 120 por minuto POR USUARIO (no por IP) y 10 intentos de login
 *         por correo cada 15 minutos.
 *
 *  POR QUÉ IMPORTA
 *    Un endpoint sin el guard correcto expone ventas, saldos o retiros a cualquiera con una
 *    cuenta. Estas pruebas fallan si alguien agrega o cambia un endpoint y olvida protegerlo.
 *
 *  CÓDIGO PROBADO
 *    backend/src/app.setup.ts                           (helmet, CORS, límite de 1 MB, validación)
 *    backend/src/common/guards/                         (JWT, roles, límite de peticiones)
 *    backend/src/modules/auth/                          (login)
 *    backend/src/modules/pos/pos.controller.ts          (roles de cada endpoint del Módulo E)
 *
 *  CÓMO EJECUTARLA
 *    cd tests
 *    npm install                                        (solo la primera vez)
 *    npm run test:integracion                           (todas las de integración, una tras otra)
 *    npx jest --runInBand integracion/api-seguridad     (solo este archivo)
 *
 *  REQUISITOS
 *    - backend/.env y backend/prisma/ca.pem (usa la misma base compartida de Aiven).
 *    - Internet. Tarda alrededor de 1 a 2 minutos.
 *    - NO hace falta levantar el backend: la prueba levanta su propia instancia de la API en
 *      un puerto libre (no choca con `npm run start:dev` en el puerto 3000).
 *
 *  QUÉ DATOS USA
 *    El escenario "[PRUEBA-AUTO]" de siempre, más un administrador, un usuario desactivado y un
 *    usuario para la prueba de límites. Las contraseñas son aleatorias en cada ejecución y no
 *    se muestran. Todo se borra al terminar (o con `npm run limpiar:confirmar`).
 *
 *  CÓMO LEER EL RESULTADO
 *    En la tabla de roles, cada caso dice "<método> <ruta> como <rol> → <esperado>". Un 403
 *    inesperado indica un guard demasiado estricto; un 2xx/4xx donde se esperaba 403 indica un
 *    endpoint DESPROTEGIDO (grave).
 *
 *  SI FALLA
 *    - Un 403 que no llega: revisa @Roles/@UseGuards del controlador de esa ruta.
 *    - Cabeceras/CORS/1 MB: revisa backend/src/app.setup.ts.
 *    - Límite de peticiones: revisa app-throttler.guard.ts y ThrottlerModule en app.module.ts.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { ApiDePrueba, levantarApi } from './helpers/app';
import {
  Escenario,
  asignarClave,
  crearEscenario,
  crearUsuario,
  nuevaClave,
  nuevoSufijo,
} from './helpers/escenario';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { limpiarDatosPrueba, DOMINIO } = require('./helpers/limpieza');

const DOS_HORAS = 2 * 60 * 60 * 1000;
const FRONTEND = 'http://localhost:5173';

type Rol = 'cliente' | 'ayudante' | 'jefe' | 'admin' | 'organizador';
const ROLES: Rol[] = ['cliente', 'ayudante', 'jefe', 'admin', 'organizador'];

let api: ApiDePrueba;
let esc: Escenario;
const sufijo = nuevoSufijo();
const clave = nuevaClave();
const usuarios = { admin: '', inactivo: '', limite: '' };
const tokens = {} as Record<Rol | 'ayudante2' | 'jefeOtroNegocio' | 'limite' | 'inactivo', string>;

const emailDe = (alias: string) => `${alias}.${sufijo}${DOMINIO}`;

/** Respuesta del login: la sesión (200) o el error (401/429). */
type RespuestaLogin = { accessToken: string; user: Record<string, unknown>; message?: string };

async function login(email: string, password = clave) {
  return api.pedir<RespuestaLogin>('POST', '/api/auth/login', { body: { email, password } });
}

beforeAll(async () => {
  api = await levantarApi();
  await limpiarDatosPrueba(api.prisma, { creadosAntesDe: new Date(Date.now() - DOS_HORAS) });
  esc = await crearEscenario(api.prisma, sufijo);

  [usuarios.admin, usuarios.inactivo, usuarios.limite] = await Promise.all([
    crearUsuario(api.prisma, 'admin', sufijo, [Role.ADMIN]),
    crearUsuario(api.prisma, 'inactivo', sufijo, [Role.CLIENTE]),
    crearUsuario(api.prisma, 'limite', sufijo, [Role.CLIENTE]),
  ]);
  await asignarClave(
    api.prisma,
    [...Object.values(esc.usuarios), ...Object.values(usuarios)],
    clave,
  );

  const alias = {
    cliente: 'cliente',
    ayudante: 'ayudante',
    jefe: 'jefe',
    admin: 'admin',
    organizador: 'organizador',
    ayudante2: 'ayudante2',
    jefeOtroNegocio: 'jefe2',
    limite: 'limite',
    inactivo: 'inactivo',
  } as const;
  await Promise.all(
    Object.entries(alias).map(async ([clave_, a]) => {
      const r = await login(emailDe(a));
      expect(r.status).toBe(200);
      tokens[clave_ as keyof typeof tokens] = r.body.accessToken;
    }),
  );
  // Se desactiva DESPUÉS de iniciar sesión: su token es válido pero la cuenta ya no.
  await api.prisma.usuario.update({ where: { id: usuarios.inactivo }, data: { activo: false } });
});

afterAll(async () => {
  if (api) {
    await limpiarDatosPrueba(api.prisma, { sufijo });
    await api.cerrar();
  }
});

describe('Autenticación', () => {
  it.each([
    ['GET', '/api/pos/contexto'],
    ['GET', '/api/negocio-panel/resumen'],
    ['GET', '/api/admin/retiros'],
    ['GET', '/api/users/me'],
  ])('%s %s sin token → 401', async (metodo, ruta) => {
    expect((await api.pedir(metodo, ruta)).status).toBe(401);
  });

  it('rechaza un token firmado con otra clave (intento de hacerse pasar por el admin)', async () => {
    const falso = new JwtService({ secret: 'clave-de-un-atacante-0123456789-abcdef' }).sign({
      sub: usuarios.admin,
      roles: ['ADMIN'],
    });
    expect((await api.pedir('GET', '/api/admin/retiros', { token: falso })).status).toBe(401);
  });

  it('rechaza un token sin firma ("alg": "none")', async () => {
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const sinFirma = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: usuarios.admin, roles: ['ADMIN'] })}.`;
    expect((await api.pedir('GET', '/api/admin/retiros', { token: sinFirma })).status).toBe(401);
  });

  it('rechaza un token vencido aunque esté bien firmado', async () => {
    const vencido = new JwtService({ secret: process.env.JWT_SECRET }).sign({
      sub: usuarios.admin,
      exp: Math.floor(Date.now() / 1000) - 60,
    });
    expect((await api.pedir('GET', '/api/admin/retiros', { token: vencido })).status).toBe(401);
  });

  it('rechaza el token de un usuario desactivado', async () => {
    expect((await api.pedir('GET', '/api/users/me', { token: tokens.inactivo })).status).toBe(401);
  });

  it('el login no revela si el correo existe (mismo mensaje con contraseña incorrecta)', async () => {
    const existente = await login(emailDe('cliente'), 'ContraseñaIncorrecta1!');
    const inexistente = await login(emailDe('nadie'), 'ContraseñaIncorrecta1!');
    expect(existente.status).toBe(401);
    expect(inexistente.status).toBe(401);
    expect(existente.body.message).toBe(inexistente.body.message);
  });

  it('el login y /users/me nunca devuelven el hash de la contraseña', async () => {
    const r = await login(emailDe('organizador'));
    const me = await api.pedir('GET', '/api/users/me', { token: tokens.organizador });
    expect(JSON.stringify(r.body)).not.toMatch(/passwordHash|\$2[aby]\$/);
    expect(JSON.stringify(me.body)).not.toMatch(/passwordHash|\$2[aby]\$/);
  });
});

describe('Roles: cada endpoint solo responde al rol que corresponde', () => {
  /** [método, ruta, cuerpo, roles permitidos]. Con un cuerpo vacío, el rol permitido recibe 400. */
  const endpoints: [string, string, unknown, Rol[]][] = [
    ['GET', '/api/pos/contexto', undefined, ['ayudante']],
    ['GET', '/api/pos/ventas', undefined, ['ayudante']],
    ['POST', '/api/pos/cobros', {}, ['ayudante']],
    ['GET', '/api/negocio-panel/resumen', undefined, ['jefe', 'admin']],
    ['GET', '/api/negocio-panel/liquidacion', undefined, ['jefe', 'admin']],
    ['POST', '/api/negocio-panel/retiros', {}, ['jefe', 'admin']],
    ['GET', '/api/admin/retiros', undefined, ['admin']],
    ['PATCH', '/api/admin/retiros/no-existe/estado', {}, ['admin']],
    ['GET', '/api/admin/usuarios', undefined, ['admin']],
    ['GET', '/api/users/me/saldo', undefined, ['cliente']],
  ];

  const casos = endpoints.flatMap(([metodo, ruta, body, permitidos]) =>
    ROLES.map((rol) => [metodo, ruta, rol, permitidos.includes(rol) ? 'permitido' : '403', body] as const),
  );

  it.each(casos)('%s %s como %s → %s', async (metodo, ruta, rol, esperado, body) => {
    const r = await api.pedir(metodo, ruta, { token: tokens[rol], body });
    if (esperado === '403') {
      expect(r.status).toBe(403);
    } else {
      expect([401, 403]).not.toContain(r.status);
      expect(r.status).toBeLessThan(500);
    }
  });
});

describe('Datos ajenos', () => {
  it('un dueño no puede ver la liquidación del negocio de otro', async () => {
    const r = await api.pedir('GET', `/api/negocio-panel/liquidacion?negocioId=${esc.negocioId}`, {
      token: tokens.jefeOtroNegocio,
    });
    expect(r.status).toBe(403);
  });

  it('un dueño no puede solicitar el retiro del dinero de otro negocio', async () => {
    const r = await api.pedir('POST', '/api/negocio-panel/retiros', {
      token: tokens.jefeOtroNegocio,
      body: { negocioId: esc.negocioId },
    });
    expect(r.status).toBe(403);
  });

  it('un ayudante no ve en su historial las ventas de otro ayudante', async () => {
    const cobro = await api.pedir('POST', '/api/pos/cobros', {
      token: tokens.ayudante2,
      body: {
        eventoId: esc.eventos.abierto,
        codigo: esc.codigos.manilla,
        items: [{ productoId: esc.productos.refresco, cantidad: 1 }],
      },
    });
    expect(cobro.status).toBe(201);

    const propio = await api.pedir('GET', '/api/pos/ventas', { token: tokens.ayudante2 });
    const otro = await api.pedir('GET', '/api/pos/ventas', { token: tokens.ayudante });
    const ids = (r: typeof propio) => r.body.ventas.map((v: { id: string }) => v.id);
    expect(ids(propio)).toContain(cobro.body.ventaId);
    expect(ids(otro)).not.toContain(cobro.body.ventaId);
  });
});

describe('Validación de la entrada', () => {
  it('rechaza un campo que no existe en el cobro (p. ej. un "total" puesto por el navegador)', async () => {
    const r = await api.pedir('POST', '/api/pos/cobros', {
      token: tokens.ayudante,
      body: {
        eventoId: esc.eventos.abierto,
        codigo: esc.codigos.manilla,
        items: [{ productoId: esc.productos.refresco, cantidad: 1 }],
        total: 0.01,
      },
    });
    expect(r.status).toBe(400);
    expect(r.body.message).toEqual(['property total should not exist']);
  });

  it('rechaza parámetros de consulta que no existen', async () => {
    const r = await api.pedir('GET', '/api/pos/ventas?ayudanteId=otro', { token: tokens.ayudante });
    expect(r.status).toBe(400);
  });

  it('un intento de inyección SQL en el código escaneado responde 404, no 500', async () => {
    const codigo = encodeURIComponent("' OR '1'='1' -- ");
    const r = await api.pedir('GET', `/api/pos/clientes?eventoId=${esc.eventos.abierto}&codigo=${codigo}`, {
      token: tokens.ayudante,
    });
    expect(r.status).toBe(404);
  });

  it('rechaza un JSON mal formado con 400', async () => {
    const r = await api.pedir('POST', '/api/pos/cobros', { token: tokens.ayudante, rawBody: '{"items": [' });
    expect(r.status).toBe(400);
  });

  it('rechaza cuerpos de más de 1 MB con 413', async () => {
    const enorme = JSON.stringify({ codigo: 'x'.repeat(1_100_000) });
    const r = await api.pedir('POST', '/api/pos/cobros', { token: tokens.ayudante, rawBody: enorme });
    expect(r.status).toBe(413);
  });
});

describe('Cabeceras de seguridad y CORS', () => {
  it('envía las cabeceras de seguridad de helmet y no revela la tecnología del servidor', async () => {
    const r = await api.pedir('GET', '/api/eventos/public');
    expect(r.headers.get('x-content-type-options')).toBe('nosniff');
    expect(r.headers.get('x-frame-options')).toBe('SAMEORIGIN');
    expect(r.headers.get('content-security-policy')).toBeTruthy();
    expect(r.headers.get('x-powered-by')).toBeNull();
  });

  it('permite llamadas desde el frontend configurado', async () => {
    const r = await api.pedir('GET', '/api/eventos/public', { headers: { Origin: FRONTEND } });
    expect(r.headers.get('access-control-allow-origin')).toBe(FRONTEND);
  });

  it('no autoriza a otros sitios web a leer las respuestas desde el navegador', async () => {
    const r = await api.pedir('GET', '/api/eventos/public', { headers: { Origin: 'https://sitio-malicioso.test' } });
    expect(r.headers.get('access-control-allow-origin')).toBeNull();
  });
});

describe('Límite de peticiones', () => {
  it('limita a 120 peticiones por minuto POR USUARIO; otro usuario desde la misma IP no se bloquea', async () => {
    // El usuario "limite" hace 125 peticiones en paralelo (de a 25) a una ruta que no le
    // corresponde: el guard de límites cuenta antes que el de roles, así no se cobra nada.
    const codigos: number[] = [];
    for (let lote = 0; lote < 5; lote++) {
      const respuestas = await Promise.all(
        Array.from({ length: 25 }, () => api.pedir('GET', '/api/pos/contexto', { token: tokens.limite })),
      );
      codigos.push(...respuestas.map((r) => r.status));
    }
    expect(codigos.filter((c) => c === 429)).toHaveLength(5);
    expect(codigos.filter((c) => c === 403)).toHaveLength(120);

    // Misma IP (127.0.0.1), otro usuario: no está bloqueado.
    expect((await api.pedir('GET', '/api/users/me', { token: tokens.organizador })).status).toBe(200);
  });

  it('bloquea el login de un correo tras 10 intentos fallidos, sin bloquear a los demás', async () => {
    const atacado = emailDe('victima-de-fuerza-bruta');
    const codigos: number[] = [];
    for (let i = 0; i < 11; i++) codigos.push((await login(atacado, `Intento${i}Malo!`)).status);
    expect(codigos.slice(0, 10)).toEqual(Array(10).fill(401));
    expect(codigos[10]).toBe(429);

    // Otro miembro del personal, desde la misma IP, sigue pudiendo entrar.
    expect((await login(emailDe('jefe'))).status).toBe(200);
  });
});
