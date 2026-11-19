/**
 * Pruebas unitarias (Node assert) — Actividad 7.
 * Ejecutar: node docs/actividad7/test_validarFechaEvento.js
 */
const assert = require('assert');
const { validarRangoFechasEvento } = require('./validarFechaEvento');

const hoy = '2026-11-19';
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`PASS  ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`FAIL  ${name}`);
    console.error(`      ${err.message}`);
  }
}

test('rango de varios días válido', () => {
  const r = validarRangoFechasEvento('2026-11-20', '2026-11-22', hoy);
  assert.strictEqual(r.ok, true);
  assert.match(r.mensaje.toLowerCase(), /válido/);
});

test('caso límite: inicio == fin (un solo día) es válido', () => {
  const r = validarRangoFechasEvento(hoy, hoy, hoy);
  assert.strictEqual(r.ok, true);
  assert.match(r.mensaje.toLowerCase(), /un solo día/);
});

test('inicio posterior a fin es inválido', () => {
  const r = validarRangoFechasEvento('2026-11-25', '2026-11-20', hoy);
  assert.strictEqual(r.ok, false);
  assert.match(r.mensaje.toLowerCase(), /posterior/);
});

test('caso límite: inicio = ayer es inválido', () => {
  const r = validarRangoFechasEvento('2026-11-18', hoy, hoy);
  assert.strictEqual(r.ok, false);
  assert.match(r.mensaje.toLowerCase(), /anterior a hoy/);
});

test('inicio igual a hoy con fin posterior es válido', () => {
  const r = validarRangoFechasEvento(hoy, '2026-11-21', hoy);
  assert.strictEqual(r.ok, true);
});

test('formato inválido', () => {
  const r = validarRangoFechasEvento('19/11/2026', hoy, hoy);
  assert.strictEqual(r.ok, false);
});

console.log(`\nResultado: ${passed} OK, ${failed} FAIL`);
process.exit(failed === 0 ? 0 : 1);
