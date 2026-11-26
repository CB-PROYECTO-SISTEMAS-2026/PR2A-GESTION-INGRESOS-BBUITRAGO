import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AsignacionEntradaEstado,
  AsignacionEntradaTipo,
  EntradaEstado,
  Prisma,
  Role,
  TitularAsignacionEstado,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../../common/mail/mail.service';
import { generateToken, hashToken } from '../../common/security/tokens';
import { normalizeEmail } from '../../common/security/user-identity';
import { newTicketCode } from '../tickets/ticket-codes';
import {
  ACCESO_CON_QR_DIGITAL,
  ENTRADA_INVALIDA,
} from '../entradas/entradas-emision';
import { IdentidadService, IDENTITY_REQUIRED } from '../identidad/identidad.service';
import { InvitarTitularDto, TransferirEntradaDto } from './dto/asignaciones.dto';

type AuthUser = { id: string; roles: Role[]; email?: string };
type Tx = Prisma.TransactionClient;

const INVITE_MSG =
  'Se ha enviado una invitación al correo indicado. El destinatario deberá iniciar sesión o crear una cuenta para aceptar su entrada.';
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class AsignacionesService {
  private readonly frontendUrl: string;

  constructor(
    private prisma: PrismaService,
    private mail: MailService,
    private identidad: IdentidadService,
    config: ConfigService,
  ) {
    this.frontendUrl = config.getOrThrow<string>('FRONTEND_URL').replace(/\/$/, '');
  }

  /** Entradas que el usuario compró (como comprador), con estado de titular. */
  async misComprasEntradas(usuarioId: string) {
    const entradas = await this.prisma.entrada.findMany({
      where: { compra: { usuarioId } },
      orderBy: { createdAt: 'desc' },
      select: this.entradaAdminSelect(),
    });
    return { entradas: entradas.map((e) => this.presentarEntrada(e, usuarioId)) };
  }

  /** Invitaciones pendientes dirigidas al correo del usuario autenticado. */
  async misInvitaciones(usuarioId: string) {
    const user = await this.prisma.usuario.findUniqueOrThrow({
      where: { id: usuarioId },
      select: { email: true },
    });
    const email = normalizeEmail(user.email);
    await this.expirarVencidas(email);

    const rows = await this.prisma.asignacionEntrada.findMany({
      where: {
        estado: AsignacionEntradaEstado.PENDIENTE,
        OR: [{ destinatarioId: usuarioId }, { destinatarioEmail: email }],
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        tipo: true,
        estado: true,
        destinatarioEmail: true,
        expiresAt: true,
        createdAt: true,
        remitente: { select: { nombre: true, apellido: true, email: true } },
        entrada: {
          select: {
            id: true,
            codigo: true,
            estado: true,
            titularEstado: true,
            categoria: { select: { nombre: true } },
            evento: { select: { id: true, titulo: true, fotoUrl: true } },
            fecha: { select: { fecha: true } },
          },
        },
      },
    });
    return { invitaciones: rows };
  }

  async asignarme(user: AuthUser, entradaId: string) {
    await this.identidad.requireIdentidad(user.id);
    return this.prisma.$transaction(async (tx) => {
      const entrada = await this.requireEntradaComprador(tx, user.id, entradaId);
      if (entrada.titularId && entrada.titularId !== user.id) {
        throw new ConflictException(
          'Esta entrada ya tiene un titular definitivo.',
        );
      }
      if (entrada.titularEstado === TitularAsignacionEstado.INVITACION_PENDIENTE) {
        await this.cancelarPendientesTx(tx, entradaId);
      }
      await this.vincularTitular(tx, entrada, user.id, false);
      return { mensaje: 'Entrada asignada a tu cuenta.', entradaId };
    });
  }

  async invitar(user: AuthUser, entradaId: string, dto: InvitarTitularDto) {
    const email = normalizeEmail(dto.email);
    const comprador = await this.prisma.usuario.findUniqueOrThrow({
      where: { id: user.id },
      select: { email: true, nombre: true, apellido: true },
    });
    if (email === normalizeEmail(comprador.email)) {
      throw new BadRequestException(
        'Para asignarte la entrada a ti, usa la opción “Asignarme”.',
      );
    }

    const { token } = await this.prisma.$transaction(async (tx) => {
      const entrada = await this.requireEntradaComprador(tx, user.id, entradaId);
      if (
        entrada.titularId &&
        entrada.titularEstado === TitularAsignacionEstado.ASIGNADA
      ) {
        throw new ConflictException(
          'Esta entrada ya tiene un titular. Usa transferencia si el evento lo permite.',
        );
      }
      await this.cancelarPendientesTx(tx, entradaId);

      const dest = await tx.usuario.findUnique({
        where: { email },
        select: { id: true, activo: true, eliminadoAt: true },
      });
      const { token, tokenHash } = generateToken();
      const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
      await tx.asignacionEntrada.create({
        data: {
          entradaId,
          remitenteId: user.id,
          destinatarioEmail: email,
          destinatarioId: dest?.activo && !dest.eliminadoAt ? dest.id : null,
          tokenHash,
          tipo: AsignacionEntradaTipo.INVITACION,
          estado: AsignacionEntradaEstado.PENDIENTE,
          expiresAt,
        },
      });
      await tx.entrada.update({
        where: { id: entradaId },
        data: {
          titularId: null,
          titularEstado: TitularAsignacionEstado.INVITACION_PENDIENTE,
          estado:
            entrada.estado === EntradaEstado.ASIGNADA
              ? EntradaEstado.GENERADA
              : entrada.estado,
        },
      });
      // Desactiva credencial mientras no haya titular.
      await tx.credencial.updateMany({
        where: { entradaId, activa: true },
        data: { activa: false },
      });
      return { token, entrada, dest };
    });

    const entradaInfo = await this.prisma.entrada.findUniqueOrThrow({
      where: { id: entradaId },
      select: {
        categoria: { select: { nombre: true } },
        evento: { select: { titulo: true } },
      },
    });
    const compradorNombre = [comprador.nombre, comprador.apellido]
      .filter(Boolean)
      .join(' ');
    await this.mail
      .sendInvitacionEntrada(email, {
        evento: entradaInfo.evento.titulo,
        categoria: entradaInfo.categoria.nombre,
        comprador: compradorNombre,
        url: `${this.frontendUrl}/invitar-entrada?token=${token}`,
      })
      .catch(() => undefined);

    return { mensaje: INVITE_MSG };
  }

  async cancelarInvitacion(user: AuthUser, asignacionId: string) {
    const row = await this.prisma.asignacionEntrada.findUnique({
      where: { id: asignacionId },
      select: {
        id: true,
        remitenteId: true,
        entradaId: true,
        estado: true,
        entrada: { select: { compra: { select: { usuarioId: true } } } },
      },
    });
    if (!row) throw new NotFoundException('Invitación no encontrada.');
    const esRemitente = row.remitenteId === user.id;
    const esComprador = row.entrada.compra?.usuarioId === user.id;
    if (!esRemitente && !esComprador && !user.roles.includes(Role.ADMIN)) {
      throw new ForbiddenException('No puedes cancelar esta invitación.');
    }
    if (row.estado !== AsignacionEntradaEstado.PENDIENTE) {
      throw new BadRequestException('La invitación ya no está pendiente.');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.asignacionEntrada.update({
        where: { id: row.id },
        data: {
          estado: AsignacionEntradaEstado.CANCELADA,
          cancelledAt: new Date(),
          tokenHash: null,
        },
      });
      await tx.entrada.update({
        where: { id: row.entradaId },
        data: { titularEstado: TitularAsignacionEstado.SIN_ASIGNAR },
      });
    });
    return { mensaje: 'Invitación cancelada.' };
  }

  async reenviarInvitacion(user: AuthUser, asignacionId: string) {
    const row = await this.prisma.asignacionEntrada.findUnique({
      where: { id: asignacionId },
      include: {
        entrada: {
          select: {
            id: true,
            compra: { select: { usuarioId: true } },
            categoria: { select: { nombre: true } },
            evento: { select: { titulo: true } },
          },
        },
        remitente: { select: { nombre: true, apellido: true } },
      },
    });
    if (!row) throw new NotFoundException('Invitación no encontrada.');
    if (
      row.remitenteId !== user.id &&
      row.entrada.compra?.usuarioId !== user.id
    ) {
      throw new ForbiddenException('No puedes reenviar esta invitación.');
    }
    if (row.estado !== AsignacionEntradaEstado.PENDIENTE) {
      throw new BadRequestException('Solo se pueden reenviar invitaciones pendientes.');
    }
    const { token, tokenHash } = generateToken();
    await this.prisma.asignacionEntrada.update({
      where: { id: row.id },
      data: {
        tokenHash,
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      },
    });
    const nombre = [row.remitente.nombre, row.remitente.apellido]
      .filter(Boolean)
      .join(' ');
    await this.mail
      .sendInvitacionEntrada(row.destinatarioEmail, {
        evento: row.entrada.evento.titulo,
        categoria: row.entrada.categoria.nombre,
        comprador: nombre,
        url: `${this.frontendUrl}/invitar-entrada?token=${token}`,
      })
      .catch(() => undefined);
    return { mensaje: INVITE_MSG };
  }

  async aceptar(user: AuthUser, asignacionId: string, token?: string) {
    await this.identidad.requireIdentidad(user.id);
    const userEmail = normalizeEmail(
      (
        await this.prisma.usuario.findUniqueOrThrow({
          where: { id: user.id },
          select: { email: true },
        })
      ).email,
    );

    return this.prisma.$transaction(async (tx) => {
      const row = await tx.asignacionEntrada.findUnique({
        where: { id: asignacionId },
        include: {
          entrada: {
            select: {
              id: true,
              estado: true,
              titularId: true,
              titularEstado: true,
              codigoQr: true,
              tokenVersion: true,
              evento: {
                select: {
                  tipoAcceso: true,
                  permiteTransferencias: true,
                  transferenciaHasta: true,
                  estado: true,
                },
              },
              credencial: { select: { id: true, activa: true, version: true } },
            },
          },
        },
      });
      if (!row) throw new NotFoundException('Invitación no encontrada.');
      if (row.estado !== AsignacionEntradaEstado.PENDIENTE) {
        throw new BadRequestException('Esta invitación ya no está disponible.');
      }
      if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
        await tx.asignacionEntrada.update({
          where: { id: row.id },
          data: { estado: AsignacionEntradaEstado.EXPIRADA, tokenHash: null },
        });
        throw new BadRequestException('La invitación expiró.');
      }
      if (normalizeEmail(row.destinatarioEmail) !== userEmail) {
        throw new ForbiddenException(
          'Debes iniciar sesión con el correo al que se envió la invitación.',
        );
      }
      if (token) {
        if (!row.tokenHash || hashToken(token) !== row.tokenHash) {
          throw new BadRequestException('El enlace de invitación no es válido.');
        }
      } else if (!row.destinatarioId && !row.tokenHash) {
        throw new BadRequestException('La invitación no es válida.');
      }

      const esTransferencia = row.tipo === AsignacionEntradaTipo.TRANSFERENCIA;
      if (esTransferencia) {
        this.assertTransferenciaPermitida(row.entrada.evento);
      }
      if (ENTRADA_INVALIDA.includes(row.entrada.estado)) {
        throw new BadRequestException('La entrada ya no es válida.');
      }

      // Un solo uso: invalidar token al aceptar.
      const updated = await tx.asignacionEntrada.updateMany({
        where: { id: row.id, estado: AsignacionEntradaEstado.PENDIENTE },
        data: {
          estado: AsignacionEntradaEstado.ACEPTADA,
          acceptedAt: new Date(),
          destinatarioId: user.id,
          tokenHash: null,
        },
      });
      if (!updated.count) {
        throw new ConflictException('La invitación ya fue utilizada.');
      }

      if (esTransferencia && row.entrada.titularId) {
        // Revoca titular anterior y regenera QR.
        await this.revocarCredencial(tx, row.entrada.id);
      }

      await this.vincularTitular(tx, row.entrada, user.id, esTransferencia);
      return { mensaje: 'Entrada aceptada. Ya eres el titular.', entradaId: row.entradaId };
    });
  }

  async rechazar(user: AuthUser, asignacionId: string) {
    const userEmail = normalizeEmail(
      (
        await this.prisma.usuario.findUniqueOrThrow({
          where: { id: user.id },
          select: { email: true },
        })
      ).email,
    );
    const row = await this.prisma.asignacionEntrada.findUnique({
      where: { id: asignacionId },
    });
    if (!row) throw new NotFoundException('Invitación no encontrada.');
    if (normalizeEmail(row.destinatarioEmail) !== userEmail) {
      throw new ForbiddenException('Esta invitación no te corresponde.');
    }
    if (row.estado !== AsignacionEntradaEstado.PENDIENTE) {
      throw new BadRequestException('La invitación ya no está pendiente.');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.asignacionEntrada.update({
        where: { id: row.id },
        data: {
          estado: AsignacionEntradaEstado.RECHAZADA,
          cancelledAt: new Date(),
          tokenHash: null,
        },
      });
      await tx.entrada.update({
        where: { id: row.entradaId },
        data: {
          titularEstado:
            row.tipo === AsignacionEntradaTipo.TRANSFERENCIA
              ? TitularAsignacionEstado.ASIGNADA
              : TitularAsignacionEstado.SIN_ASIGNAR,
        },
      });
    });
    return { mensaje: 'Invitación rechazada.' };
  }

  async transferir(user: AuthUser, entradaId: string, dto: TransferirEntradaDto) {
    const email = normalizeEmail(dto.email);
    const me = await this.prisma.usuario.findUniqueOrThrow({
      where: { id: user.id },
      select: { email: true, nombre: true, apellido: true },
    });
    if (email === normalizeEmail(me.email)) {
      throw new BadRequestException('No puedes transferirte la entrada a ti mismo.');
    }

    const { token } = await this.prisma.$transaction(async (tx) => {
      const entrada = await tx.entrada.findUnique({
        where: { id: entradaId },
        select: {
          id: true,
          titularId: true,
          titularEstado: true,
          estado: true,
          evento: {
            select: {
              titulo: true,
              permiteTransferencias: true,
              transferenciaHasta: true,
              estado: true,
            },
          },
          categoria: { select: { nombre: true } },
        },
      });
      if (!entrada) throw new NotFoundException('Entrada no encontrada.');
      if (entrada.titularId !== user.id) {
        throw new ForbiddenException('Solo el titular actual puede transferir la entrada.');
      }
      if (entrada.titularEstado !== TitularAsignacionEstado.ASIGNADA) {
        throw new BadRequestException('La entrada no tiene un titular definitivo.');
      }
      if (ENTRADA_INVALIDA.includes(entrada.estado) || entrada.estado === EntradaEstado.USADA) {
        throw new BadRequestException('No se puede transferir una entrada usada o anulada.');
      }
      this.assertTransferenciaPermitida(entrada.evento);
      await this.cancelarPendientesTx(tx, entradaId);

      const dest = await tx.usuario.findUnique({
        where: { email },
        select: { id: true, activo: true, eliminadoAt: true },
      });
      const { token, tokenHash } = generateToken();
      await tx.asignacionEntrada.create({
        data: {
          entradaId,
          remitenteId: user.id,
          destinatarioEmail: email,
          destinatarioId: dest?.activo && !dest.eliminadoAt ? dest.id : null,
          tokenHash,
          tipo: AsignacionEntradaTipo.TRANSFERENCIA,
          estado: AsignacionEntradaEstado.PENDIENTE,
          expiresAt: new Date(Date.now() + INVITE_TTL_MS),
        },
      });
      await tx.entrada.update({
        where: { id: entradaId },
        data: { titularEstado: TitularAsignacionEstado.INVITACION_PENDIENTE },
      });
      return { token, entrada };
    });

    const nombre = [me.nombre, me.apellido].filter(Boolean).join(' ');
    const info = await this.prisma.entrada.findUniqueOrThrow({
      where: { id: entradaId },
      select: {
        categoria: { select: { nombre: true } },
        evento: { select: { titulo: true } },
      },
    });
    await this.mail
      .sendInvitacionEntrada(email, {
        evento: info.evento.titulo,
        categoria: info.categoria.nombre,
        comprador: nombre,
        url: `${this.frontendUrl}/invitar-entrada?token=${token}`,
        esTransferencia: true,
      })
      .catch(() => undefined);

    return { mensaje: INVITE_MSG };
  }

  /**
   * Tras aprobar compra: crea invitaciones con token para ítems con paraEmail.
   * Devuelve payloads para enviar correo fuera de la transacción.
   */
  async crearInvitacionesPostEmision(
    tx: Tx,
    compraId: string,
    remitenteId: string,
  ) {
    const items = await tx.compraEntradaItem.findMany({
      where: { compraId, paraEmail: { not: null }, entradaId: { not: null } },
      select: {
        paraEmail: true,
        paraNombre: true,
        entradaId: true,
        entrada: {
          select: {
            categoria: { select: { nombre: true } },
            evento: { select: { titulo: true } },
          },
        },
      },
    });
    const remitente = await tx.usuario.findUniqueOrThrow({
      where: { id: remitenteId },
      select: { nombre: true, apellido: true },
    });
    const compradorNombre = [remitente.nombre, remitente.apellido]
      .filter(Boolean)
      .join(' ');
    const mails: Array<{
      email: string;
      evento: string;
      categoria: string;
      comprador: string;
      url: string;
    }> = [];

    for (const item of items) {
      if (!item.paraEmail || !item.entradaId || !item.entrada) continue;
      const email = normalizeEmail(item.paraEmail);
      const dest = await tx.usuario.findUnique({
        where: { email },
        select: { id: true, activo: true, eliminadoAt: true },
      });
      const { token, tokenHash } = generateToken();
      await tx.asignacionEntrada.create({
        data: {
          entradaId: item.entradaId,
          remitenteId,
          destinatarioEmail: email,
          destinatarioId: dest?.activo && !dest.eliminadoAt ? dest.id : null,
          tokenHash,
          tipo: AsignacionEntradaTipo.INVITACION,
          estado: AsignacionEntradaEstado.PENDIENTE,
          expiresAt: new Date(Date.now() + INVITE_TTL_MS),
        },
      });
      await tx.entrada.update({
        where: { id: item.entradaId },
        data: {
          titularId: null,
          titularEstado: TitularAsignacionEstado.INVITACION_PENDIENTE,
          estado: EntradaEstado.GENERADA,
        },
      });
      mails.push({
        email,
        evento: item.entrada.evento.titulo,
        categoria: item.entrada.categoria.nombre,
        comprador: compradorNombre,
        url: `${this.frontendUrl}/invitar-entrada?token=${token}`,
      });
    }
    return mails;
  }

  async previewPorToken(token: string) {
    const tokenHash = hashToken(token);
    const row = await this.prisma.asignacionEntrada.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        estado: true,
        tipo: true,
        expiresAt: true,
        destinatarioEmail: true,
        entrada: {
          select: {
            codigo: true,
            categoria: { select: { nombre: true } },
            evento: { select: { titulo: true, fotoUrl: true } },
          },
        },
        remitente: { select: { nombre: true, apellido: true } },
      },
    });
    if (!row || row.estado !== AsignacionEntradaEstado.PENDIENTE) {
      throw new NotFoundException('La invitación no es válida o ya fue utilizada.');
    }
    if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('La invitación expiró.');
    }
    return {
      asignacionId: row.id,
      tipo: row.tipo,
      // No revelar si el correo tiene cuenta; solo máscara parcial.
      destinatarioEmail: this.maskEmail(row.destinatarioEmail),
      evento: row.entrada.evento.titulo,
      categoria: row.entrada.categoria.nombre,
      remitente: [row.remitente.nombre, row.remitente.apellido]
        .filter(Boolean)
        .join(' '),
    };
  }

  private maskEmail(email: string) {
    const [user, domain] = email.split('@');
    if (!domain) return '***';
    const u = user.length <= 2 ? '*'.repeat(user.length) : `${user[0]}***${user.slice(-1)}`;
    return `${u}@${domain}`;
  }

  private assertTransferenciaPermitida(evento: {
    permiteTransferencias: boolean;
    transferenciaHasta: Date | null;
  }) {
    if (!evento.permiteTransferencias) {
      throw new BadRequestException(
        'Este evento no permite transferir entradas.',
      );
    }
    if (evento.transferenciaHasta && evento.transferenciaHasta.getTime() < Date.now()) {
      throw new BadRequestException(
        'El plazo para transferir entradas de este evento ya venció.',
      );
    }
  }

  private async requireEntradaComprador(tx: Tx, usuarioId: string, entradaId: string) {
    const entrada = await tx.entrada.findUnique({
      where: { id: entradaId },
      select: {
        id: true,
        estado: true,
        titularId: true,
        titularEstado: true,
        codigoQr: true,
        tokenVersion: true,
        compra: { select: { usuarioId: true } },
        evento: { select: { tipoAcceso: true } },
        credencial: { select: { id: true, activa: true, version: true } },
      },
    });
    if (!entrada) throw new NotFoundException('Entrada no encontrada.');
    if (entrada.compra?.usuarioId !== usuarioId) {
      throw new ForbiddenException(
        'Solo el comprador puede administrar la asignación de esta entrada.',
      );
    }
    if (ENTRADA_INVALIDA.includes(entrada.estado)) {
      throw new BadRequestException('La entrada ya no es válida.');
    }
    return entrada;
  }

  private async cancelarPendientesTx(tx: Tx, entradaId: string) {
    await tx.asignacionEntrada.updateMany({
      where: { entradaId, estado: AsignacionEntradaEstado.PENDIENTE },
      data: {
        estado: AsignacionEntradaEstado.CANCELADA,
        cancelledAt: new Date(),
        tokenHash: null,
      },
    });
  }

  private async vincularTitular(
    tx: Tx,
    entrada: {
      id: string;
      estado: EntradaEstado;
      codigoQr: string;
      tokenVersion: number;
      evento: { tipoAcceso: string };
      credencial: { id: string; activa: boolean; version: number } | null;
    },
    titularId: string,
    regenerarQr: boolean,
  ) {
    const digital = ACCESO_CON_QR_DIGITAL.includes(entrada.evento.tipoAcceso as any);
    let credencialCodigo = entrada.codigoQr;
    let version = entrada.tokenVersion;

    if (regenerarQr || !entrada.credencial) {
      credencialCodigo = newTicketCode();
      version = entrada.tokenVersion + (regenerarQr ? 1 : 0);
    } else if (!entrada.credencial.activa) {
      credencialCodigo = newTicketCode();
      version = entrada.tokenVersion + 1;
    }

    await tx.entrada.update({
      where: { id: entrada.id },
      data: {
        titularId,
        titularEstado: TitularAsignacionEstado.ASIGNADA,
        tokenVersion: version,
        estado: digital ? EntradaEstado.ASIGNADA : entrada.estado,
      },
    });

    if (digital) {
      if (entrada.credencial) {
        await tx.credencial.update({
          where: { id: entrada.credencial.id },
          data: {
            codigoQr: credencialCodigo,
            version,
            activa: true,
          },
        });
      } else {
        await tx.credencial.create({
          data: {
            entradaId: entrada.id,
            codigoQr: credencialCodigo,
            version,
            activa: true,
          },
        });
      }
    }
  }

  private async revocarCredencial(tx: Tx, entradaId: string) {
    await tx.credencial.updateMany({
      where: { entradaId },
      data: { activa: false },
    });
    await tx.entrada.update({
      where: { id: entradaId },
      data: {
        titularEstado: TitularAsignacionEstado.REVOCADA,
      },
    });
  }

  private async expirarVencidas(email: string) {
    await this.prisma.asignacionEntrada.updateMany({
      where: {
        destinatarioEmail: email,
        estado: AsignacionEntradaEstado.PENDIENTE,
        expiresAt: { lt: new Date() },
      },
      data: { estado: AsignacionEntradaEstado.EXPIRADA, tokenHash: null },
    });
  }

  private entradaAdminSelect() {
    return {
      id: true,
      codigo: true,
      estado: true,
      titularEstado: true,
      titularId: true,
      createdAt: true,
      titular: {
        select: { id: true, nombre: true, apellido: true, email: true, documento: true },
      },
      categoria: { select: { nombre: true } },
      fecha: { select: { fecha: true } },
      evento: {
        select: {
          id: true,
          titulo: true,
          fotoUrl: true,
          permiteTransferencias: true,
          transferenciaHasta: true,
        },
      },
      asignaciones: {
        where: { estado: AsignacionEntradaEstado.PENDIENTE },
        orderBy: { createdAt: 'desc' as const },
        take: 1,
        select: {
          id: true,
          destinatarioEmail: true,
          estado: true,
          expiresAt: true,
          tipo: true,
        },
      },
    } satisfies Prisma.EntradaSelect;
  }

  private presentarEntrada(
    e: Prisma.EntradaGetPayload<{ select: ReturnType<AsignacionesService['entradaAdminSelect']> }>,
    compradorId: string,
  ) {
    const pend = e.asignaciones[0] ?? null;
    return {
      id: e.id,
      codigo: e.codigo,
      estado: e.estado,
      titularEstado: e.titularEstado,
      categoria: e.categoria.nombre,
      fecha: e.fecha,
      evento: e.evento,
      titular: e.titular
        ? {
            id: e.titular.id,
            nombre: [e.titular.nombre, e.titular.apellido].filter(Boolean).join(' '),
            email: e.titular.email,
            documento: e.titular.documento,
            soyYo: e.titular.id === compradorId,
          }
        : null,
      invitacionPendiente: pend
        ? {
            id: pend.id,
            email: pend.destinatarioEmail,
            expiresAt: pend.expiresAt,
            tipo: pend.tipo,
          }
        : null,
    };
  }
}

export { INVITE_MSG, IDENTITY_REQUIRED };
