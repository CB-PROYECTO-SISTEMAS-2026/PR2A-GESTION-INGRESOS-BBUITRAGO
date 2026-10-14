import { Controller, Get, UseGuards } from '@nestjs/common';
import { EntradasService } from './entradas.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('api/entradas')
@UseGuards(JwtAuthGuard)
export class EntradasController {
  constructor(private entradasService: EntradasService) {}

  @Get('mias')
  mias(@CurrentUser('id') userId: string) {
    return this.entradasService.misEntradas(userId);
  }
}
