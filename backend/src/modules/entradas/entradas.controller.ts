import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { EntradasService } from './entradas.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MisEntradasQueryDto } from './dto/mis-entradas-query.dto';

@Controller('api/entradas')
@UseGuards(JwtAuthGuard)
export class EntradasController {
  constructor(private entradasService: EntradasService) {}

  @Get('mias')
  mias(@CurrentUser('id') userId: string, @Query() query: MisEntradasQueryDto) {
    return this.entradasService.misEntradas(userId, query);
  }
}
