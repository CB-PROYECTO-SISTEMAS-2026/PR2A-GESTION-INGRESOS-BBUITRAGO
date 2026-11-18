import { Module } from '@nestjs/common';
import { SaldoModule } from '../saldo/saldo.module';
import { DevolucionesController } from './devoluciones.controller';
import { DevolucionesService } from './devoluciones.service';

@Module({
  imports: [SaldoModule],
  controllers: [DevolucionesController],
  providers: [DevolucionesService],
})
export class DevolucionesModule {}
