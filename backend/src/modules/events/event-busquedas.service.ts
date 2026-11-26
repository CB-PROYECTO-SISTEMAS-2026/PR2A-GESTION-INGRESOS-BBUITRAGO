import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const MAX_RECIENTES_POR_IDENTIDAD = 50;

export type SugerenciasBusquedaEvento = {
  populares: string[];
  recientes: string[];
};

function normalizeTermino(raw: string): { termino: string; terminoNorm: string } | null {
  const termino = raw.replace(/\s+/g, ' ').trim().slice(0, 120);
  const terminoNorm = termino.toLowerCase();
  if (terminoNorm.length < 2) return null;
  return { termino, terminoNorm };
}

function cuidLike(): string {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 10);
  return `c${t}${r}`.slice(0, 25);
}

@Injectable()
export class EventBusquedasService {
  constructor(private prisma: PrismaService) {}

  async sugerencias(
    visitorKey?: string,
    usuarioId?: string,
  ): Promise<SugerenciasBusquedaEvento> {
    try {
      const [populares, recientes] = await Promise.all([
        this.popularTerms(),
        this.recentTerms(visitorKey, usuarioId),
      ]);
      return { populares, recientes };
    } catch {
      return { populares: [], recientes: [] };
    }
  }

  async registrar(
    raw: string,
    usuarioId?: string,
    visitorKey?: string,
  ): Promise<SugerenciasBusquedaEvento> {
    const norm = normalizeTermino(raw);
    if (!norm) {
      return { populares: [], recientes: [] };
    }

    const { termino, terminoNorm } = norm;
    const key = visitorKey?.trim() || undefined;

    try {
      await this.prisma.$executeRaw`
        INSERT INTO BusquedaEventoPopular (terminoNorm, termino, busquedas, updatedAt, createdAt)
        VALUES (${terminoNorm}, ${termino}, 1, NOW(3), NOW(3))
        ON DUPLICATE KEY UPDATE
          termino = VALUES(termino),
          busquedas = busquedas + 1,
          updatedAt = NOW(3)
      `;

      if (usuarioId || key) {
        if (usuarioId) {
          await this.prisma.$executeRaw`
            DELETE FROM BusquedaEventoReciente
            WHERE usuarioId = ${usuarioId} AND terminoNorm = ${terminoNorm}
          `;
          await this.prisma.$executeRaw`
            INSERT INTO BusquedaEventoReciente (id, usuarioId, visitorKey, termino, terminoNorm, createdAt)
            VALUES (${cuidLike()}, ${usuarioId}, NULL, ${termino}, ${terminoNorm}, NOW(3))
          `;
          await this.prisma.$executeRaw`
            DELETE FROM BusquedaEventoReciente
            WHERE usuarioId = ${usuarioId}
              AND id NOT IN (
                SELECT id FROM (
                  SELECT id FROM BusquedaEventoReciente
                  WHERE usuarioId = ${usuarioId}
                  ORDER BY createdAt DESC
                  LIMIT ${MAX_RECIENTES_POR_IDENTIDAD}
                ) AS keep_rows
              )
          `;
        } else if (key) {
          await this.prisma.$executeRaw`
            DELETE FROM BusquedaEventoReciente
            WHERE visitorKey = ${key} AND terminoNorm = ${terminoNorm}
          `;
          await this.prisma.$executeRaw`
            INSERT INTO BusquedaEventoReciente (id, usuarioId, visitorKey, termino, terminoNorm, createdAt)
            VALUES (${cuidLike()}, NULL, ${key}, ${termino}, ${terminoNorm}, NOW(3))
          `;
          await this.prisma.$executeRaw`
            DELETE FROM BusquedaEventoReciente
            WHERE visitorKey = ${key}
              AND id NOT IN (
                SELECT id FROM (
                  SELECT id FROM BusquedaEventoReciente
                  WHERE visitorKey = ${key}
                  ORDER BY createdAt DESC
                  LIMIT ${MAX_RECIENTES_POR_IDENTIDAD}
                ) AS keep_rows
              )
          `;
        }
      }
    } catch {
      return this.sugerencias(key, usuarioId);
    }

    return this.sugerencias(key, usuarioId);
  }

  private async popularTerms(): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<{ termino: string }[]>`
      SELECT termino FROM BusquedaEventoPopular
      ORDER BY busquedas DESC, updatedAt DESC
      LIMIT 3
    `;
    return rows.map((r) => r.termino);
  }

  private async recentTerms(
    visitorKey?: string,
    usuarioId?: string,
  ): Promise<string[]> {
    const key = visitorKey?.trim() || undefined;
    if (!usuarioId && !key) return [];

    const rows = usuarioId
      ? await this.prisma.$queryRaw<{ termino: string; terminoNorm: string }[]>`
          SELECT termino, terminoNorm FROM BusquedaEventoReciente
          WHERE usuarioId = ${usuarioId}
          ORDER BY createdAt DESC
          LIMIT 12
        `
      : await this.prisma.$queryRaw<{ termino: string; terminoNorm: string }[]>`
          SELECT termino, terminoNorm FROM BusquedaEventoReciente
          WHERE visitorKey = ${key}
          ORDER BY createdAt DESC
          LIMIT 12
        `;

    const seen = new Set<string>();
    const out: string[] = [];
    for (const row of rows) {
      if (seen.has(row.terminoNorm)) continue;
      seen.add(row.terminoNorm);
      out.push(row.termino);
      if (out.length >= 3) break;
    }
    return out;
  }
}