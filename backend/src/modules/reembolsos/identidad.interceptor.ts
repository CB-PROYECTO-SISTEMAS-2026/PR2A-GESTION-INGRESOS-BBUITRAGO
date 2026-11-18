import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { mergeMap } from 'rxjs';
import { DevolucionesController } from '../devoluciones/devoluciones.controller';
import { IdentidadService } from './identidad.service';

const SIN_FOTO =
  'No se pueden devolver puntos sin la foto del primer ingreso al evento.';

@Injectable()
export class IdentidadInterceptor implements NestInterceptor {
  constructor(private identidad: IdentidadService) {}
  async intercept(ctx: ExecutionContext, next: CallHandler) {
    if (ctx.getClass() !== DevolucionesController) return next.handle();
    const req = ctx.switchToHttp().getRequest();
    const handler = ctx.getHandler();
    if (handler === DevolucionesController.prototype.consultarCliente) {
      return next.handle().pipe(
        mergeMap(async (resultado) => {
          const datos = await this.identidad.consultar(
            req.user.id,
            req.query.eventoId,
            req.query.codigo,
          );
          return {
            ...resultado,
            nombre: datos.nombre,
            fotoIngreso: datos.fotoIngreso,
            movimientos: datos.movimientos,
            ...(!datos.fotoIngreso && {
              puedeDevolver: false,
              montoDevolvible: '0.00',
              motivo: SIN_FOTO,
            }),
          };
        }),
      );
    }
    if (handler === DevolucionesController.prototype.devolver) {
      const { eventoId, codigo } = req.body ?? {};
      if (
        typeof eventoId !== 'string' ||
        typeof codigo !== 'string' ||
        !eventoId ||
        !codigo ||
        codigo.length > 191
      )
        throw new BadRequestException('Evento o código inválido.');
      const datos = await this.identidad.consultar(
        req.user.id,
        eventoId,
        codigo,
      );
      if (!datos.fotoIngreso) throw new BadRequestException(SIN_FOTO);
      return next.handle().pipe(
        mergeMap(async (resultado) => {
          if (resultado.repetido) {
            await this.identidad.validarReintento(
              resultado.transaccionId, req.user.id, eventoId, datos.usuarioId, Number(req.body.montoEsperado),
            );
          }
          return resultado;
        }),
      );
    }
    return next.handle();
  }
}
