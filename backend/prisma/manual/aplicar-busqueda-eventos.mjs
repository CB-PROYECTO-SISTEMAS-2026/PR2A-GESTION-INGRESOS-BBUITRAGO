import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadEnv() {
  try {
    const raw = readFileSync(join(__dirname, '../../.env'), 'utf8')
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (!m || process.env[m[1]]) continue
      let v = m[2].trim()
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1)
      }
      process.env[m[1]] = v
    }
  } catch {
    /* already in env */
  }
}

loadEnv()

const adminUrl = process.env.ADMIN_DATABASE_URL || process.env.DATABASE_URL
if (!adminUrl) {
  console.error('Falta DATABASE_URL o ADMIN_DATABASE_URL.')
  process.exit(1)
}

const sql = readFileSync(join(__dirname, 'alter_busqueda_eventos.sql'), 'utf8')
const statements = sql
  .split(';')
  .map((s) => s.trim())
  .filter(Boolean)

const admin = new PrismaClient({ datasources: { db: { url: adminUrl } } })

try {
  for (const stmt of statements) {
    await admin.$executeRawUnsafe(stmt)
  }
  console.log('Tablas BusquedaEvento* creadas o ya existían.')
} finally {
  await admin.$disconnect()
}