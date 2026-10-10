/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *  PRUEBA UNITARIA · Validación de los datos que recibe la API del punto de venta (Módulo E)
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 *  QUÉ VERIFICA
 *    Que los DTO del POS acepten solo datos correctos y rechacen el resto ANTES de llegar a la
 *    lógica de negocio (y a la base de datos):
 *      - CreateCobroDto (POST /api/pos/cobros): productos, cantidades, código del cliente y la
 *        clave anti-cobro-duplicado (idempotencyKey).
 *      - RangoFechasDto (historial del ayudante): formato de fechas.
 *      - CambiarEstadoRetiroDto (administrador): solo APROBADO o RECHAZADO.
 *
 *  POR QUÉ IMPORTA
 *    - Evita cobros con cantidades negativas, decimales o gigantes.
 *    - Evita que el navegador mande un precio inventado: cualquier campo que no esté en el DTO
 *      (p. ej. "precio") se rechaza; los precios siempre salen de la base de datos.
 *    - Las respuestas de error son las que verá el ayudante en el celular, por eso se comprueban
 *      los mensajes en español.
 *
 *  CÓDIGO PROBADO
 *    backend/src/modules/pos/dto/pos.dto.ts
 *    backend/src/common/validation/validation-pipe.options.ts  (misma configuración que main.ts)
 *
 *  CÓMO EJECUTARLA
 *    cd tests
 *    npm install                              (solo la primera vez)
 *    npx jest unit/pos-validacion.test.ts     (solo este archivo)
 *    npm run test:unit                        (todas las pruebas unitarias)
 *
 *  REQUISITOS
 *    Ninguno: no usa base de datos, servidor ni internet.
 *
 *  CÓMO LEER EL RESULTADO
 *    `errores(...)` devuelve la lista de mensajes que respondería la API con un 400. Una lista
 *    vacía significa que el cuerpo es válido.
 *
 *  SI FALLA
 *    Probablemente cambió un DTO o sus mensajes. Si el cambio fue intencional, actualiza el
 *    mensaje esperado aquí; si no, revisa pos.dto.ts.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { VALIDATION_PIPE_OPTIONS } from '../../backend/src/common/validation/validation-pipe.options';
import {
  CambiarEstadoRetiroDto,
  CreateCobroDto,
  RangoFechasDto,
} from '../../backend/src/modules/pos/dto/pos.dto';

const pipe = new ValidationPipe(VALIDATION_PIPE_OPTIONS);

/** Valida como lo haría la API y devuelve el objeto ya transformado. */
function validar<T>(body: unknown, metatype: new () => T, type: 'body' | 'query' = 'body') {
  return pipe.transform(body, { type, metatype }) as Promise<T>;
}

/** Mensajes de error que devolvería la API (lista vacía = cuerpo válido). */
async function errores(body: unknown, metatype: new () => unknown) {
  try {
    await validar(body, metatype);
    return [];
  } catch (err) {
    expect(err).toBeInstanceOf(BadRequestException);
    const message = ((err as BadRequestException).getResponse() as { message: string[] })
      .message;
    return message;
  }
}

const UUID = '3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b';
const cobro = (cambios: Record<string, unknown> = {}) => ({
  eventoId: 'evento-1',
  codigo: 'MNL-0001',
  items: [{ productoId: 'producto-1', cantidad: 2 }],
  idempotencyKey: UUID,
  ...cambios,
});

describe('CreateCobroDto (POST /api/pos/cobros)', () => {
  it('acepta un cobro correcto', async () => {
    expect(await errores(cobro(), CreateCobroDto)).toEqual([]);
  });

  it('limpia espacios del código escaneado y convierte la cantidad "2" en número', async () => {
    const dto = await validar(
      cobro({ codigo: '  MNL-0001  ', items: [{ productoId: 'p1', cantidad: '2' }] }),
      CreateCobroDto,
    );
    expect(dto.codigo).toBe('MNL-0001');
    expect(dto.items[0].cantidad).toBe(2);
  });

  it('la clave anti-duplicado es opcional', async () => {
    expect(await errores(cobro({ idempotencyKey: undefined }), CreateCobroDto)).toEqual([]);
  });

  it('exige al menos un producto', async () => {
    expect(await errores(cobro({ items: [] }), CreateCobroDto)).toEqual([
      'Selecciona al menos un producto.',
    ]);
  });

  it('limita un cobro a 50 líneas de productos', async () => {
    const items = Array.from({ length: 51 }, (_, i) => ({ productoId: `p${i}`, cantidad: 1 }));
    expect(await errores(cobro({ items }), CreateCobroDto)).toHaveLength(1);
  });

  it.each([
    [0, 'La cantidad mínima es 1.'],
    [100, 'La cantidad máxima por producto es 99.'],
    ['1.5', 'La cantidad debe ser un número entero.'],
    ['-3', 'La cantidad debe ser un número entero.'],
    ['1e2', 'La cantidad debe ser un número entero.'],
  ])('rechaza la cantidad %p', async (cantidad, mensaje) => {
    const body = cobro({ items: [{ productoId: 'p1', cantidad }] });
    // En campos de una lista, la API antepone la ruta del campo: items.<posición>.
    expect(await errores(body, CreateCobroDto)).toEqual([`items.0.${mensaje}`]);
  });

  it('exige el código del cliente (un código de solo espacios cuenta como vacío)', async () => {
    expect(await errores(cobro({ codigo: '   ' }), CreateCobroDto)).toEqual([
      'Escanea o ingresa el código del cliente.',
    ]);
  });

  it('rechaza campos que no existen, como un precio enviado desde el navegador', async () => {
    const body = cobro({ items: [{ productoId: 'p1', cantidad: 1, precio: 0.01 }] });
    expect(await errores(body, CreateCobroDto)).toEqual([
      'items.0.property precio should not exist',
    ]);
    expect(await errores(cobro({ total: 1 }), CreateCobroDto)).toEqual([
      'property total should not exist',
    ]);
  });

  it.each([
    ['abc', 'muy corta'],
    ["x'; DROP TABLE Venta;--xxxxxxxx", 'con caracteres no permitidos'],
    ['a'.repeat(65), 'muy larga'],
  ])('rechaza la clave anti-duplicado %p (%s)', async (idempotencyKey) => {
    expect(await errores(cobro({ idempotencyKey }), CreateCobroDto)).toEqual([
      'La clave del cobro no es válida.',
    ]);
  });

  it('acepta como clave un UUID o 32 caracteres hexadecimales (los dos formatos del POS)', async () => {
    expect(await errores(cobro({ idempotencyKey: UUID }), CreateCobroDto)).toEqual([]);
    expect(
      await errores(cobro({ idempotencyKey: 'a1b2c3d4e5f60718293a4b5c6d7e8f90' }), CreateCobroDto),
    ).toEqual([]);
  });
});

describe('RangoFechasDto (GET /api/pos/ventas)', () => {
  it('acepta fechas AAAA-MM-DD y trata los vacíos como "sin filtro"', async () => {
    const dto = await validar({ desde: '2026-10-01', hasta: '' }, RangoFechasDto, 'query');
    expect(dto).toEqual({ desde: '2026-10-01', hasta: undefined });
  });

  it('rechaza otros formatos de fecha', async () => {
    expect(await errores({ desde: '01/10/2026' }, RangoFechasDto)).toEqual([
      'La fecha debe tener el formato AAAA-MM-DD.',
    ]);
  });
});

describe('CambiarEstadoRetiroDto (PATCH /api/admin/retiros/:id/estado)', () => {
  it.each(['APROBADO', 'RECHAZADO'])('acepta %p', async (estado) => {
    expect(await errores({ estado }, CambiarEstadoRetiroDto)).toEqual([]);
  });

  it.each(['PAGADO', 'SOLICITADO', 'aprobado'])(
    'rechaza %p (PAGADO solo se registra subiendo el comprobante)',
    async (estado) => {
      expect(await errores({ estado }, CambiarEstadoRetiroDto)).toEqual([
        'El estado debe ser APROBADO o RECHAZADO.',
      ]);
    },
  );
});
