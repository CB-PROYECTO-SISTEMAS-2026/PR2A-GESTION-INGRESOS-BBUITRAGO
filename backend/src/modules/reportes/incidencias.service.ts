import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/** Categorías operativas que el organizador reporta al admin (HU-045). */
export const TIPOS_INCIDENCIA = [
  'ACCESO',
  'AFORO',
  'CAJA',
  'NEGOCIO',
  'SEGURIDAD',
  'INFRAESTRUCTURA',
  'OTRO',
] as const;

export const PRIORIDADES_INCIDENCIA = ['BAJA', 'MEDIA', 'ALTA'] as const;

export type TipoIncidencia = (typeof TIPOS_INCIDENCIA)[number];
export type PrioridadIncidencia = (typeof PRIORIDADES_INCIDENCIA)[number];

const META_RE = /^\[([A-Z_]+)\|([A-Z]+)\]\s([\s\S]*)$/;

function empaquetar(
  tipo: TipoIncidencia,
  prioridad: PrioridadIncidencia,
  descripcion: string,
) {
  return `[${tipo}|${prioridad}] ${descripcion.trim()}`;
}

function desempaquetar(raw: string) {
  const m = META_RE.exec(raw);
  if (!m) {
    return {
      tipo: 'OTRO' as TipoIncidencia,
      prioridad: 'MEDIA' as PrioridadIncidencia,
      descripcion: raw,
    };
  }
  const tipo = (TIPOS_INCIDENCIA.includes(m[1] as TipoIncidencia)
    ? m[1]
    : 'OTRO') as TipoIncidencia;
  const prioridad = (PRIORIDADES_INCIDENCIA.includes(
    m[2] as PrioridadIncidencia,
  )
    ? m[2]
    : 'MEDIA') as PrioridadIncidencia;
  return { tipo, prioridad, descripcion: m[3] };
}

function presentar(row: {
  id: string;
  eventoId: string;
  autorId: string;
  clave: string;
  descripcion: string;
  resolucion: string | null;
  resueltaPorId: string | null;
  resueltaAt: Date | null;
  createdAt: Date;
}) {
  const meta = desempaquetar(row.descripcion);
  return {
    id: row.id,
    eventoId: row.eventoId,
    autorId: row.autorId,
    clave: row.clave,
    tipo: meta.tipo,
    prioridad: meta.prioridad,
    descripcion: meta.descripcion,
    resolucion: row.resolucion,
    resueltaPorId: row.resueltaPorId,
    resueltaAt: row.resueltaAt,
    createdAt: row.createdAt,
    abierta: !row.resueltaAt,
  };
}

@Injectable()
export class IncidenciasEventoService {
  constructor(private db: PrismaService) {}

  async registrar(
    eventoId: string,
    autorId: string,
    clave: string,
    descripcion: string,
    tipo: TipoIncidencia = 'OTRO',
    prioridad: PrioridadIncidencia = 'MEDIA',
  ) {
    if (!TIPOS_INCIDENCIA.includes(tipo)) {
      throw new BadRequestException('Tipo de incidencia no válido.');
    }
    if (!PRIORIDADES_INCIDENCIA.includes(prioridad)) {
      throw new BadRequestException('Prioridad no válida.');
    }
    const packed = empaquetar(tipo, prioridad, descripcion);
    if (packed.length > 500) {
      throw new BadRequestException(
        'La descripción es demasiado larga para el tipo y la prioridad elegidos.',
      );
    }
    const where = { eventoId_autorId_clave: { eventoId, autorId, clave } };
    try {
      const creada = await this.db.incidenciaEvento.create({
        data: { eventoId, autorId, clave, descripcion: packed },
      });
      return presentar(creada);
    } catch (e) {
      if (e?.code !== 'P2002') throw e;
      const previa = await this.db.incidenciaEvento.findUniqueOrThrow({
        where,
      });
      if (previa.descripcion !== packed)
        throw new ConflictException(
          'La clave ya corresponde a otra incidencia.',
        );
      return presentar(previa);
    }
  }

  async listar(eventoId: string, page: number) {
    const rows = await this.db.incidenciaEvento.findMany({
      where: { eventoId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * 50,
      take: 50,
    });
    return rows.map(presentar);
  }

  async resumen(eventoId: string) {
    const rows = await this.db.incidenciaEvento.findMany({
      where: { eventoId },
      select: { descripcion: true, resueltaAt: true },
    });
    const abiertas = rows.filter((r) => !r.resueltaAt);
    const porPrioridad = { ALTA: 0, MEDIA: 0, BAJA: 0 };
    for (const r of abiertas) {
      const { prioridad } = desempaquetar(r.descripcion);
      porPrioridad[prioridad] += 1;
    }
    return {
      total: rows.length,
      abiertas: abiertas.length,
      resueltas: rows.length - abiertas.length,
      abiertasPorPrioridad: porPrioridad,
    };
  }

  async resolver(
    eventoId: string,
    id: string,
    adminId: string,
    resolucion: string,
  ) {
    await this.db.incidenciaEvento.updateMany({
      where: { id, eventoId, resueltaAt: null },
      data: { resolucion, resueltaAt: new Date(), resueltaPorId: adminId },
    });
    const fila = await this.db.incidenciaEvento.findFirst({
      where: { id, eventoId },
    });
    if (!fila) throw new NotFoundException('Incidencia no encontrada.');
    if (fila.resolucion !== resolucion || fila.resueltaPorId !== adminId)
      throw new ConflictException('La incidencia ya fue resuelta.');
    return presentar(fila);
  }
}
