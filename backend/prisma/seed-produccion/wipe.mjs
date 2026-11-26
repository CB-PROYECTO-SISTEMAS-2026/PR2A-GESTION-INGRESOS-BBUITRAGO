/** Vacía todas las tablas del schema EvenTix respetando FKs vía FOREIGN_KEY_CHECKS. */
export async function wipeDatabase(prisma) {
  const tables = [
    'IncidenciaEvento',
    'IncidenciaRecarga',
    'TransaccionSaldo',
    'DetalleVenta',
    'Venta',
    'RetiroGanancias',
    'LiquidacionEvento',
    'AccesoRechazo',
    'AccesoEvento',
    'Manilla',
    'SupervisorPuntoRetiro',
    'PuntoRetiroManilla',
    'Credencial',
    'ReembolsoEntrada',
    'CompraEntradaItem',
    'PagoQR',
    'Entrada',
    'TicketPool',
    'CompraEntrada',
    'SaldoEvento',
    'StaffEvento',
    'CategoriaFecha',
    'CategoriaEntrada',
    'FechaEvento',
    'MapaHistorial',
    'InvitacionAyudante',
    'AyudanteNegocio',
    'RolNegocio',
    'Producto',
    'SolicitudNegocio',
    'Negocio',
    'Evento',
    'SolicitudEvento',
    'InvitacionUsuario',
    'PasswordResetToken',
    'UsuarioRol',
    'Archivo',
    'Usuario',
  ];

  await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0');
  for (const table of tables) {
    await prisma.$executeRawUnsafe(`DELETE FROM \`${table}\``);
  }
  await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1');
}
