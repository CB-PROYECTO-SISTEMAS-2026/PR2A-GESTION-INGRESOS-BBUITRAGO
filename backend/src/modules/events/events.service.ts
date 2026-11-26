import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EventoEstado,
  LiquidacionEstado,
  MapChangeTipo,
  Prisma,
  Role,
  SolicitudEstado,
  TipoAcceso,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../common/storage/storage.service';
import { MailService } from '../../common/mail/mail.service';
import {
  cuposPorDia,
  POOL_TX_TIMEOUT_MS,
  sincronizarPool,
} from '../tickets/cupos';
import {
  CreateEventoDto,
  CreateSolicitudDto,
  MAX_CATEGORIAS_EVENTO,
  RevisarSolicitudDto,
  UpdateEventoDto,
  UpdateMapaDto,
} from './dto/events.dto';
import {
  buildSchedule,
  dateToDay,
  dayToDate,
  Schedule,
  todayIn,
} from './event-schedule';
import {
  buildCronograma,
  Cronograma,
  isCronograma,
  normalizeList,
} from './event-content';

type AuthUser = { id: string; roles: Role[] };

const organizadorSelect = {
  id: true,
  nombre: true,
  apellido: true,
  nombreProductora: true,
  email: true,
  telefono: true,
};

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);
  private readonly timeZone: string;

  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private mail: MailService,
    config: ConfigService,
  ) {
    this.timeZone = config.get<string>('APP_TIMEZONE', 'America/La_Paz');
  }

  private today() {
    return todayIn(this.timeZone);
  }

  /** Catálogo público/admin de temáticas (CategoriaEvento ≠ CategoriaEntrada). */
  listCategoriasEvento() {
    return this.prisma.categoriaEvento.findMany({
      where: { activa: true },
      orderBy: { orden: 'asc' },
      select: {
        id: true,
        nombre: true,
        slug: true,
        esMusical: true,
        orden: true,
      },
    });
  }

  /**
   * Valida IDs de CategoriaEvento (1–3). Si exige Spotify musical, limpia o
   * rechaza según haya categoría con esMusical.
   */
  private async resolveCategoriasEvento(
    ids: string[],
    spotifyUrl?: string | null,
  ) {
    const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
    if (unique.length < 1 || unique.length > MAX_CATEGORIAS_EVENTO) {
      throw new BadRequestException(
        `Elige entre 1 y ${MAX_CATEGORIAS_EVENTO} categorías del evento.`,
      );
    }
    const rows = await this.prisma.categoriaEvento.findMany({
      where: { id: { in: unique }, activa: true },
      select: { id: true, esMusical: true, nombre: true },
    });
    if (rows.length !== unique.length) {
      throw new BadRequestException(
        'Una o más categorías del evento no son válidas.',
      );
    }
    const musical = rows.some((r) => r.esMusical);
    const spotify =
      musical && spotifyUrl && String(spotifyUrl).trim()
        ? String(spotifyUrl).trim()
        : null;
    if (spotifyUrl && String(spotifyUrl).trim() && !musical) {
      throw new BadRequestException(
        'El enlace de Spotify solo aplica si eliges una categoría musical (Conciertos, Urbano, Electrónica o Folclore).',
      );
    }
    return { ids: unique, spotifyUrl: spotify, musical };
  }

  // Solicitudes

  async createSolicitud(
    organizadorId: string,
    dto: CreateSolicitudDto,
    mapa?: Express.Multer.File,
  ) {
    if (!mapa)
      throw new BadRequestException(
        'Adjunta el mapa de la zona del evento (imagen o PDF).',
      );
    const schedule = buildSchedule(dto, { today: this.today() });
    const cats = await this.resolveCategoriasEvento(
      dto.categoriaEventoIds,
      dto.spotifyUrl,
    );
    const stored = await this.storage.upload(mapa, 'mapas', 'imageOrPdf');
    const empresaTrim = dto.empresa?.trim() || '';
    let empresa: string | null = empresaTrim || null;
    if (!empresa) {
      const org = await this.prisma.usuario.findUnique({
        where: { id: organizadorId },
        select: { nombreProductora: true },
      });
      const fromProfile = org?.nombreProductora?.trim();
      if (fromProfile) empresa = fromProfile;
    }

    try {
      return await this.prisma.solicitudEvento.create({
        data: {
          organizadorId,
          nombreEvento: dto.nombreEvento,
          reembolsoHoras: dto.reembolsoHoras,
          descripcion: dto.descripcion,
          ubicacion: dto.ubicacion,
          ubicacionUrl: dto.ubicacionUrl,
          capacidad: dto.capacidad,
          empresa,
          fechaInicio: dayToDate(schedule.fechaInicio),
          fechaFin: schedule.fechaFin ? dayToDate(schedule.fechaFin) : null,
          horaInicio: schedule.horaInicio,
          horaFin: schedule.horaFin,
          mapaUrl: stored.url,
          mapaNombre: stored.nombre,
          spotifyUrl: cats.spotifyUrl,
          estado: SolicitudEstado.PENDIENTE,
          categoriasEvento: {
            create: cats.ids.map((categoriaEventoId) => ({
              categoriaEventoId,
            })),
          },
          mapHistory: {
            create: {
              mapaUrl: stored.url,
              mapaNombre: stored.nombre,
              tipo: MapChangeTipo.CREACION,
              nota: 'Mapa enviado con la solicitud',
            },
          },
        },
        include: {
          categoriasEvento: {
            include: {
              categoriaEvento: {
                select: {
                  id: true,
                  nombre: true,
                  slug: true,
                  esMusical: true,
                },
              },
            },
          },
        },
      });
    } catch (err) {
      await this.storage.remove(stored.publicId);
      throw err;
    }
  }

  private readonly categoriasEventoInclude = {
    categoriasEvento: {
      include: {
        categoriaEvento: {
          select: {
            id: true,
            nombre: true,
            slug: true,
            esMusical: true,
            orden: true,
          },
        },
      },
    },
  } as const;

  misSolicitudes(organizadorId: string) {
    return this.prisma.solicitudEvento.findMany({
      where: { organizadorId },
      orderBy: { createdAt: 'desc' },
      include: {
        evento: { select: { id: true, titulo: true, estado: true } },
        mapHistory: { orderBy: { createdAt: 'desc' } },
        ...this.categoriasEventoInclude,
      },
    });
  }

  allSolicitudes(estado?: SolicitudEstado) {
    return this.prisma.solicitudEvento.findMany({
      where: estado ? { estado } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        organizador: { select: organizadorSelect },
        evento: { select: { id: true, titulo: true, estado: true } },
        ...this.categoriasEventoInclude,
      },
    });
  }

  async getSolicitud(id: string, user: AuthUser) {
    const solicitud = await this.prisma.solicitudEvento.findUnique({
      where: { id },
      include: {
        ...this.categoriasEventoInclude,
        organizador: { select: { ...organizadorSelect, documento: true } },
        evento: { select: { id: true, titulo: true, estado: true } },
        mapHistory: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!solicitud) throw new NotFoundException('Solicitud no encontrada');
    if (
      !user.roles.includes(Role.ADMIN) &&
      solicitud.organizadorId !== user.id
    ) {
      throw new ForbiddenException('No autorizado');
    }
    return solicitud;
  }

  async revisarSolicitud(id: string, dto: RevisarSolicitudDto) {
    const solicitud = await this.prisma.solicitudEvento.findUnique({
      where: { id },
    });
    if (!solicitud) throw new NotFoundException('Solicitud no encontrada');
    if (solicitud.estado !== SolicitudEstado.PENDIENTE) {
      throw new BadRequestException('La solicitud ya fue revisada');
    }
    const updated = await this.prisma.solicitudEvento.update({
      where: { id },
      data: {
        estado: dto.estado,
        observaciones: dto.observaciones?.trim() || null,
      },
      include: { organizador: { select: organizadorSelect } },
    });
    const correoEnviado = await this.notify(() =>
      this.mail.sendSolicitudRevisada(
        updated.organizador.email,
        updated.organizador.nombre,
        {
          nombre: updated.nombreEvento,
          aprobada: updated.estado === SolicitudEstado.APROBADA,
          observaciones: updated.observaciones,
        },
      ),
    );
    return { ...updated, correoEnviado };
  }

  /** La acción principal ya se guardó: si el correo falla se informa, pero no se revierte. */
  private async notify(send: () => Promise<void>) {
    try {
      await send();
      return true;
    } catch (err) {
      this.logger.warn(`Notificación no enviada: ${(err as Error).message}`);
      return false;
    }
  }

  /** El organizador sube una nueva versión del mapa; queda en el historial (HU-043). */
  async updateMapaSolicitud(
    id: string,
    user: AuthUser,
    mapa: Express.Multer.File | undefined,
    dto: UpdateMapaDto,
  ) {
    const solicitud = await this.prisma.solicitudEvento.findUnique({
      where: { id },
      include: { evento: { select: { id: true } } },
    });
    if (!solicitud) throw new NotFoundException('Solicitud no encontrada');
    if (solicitud.organizadorId !== user.id)
      throw new ForbiddenException('No autorizado');
    if (solicitud.estado === SolicitudEstado.RECHAZADA) {
      throw new BadRequestException(
        'No se puede actualizar el mapa de una solicitud rechazada.',
      );
    }

    const stored = await this.storage.upload(mapa, 'mapas', 'imageOrPdf');
    try {
      await this.prisma.$transaction([
        this.prisma.solicitudEvento.update({
          where: { id },
          data: { mapaUrl: stored.url, mapaNombre: stored.nombre },
        }),
        ...(solicitud.evento
          ? [
              this.prisma.evento.update({
                where: { id: solicitud.evento.id },
                data: { mapaUrl: stored.url },
              }),
            ]
          : []),
        this.prisma.mapaHistorial.create({
          data: {
            solicitudId: id,
            eventoId: solicitud.evento?.id,
            mapaUrl: stored.url,
            mapaNombre: stored.nombre,
            tipo: MapChangeTipo.ACTUALIZACION,
            nota: dto.nota?.trim() || 'Mapa actualizado por el organizador',
          },
        }),
      ]);
    } catch (err) {
      await this.storage.remove(stored.publicId);
      throw err;
    }
    return this.getSolicitud(id, user);
  }

  // Eventos

  async createEvento(dto: CreateEventoDto) {
    const schedule = buildSchedule(dto, { today: this.today() });
    const cronograma = buildCronograma(dto.cronograma, schedule);
    if (dto.estado && dto.estado !== EventoEstado.BORRADOR) {
      throw new BadRequestException(
        'El evento se crea como borrador. Podrás publicarlo después de subir su imagen y crear sus categorías de entrada.',
      );
    }
    let organizadorId = dto.organizadorId;
    let horas = dto.reembolsoHoras;
    let mapaUrl: string | null = null;
    let mapaNombre: string | null = null;
    let spotifyFromSolicitud: string | null | undefined;
    const solicitudId = dto.solicitudId;
    let categoriaIds = dto.categoriaEventoIds;

    if (solicitudId) {
      const solicitud = await this.prisma.solicitudEvento.findUnique({
        where: { id: solicitudId },
        include: {
          evento: { select: { id: true } },
          categoriasEvento: { select: { categoriaEventoId: true } },
        },
      });
      if (!solicitud) throw new NotFoundException('Solicitud no encontrada');
      if (solicitud.evento)
        throw new BadRequestException(
          'Ya existe un evento para esta solicitud',
        );
      if (solicitud.estado !== SolicitudEstado.APROBADA) {
        throw new BadRequestException(
          'La solicitud debe estar APROBADA para crear el evento',
        );
      }
      horas ??= solicitud.reembolsoHoras;
      organizadorId = solicitud.organizadorId;
      mapaUrl = solicitud.mapaUrl;
      mapaNombre = solicitud.mapaNombre;
      if (!categoriaIds?.length) {
        categoriaIds = solicitud.categoriasEvento.map(
          (c) => c.categoriaEventoId,
        );
      }
      if (dto.spotifyUrl === undefined) {
        spotifyFromSolicitud = solicitud.spotifyUrl;
      }
    } else {
      await this.ensureOrganizador(organizadorId);
    }

    if (!categoriaIds?.length) {
      throw new BadRequestException(
        'Elige al menos una categoría del evento (temática).',
      );
    }
    const cats = await this.resolveCategoriasEvento(
      categoriaIds,
      dto.spotifyUrl !== undefined ? dto.spotifyUrl : spotifyFromSolicitud,
    );

    return this.prisma.$transaction(async (tx) => {
      const evento = await tx.evento.create({
        data: {
          solicitudId,
          organizadorId: organizadorId!,
          titulo: dto.titulo,
          reembolsoHoras: horas,
          descripcion: dto.descripcion,
          ubicacion: dto.ubicacion,
          ubicacionUrl: dto.ubicacionUrl,
          servicios: normalizeList(dto.servicios),
          cronograma: cronograma as unknown as Prisma.InputJsonObject,
          tipoAcceso: dto.tipoAcceso ?? TipoAcceso.QR_DIGITAL,
          estado: EventoEstado.BORRADOR,
          mapaUrl,
          capacidad: dto.capacidad,
          spotifyUrl: cats.spotifyUrl,
          fechas: {
            create: schedule.days.map((day) => ({
              fecha: dayToDate(day),
              horaInicio: schedule.horaInicio,
              horaFin: schedule.horaFin,
            })),
          },
          categoriasEvento: {
            create: cats.ids.map((categoriaEventoId) => ({
              categoriaEventoId,
            })),
          },
        },
      });

      if (mapaUrl) {
        await tx.mapaHistorial.create({
          data: {
            eventoId: evento.id,
            solicitudId,
            mapaUrl,
            mapaNombre,
            tipo: MapChangeTipo.CREACION,
            nota: 'Mapa asociado al crear el evento',
          },
        });
      }

      if (solicitudId) {
        await tx.solicitudEvento.update({
          where: { id: solicitudId },
          data: { estado: SolicitudEstado.EVENTO_CREADO },
        });
      }

      return tx.evento.findUniqueOrThrow({
        where: { id: evento.id },
        include: {
          fechas: { orderBy: { fecha: 'asc' } },
          categorias: true,
          ...this.categoriasEventoInclude,
          solicitud: true,
        },
      });
    });
  }

  async updateEvento(id: string, dto: UpdateEventoDto) {
    const evento = await this.prisma.evento.findUnique({
      where: { id },
      include: {
        fechas: {
          orderBy: { fecha: 'asc' },
          include: { _count: { select: { entradas: true, accesos: true } } },
        },
        categorias: {
          select: {
            cupo: true,
            fechasDisponibles: {
              where: { disponible: true },
              select: { fechaId: true },
            },
          },
        },
        _count: { select: { entradas: true } },
      },
    });
    if (!evento) throw new NotFoundException('Evento no encontrado');
    if (
      dto.tipoAcceso !== undefined &&
      dto.tipoAcceso !== evento.tipoAcceso &&
      evento._count.entradas > 0
    ) {
      throw new BadRequestException(
        'No puedes cambiar el tipo de acceso porque el evento ya tiene entradas emitidas con el tipo actual.',
      );
    }

    const {
      fechaInicio,
      fechaFin,
      horaInicio,
      horaFin,
      servicios,
      cronograma: cronogramaDto,
      transferenciaHasta,
      categoriaEventoIds,
      spotifyUrl,
      ...fields
    } = dto;

    let catsResolved: Awaited<
      ReturnType<EventsService['resolveCategoriasEvento']>
    > | null = null;
    if (categoriaEventoIds !== undefined || spotifyUrl !== undefined) {
      const currentIds = (
        await this.prisma.eventoCategoriaEvento.findMany({
          where: { eventoId: id },
          select: { categoriaEventoId: true },
        })
      ).map((r) => r.categoriaEventoId);
      catsResolved = await this.resolveCategoriasEvento(
        categoriaEventoIds ?? currentIds,
        spotifyUrl !== undefined ? spotifyUrl : evento.spotifyUrl,
      );
    }
    let transferenciaHastaDate: Date | null | undefined;
    if (transferenciaHasta === null || transferenciaHasta === '') {
      transferenciaHastaDate = null;
    } else if (transferenciaHasta !== undefined) {
      const parsed = new Date(transferenciaHasta);
      if (Number.isNaN(parsed.getTime())) {
        throw new BadRequestException(
          'La fecha límite de transferencia no es válida.',
        );
      }
      transferenciaHastaDate = parsed;
    }
    const touchesSchedule = [fechaInicio, fechaFin, horaInicio, horaFin].some(
      (v) => v !== undefined,
    );

    let schedule: Schedule | null = null;
    if (touchesSchedule) {
      if (!fechaInicio || !horaInicio || !horaFin) {
        throw new BadRequestException(
          'Envía la fecha de inicio, hora de inicio y hora de fin juntas.',
        );
      }
      // Los días ya existentes pueden estar en el pasado; solo los días nuevos deben ser desde hoy.
      schedule = buildSchedule(
        { fechaInicio, fechaFin, horaInicio, horaFin },
        { today: this.today(), allowPast: true },
      );
      const existingDays = new Set(
        evento.fechas.map((f) => dateToDay(f.fecha)),
      );
      const today = this.today();
      const newPastDay = schedule.days.find(
        (d) => !existingDays.has(d) && d < today,
      );
      if (newPastDay) {
        throw new BadRequestException(
          'No puedes agregar días anteriores a hoy al evento.',
        );
      }
    }

    const maxPorDia = Math.max(0, ...cuposPorDia(evento.categorias).values());
    if (fields.capacidad !== undefined && fields.capacidad < maxPorDia) {
      throw new BadRequestException(
        `Las categorías ya suman ${maxPorDia.toLocaleString('es-BO')} entradas${evento.fechas.length > 1 ? ' en un mismo día' : ''}. La capacidad máxima no puede ser menor.`,
      );
    }

    const horario = schedule ?? {
      horaInicio: evento.fechas[0]?.horaInicio ?? '',
      horaFin: evento.fechas[0]?.horaFin ?? '',
    };
    const storedCronograma = isCronograma(evento.cronograma)
      ? evento.cronograma
      : null;
    let cronograma: Cronograma | null = null;
    if (cronogramaDto || schedule)
      cronograma = buildCronograma(cronogramaDto ?? storedCronograma, horario);

    const estadoFinal = fields.estado ?? evento.estado;
    if (estadoFinal === EventoEstado.PUBLICADO) {
      if (!evento.fotoUrl) {
        throw new BadRequestException(
          'Sube la imagen del evento antes de publicarlo.',
        );
      }
      if (!evento.categorias.length) {
        throw new BadRequestException(
          'Crea al menos una categoría de entrada antes de publicar el evento.',
        );
      }
      const tematicasCount = catsResolved
        ? catsResolved.ids.length
        : await this.prisma.eventoCategoriaEvento.count({
            where: { eventoId: id },
          });
      if (!tematicasCount) {
        throw new BadRequestException(
          'Asigna al menos una categoría del evento (temática) antes de publicarlo.',
        );
      }
      if (!(fields.ubicacionUrl ?? evento.ubicacionUrl)) {
        throw new BadRequestException(
          'Agrega el enlace de Google Maps de la ubicación antes de publicar el evento.',
        );
      }
    }

    const data: Prisma.EventoUpdateInput = {
      ...fields,
      ...(transferenciaHastaDate !== undefined
        ? { transferenciaHasta: transferenciaHastaDate }
        : {}),
      ...(servicios !== undefined
        ? { servicios: normalizeList(servicios) }
        : {}),
      ...(cronograma
        ? { cronograma: cronograma as unknown as Prisma.InputJsonObject }
        : {}),
      ...(catsResolved ? { spotifyUrl: catsResolved.spotifyUrl } : {}),
    };

    const result = await this.prisma.$transaction(
      async (tx) => {
        await tx.evento.update({ where: { id }, data });
        if (catsResolved) {
          await tx.eventoCategoriaEvento.deleteMany({
            where: { eventoId: id },
          });
          await tx.eventoCategoriaEvento.createMany({
            data: catsResolved.ids.map((categoriaEventoId) => ({
              eventoId: id,
              categoriaEventoId,
            })),
          });
        }
        if (
          schedule &&
          (await this.syncFechas(tx, id, evento.fechas, schedule))
        ) {
          await this.ajustarCuposPorDia(
            tx,
            id,
            fields.capacidad ?? evento.capacidad,
          );
        }
        return tx.evento.findUniqueOrThrow({
          where: { id },
          include: {
            fechas: { orderBy: { fecha: 'asc' } },
            categorias: true,
            ...this.categoriasEventoInclude,
            organizador: { select: organizadorSelect },
          },
        });
      },
      { timeout: POOL_TX_TIMEOUT_MS },
    );

    if (
      evento.estado !== EventoEstado.PUBLICADO &&
      result.estado === EventoEstado.PUBLICADO
    ) {
      await this.notify(() =>
        this.mail.sendEventoPublicado(
          result.organizador.email,
          result.organizador.nombre,
          {
            id: result.id,
            titulo: result.titulo,
          },
        ),
      );
    }
    if (
      evento.estado !== EventoEstado.FINALIZADO &&
      result.estado === EventoEstado.FINALIZADO
    ) {
      await this.asegurarLiquidacionEvento(result.id, null);
    }
    return result;
  }

  /**
   * Cierra el ciclo operativo del evento: pasa a FINALIZADO y deja el resumen de
   * liquidación (ventas de negocios) listo para seguimiento admin.
   */
  async finalizarEvento(id: string, adminId: string) {
    const evento = await this.prisma.evento.findUnique({
      where: { id },
      select: {
        id: true,
        titulo: true,
        estado: true,
        organizador: { select: organizadorSelect },
      },
    });
    if (!evento) throw new NotFoundException('Evento no encontrado');
    if (evento.estado === EventoEstado.FINALIZADO) {
      const liquidacion = await this.asegurarLiquidacionEvento(id, adminId);
      return { ...evento, liquidacion, yaFinalizado: true };
    }
    if (evento.estado === EventoEstado.CANCELADO) {
      throw new BadRequestException(
        'Un evento cancelado no se puede finalizar; ya está cerrado.',
      );
    }
    if (evento.estado === EventoEstado.BORRADOR) {
      throw new BadRequestException(
        'Publica el evento antes de finalizarlo.',
      );
    }
    const actualizado = await this.prisma.evento.update({
      where: { id },
      data: { estado: EventoEstado.FINALIZADO },
      include: {
        fechas: { orderBy: { fecha: 'asc' } },
        organizador: { select: organizadorSelect },
      },
    });
    const liquidacion = await this.asegurarLiquidacionEvento(id, adminId);
    return { ...actualizado, liquidacion, yaFinalizado: false };
  }

  async liquidacionDelEvento(eventoId: string) {
    await this.ensureEvento(eventoId);
    return this.asegurarLiquidacionEvento(eventoId, null);
  }

  /**
   * Snapshot de lo recaudado por negocios en el evento. No paga nada: el pago al
   * puesto sigue el flujo de retiros; esto solo deja trazabilidad al cerrar.
   */
  private async asegurarLiquidacionEvento(
    eventoId: string,
    adminId: string | null,
  ) {
    const ventas = await this.prisma.venta.aggregate({
      where: { eventoId },
      _sum: { total: true },
      _count: { _all: true },
    });
    const montoTotal = ventas._sum.total ?? new Prisma.Decimal(0);
    const nota = `${ventas._count._all} venta(s) de negocio al cierre. El pago a cada puesto se gestiona con retiros de ganancias.`;
    const existente = await this.prisma.liquidacionEvento.findUnique({
      where: { eventoId },
    });
    if (existente) {
      return this.prisma.liquidacionEvento.update({
        where: { eventoId },
        data: {
          montoTotal,
          nota,
          ...(adminId && existente.estado === LiquidacionEstado.PENDIENTE
            ? { aprobadoPorId: adminId, aprobadoAt: new Date() }
            : {}),
        },
      });
    }
    return this.prisma.liquidacionEvento.create({
      data: {
        eventoId,
        montoTotal,
        estado: LiquidacionEstado.PENDIENTE,
        nota,
        ...(adminId
          ? { aprobadoPorId: adminId, aprobadoAt: new Date() }
          : {}),
      },
    });
  }

  /**
   * El cupo de cada categoría es por día: al agregar o quitar días del evento, cada pool de códigos
   * se ajusta y ningún día puede superar la capacidad del evento.
   */
  private async ajustarCuposPorDia(
    tx: Prisma.TransactionClient,
    eventoId: string,
    capacidad: number | null,
  ) {
    const categorias = await tx.categoriaEntrada.findMany({
      where: { eventoId },
      select: {
        id: true,
        cupo: true,
        fechasDisponibles: {
          where: { disponible: true },
          select: { fechaId: true },
        },
      },
    });
    const maxPorDia = Math.max(0, ...cuposPorDia(categorias).values());
    if (capacidad && maxPorDia > capacidad) {
      throw new BadRequestException(
        `Los días nuevos quedan a la venta en todas las categorías y sumarían ${maxPorDia.toLocaleString('es-BO')} entradas en un mismo día, más que la capacidad (${capacidad.toLocaleString('es-BO')}). Aumenta la capacidad o ajusta las categorías.`,
      );
    }
    for (const c of categorias) await sincronizarPool(tx, c.id);
  }

  /**
   * Deja en FechaEvento exactamente los días del rango: actualiza horarios,
   * crea los días nuevos (disponibles para todas las categorías) y elimina los que salen del rango.
   * Devuelve true si se agregaron o quitaron días.
   */
  private async syncFechas(
    tx: Prisma.TransactionClient,
    eventoId: string,
    current: Array<{
      id: string;
      fecha: Date;
      horaInicio: string;
      horaFin: string;
      _count: { entradas: number; accesos: number };
    }>,
    schedule: Schedule,
  ) {
    const wanted = new Set(schedule.days);
    const toRemove = current.filter((f) => !wanted.has(dateToDay(f.fecha)));
    const blocked = toRemove.find(
      (f) => f._count.entradas > 0 || f._count.accesos > 0,
    );
    if (blocked) {
      throw new BadRequestException(
        `No puedes quitar el día ${dateToDay(blocked.fecha)} porque ya tiene entradas o accesos registrados.`,
      );
    }
    if (toRemove.length) {
      await tx.fechaEvento.deleteMany({
        where: { id: { in: toRemove.map((f) => f.id) } },
      });
    }

    const keep = current.filter((f) => wanted.has(dateToDay(f.fecha)));
    const toRetime = keep.filter(
      (f) =>
        f.horaInicio !== schedule.horaInicio || f.horaFin !== schedule.horaFin,
    );
    if (toRetime.length) {
      await tx.fechaEvento.updateMany({
        where: { id: { in: toRetime.map((f) => f.id) } },
        data: { horaInicio: schedule.horaInicio, horaFin: schedule.horaFin },
      });
    }

    const existing = new Set(keep.map((f) => dateToDay(f.fecha)));
    const newDays = schedule.days.filter((d) => !existing.has(d));
    if (!newDays.length) return toRemove.length > 0;

    await tx.fechaEvento.createMany({
      data: newDays.map((day) => ({
        eventoId,
        fecha: dayToDate(day),
        horaInicio: schedule.horaInicio,
        horaFin: schedule.horaFin,
      })),
    });
    const [created, categorias] = await Promise.all([
      tx.fechaEvento.findMany({
        where: { eventoId, fecha: { in: newDays.map(dayToDate) } },
        select: { id: true },
      }),
      tx.categoriaEntrada.findMany({
        where: { eventoId },
        select: { id: true },
      }),
    ]);
    if (categorias.length) {
      await tx.categoriaFecha.createMany({
        data: categorias.flatMap((c) =>
          created.map((f) => ({
            categoriaId: c.id,
            fechaId: f.id,
            disponible: true,
          })),
        ),
        skipDuplicates: true,
      });
    }
    return true;
  }

  async updateFoto(id: string, foto: Express.Multer.File | undefined) {
    const evento = await this.ensureEvento(id);
    const stored = await this.storage.upload(foto, 'eventos', 'image');
    try {
      const updated = await this.prisma.evento.update({
        where: { id },
        data: { fotoUrl: stored.url, fotoPublicId: stored.publicId },
        select: { id: true, fotoUrl: true },
      });
      await this.storage.remove(evento.fotoPublicId);
      return updated;
    } catch (err) {
      await this.storage.remove(stored.publicId);
      throw err;
    }
  }

  adminAll() {
    return this.prisma.evento.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        organizador: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            nombreProductora: true,
            email: true,
          },
        },
        fechas: { orderBy: { fecha: 'asc' } },
        categorias: {
          select: { id: true, nombre: true, precio: true, cupo: true },
          orderBy: { precio: 'asc' },
        },
        ...this.categoriasEventoInclude,
        solicitud: { select: { id: true, estado: true } },
      },
    });
  }

  publicList() {
    return this.prisma.evento.findMany({
      where: { estado: EventoEstado.PUBLICADO },
      orderBy: { createdAt: 'desc' },
      select: this.publicSelect(false),
    });
  }

  async publicDetail(id: string) {
    const evento = await this.prisma.evento.findFirst({
      where: { id, estado: EventoEstado.PUBLICADO },
      select: this.publicSelect(true),
    });
    if (!evento) throw new NotFoundException('Evento no encontrado');
    return evento;
  }

  private publicSelect(withAvailability: boolean) {
    return {
      id: true,
      titulo: true,
      descripcion: true,
      fotoUrl: true,
      ubicacion: true,
      ubicacionUrl: true,
      mapaUrl: true,
      servicios: true,
      cronograma: true,
      tipoAcceso: true,
      estado: true,
      capacidad: true,
      spotifyUrl: true,
      organizador: {
        select: { id: true, nombreProductora: true },
      },
      fechas: { orderBy: { fecha: 'asc' as const } },
      categoriasEvento: {
        include: {
          categoriaEvento: {
            select: {
              id: true,
              nombre: true,
              slug: true,
              esMusical: true,
              orden: true,
            },
          },
        },
      },
      categorias: {
        orderBy: { precio: 'asc' as const },
        select: {
          id: true,
          nombre: true,
          precio: true,
          descuento: true,
          beneficios: true,
          cupo: true,
          ...(withAvailability
            ? {
                fechasDisponibles: {
                  where: { disponible: true },
                  select: { fechaId: true },
                },
              }
            : {}),
        },
      },
    } satisfies Prisma.EventoSelect;
  }

  async adminDetail(id: string) {
    const evento = await this.prisma.evento.findUnique({
      where: { id },
      include: {
        fechas: { orderBy: { fecha: 'asc' } },
        categorias: {
          orderBy: { precio: 'asc' },
          include: {
            fechasDisponibles: true,
            _count: { select: { ticketsPool: true } },
          },
        },
        ...this.categoriasEventoInclude,
        organizador: { select: organizadorSelect },
        solicitud: {
          include: {
            mapHistory: { orderBy: { createdAt: 'desc' } },
            ...this.categoriasEventoInclude,
          },
        },
        mapHistory: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!evento) throw new NotFoundException('Evento no encontrado');
    return evento;
  }

  async updateMapa(
    eventoId: string,
    mapa: Express.Multer.File | undefined,
    dto: UpdateMapaDto,
  ) {
    const evento = await this.ensureEvento(eventoId);
    const stored = await this.storage.upload(mapa, 'mapas', 'imageOrPdf');
    try {
      const [updated] = await this.prisma.$transaction([
        this.prisma.evento.update({
          where: { id: eventoId },
          data: { mapaUrl: stored.url },
        }),
        this.prisma.mapaHistorial.create({
          data: {
            eventoId,
            solicitudId: evento.solicitudId,
            mapaUrl: stored.url,
            mapaNombre: stored.nombre,
            tipo: MapChangeTipo.ACTUALIZACION,
            nota: dto.nota?.trim() || 'Mapa actualizado por el administrador',
          },
        }),
      ]);
      return updated;
    } catch (err) {
      await this.storage.remove(stored.publicId);
      throw err;
    }
  }

  mapaHistorial(eventoId: string) {
    return this.prisma.mapaHistorial.findMany({
      where: {
        OR: [{ eventoId }, { solicitud: { evento: { id: eventoId } } }],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  listOrganizadores() {
    return this.prisma.usuario.findMany({
      where: { activo: true, roles: { some: { role: Role.ORGANIZADOR } } },
      orderBy: { nombre: 'asc' },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        nombreProductora: true,
        email: true,
      },
    });
  }

  private async ensureOrganizador(organizadorId?: string) {
    if (!organizadorId)
      throw new BadRequestException('Selecciona el organizador del evento');
    const organizador = await this.prisma.usuario.findFirst({
      where: {
        id: organizadorId,
        activo: true,
        roles: { some: { role: Role.ORGANIZADOR } },
      },
    });
    if (!organizador)
      throw new BadRequestException(
        'El usuario seleccionado no es un organizador activo',
      );
  }

  private async ensureEvento(id: string) {
    const evento = await this.prisma.evento.findUnique({ where: { id } });
    if (!evento) throw new NotFoundException('Evento no encontrado');
    return evento;
  }
}
