require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
Promise.all([
  p.usuario.count(),
  p.evento.count(),
  p.negocio.count(),
  p.ticketPool.count(),
  p.compraEntrada.count(),
  p.entrada.count(),
  p.venta.count(),
])
  .then(([usuarios, eventos, negocios, pool, compras, entradas, ventas]) => {
    console.log({ usuarios, eventos, negocios, pool, compras, entradas, ventas });
  })
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => p.$disconnect());
