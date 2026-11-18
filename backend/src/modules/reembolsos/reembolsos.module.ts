import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { SaldoModule } from '../saldo/saldo.module';
import { IdentidadInterceptor } from './identidad.interceptor';
import { IdentidadService } from './identidad.service';
import { ReembolsoEntradasService } from './entradas.service';
import { ReembolsosController } from './reembolsos.controller';

@Module({
  imports: [SaldoModule],
  controllers: [ReembolsosController],
  providers: [
    IdentidadService,
    ReembolsoEntradasService,
    { provide: APP_INTERCEPTOR, useClass: IdentidadInterceptor },
  ],
})
export class ReembolsosModule {}
