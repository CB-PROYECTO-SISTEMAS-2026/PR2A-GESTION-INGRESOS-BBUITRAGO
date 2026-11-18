import { Injectable } from '@nestjs/common';
import { Workbook } from 'exceljs';
import { PrismaService } from '../../prisma/prisma.service';
import { csvCell } from '../pos/pos-helpers';

@Injectable()
export class ExportacionVentas {
  constructor(private db: PrismaService) {}
  async generar(eventoId: string, formato: 'csv' | 'xlsx') {
    const [entradas, ventas] = await this.db.$transaction([
      this.db.compraEntrada.findMany({
        where: { eventoId, estado: 'APROBADA' },
        select: {
          id: true,
          revisadoAt: true,
          createdAt: true,
          montoTotal: true,
        },
        orderBy: { id: 'asc' },
      }),
      this.db.venta.findMany({
        where: { eventoId },
        select: {
          id: true,
          createdAt: true,
          total: true,
          negocio: { select: { nombre: true } },
        },
        orderBy: { id: 'asc' },
      }),
    ]);
    const encabezado = [
      'Tipo',
      'ID',
      'Fecha UTC',
      'Negocio',
      'Venta bruta (Bs)',
    ];
    const filas = [
      ...entradas.map((e) => [
        'Entrada',
        e.id,
        (e.revisadoAt ?? e.createdAt).toISOString(),
        '',
        e.montoTotal.toFixed(2),
      ]),
      ...ventas.map((v) => [
        'Negocio',
        v.id,
        v.createdAt.toISOString(),
        v.negocio.nombre,
        v.total.toFixed(2),
      ]),
    ].sort((a, b) => a[2].localeCompare(b[2]) || a[1].localeCompare(b[1]));
    if (formato === 'csv')
      return Buffer.from(
        '\uFEFF' +
          [encabezado, ...filas]
            .map((f) => f.map(csvCell).join(';'))
            .join('\r\n') +
          '\r\n',
      );
    const libro = new Workbook();
    const hoja = libro.addWorksheet('Ventas');
    hoja.addRow(encabezado).font = { bold: true };
    for (const [tipo, id, fecha, negocio, total] of filas)
      hoja.addRow([tipo, id, fecha, negocio, Number(total)]);
    [16, 32, 28, 32, 20].forEach(
      (width, i) => (hoja.getColumn(i + 1).width = width),
    );
    hoja.getColumn(5).numFmt = '#,##0.00';
    return Buffer.from(await libro.xlsx.writeBuffer());
  }
}
