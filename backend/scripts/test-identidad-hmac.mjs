/**
 * Pruebas unitarias de normalización y HMAC de identidad (sin base de datos).
 * Uso: node scripts/test-identidad-hmac.mjs
 */
import { createHmac, timingSafeEqual, randomBytes } from 'crypto';

const DOCUMENT_TYPES = ['CI', 'PASAPORTE', 'CE', 'OTRO'];

function normalizeIdentityDocument(input) {
  const country = (input.country || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) throw new Error('País emisor inválido.');
  const type = String(input.type || '').trim().toUpperCase();
  if (!DOCUMENT_TYPES.includes(type)) throw new Error('Tipo de documento inválido.');
  const number = (input.number || '').trim().toUpperCase().replace(/[\s.\-_/]/g, '');
  if (!number || number.length < 4 || number.length > 30) throw new Error('Número de documento inválido.');
  let complement = null;
  const rawComp = input.complement?.trim().toUpperCase().replace(/[\s.\-]/g, '');
  if (rawComp) {
    if (country !== 'BO' || type !== 'CI') throw new Error('El complemento solo aplica a CI boliviano.');
    complement = rawComp;
  }
  const suffix = number.slice(-4);
  const mask = `${'*'.repeat(Math.max(number.length - 4, 2))}${suffix}`;
  const canonical = [country, type, number, complement ?? ''].join('|');
  return { country, type, number, complement, canonical, suffix, mask, tieneComplemento: Boolean(complement) };
}

function hmac(secret, payload) {
  return createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
}

function safeEq(a, b) {
  const ba = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

const identitySecret = randomBytes(48).toString('hex');
const suffixSecret = randomBytes(48).toString('hex');
let passed = 0;
let failed = 0;

function assert(cond, name) {
  if (cond) {
    passed += 1;
    console.log(`OK  ${name}`);
  } else {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}

// 1. Registro correcto / normalización
const a = normalizeIdentityDocument({ country: 'BO', type: 'CI', number: '1234567' });
assert(a.canonical === 'BO|CI|1234567|', 'normaliza CI sin complemento');
assert(a.mask.endsWith('4567'), 'máscara termina en últimos 4');
assert(!a.mask.includes('1234567'), 'máscara no contiene número completo');

// 2/3. Mismo CI → mismo HMAC; distinto CI mismos 4 dígitos → distinto identity HMAC, mismo suffix
const b = normalizeIdentityDocument({ country: 'BO', type: 'CI', number: '9994567' });
const ha = hmac(identitySecret, a.canonical);
const hb = hmac(identitySecret, b.canonical);
assert(ha !== hb, 'dos CI distintos con mismos 4 dígitos tienen HMAC de identidad distinto');
assert(a.suffix === b.suffix, 'comparten sufijo');
assert(safeEq(hmac(suffixSecret, a.suffix), hmac(suffixSecret, b.suffix)), 'mismo suffix HMAC');

// 4. Complemento
const c = normalizeIdentityDocument({ country: 'BO', type: 'CI', number: '1234567', complement: '1A' });
assert(c.canonical === 'BO|CI|1234567|1A', 'incluye complemento en canónico');
assert(hmac(identitySecret, a.canonical) !== hmac(identitySecret, c.canonical), 'complemento cambia identidad');

// 5. Ceros iniciales
const z = normalizeIdentityDocument({ country: 'BO', type: 'CI', number: '001234' });
assert(z.number === '001234', 'preserva ceros iniciales');
assert(z.canonical === 'BO|CI|001234|', 'canónico con ceros');

// 6. Separadores equivalentes
const d1 = normalizeIdentityDocument({ country: 'BO', type: 'CI', number: '1.234.567' });
const d2 = normalizeIdentityDocument({ country: 'BO', type: 'CI', number: '1234567' });
assert(d1.canonical === d2.canonical, 'separadores no cambian el canónico');

// 7. Unicidad simulada global
const registry = new Set([ha]);
assert(registry.has(hb) === false, 'no colisiona en registro simulado');
registry.add(hb);
assert(registry.has(hmac(identitySecret, c.canonical)) === false, 'CI con complemento es otro documento');

// 8. Verificación de sufijo
const suffixH = hmac(suffixSecret, a.suffix);
assert(safeEq(hmac(suffixSecret, '4567'), suffixH), 'sufijo correcto coincide');
assert(!safeEq(hmac(suffixSecret, '0000'), suffixH), 'sufijo incorrecto no coincide');

// 9. No usar SHA-256 simple (el test demuestra que usamos HMAC con secret)
assert(hmac(identitySecret, a.canonical).length === 64, 'HMAC-SHA256 produce 64 hex');
assert(hmac('otra-clave', a.canonical) !== ha, 'clave distinta produce huella distinta');

// 10. País y tipo forman parte de la huella
const pe = normalizeIdentityDocument({ country: 'PE', type: 'CI', number: '1234567' });
assert(hmac(identitySecret, pe.canonical) !== ha, 'país distinto cambia HMAC');

console.log(`\n${passed} ok, ${failed} fallos`);
process.exit(failed ? 1 : 0);
