import { Module } from '@nestjs/common';
import { PersonalEventoController } from './personal-evento.controller';
import { PersonalEventoService } from './personal-evento.service';

@Module({
  controllers: [PersonalEventoController],
  providers: [PersonalEventoService],
})
export class PersonalEventoModule {}
