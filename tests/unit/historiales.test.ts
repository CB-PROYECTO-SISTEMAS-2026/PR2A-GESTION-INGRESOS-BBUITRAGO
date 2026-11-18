import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MovimientosService } from '../../backend/src/modules/saldo/movimientos.service';
import { PrismaService } from '../../backend/src/prisma/prisma.service';

function escenario(asignado: boolean) {
  const db = {
    staffEvento: { findFirst: jest.fn().mockResolvedValue(asignado ? { id: 'staff' } : null) },
    transaccionSaldo: { count: jest.fn().mockResolvedValue(51), findMany: jest.fn().mockResolvedValue([]) },
    $transaction: (consultas: Promise<unknown>[]) => Promise.all(consultas),
  };
  return { db, servicio: new MovimientosService(db as unknown as PrismaService, new ConfigService()) };
}

test('rechaza al encargado no asignado antes de leer transacciones', async () => {
  const { db, servicio } = escenario(false);
  await expect(servicio.devolucionesPorEncargado('operador', { eventoId: 'evento' })).rejects.toThrow(ForbiddenException);
  expect(db.transaccionSaldo.findMany).not.toHaveBeenCalled();
});

test('lista solo devoluciones propias completadas en el evento y pagina el historial', async () => {
  const { db, servicio } = escenario(true);
  const resultado = await servicio.devolucionesPorEncargado('operador', { eventoId: 'evento', page: 2 });
  expect(db.staffEvento.findFirst.mock.calls[0][0].where).toEqual({
    usuarioId: 'operador', eventoId: 'evento', role: 'DEVOLUCIONES', activo: true,
  });
  const where = { eventoId: 'evento', operadorId: 'operador', tipo: 'DEVOLUCION', estado: 'COMPLETADA' };
  expect(db.transaccionSaldo.count).toHaveBeenCalledWith({ where });
  expect(db.transaccionSaldo.findMany).toHaveBeenCalledWith(expect.objectContaining({ where, skip: 50, take: 50 }));
  expect(resultado.cantidad).toBe(51);
});
