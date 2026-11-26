import { Module } from '@nestjs/common';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { EventBusquedasController } from './event-busquedas.controller';
import { EventBusquedasService } from './event-busquedas.service';

@Module({
  controllers: [EventsController, EventBusquedasController],
  providers: [EventsService, EventBusquedasService],
  exports: [EventsService],
})
export class EventsModule {}
