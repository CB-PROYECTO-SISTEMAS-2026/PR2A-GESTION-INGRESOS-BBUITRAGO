import { Module } from '@nestjs/common';
import { CodigoClienteService } from './codigo-cliente.service';
import { MovimientosController } from './movimientos.controller';
import { MovimientosService } from './movimientos.service';

/**
 * Saldo por evento: consulta de saldos y movimientos (HU-020) y la identificación del cliente por
 * QR o manilla, que comparten el punto de venta y el recargador.
 */
@Module({
  controllers: [MovimientosController],
  providers: [CodigoClienteService, MovimientosService],
  exports: [CodigoClienteService],
})
export class SaldoModule {}
