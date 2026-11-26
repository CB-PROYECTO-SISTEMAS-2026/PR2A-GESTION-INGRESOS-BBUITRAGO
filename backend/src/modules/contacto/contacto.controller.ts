import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ContactoService } from './contacto.service';
import { ContactoDto } from './dto/contacto.dto';

@Controller('api/contacto')
export class ContactoController {
  constructor(private contactoService: ContactoService) {}

  @Post()
  @HttpCode(200)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  enviar(@Body() dto: ContactoDto) {
    return this.contactoService.enviar(dto);
  }
}
