/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *  PRUEBA UNITARIA · Utilidades del punto de venta: montos, CSV, códigos e identificadores
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 *  QUÉ VERIFICA
 *    1. money(): todos los montos de la API salen como texto con 2 decimales y sin errores de
 *       redondeo (0.1 + 0.2 = 0.30, nunca 0.30000000000000004).
 *    2. csvCell(): las celdas del CSV que se abre en Excel no pueden ejecutar fórmulas
 *       (inyección CSV) y respetan comillas, punto y coma y saltos de línea.
 *    3. codigoTransaccion(): el código corto que ve el cliente ("TX-XXXXXXXX").
 *    4. newId(): los ids generados para ventas y transacciones no se repiten.
 *    5. nombreCompleto(): arma "Nombre Apellido" sin espacios sobrantes.
 *
 *  POR QUÉ IMPORTA
 *    - Un monto mal redondeado descuadra la caja y la liquidación del negocio.
 *    - Un cliente podría registrarse con el nombre "=HYPERLINK(...)" y, sin el escape, ese
 *      texto se ejecutaría al abrir el CSV de ventas en el Excel del dueño del negocio.
 *    - Un id repetido haría fallar un cobro (o mezclaría dos ventas).
 *
 *  CÓDIGO PROBADO
 *    backend/src/modules/pos/pos-helpers.ts
 *
 *  CÓMO EJECUTARLA
 *    cd tests
 *    npm install                           (solo la primera vez)
 *    npx jest unit/pos-helpers.test.ts     (solo este archivo)
 *    npm run test:unit                     (todas las pruebas unitarias)
 *
 *  REQUISITOS
 *    Ninguno: no usa base de datos, servidor ni internet. Solo necesita que el cliente de
 *    Prisma esté generado en el backend (se genera solo con `npm install` en backend/).
 *
 *  CÓMO LEER EL RESULTADO
 *    Cada `it(...)` describe una regla. En los casos del CSV, el valor esperado es exactamente
 *    lo que quedará escrito en el archivo (por eso algunos llevan un apóstrofo delante).
 *
 *  SI FALLA
 *    - money: revisa que siga usando Prisma.Decimal y no números de JavaScript.
 *    - csvCell: NO quites el apóstrofo de las celdas que empiezan con = + - @ (es la defensa
 *      contra la inyección de fórmulas).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
import { Prisma } from '@prisma/client';
import {
  codigoTransaccion,
  csvCell,
  money,
  newId,
  nombreCompleto,
} from '../../backend/src/modules/pos/pos-helpers';

describe('money(): montos con 2 decimales', () => {
  it.each([
    [10, '10.00'],
    ['8.5', '8.50'],
    [0, '0.00'],
    [null, '0.00'],
    [undefined, '0.00'],
    [new Prisma.Decimal('1234.567'), '1234.57'],
  ])('money(%p) = %p', (entrada, esperado) => {
    expect(money(entrada as Parameters<typeof money>[0])).toBe(esperado);
  });

  it('no arrastra errores de punto flotante (0.1 + 0.2)', () => {
    expect(money(new Prisma.Decimal('0.1').add('0.2'))).toBe('0.30');
  });
});

describe('csvCell(): celdas seguras para Excel', () => {
  it.each([
    ['=HYPERLINK("http://malicioso")', `"'=HYPERLINK(""http://malicioso"")"`],
    ['+56 cmd', "'+56 cmd"],
    ['-2+3', "'-2+3"],
    ['@SUM(A1:A9)', "'@SUM(A1:A9)"],
    ['\tTAB', "'\tTAB"],
  ])('neutraliza la fórmula %p', (texto, esperado) => {
    expect(csvCell(texto)).toBe(esperado);
  });

  it('deja intacto el texto normal', () => {
    expect(csvCell('Juan Pérez')).toBe('Juan Pérez');
    expect(csvCell('2x Empanada de carne, 1x Refresco')).toBe(
      '2x Empanada de carne, 1x Refresco',
    );
  });

  it('pone entre comillas el texto con punto y coma, comillas o saltos de línea', () => {
    expect(csvCell('Pollo; papas')).toBe('"Pollo; papas"');
    expect(csvCell('Combo "familiar"')).toBe('"Combo ""familiar"""');
    expect(csvCell('línea 1\nlínea 2')).toBe('"línea 1\nlínea 2"');
  });

  it('no altera montos ni fechas', () => {
    expect(csvCell('26.00')).toBe('26.00');
    expect(csvCell('2026-10-10')).toBe('2026-10-10');
    expect(csvCell(15)).toBe('15');
  });
});

describe('codigoTransaccion(): código corto para el cliente', () => {
  it('usa los últimos 8 caracteres del id en mayúsculas', () => {
    expect(codigoTransaccion('abc12345xyz98765')).toBe('TX-XYZ98765');
  });
});

describe('newId(): ids de ventas y transacciones', () => {
  it('tiene formato de cuid (empieza con "c", solo minúsculas y dígitos)', () => {
    expect(newId()).toMatch(/^c[0-9a-z]{20,}$/);
  });

  it('no se repite en 10.000 ids generados seguidos', () => {
    const ids = new Set(Array.from({ length: 10_000 }, () => newId()));
    expect(ids.size).toBe(10_000);
  });
});

describe('nombreCompleto()', () => {
  it('une nombre y apellido', () => {
    expect(nombreCompleto({ nombre: 'Juan', apellido: 'Pérez' })).toBe('Juan Pérez');
  });

  it('no deja espacios sobrantes si no hay apellido', () => {
    expect(nombreCompleto({ nombre: 'Juan', apellido: null })).toBe('Juan');
  });

  it('devuelve null si no hay usuario', () => {
    expect(nombreCompleto(null)).toBeNull();
    expect(nombreCompleto(undefined)).toBeNull();
  });
});
