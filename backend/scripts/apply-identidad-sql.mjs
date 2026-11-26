import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const url = process.env.ADMIN_DATABASE_URL || process.env.DATABASE_URL;
if (!url || !url.includes('avnadmin')) {
  console.error('Falta ADMIN_DATABASE_URL con usuario avnadmin en backend/.env');
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url } } });
const sqlPath = path.join(__dirname, '../prisma/manual/alter_identidad_asignacion.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');
const parts = sql
  .split(';')
  .map((s) => s.replace(/--.*$/gm, '').trim())
  .filter((s) => s.length > 10);

async function tableExists(name) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) AS c FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    name,
  );
  return Number(rows[0].c) > 0;
}

async function columnExists(table, column) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    table,
    column,
  );
  return Number(rows[0].c) > 0;
}

async function indexExists(table, indexName) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) AS c FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    table,
    indexName,
  );
  return Number(rows[0].c) > 0;
}

async function main() {
  const user = await prisma.$queryRawUnsafe('SELECT CURRENT_USER() AS u');
  console.log('Conectado como', user[0].u);

  let ok = 0;
  let skip = 0;
  let fail = 0;

  for (const stmt of parts) {
    const upper = stmt.toUpperCase();
    try {
      // Idempotencia básica
      if (upper.includes('DROP INDEX') && upper.includes('USUARIO_DOCUMENTO_KEY')) {
        if (!(await indexExists('Usuario', 'Usuario_documento_key'))) {
          console.log('SKIP (no existe índice): Usuario_documento_key');
          skip += 1;
          continue;
        }
      }
      if (upper.startsWith('CREATE TABLE IF NOT EXISTS')) {
        const m = stmt.match(/CREATE TABLE IF NOT EXISTS\s+`?(\w+)`?/i);
        if (m && (await tableExists(m[1]))) {
          console.log('SKIP (tabla existe):', m[1]);
          skip += 1;
          continue;
        }
      }
      if (upper.includes('ADD COLUMN')) {
        const tm = stmt.match(/ALTER TABLE\s+`?(\w+)`?/i);
        const cm = stmt.match(/ADD COLUMN\s+`?(\w+)`?/i);
        if (tm && cm && (await columnExists(tm[1], cm[1]))) {
          console.log(`SKIP (columna existe): ${tm[1]}.${cm[1]}`);
          skip += 1;
          continue;
        }
      }
      if (upper.startsWith('CREATE INDEX') && upper.includes('ENTRADA_TITULARESTADO_IDX')) {
        if (await indexExists('Entrada', 'Entrada_titularEstado_idx')) {
          console.log('SKIP (índice existe): Entrada_titularEstado_idx');
          skip += 1;
          continue;
        }
      }
      if (upper.startsWith('UPDATE') && upper.includes('TITULARESTADO')) {
        if (!(await columnExists('Entrada', 'titularEstado'))) {
          console.log('SKIP (aún no hay titularEstado)');
          skip += 1;
          continue;
        }
      }

      await prisma.$executeRawUnsafe(stmt);
      ok += 1;
      console.log('OK:', stmt.slice(0, 100).replace(/\s+/g, ' '));
    } catch (e) {
      fail += 1;
      console.error(
        'ERR:',
        String(e.message || e).slice(0, 180),
        '|',
        stmt.slice(0, 80).replace(/\s+/g, ' '),
      );
    }
  }

  console.log('\nResumen:', { ok, skip, fail });

  // Verificación rápida
  const checks = [
    ['IdentidadUsuario', null],
    ['AsignacionEntrada', null],
    ['VerificacionIdentidadIntento', null],
    ['Entrada', 'titularEstado'],
    ['Evento', 'permiteTransferencias'],
    ['Credencial', 'version'],
    ['AccesoEvento', 'verificacionIdentidad'],
  ];
  for (const [table, col] of checks) {
    if (col) {
      console.log(`  ${table}.${col}:`, (await columnExists(table, col)) ? 'OK' : 'FALTA');
    } else {
      console.log(`  ${table}:`, (await tableExists(table)) ? 'OK' : 'FALTA');
    }
  }

  if (fail) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
