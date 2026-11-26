/** Borrado total respetando FKs (orden de hijos → padres). */
async function wipeAll(prisma) {
  const steps = [
    () => prisma.incidenciaRecarga.deleteMany(),
    () => prisma.transaccionSaldo.deleteMany(),
    () => prisma.detalleVenta.deleteMany(),
    () => prisma.venta.deleteMany(),
    () => prisma.incidenciaEvento.deleteMany(),
    () => prisma.accesoEvento.deleteMany(),
    () => prisma.accesoRechazo.deleteMany(),
    () => prisma.reembolsoEntrada.deleteMany(),
    () => prisma.manilla.deleteMany(),
    () => prisma.supervisorPuntoRetiro.deleteMany(),
    () => prisma.credencial.deleteMany(),
    () => prisma.compraEntradaItem.deleteMany(),
    () => prisma.entrada.deleteMany(),
    () => prisma.pagoQR.deleteMany(),
    () => prisma.compraEntrada.deleteMany(),
    () => prisma.ticketPool.deleteMany(),
    () => prisma.categoriaFecha.deleteMany(),
    () => prisma.categoriaEntrada.deleteMany(),
    () => prisma.fechaEvento.deleteMany(),
    () => prisma.liquidacionEvento.deleteMany(),
    () => prisma.mapaHistorial.deleteMany(),
    () => prisma.staffEvento.deleteMany(),
    () => prisma.saldoEvento.deleteMany(),
    () => prisma.solicitudNegocio.deleteMany(),
    () => prisma.invitacionAyudante.deleteMany(),
    () => prisma.ayudanteNegocio.deleteMany(),
    () => prisma.producto.deleteMany(),
    () => prisma.rolNegocio.deleteMany(),
    () => prisma.retiroGanancias.deleteMany(),
    () => prisma.puntoRetiroManilla.deleteMany(),
    () => prisma.negocio.deleteMany(),
    () => prisma.evento.deleteMany(),
    () => prisma.solicitudEvento.deleteMany(),
    () => prisma.invitacionUsuario.deleteMany(),
    () => prisma.passwordResetToken.deleteMany(),
    () => prisma.archivo.deleteMany(),
    () => prisma.usuarioRol.deleteMany(),
    () => prisma.usuario.deleteMany(),
  ];
  for (const step of steps) {
    await step();
  }
}

module.exports = { wipeAll };