import { randomUUID } from "crypto";
import { JwtService } from "@nestjs/jwt";
import { Workbook } from "exceljs";
import { levantarApi, ApiDePrueba } from "./helpers/app";
import { crearEscenario, nuevoSufijo, Escenario } from "./helpers/escenario";
const { limpiarDatosPrueba } = require("./helpers/limpieza");
let api: ApiDePrueba, esc: Escenario, ruta: string, compra: string;
let admin: string, org: string, ajeno: string;
const sufijo = nuevoSufijo();
beforeAll(async () => {
  api = await levantarApi();
  esc = await crearEscenario(api.prisma, sufijo);
  const token = (sub: string) =>
    new JwtService({ secret: process.env.JWT_SECRET }).sign(
      { sub },
      { expiresIn: "5m" },
    );
  admin = token(esc.usuarios.admin);
  org = token(esc.usuarios.organizador);
  ajeno = token(esc.usuarios.organizador2);
  const eventoId = esc.eventos.abierto;
  ruta = "/api/reportes/evento/" + eventoId;
  compra = (
    await api.prisma.compraEntrada.create({
      data: {
        usuarioId: esc.usuarios.cliente,
        eventoId,
        estado: "APROBADA",
        montoTotal: "12.30",
      },
    })
  ).id;
  await api.prisma.venta.create({
    data: {
      eventoId,
      negocioId: esc.negocioId,
      ayudanteId: esc.usuarios.ayudante,
      total: "4.50",
    },
  });
});
afterAll(async () => {
  if (api) {
    try {
      if (compra)
        await api.prisma.compraEntrada.delete({ where: { id: compra } });
      await limpiarDatosPrueba(api.prisma, { sufijo });
    } finally {
      await api.cerrar();
    }
  }
});
test("reportes por rol, totales separados y acceso global", async () => {
  expect((await api.pedir("GET", ruta, { token: ajeno })).status).toBe(404);
  expect(
    (await api.pedir("GET", "/api/reportes/global", { token: org })).status,
  ).toBe(403);
  const r = await api.pedir("GET", ruta, { token: org });
  expect(r.status).toBe(200);
  expect(r.body.entradas.ingresoNeto).toBe("12.30");
  expect(r.body.negocios.total).toBe("4.50");
  expect(
    (await api.pedir("GET", "/api/reportes/global", { token: admin })).status,
  ).toBe(200);
});
test("HU-035: rankings de clientes ordenados, sin anuladas y solo para el admin", async () => {
  const eventoId = esc.eventos.abierto;
  const { cliente, cliente2 } = esc.usuarios;
  const mover = async (
    usuarioId: string,
    tipo: "RECARGA" | "DEVOLUCION",
    monto: number,
    estado: "COMPLETADA" | "ANULADA" = "COMPLETADA",
  ) => {
    const { id } = await api.prisma.saldoEvento.upsert({
      where: { usuarioId_eventoId: { usuarioId, eventoId } },
      create: { usuarioId, eventoId, saldo: 0 },
      update: {},
    });
    await api.prisma.transaccionSaldo.create({
      data: {
        saldoEventoId: id,
        usuarioId,
        eventoId,
        tipo,
        monto,
        estado,
        saldoResultante: 0,
      },
    });
  };
  await mover(cliente, "RECARGA", 30);
  await mover(cliente, "RECARGA", 20);
  await mover(cliente2, "RECARGA", 80);
  await mover(cliente, "RECARGA", 500, "ANULADA");
  await mover(cliente, "DEVOLUCION", 15);

  const r = await api.pedir("GET", ruta, { token: admin });
  expect(r.body.clientes.recargas).toMatchObject([
    { usuarioId: cliente2, cantidad: 1, total: "80.00" },
    { usuarioId: cliente, cantidad: 2, total: "50.00" },
  ]);
  expect(r.body.clientes.recargas[0].nombre).toContain("Prueba");
  expect(r.body.clientes.devoluciones).toMatchObject([
    { usuarioId: cliente, cantidad: 1, total: "15.00" },
  ]);
  const global = await api.pedir("GET", "/api/reportes/global", {
    token: admin,
  });
  expect(global.body.clientes.recargas.length).toBeGreaterThan(0);
  const propio = await api.pedir("GET", ruta, { token: org });
  expect(propio.status).toBe(200);
  expect(propio.body).not.toHaveProperty("clientes");
});

test("exporta ambos tipos de venta en CSV y XLSX legible", async () => {
  for (const formato of ["csv", "xlsx"]) {
    const res = await fetch(api.url + ruta + "/ventas?formato=" + formato, {
      headers: { Authorization: "Bearer " + org },
    });
    expect(res.status).toBe(200);
    if (formato === "csv") {
      const texto = await res.text();
      expect(texto).toContain("Entrada;");
      expect(texto).toContain("Negocio;");
    } else {
      const libro = new Workbook();
      await libro.xlsx.load(await res.arrayBuffer());
      const hoja = libro.worksheets[0];
      expect(hoja.rowCount).toBe(3);
      expect(
        [hoja.getCell("E2").value, hoja.getCell("E3").value].sort(),
      ).toEqual([12.3, 4.5]);
    }
  }
});
test("organizador registra una incidencia sin duplicados y admin resuelve", async () => {
  const url = ruta + "/incidencias",
    body = {
      idempotencyKey: randomUUID(),
      descripcion: "Falla en el punto de ingreso",
    };
  const crear = () => api.pedir("POST", url, { token: org, body });
  const a = await crear();
  expect(a.status).toBe(201);
  expect((await crear()).body.id).toBe(a.body.id);
  expect(
    (
      await api.pedir("POST", url, {
        token: org,
        body: { ...body, descripcion: "Otra incidencia" },
      })
    ).status,
  ).toBe(409);
  expect((await api.pedir("GET", url, { token: ajeno })).status).toBe(404);
  const r = await api.pedir("PATCH", url + "/" + a.body.id, {
    token: admin,
    body: { resolucion: "Ingreso habilitado" },
  });
  expect(r.status).toBe(200);
  expect(r.body.resueltaPorId).toBe(esc.usuarios.admin);
});
