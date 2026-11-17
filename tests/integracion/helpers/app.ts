/**
 * Levanta la API real de Eventix (AppModule + configureApp, igual que backend/src/main.ts)
 * dentro de la prueba, en un puerto libre de la máquina, y ofrece un cliente HTTP mínimo.
 *
 * No hace falta tener el backend corriendo: cada archivo de prueba tiene su propia instancia.
 * El límite de peticiones (throttler) guarda sus contadores en memoria de esta instancia, así que
 * cada ejecución empieza con los contadores en cero.
 */
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AddressInfo } from 'net';
import { AppModule } from '../../../backend/src/app.module';
import { configureApp } from '../../../backend/src/app.setup';
import { PrismaService } from '../../../backend/src/prisma/prisma.service';

export interface Respuesta<T = any> {
  status: number;
  body: T;
  headers: Headers;
}

export interface ApiDePrueba {
  app: NestExpressApplication;
  prisma: PrismaService;
  url: string;
  /** Petición HTTP real a la API. `token` agrega "Authorization: Bearer <token>". */
  pedir: <T = any>(
    metodo: string,
    ruta: string,
    opciones?: { token?: string; body?: unknown; rawBody?: string; headers?: Record<string, string> },
  ) => Promise<Respuesta<T>>;
  cerrar: () => Promise<void>;
}

export async function levantarApi(): Promise<ApiDePrueba> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error'],
  });
  configureApp(app);
  await app.listen(0, '127.0.0.1');
  const { port } = app.getHttpServer().address() as AddressInfo;
  const url = `http://127.0.0.1:${port}`;

  const pedir: ApiDePrueba['pedir'] = async (metodo, ruta, opciones = {}) => {
    const headers: Record<string, string> = { ...opciones.headers };
    if (opciones.token) headers.Authorization = `Bearer ${opciones.token}`;
    let body: string | undefined;
    if (opciones.rawBody !== undefined) {
      body = opciones.rawBody;
      headers['Content-Type'] ??= 'application/json';
    } else if (opciones.body !== undefined) {
      body = JSON.stringify(opciones.body);
      headers['Content-Type'] = 'application/json';
    }
    const res = await fetch(`${url}${ruta}`, { method: metodo, headers, body });
    const texto = await res.text();
    let parsed: unknown = texto;
    try {
      parsed = texto ? JSON.parse(texto) : null;
    } catch {
      // Respuesta que no es JSON (p. ej. CSV): se deja como texto.
    }
    return { status: res.status, body: parsed as never, headers: res.headers };
  };

  return {
    app,
    prisma: app.get(PrismaService),
    url,
    pedir,
    cerrar: () => app.close(),
  };
}
