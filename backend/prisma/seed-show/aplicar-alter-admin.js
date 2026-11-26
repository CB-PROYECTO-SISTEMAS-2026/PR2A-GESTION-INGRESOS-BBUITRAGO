require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const url = process.env.ADMIN_DATABASE_URL || process.env.DATABASE_URL;
if (!url || !url.includes('avnadmin')) {
  console.error('Falta ADMIN_DATABASE_URL con usuario avnadmin');
  process.exit(1);
}

const p = new PrismaClient({ datasources: { db: { url } } });

async function colExists(col) {
  const rows = await p.$queryRawUnsafe(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ReembolsoEntrada' AND COLUMN_NAME = ?`,
    col,
  );
  return Number(rows[0].c) > 0;
}

async function main() {
  const user = await p.$queryRawUnsafe('SELECT CURRENT_USER() AS u');
  console.log('Conectado como', user[0].u);

  const needed = ['evidenciaUrl', 'pagadoAt', 'pagadoPorId'];
  const missing = [];
  for (const c of needed) {
    if (!(await colExists(c))) missing.push(c);
  }
  if (!missing.length) {
    console.log('Columnas ya existen. Nada que alterar.');
  } else {
    console.log('Agregando:', missing.join(', '));
    await p.$executeRawUnsafe(`
      ALTER TABLE \`ReembolsoEntrada\`
        ADD COLUMN \`evidenciaUrl\` VARCHAR(191) NULL,
        ADD COLUMN \`pagadoAt\` DATETIME(3) NULL,
        ADD COLUMN \`pagadoPorId\` VARCHAR(191) NULL
    `);
    console.log('ALTER OK');
  }

  const grants = await p.$queryRawUnsafe('SHOW GRANTS');
  console.log(grants[0]);
}

main()
  .catch((e) => {
    console.error(e.message || e);
    process.exitCode = 1;
  })
  .finally(() => p.$disconnect());
