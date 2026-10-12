import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntradaEstado, EventoEstado, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizeDocument, normalizeEmail } from '../../common/security/user-identity';
import { ACCESO_CON_MANILLA, ENTRADA_INVALIDA } from '../entradas/entradas-emision';
import { BuscarEntradaDto, ListEntregasQuery, VincularManillaDto } from './dto/manillas.dto';
import { entregaSelect, nombreCompleto, presentarEntrega } from './manillas-helpers';

type AuthUser = { id: string; roles: Role[] };

const MAX_RESULTADOS = 20;
const MAX_ENTREGAS = 100;

const entradaClienteSelect = {
  id: true,
  codigo: true,
  estado: true,
  eventoId: true,
  categoria: { select: { nombre: true } },
  fecha: { select: { fecha: true } },
  titular: {
    select: {
      id: true,
      nombre: true,
      apellido: true,
      email: true,
      telefono: true,
      documento: true,
      fotoUrl: true,
      activo: true,
    },
  },
  manilla: {
    select: {
      codigoFisico: true,
      vinculada: true,
      vinculadaAt: true,
      puntoRetiro: { select: { nombre: true } },
      entregadaPor: { select: { nombre: true, apellido: true } },
    },
  },
} satisfies Prisma.EntradaSelect;

type EntradaCliente = Prisma.EntradaGetPayload<{ select: typeof entradaClienteSelect }>;

/**
 * HU-015 / HU-053 (supervisor): en su punto de entrega, el supervisor identifica la entrada del
 * cliente que reclama la manilla y la vincula a su cuenta. Desde ahí el cliente usa el QR físico.
 */
@Injectable()
export class ManillasService {
  constructor(private prisma: PrismaService) {}

  /** Puntos activos que atiende el supervisor (el admin ve todos) en eventos publicados con manilla. */
  async misPuntos(user: AuthUser) {
    const esAdmin = user.roles.includes(Role.ADMIN);
    const puntos = await this.prisma.puntoRetiroManilla.findMany({
      where: {
        activo: true,
        evento: { estado: EventoEstado.PUBLICADO, tipoAcceso: { in: ACCESO_CON_MANILLA } },
        ...(esAdmin ? {} : { supervisores: { some: { usuarioId: user.id, activo: true } } }),
      },
      orderBy: [{ evento: { titulo: 'asc' } }, { nombre: 'asc' }],
      select: {
        id: true,
        nombre: true,
        ubicacion: true,
        horario: true,
        evento: {
          select: {
            id: true,
            titulo: true,
            tipoAcceso: true,
            fechas: { orderBy: { fecha: 'asc' }, select: { fecha: true } },
          },
        },
        _count: { select: { manillas: { where: { vinculada: true } } } },
      },
    });
    return {
      puntos: puntos.map(({ _count, ...p }) => ({ ...p, manillasEntregadas: _count.manillas })),
    };
  }

  /**
   * Busca las entradas del evento del punto por el código del QR que muestra el cliente, su correo,
   * su documento o el código de una manilla ya entregada.
   */
  async buscar(user: AuthUser, dto: BuscarEntradaDto) {
    const punto = await this.requirePunto(user, dto.puntoId);
    const texto = dto.busqueda.trim();
    const codigos = [...new Set([texto, texto.toUpperCase()])];
    const documento = normalizeDocument(texto);

    const or: Prisma.EntradaWhereInput[] = [
      { codigo: { in: codigos } },
      { codigoQr: { in: codigos } },
      { manilla: { is: { codigoFisico: { in: codigos } } } },
    ];
    if (texto.includes('@')) or.push({ titular: { is: { email: normalizeEmail(texto) } } });
    if (documento) or.push({ titular: { is: { documento } } });

    const entradas = await this.prisma.entrada.findMany({
      where: { eventoId: punto.eventoId, OR: or },
      orderBy: { createdAt: 'asc' },
      take: MAX_RESULTADOS,
      select: entradaClienteSelect,
    });

    if (!entradas.length) {
      const otroEvento = await this.prisma.entrada.findFirst({
        where: { OR: [{ codigo: { in: codigos } }, { codigoQr: { in: codigos } }] },
        select: { id: true },
      });
      if (otroEvento) throw new BadRequestException('Esta entrada pertenece a otro evento.');
      throw new NotFoundException('No se encontró ninguna entrada de este evento con ese código, correo o documento.');
    }
    return { entradas: entradas.map((e) => this.presentarEntrada(e)) };
  }

  async vincular(user: AuthUser, dto: VincularManillaDto) {
    const punto = await this.requirePunto(user, dto.puntoId);
    const codigoManilla = dto.codigoManilla;

    try {
      const manillaId = await this.prisma.$transaction(async (tx) => {
        const entrada = await tx.entrada.findUnique({ where: { id: dto.entradaId }, select: entradaClienteSelect });
        if (!entrada || entrada.eventoId !== punto.eventoId) {
          throw new NotFoundException('La entrada no pertenece al evento de este punto de entrega.');
        }
        const bloqueo = this.motivoNoVinculable(entrada);
        if (bloqueo) throw new BadRequestException(bloqueo);

        const existente = await tx.manilla.findUnique({
          where: { eventoId_codigoFisico: { eventoId: punto.eventoId, codigoFisico: codigoManilla } },
          select: { id: true, vinculada: true, entradaId: true },
        });
        if (existente && (existente.vinculada || existente.entradaId)) {
          throw new ConflictException(`La manilla ${codigoManilla} ya fue entregada a otra persona. Usa otra manilla.`);
        }

        const data = {
          entradaId: entrada.id,
          vinculada: true,
          vinculadaAt: new Date(),
          puntoRetiroId: punto.id,
          entregadaPorId: user.id,
        };
        const manilla = existente
          ? await tx.manilla.update({ where: { id: existente.id }, data, select: { id: true } })
          : await tx.manilla.create({
              data: { ...data, eventoId: punto.eventoId, codigoFisico: codigoManilla },
              select: { id: true },
            });

        if (entrada.estado === EntradaEstado.GENERADA) {
          await tx.entrada.update({ where: { id: entrada.id }, data: { estado: EntradaEstado.ASIGNADA } });
        }
        return manilla.id;
      });

      const entrega = await this.prisma.manilla.findUniqueOrThrow({ where: { id: manillaId }, select: entregaSelect });
      return presentarEntrega(entrega);
    } catch (err) {
      // Otro supervisor vinculó la misma manilla o la misma entrada al mismo tiempo.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('La manilla o la entrada se acaba de vincular en otro punto. Vuelve a buscar al cliente.');
      }
      throw err;
    }
  }

  /** Historial de manillas que entregó el propio supervisor (opcionalmente en un punto). */
  async misEntregas(user: AuthUser, query: ListEntregasQuery) {
    const manillas = await this.prisma.manilla.findMany({
      where: {
        vinculada: true,
        entregadaPorId: user.id,
        ...(query.puntoId ? { puntoRetiroId: query.puntoId } : {}),
      },
      orderBy: { vinculadaAt: 'desc' },
      take: MAX_ENTREGAS,
      select: entregaSelect,
    });
    return { entregas: manillas.map(presentarEntrega) };
  }

  private presentarEntrada(e: EntradaCliente) {
    const motivo = this.motivoNoVinculable(e);
    return {
      id: e.id,
      codigo: e.codigo,
      estado: e.estado,
      categoria: e.categoria.nombre,
      fecha: e.fecha?.fecha ?? null,
      cliente: e.titular
        ? {
            id: e.titular.id,
            nombre: nombreCompleto(e.titular),
            email: e.titular.email,
            telefono: e.titular.telefono,
            documento: e.titular.documento,
            fotoUrl: e.titular.fotoUrl,
          }
        : null,
      manilla: e.manilla?.vinculada
        ? {
            codigo: e.manilla.codigoFisico,
            entregadaAt: e.manilla.vinculadaAt,
            puntoRetiro: e.manilla.puntoRetiro?.nombre ?? null,
            supervisor: nombreCompleto(e.manilla.entregadaPor),
          }
        : null,
      puedeVincular: !motivo,
      motivo,
    };
  }

  private motivoNoVinculable(e: EntradaCliente) {
    if (ENTRADA_INVALIDA.includes(e.estado)) return 'La entrada está anulada o fue reembolsada.';
    if (!e.titular || !e.titular.activo) {
      return 'La entrada no tiene un titular con cuenta activa. La persona debe registrarse antes de recoger su manilla.';
    }
    if (e.manilla?.vinculada) return `Esta entrada ya tiene la manilla ${e.manilla.codigoFisico} vinculada.`;
    return null;
  }

  private async requirePunto(user: AuthUser, puntoId: string) {
    const punto = await this.prisma.puntoRetiroManilla.findUnique({
      where: { id: puntoId },
      select: {
        id: true,
        eventoId: true,
        activo: true,
        evento: { select: { estado: true, tipoAcceso: true } },
        supervisores: { where: { usuarioId: user.id, activo: true }, select: { id: true } },
      },
    });
    if (!punto) throw new NotFoundException('Punto de entrega no encontrado');
    if (!user.roles.includes(Role.ADMIN) && !punto.supervisores.length) {
      throw new ForbiddenException('No estás asignado a este punto de entrega.');
    }
    if (!punto.activo) throw new BadRequestException('Este punto de entrega está desactivado.');
    if (punto.evento.estado !== EventoEstado.PUBLICADO) {
      throw new BadRequestException('El evento de este punto no está publicado.');
    }
    if (!ACCESO_CON_MANILLA.includes(punto.evento.tipoAcceso)) {
      throw new BadRequestException('Este evento usa QR digital y no entrega manillas físicas.');
    }
    return punto;
  }
}
