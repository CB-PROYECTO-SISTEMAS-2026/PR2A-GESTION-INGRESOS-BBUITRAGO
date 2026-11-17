import { Module } from '@nestjs/common';
import { SaldoModule } from '../saldo/saldo.module';
import {
  RecargasAdminController,
  RecargasController,
} from './recargas.controller';
import { RecargasService } from './recargas.service';
import { RecargasAdminService } from './recargas-admin.service';

@Module({
  imports: [SaldoModule],
  controllers: [RecargasController, RecargasAdminController],
  providers: [RecargasService, RecargasAdminService],
})
export class RecargasModule {}
