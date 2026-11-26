import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const url = process.env.ADMIN_DATABASE_URL || process.env.DATABASE_URL
if (!url) {
  console.error('Falta DATABASE_URL o ADMIN_DATABASE_URL')
  process.exit(1)
}

const prisma = new PrismaClient({ datasources: { db: { url } } })
const sqlPath = path.join(__dirname, '../prisma/manual/alter_organizador_productora.sql')
const sql = fs.readFileSync(sqlPath, 'utf8')
const parts = sql
  .split(';')
  .map((s) => s.replace(/--.*$/gm, '').trim())
  .filter((s) => s.length > 10)

async function columnExists(table, column) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    table,
    column,
  )
  return Number(rows[0].c) > 0
}

async function main() {
  for (const stmt of parts) {
    const upper = stmt.toUpperCase()
    if (upper.includes('ADD COLUMN') && (await columnExists('Usuario', 'nombreProductora'))) {
      console.log('SKIP (columna existe): Usuario.nombreProductora')
      continue
    }
    await prisma.$executeRawUnsafe(stmt)
    console.log('OK:', stmt.slice(0, 100).replace(/\s+/g, ' '))
  }
  console.log(
    'Usuario.nombreProductora:',
    (await columnExists('Usuario', 'nombreProductora')) ? 'OK' : 'FALTA',
  )
}

main()
  .catch((e) => {
    console.error(e.message || e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
