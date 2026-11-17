import { Module } from '@nestjs/common';
import { ManillasService } from './manillas.service';
import { ManillasController } from './manillas.controller';
import { PuntosRetiroService } from './puntos-retiro.service';
import { PuntosRetiroController } from './puntos-retiro.controller';

@Module({
  controllers: [PuntosRetiroController, ManillasController],
  providers: [PuntosRetiroService, ManillasService],
})
export class ManillasModule {}
