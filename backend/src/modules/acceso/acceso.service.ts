import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AccesoTipo,
  EntradaEstado,
  EventoEstado,
  Prisma,
  Role,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  StorageService,
  StoredFile,
} from '../../common/storage/storage.service';
import { EntradasService } from '../entradas/entradas.service';
import { ENTRADA_INVALIDA } from '../entradas/entradas-emision';
import { dateToDay, todayIn } from '../events/event-schedule';
import { nombreCompleto } from '../manillas/manillas-helpers';
import {
  AsignarEncargadoDto,
  CandidatosAccesoQuery,
  EscaneoDto,
  FechaAccesoQuery,
  RechazoAccesoDto,
  RegistroAccesoDto,
  Sentido,
} from './dto/acceso.dto';

type AuthUser = { id: string; roles: Role[] };
type Db = Prisma.TransactionClient;
type Medio = 'MANILLA' | 'QR_DIGITAL';
export type EstadoEscaneo = 'VALIDO' | 'YA_USADO' | 'INVALIDO';

const MAX_CANDIDATOS = 20;
const MAX_REGISTROS = 200;
const DENTRO: AccesoTipo[] = [AccesoTipo.INGRESO, AccesoTipo.REINGRESO];
const ACCESO_TX_OPTIONS = { maxWait: 10_000, timeout: 20_000 };
const MOTIVO_RECHAZO_FOTO =
  'La persona no coincide con la foto del primer ingreso.';

const eventoAccesoSelect = {
  id: true,
  titulo: true,
  estado: true,
  tipoAcceso: true,
  ubicacion: true,
  capacidad: true,
  fotoUrl: true,
  fechas: {
    orderBy: { fecha: 'asc' },
    select: { id: true, fecha: true, horaInicio: true, horaFin: true },
  },
} satisfies Prisma.EventoSelect;

type EventoAcceso = Prisma.EventoGetPayload<{
  select: typeof eventoAccesoSelect;
}>;
type FechaAcceso = EventoAcceso['fechas'][number];

const fichaSelect = {
  id: true,
  codigo: true,
  estado: true,
  fechaId: true,
  categoria: {
    select: {
      nombre: true,
      fechasDisponibles: {
        where: { disponible: true },
        select: { fechaId: true },
      },
    },
  },
  fecha: { select: { fecha: true } },
  titular: {
    select: {
      id: true,
      nombre: true,
      apellido: true,
      documento: true,
      email: true,
      telefono: true,
      fotoUrl: true,
    },
  },
  manilla: { select: { codigoFisico: true, vinculada: true } },
} satisfies Prisma.EntradaSelect;

const registroSelect = {
  id: true,
  tipo: true,
  fotoIngresoUrl: true,
  createdAt: true,
  fecha: { select: { fecha: true } },
  encargado: { select: { nombre: true, apellido: true } },
  entrada: {
    select: {
      codigo: true,
      categoria: { select: { nombre: true } },
      titular: { select: { nombre: true, apellido: true, documento: true } },
      manilla: { select: { codigoFisico: true } },
    },
  },
} satisfies Prisma.AccesoEventoSelect;

const rechazoSelect = {
  id: true,
  sentido: true,
  motivo: true,
  createdAt: true,
  encargado: { select: { nombre: true, apellido: true } },
  entrada: registroSelect.entrada,
} satisfies Prisma.AccesoRechazoSelect;

function formatDia(fecha: Date) {
  return fecha.toLocaleDateString('es-BO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}

/**
 * Entrada escaneada con su último movimiento del día, la foto del primer ingreso, sus ingresos
 * previos y los intentos rechazados hoy porque la persona no coincidía con la foto.
 */
async function fichaEntrada(db: Db, entradaId: string, fechaHoyId: string) {
  const [entrada, ultimoHoy, primeraFoto, ingresosPrevios, rechazosHoy] =
    await Promise.all([
      db.entrada.findUniqueOrThrow({
        where: { id: entradaId },
        select: fichaSelect,
      }),
      db.accesoEvento.findFirst({
        where: { entradaId, fechaId: fechaHoyId },
        orderBy: { createdAt: 'desc' },
        select: { tipo: true, createdAt: true },
      }),
      db.accesoEvento.findFirst({
        where: { entradaId, fotoIngresoUrl: { not: null } },
        orderBy: { createdAt: 'asc' },
        select: { fotoIngresoUrl: true, createdAt: true },
      }),
      db.accesoEvento.count({ where: { entradaId, tipo: { in: DENTRO } } }),
      db.accesoRechazo.count({ where: { entradaId, fechaId: fechaHoyId } }),
    ]);
  return {
    entrada,
    ultimoHoy,
    fotoIngreso: primeraFoto
      ? { url: primeraFoto.fotoIngresoUrl!, tomadaAt: primeraFoto.createdAt }
      : null,
    ingresosPrevios,
    rechazosHoy,
  };
}

type Ficha = Awaited<ReturnType<typeof fichaEntrada>>;

/**
 * HU-016, HU-017, HU-046: control de acceso en puerta. El supervisor (rol ENCARGADO_ACCESO asignado
 * al evento) escanea la manilla o el QR digital; la entrada se identifica con
 * EntradasService.resolverCodigoEscaneado (HU-015) y aquí se decide si puede pasar.
 */
@Injectable()
export class AccesoService {
  private readonly timeZone: string;

  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private entradas: EntradasService,
    config: ConfigService,
  ) {
    this.timeZone = config.get<string>('APP_TIMEZONE', 'America/La_Paz');
  }

  // ---------- Supervisor ----------

  /** Eventos publicados en los que el supervisor controla el acceso; primero los de hoy. */
  async misEventos(user: AuthUser) {
    const today = todayIn(this.timeZone);
    const eventos = await this.prisma.evento.findMany({
      where: {
        estado: EventoEstado.PUBLICADO,
        ...(user.roles.includes(Role.ADMIN)
          ? {}
          : {
              staff: {
                some: {
                  usuarioId: user.id,
                  role: Role.ENCARGADO_ACCESO,
                  activo: true,
                },
              },
            }),
      },
      select: eventoAccesoSelect,
    });
    const lista = eventos
      .map((e) => {
        const dias = e.fechas.map((f) => dateToDay(f.fecha));
        const hoy = e.fechas.find((f) => dateToDay(f.fecha) === today) ?? null;
        const proximo = dias.find((d) => d >= today) ?? null;
        return {
          id: e.id,
          titulo: e.titulo,
          ubicacion: e.ubicacion,
          tipoAcceso: e.tipoAcceso,
          fotoUrl: e.fotoUrl,
          fechas: e.fechas,
          hoy,
          proximo,
        };
      })
      .filter((e) => e.proximo)
      .sort(
        (a, b) =>
          Number(Boolean(b.hoy)) - Number(Boolean(a.hoy)) ||
          a.proximo!.localeCompare(b.proximo!),
      );
    return { hoy: today, eventos: lista };
  }

  /** HU-016: valida lo escaneado sin registrar nada todavía. */
  async verificar(user: AuthUser, dto: EscaneoDto) {
    const evento = await this.requireEventoSupervisado(user, dto.eventoId);
    const hoy = this.fechaDeHoy(evento);
    if (!hoy)
      return this.invalido(dto.sentido, this.motivoFueraDeFecha(evento));

    let resuelto: Awaited<
      ReturnType<EntradasService['resolverCodigoEscaneado']>
    >;
    try {
      resuelto = await this.entradas.resolverCodigoEscaneado(
        evento.id,
        dto.codigo,
      );
    } catch (err) {
      if (
        err instanceof BadRequestException ||
        err instanceof NotFoundException
      ) {
        return this.invalido(dto.sentido, err.message);
      }
      throw err;
    }
    const ficha = await fichaEntrada(this.prisma, resuelto.entrada.id, hoy.id);
    return this.dictamen(hoy, ficha, dto.sentido, resuelto.medio);
  }

  /**
   * HU-017 / HU-046: registra el ingreso, reingreso o salida. El primer ingreso exige la foto y,
   * desde entonces, el supervisor debe confirmar que la persona coincide con esa foto.
   */
  async registrar(
    user: AuthUser,
    dto: RegistroAccesoDto,
    foto?: Express.Multer.File,
  ) {
    const evento = await this.requireEventoSupervisado(user, dto.eventoId);
    const hoy = this.fechaDeHoy(evento);
    if (!hoy) throw new BadRequestException(this.motivoFueraDeFecha(evento));

    const { entrada, medio } = await this.entradas.resolverCodigoEscaneado(
      evento.id,
      dto.codigo,
    );
    const previa = this.dictamen(
      hoy,
      await fichaEntrada(this.prisma, entrada.id, hoy.id),
      dto.sentido,
      medio,
    );
    if (previa.estado !== 'VALIDO') throw new ConflictException(previa.motivo);
    if (previa.requiereFoto && !foto) {
      throw new BadRequestException(
        'Toma la foto de la persona: es su primer ingreso y queda registrada para verificar sus próximos ingresos.',
      );
    }
    if (previa.fotoIngreso && !dto.fotoVerificada) {
      throw new BadRequestException(
        'Compara la foto del primer ingreso con la persona y confirma que es la misma antes de registrar.',
      );
    }

    let stored: StoredFile | null = null;
    if (previa.requiereFoto && foto)
      stored = await this.storage.upload(foto, 'accesos', 'image');
    try {
      const registro = await this.prisma.$transaction(async (tx) => {
        // Bloquea la fila de la entrada: dos puertas no pueden registrar el mismo movimiento a la vez.
        await tx.entrada.update({
          where: { id: entrada.id },
          data: { updatedAt: new Date() },
        });
        const d = this.dictamen(
          hoy,
          await fichaEntrada(tx, entrada.id, hoy.id),
          dto.sentido,
          medio,
        );
        if (d.estado !== 'VALIDO' || !d.movimiento)
          throw new ConflictException(d.motivo);
        if (d.requiereFoto && !stored) {
          throw new BadRequestException(
            'Toma la foto de la persona: es su primer ingreso.',
          );
        }
        const creado = await tx.accesoEvento.create({
          data: {
            eventoId: evento.id,
            entradaId: entrada.id,
            fechaId: hoy.id,
            encargadoId: user.id,
            tipo: d.movimiento,
            fotoIngresoUrl: d.requiereFoto ? stored!.url : null,
          },
          select: {
            id: true,
            tipo: true,
            fotoIngresoUrl: true,
            createdAt: true,
          },
        });
        if (
          DENTRO.includes(d.movimiento) &&
          d.entrada &&
          d.entrada.estado !== EntradaEstado.USADA
        ) {
          await tx.entrada.update({
            where: { id: entrada.id },
            data: { estado: EntradaEstado.USADA },
          });
        }
        return creado;
      }, ACCESO_TX_OPTIONS);
      if (stored && !registro.fotoIngresoUrl)
        await this.storage.remove(stored.publicId);

      const resultado = this.dictamen(
        hoy,
        await fichaEntrada(this.prisma, entrada.id, hoy.id),
        dto.sentido,
        medio,
      );
      return {
        registro,
        resultado,
        aforo: await this.calcularAforo(evento, hoy),
      };
    } catch (err) {
      await this.storage.remove(stored?.publicId);
      throw err;
    }
  }

  /**
   * HU-046: la persona no coincide con la foto de su primer ingreso. No se registra el paso, pero
   * el intento queda guardado para que el administrador vea qué entradas se intentaron prestar.
   */
  async rechazar(user: AuthUser, dto: RechazoAccesoDto) {
    const evento = await this.requireEventoSupervisado(user, dto.eventoId);
    const hoy = this.fechaDeHoy(evento);
    if (!hoy) throw new BadRequestException(this.motivoFueraDeFecha(evento));

    const { entrada } = await this.entradas.resolverCodigoEscaneado(
      evento.id,
      dto.codigo,
    );
    const ficha = await fichaEntrada(this.prisma, entrada.id, hoy.id);
    if (!ficha.fotoIngreso) {
      throw new BadRequestException(
        'Esta entrada todavía no tiene una foto de ingreso con la cual comparar.',
      );
    }
    const rechazo = await this.prisma.accesoRechazo.create({
      data: {
        eventoId: evento.id,
        entradaId: entrada.id,
        fechaId: hoy.id,
        encargadoId: user.id,
        sentido: dto.sentido,
        motivo: dto.motivo || MOTIVO_RECHAZO_FOTO,
      },
      select: { id: true, createdAt: true },
    });
    return { rechazo, rechazosHoy: ficha.rechazosHoy + 1 };
  }

  async aforoSupervisor(
    user: AuthUser,
    eventoId: string,
    query: FechaAccesoQuery,
  ) {
    const evento = await this.requireEventoSupervisado(user, eventoId, false);
    return this.calcularAforo(
      evento,
      this.fechaConsultada(evento, query.fechaId),
    );
  }

  async registrosSupervisor(
    user: AuthUser,
    eventoId: string,
    query: FechaAccesoQuery,
  ) {
    const evento = await this.requireEventoSupervisado(user, eventoId, false);
    return this.listarRegistros(
      evento,
      this.fechaConsultada(evento, query.fechaId),
      user.id,
    );
  }

  // ---------- Administración ----------

  /** Supervisores asignados, aforo y registros del día elegido (por defecto hoy o el próximo día). */
  async panelEvento(eventoId: string, query: FechaAccesoQuery) {
    const evento = await this.requireEvento(eventoId);
    const fecha = this.fechaConsultada(evento, query.fechaId);
    const [supervisores, aforo, registros] = await Promise.all([
      this.supervisores(eventoId),
      this.calcularAforo(evento, fecha),
      this.listarRegistros(evento, fecha),
    ]);
    return {
      evento: {
        id: evento.id,
        titulo: evento.titulo,
        estado: evento.estado,
        tipoAcceso: evento.tipoAcceso,
      },
      fechas: evento.fechas,
      hoy: todayIn(this.timeZone),
      supervisores,
      aforo,
      registros: registros.registros,
      totalRegistros: registros.total,
      rechazos: registros.rechazos,
    };
  }

  /** Usuarios activos con rol ENCARGADO_ACCESO que todavía no controlan el acceso de este evento. */
  async candidatos(eventoId: string, query: CandidatosAccesoQuery) {
    await this.requireEvento(eventoId);
    const q = query.q?.trim();
    const usuarios = await this.prisma.usuario.findMany({
      where: {
        activo: true,
        eliminadoAt: null,
        roles: { some: { role: Role.ENCARGADO_ACCESO } },
        staffAsignaciones: {
          none: { eventoId, role: Role.ENCARGADO_ACCESO, activo: true },
        },
        ...(q
          ? {
              OR: [
                { nombre: { contains: q } },
                { apellido: { contains: q } },
                { email: { contains: q } },
              ],
            }
          : {}),
      },
      orderBy: { nombre: 'asc' },
      take: MAX_CANDIDATOS,
      select: { id: true, nombre: true, apellido: true, email: true },
    });
    return {
      candidatos: usuarios.map((u) => ({
        id: u.id,
        nombre: nombreCompleto(u),
        email: u.email,
      })),
    };
  }

  async asignarSupervisor(eventoId: string, dto: AsignarEncargadoDto) {
    const evento = await this.requireEvento(eventoId);
    if (
      evento.estado === EventoEstado.FINALIZADO ||
      evento.estado === EventoEstado.CANCELADO
    ) {
      throw new BadRequestException(
        'No se pueden asignar supervisores a un evento finalizado o cancelado.',
      );
    }
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: dto.usuarioId },
      select: {
        activo: true,
        eliminadoAt: true,
        roles: { where: { role: Role.ENCARGADO_ACCESO }, select: { id: true } },
      },
    });
    if (!usuario || !usuario.activo || usuario.eliminadoAt)
      throw new NotFoundException('Usuario no encontrado o inactivo.');
    if (!usuario.roles.length) {
      throw new BadRequestException(
        'Solo se pueden asignar usuarios con el rol Encargado de acceso (supervisor).',
      );
    }
    await this.prisma.staffEvento.upsert({
      where: {
        usuarioId_eventoId_role: {
          usuarioId: dto.usuarioId,
          eventoId,
          role: Role.ENCARGADO_ACCESO,
        },
      },
      create: {
        usuarioId: dto.usuarioId,
        eventoId,
        role: Role.ENCARGADO_ACCESO,
      },
      update: { activo: true },
    });
    return { supervisores: await this.supervisores(eventoId) };
  }

  async quitarSupervisor(eventoId: string, usuarioId: string) {
    await this.requireEvento(eventoId);
    const { count } = await this.prisma.staffEvento.updateMany({
      where: { eventoId, usuarioId, role: Role.ENCARGADO_ACCESO, activo: true },
      data: { activo: false },
    });
    if (!count)
      throw new NotFoundException(
        'El supervisor no está asignado a este evento.',
      );
    return { supervisores: await this.supervisores(eventoId) };
  }

  /** Resumen de aforo de hoy de todos los eventos publicados (HU-046). */
  async resumenHoy() {
    const today = todayIn(this.timeZone);
    const eventos = await this.prisma.evento.findMany({
      where: { estado: EventoEstado.PUBLICADO },
      select: eventoAccesoSelect,
    });
    const deHoy = eventos.filter((e) =>
      e.fechas.some((f) => dateToDay(f.fecha) === today),
    );
    const resumen = await Promise.all(
      deHoy.map(async (e) => ({
        evento: {
          id: e.id,
          titulo: e.titulo,
          ubicacion: e.ubicacion,
          tipoAcceso: e.tipoAcceso,
          fotoUrl: e.fotoUrl,
        },
        aforo: await this.calcularAforo(e, this.fechaDeHoy(e)),
      })),
    );
    return { hoy: today, eventos: resumen };
  }

  // ---------- Reglas ----------

  /**
   * Decide si la entrada puede pasar por la puerta indicada. La entrada debe ser del día de hoy y no
   * puede ingresar dos veces sin registrar su salida (evita que se preste la manilla o el QR).
   */
  private dictamen(
    hoy: FechaAcceso,
    ficha: Ficha,
    sentido: Sentido,
    medio: Medio,
  ) {
    const { entrada, ultimoHoy, fotoIngreso, ingresosPrevios, rechazosHoy } =
      ficha;
    const dentro = Boolean(ultimoHoy && DENTRO.includes(ultimoHoy.tipo));
    const base = {
      sentido,
      medio,
      entrada: {
        id: entrada.id,
        codigo: entrada.codigo,
        estado: entrada.estado,
        categoria: entrada.categoria.nombre,
        dia: entrada.fecha?.fecha ?? null,
        manilla: entrada.manilla?.vinculada
          ? entrada.manilla.codigoFisico
          : null,
      },
      persona: entrada.titular
        ? {
            nombre: nombreCompleto(entrada.titular),
            documento: entrada.titular.documento,
            email: entrada.titular.email,
            telefono: entrada.titular.telefono,
            fotoPerfilUrl: entrada.titular.fotoUrl,
          }
        : null,
      fotoIngreso,
      rechazosHoy,
      ultimoMovimiento: ultimoHoy
        ? { tipo: ultimoHoy.tipo, at: ultimoHoy.createdAt }
        : null,
      dentro,
      fecha: { id: hoy.id, fecha: hoy.fecha },
    };
    const resultado = (
      estado: EstadoEscaneo,
      motivo: string | null,
      movimiento: AccesoTipo | null = null,
    ) => ({
      estado,
      motivo,
      movimiento,
      requiereFoto:
        movimiento !== null && movimiento !== AccesoTipo.SALIDA && !fotoIngreso,
      ...base,
    });

    if (ENTRADA_INVALIDA.includes(entrada.estado)) {
      return resultado(
        'INVALIDO',
        `La entrada ${entrada.codigo} está ${entrada.estado.toLowerCase()} y ya no es válida.`,
      );
    }
    if (entrada.fechaId && entrada.fechaId !== hoy.id) {
      const dia = entrada.fecha ? formatDia(entrada.fecha.fecha) : 'otro día';
      return resultado(
        'INVALIDO',
        `Esta entrada es para el ${dia}; hoy no permite el ingreso.`,
      );
    }
    if (
      !entrada.fechaId &&
      !entrada.categoria.fechasDisponibles.some((f) => f.fechaId === hoy.id)
    ) {
      return resultado(
        'INVALIDO',
        `La categoría ${entrada.categoria.nombre} no tiene acceso hoy.`,
      );
    }

    if (sentido === 'ENTRADA') {
      if (dentro) {
        return resultado(
          'YA_USADO',
          `Ya ingresó hoy a las ${this.hora(ultimoHoy!.createdAt)} y no registró su salida. Verifica que la manilla o el QR no se esté prestando.`,
        );
      }
      return resultado(
        'VALIDO',
        null,
        ingresosPrevios > 0 ? AccesoTipo.REINGRESO : AccesoTipo.INGRESO,
      );
    }
    if (!dentro) {
      return resultado(
        'INVALIDO',
        ultimoHoy
          ? `Ya registró su salida a las ${this.hora(ultimoHoy.createdAt)}; no está dentro del evento.`
          : 'No tiene un ingreso registrado hoy: no se puede marcar su salida.',
      );
    }
    return resultado('VALIDO', null, AccesoTipo.SALIDA);
  }

  private invalido(sentido: Sentido, motivo: string) {
    return {
      estado: 'INVALIDO' as EstadoEscaneo,
      motivo,
      movimiento: null,
      requiereFoto: false,
      sentido,
      medio: null,
      entrada: null,
      persona: null,
      fotoIngreso: null,
      rechazosHoy: 0,
      ultimoMovimiento: null,
      dentro: false,
      fecha: null,
    };
  }

  /** HU-046: personas dentro del evento ahora mismo según el último movimiento de cada entrada en el día. */
  private async calcularAforo(evento: EventoAcceso, fecha: FechaAcceso | null) {
    if (!fecha) {
      return {
        fecha: null,
        dentro: 0,
        personas: 0,
        ingresos: 0,
        reingresos: 0,
        salidas: 0,
        entradasDelDia: 0,
        capacidad: evento.capacidad,
      };
    }
    const [movimientos, entradasDelDia] = await Promise.all([
      this.prisma.accesoEvento.findMany({
        where: { eventoId: evento.id, fechaId: fecha.id },
        orderBy: { createdAt: 'asc' },
        select: { entradaId: true, tipo: true },
      }),
      this.prisma.entrada.count({
        where: {
          eventoId: evento.id,
          estado: { notIn: ENTRADA_INVALIDA },
          OR: [
            { fechaId: fecha.id },
            {
              fechaId: null,
              categoria: {
                fechasDisponibles: {
                  some: { fechaId: fecha.id, disponible: true },
                },
              },
            },
          ],
        },
      }),
    ]);
    const conteo: Record<AccesoTipo, number> = {
      INGRESO: 0,
      REINGRESO: 0,
      SALIDA: 0,
    };
    const ultimo = new Map<string, AccesoTipo>();
    for (const m of movimientos) {
      conteo[m.tipo] += 1;
      ultimo.set(m.entradaId, m.tipo);
    }
    return {
      fecha: {
        id: fecha.id,
        fecha: fecha.fecha,
        horaInicio: fecha.horaInicio,
        horaFin: fecha.horaFin,
      },
      dentro: [...ultimo.values()].filter((t) => DENTRO.includes(t)).length,
      personas: ultimo.size,
      ingresos: conteo.INGRESO,
      reingresos: conteo.REINGRESO,
      salidas: conteo.SALIDA,
      entradasDelDia,
      capacidad: evento.capacidad,
    };
  }

  private async listarRegistros(
    evento: EventoAcceso,
    fecha: FechaAcceso | null,
    encargadoId?: string,
  ) {
    if (!fecha) return { total: 0, registros: [], rechazos: [] };
    const where = {
      eventoId: evento.id,
      fechaId: fecha.id,
      ...(encargadoId ? { encargadoId } : {}),
    };
    const [total, registros, rechazos] = await Promise.all([
      this.prisma.accesoEvento.count({ where }),
      this.prisma.accesoEvento.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: MAX_REGISTROS,
        select: registroSelect,
      }),
      this.prisma.accesoRechazo.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: MAX_REGISTROS,
        select: rechazoSelect,
      }),
    ]);
    return {
      total,
      /** HU-046: intentos en los que la persona no coincidía con la foto del primer ingreso. */
      rechazos: rechazos.map((r) => ({
        id: r.id,
        sentido: r.sentido,
        motivo: r.motivo,
        createdAt: r.createdAt,
        codigo: r.entrada.codigo,
        manilla: r.entrada.manilla?.codigoFisico ?? null,
        categoria: r.entrada.categoria.nombre,
        persona: nombreCompleto(r.entrada.titular),
        documento: r.entrada.titular?.documento ?? null,
        supervisor: nombreCompleto(r.encargado),
      })),
      registros: registros.map((r) => ({
        id: r.id,
        tipo: r.tipo,
        createdAt: r.createdAt,
        fotoIngresoUrl: r.fotoIngresoUrl,
        codigo: r.entrada.codigo,
        manilla: r.entrada.manilla?.codigoFisico ?? null,
        categoria: r.entrada.categoria.nombre,
        persona: nombreCompleto(r.entrada.titular),
        documento: r.entrada.titular?.documento ?? null,
        supervisor: nombreCompleto(r.encargado),
      })),
    };
  }

  private async supervisores(eventoId: string) {
    const staff = await this.prisma.staffEvento.findMany({
      where: { eventoId, role: Role.ENCARGADO_ACCESO, activo: true },
      orderBy: { createdAt: 'asc' },
      select: {
        usuario: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            email: true,
            activo: true,
            _count: { select: { accesosRegistrados: { where: { eventoId } } } },
          },
        },
      },
    });
    return staff.map(({ usuario }) => ({
      id: usuario.id,
      nombre: nombreCompleto(usuario),
      email: usuario.email,
      activo: usuario.activo,
      registros: usuario._count.accesosRegistrados,
    }));
  }

  private async requireEvento(eventoId: string) {
    const evento = await this.prisma.evento.findUnique({
      where: { id: eventoId },
      select: eventoAccesoSelect,
    });
    if (!evento) throw new NotFoundException('Evento no encontrado');
    return evento;
  }

  private async requireEventoSupervisado(
    user: AuthUser,
    eventoId: string,
    soloPublicado = true,
  ) {
    const evento = await this.requireEvento(eventoId);
    if (!user.roles.includes(Role.ADMIN)) {
      const asignado = await this.prisma.staffEvento.findFirst({
        where: {
          eventoId,
          usuarioId: user.id,
          role: Role.ENCARGADO_ACCESO,
          activo: true,
        },
        select: { id: true },
      });
      if (!asignado)
        throw new ForbiddenException(
          'No estás asignado al control de acceso de este evento.',
        );
    }
    if (soloPublicado && evento.estado !== EventoEstado.PUBLICADO) {
      throw new BadRequestException(
        'El evento no está publicado: no se puede controlar su acceso.',
      );
    }
    return evento;
  }

  private fechaDeHoy(evento: EventoAcceso) {
    const today = todayIn(this.timeZone);
    return evento.fechas.find((f) => dateToDay(f.fecha) === today) ?? null;
  }

  /** El día pedido; si no se indica, hoy, el próximo día del evento o el último que tuvo. */
  private fechaConsultada(evento: EventoAcceso, fechaId?: string) {
    if (fechaId) {
      const fecha = evento.fechas.find((f) => f.id === fechaId);
      if (!fecha)
        throw new BadRequestException(
          'El día elegido no pertenece a este evento.',
        );
      return fecha;
    }
    const today = todayIn(this.timeZone);
    return (
      evento.fechas.find((f) => dateToDay(f.fecha) >= today) ??
      evento.fechas[evento.fechas.length - 1] ??
      null
    );
  }

  private motivoFueraDeFecha(evento: EventoAcceso) {
    const today = todayIn(this.timeZone);
    const proximo = evento.fechas.find((f) => dateToDay(f.fecha) > today);
    return proximo
      ? `El evento no se realiza hoy; el próximo día es el ${formatDia(proximo.fecha)}.`
      : 'El evento ya terminó: no se puede registrar el acceso.';
  }

  private hora(date: Date) {
    return new Intl.DateTimeFormat('es-BO', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: this.timeZone,
    }).format(date);
  }
}
