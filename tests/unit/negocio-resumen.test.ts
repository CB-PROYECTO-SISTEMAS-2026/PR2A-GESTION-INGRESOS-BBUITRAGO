/** Integración de HU-037: ranking por ayudante y aislamiento por dueño, sin Aiven. */
import { ConfigService } from '@nestjs/config';
import { ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { NegocioVentasService } from '../../backend/src/modules/pos/negocio-ventas.service';
import { PrismaService } from '../../backend/src/prisma/prisma.service';

function escenario() {
  const venta = (ayudanteId: string, total: string) => ({
    ayudanteId, total: new Prisma.Decimal(total),
    createdAt: new Date('2026-11-17T16:00:00Z'), eventoId: 'evento',
  });
  const prisma = {
    negocio: { findMany: jest.fn().mockResolvedValue([{ id: 'propio', nombre: 'Puesto' }]) },
    venta: {
      findMany: jest.fn().mockImplementation(({ select }: { select: Record<string, unknown> }) =>
        Promise.resolve(select.ayudanteId && !select.id ? [venta('a', '0.10'), venta('a', '0.20'), venta('b', '20')] : [])),
      groupBy: jest.fn().mockResolvedValue([{ eventoId: 'evento' }]),
    },
    detalleVenta: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { cantidad: 3 } }),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    ayudanteNegocio: { count: jest.fn().mockResolvedValue(2) },
    solicitudNegocio: { findMany: jest.fn().mockResolvedValue([]) },
    evento: { findMany: jest.fn().mockResolvedValue([{ id: 'evento', titulo: 'Evento' }]) },
    producto: { findMany: jest.fn().mockResolvedValue([]) },
    usuario: { findMany: jest.fn().mockResolvedValue([
      { id: 'a', nombre: 'Ana', apellido: 'Perez' },
      { id: 'b', nombre: 'Beto', apellido: 'Lopez' },
    ]) },
  };
  const servicio = new NegocioVentasService(
    prisma as unknown as PrismaService,
    new ConfigService({ APP_TIMEZONE: 'America/La_Paz' }),
  );
  return { prisma, servicio };
}

test('conserva ranking y montos exactos de Rocabado, consultando solo negocios propios', async () => {
  const { prisma, servicio } = escenario();
  const resultado = await servicio.resumen('dueno', { desde: '2026-11-17', hasta: '2026-11-17' });
  expect(resultado.kpis.ventasTotales).toBe('20.30');
  expect(resultado.porAyudante).toEqual([
    { ayudanteId: 'b', nombre: 'Beto Lopez', total: '20.00', transacciones: 1, ticketPromedio: '20.00' },
    { ayudanteId: 'a', nombre: 'Ana Perez', total: '0.30', transacciones: 2, ticketPromedio: '0.15' },
  ]);
  expect(prisma.negocio.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { duenoId: 'dueno' } }));
  expect(prisma.venta.findMany).toHaveBeenCalledWith(expect.objectContaining({
    where: expect.objectContaining({ negocioId: { in: ['propio'] } }),
  }));
});

test('rechaza consultar un negocio ajeno antes de consultar ventas', async () => {
  const { prisma, servicio } = escenario();
  await expect(servicio.resumen('dueno', { negocioId: 'ajeno' })).rejects.toBeInstanceOf(ForbiddenException);
  expect(prisma.venta.findMany).not.toHaveBeenCalled();
});
