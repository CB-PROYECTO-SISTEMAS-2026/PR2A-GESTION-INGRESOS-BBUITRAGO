import 'dotenv/config';
import { PrismaClient, Role, EventoEstado, TipoAcceso, SolicitudEstado } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { v2 as cloudinary } from 'cloudinary';
import { buildPoolRows } from '../src/modules/tickets/ticket-codes';

if (process.env.NODE_ENV === 'production' && process.env.SEED_ALLOW_PRODUCTION !== 'true') {
  console.error('El seed borra contenido y resetea contraseñas de demo: no se ejecuta en producción.');
  process.exit(1);
}

const prisma = new PrismaClient();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

async function hostImage(remoteUrl: string) {
  const res = await cloudinary.uploader.upload(remoteUrl, {
    folder: `${process.env.CLOUDINARY_FOLDER || 'eventix'}/eventos`,
    resource_type: 'image',
  });
  return { fotoUrl: res.secure_url, fotoPublicId: res.public_id };
}

const day = (d: string) => new Date(`${d}T00:00:00.000Z`);

const ROLE_USERS: Array<{
  email: string;
  password: string;
  nombre: string;
  apellido: string;
  telefono: string;
  documento?: string;
  role: Role;
}> = [
  {
    email: 'admin@eventix.com',
    password: 'Admin123!',
    nombre: 'Admin',
    apellido: 'EvenTix',
    telefono: '+59170000001',
    role: Role.ADMIN,
  },
  {
    email: 'organizador@eventix.com',
    password: 'Organiza123!',
    nombre: 'Organizador',
    apellido: 'EvenTix',
    telefono: '+59170000002',
    role: Role.ORGANIZADOR,
  },
  {
    email: 'cliente@eventix.com',
    password: 'Cliente123!',
    nombre: 'Cliente',
    apellido: 'EvenTix',
    telefono: '+59170000003',
    documento: '7845123',
    role: Role.CLIENTE,
  },
  {
    email: 'negocio@eventix.com',
    password: 'Negocio123!',
    nombre: 'Jefe',
    apellido: 'Negocio',
    telefono: '+59170000004',
    role: Role.JEFE_NEGOCIO,
  },
  {
    email: 'ayudante@eventix.com',
    password: 'Ayudante123!',
    nombre: 'Ayudante',
    apellido: 'Negocio',
    telefono: '+59170000005',
    role: Role.AYUDANTE,
  },
  {
    email: 'acceso@eventix.com',
    password: 'Acceso123!',
    nombre: 'Encargado',
    apellido: 'Acceso',
    telefono: '+59170000006',
    role: Role.ENCARGADO_ACCESO,
  },
  {
    email: 'recargador@eventix.com',
    password: 'Recarga123!',
    nombre: 'Recargador',
    apellido: 'EvenTix',
    telefono: '+59170000007',
    role: Role.RECARGADOR,
  },
  {
    email: 'devoluciones@eventix.com',
    password: 'Devol123!',
    nombre: 'Encargado',
    apellido: 'Devoluciones',
    telefono: '+59170000008',
    role: Role.DEVOLUCIONES,
  },
];

async function upsertUser(params: (typeof ROLE_USERS)[number]) {
  const passwordHash = await bcrypt.hash(params.password, 10);

  const user = await prisma.usuario.upsert({
    where: { email: params.email },
    update: {
      passwordHash,
      nombre: params.nombre,
      apellido: params.apellido,
      telefono: params.telefono,
      documento: params.documento,
      activo: true,
      eliminadoAt: null,
    },
    create: {
      email: params.email,
      passwordHash,
      nombre: params.nombre,
      apellido: params.apellido,
      telefono: params.telefono,
      documento: params.documento,
      roles: {
        create: { role: params.role },
      },
    },
    include: { roles: true },
  });

  const hasRole = user.roles.some((r) => r.role === params.role);
  if (!hasRole) {
    await prisma.usuarioRol.create({
      data: { usuarioId: user.id, role: params.role },
    });
  }

  return { id: user.id, email: params.email, password: params.password, role: params.role };
}

async function wipeDemoContent() {
  // Orden por FKs: limpia contenido de demo sin tocar usuarios base
  await prisma.detalleVenta.deleteMany();
  await prisma.transaccionSaldo.deleteMany();
  await prisma.venta.deleteMany();
  await prisma.retiroGanancias.deleteMany();
  await prisma.ayudanteNegocio.deleteMany();
  await prisma.producto.deleteMany();
  await prisma.negocio.deleteMany();
  await prisma.reembolsoEntrada.deleteMany();
  await prisma.accesoEvento.deleteMany();
  await prisma.manilla.deleteMany();
  await prisma.credencial.deleteMany();
  await prisma.entrada.deleteMany();
  await prisma.pagoQR.deleteMany();
  await prisma.compraEntradaItem.deleteMany();
  await prisma.compraEntrada.deleteMany();
  await prisma.ticketPool.deleteMany();
  await prisma.categoriaFecha.deleteMany();
  await prisma.categoriaEntrada.deleteMany();
  await prisma.fechaEvento.deleteMany();
  await prisma.mapaHistorial.deleteMany();
  await prisma.puntoRetiroManilla.deleteMany();
  await prisma.staffEvento.deleteMany();
  await prisma.saldoEvento.deleteMany();
  await prisma.liquidacionEvento.deleteMany();
  const fotos = await prisma.evento.findMany({ where: { fotoPublicId: { not: null } }, select: { fotoPublicId: true } });
  for (const { fotoPublicId } of fotos) {
    await cloudinary.uploader.destroy(fotoPublicId!).catch(() => undefined);
  }
  await prisma.evento.deleteMany();
  await prisma.solicitudEvento.deleteMany();
}

const mapsUrl = (lugar: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lugar)}`;

/** Igual que la API: cada categoría tiene tantos códigos QR como entradas (cupo). */
async function crearPool(categoriaId: string, cupo: number) {
  for (let i = 0; i < cupo; i += 1000) {
    await prisma.ticketPool.createMany({ data: buildPoolRows(categoriaId, Math.min(1000, cupo - i)) });
  }
}

async function main() {
  console.log('Seeding EvenTix (Cochabamba)...');

  const created = [];
  for (const roleUser of ROLE_USERS) {
    created.push(await upsertUser(roleUser));
  }

  const byEmail = Object.fromEntries(created.map((u) => [u.email, u]));
  const organizadorId = byEmail['organizador@eventix.com'].id;
  const clienteId = byEmail['cliente@eventix.com'].id;
  const jefeId = byEmail['negocio@eventix.com'].id;
  const ayudanteUserId = byEmail['ayudante@eventix.com'].id;

  await wipeDemoContent();

  // Solicitud pendiente (demo admin HU-002 / HU-051)
  await prisma.solicitudEvento.create({
    data: {
      organizadorId,
      nombreEvento: 'Festival de la Canción Cochabamba 2026',
      descripcion:
        'Festival competitivo de canción inédita con artistas invitados de Bolivia y Latinoamérica. Incluye escenarios principal y acústico, zona gastronómica y feria de productores locales.',
      ubicacion: 'Campo Ferial Alalay, Cochabamba',
      ubicacionUrl: mapsUrl('Campo Ferial Alalay, Cochabamba'),
      capacidad: 8000,
      empresa: 'Fundación Cultural Tunari',
      fechaInicio: day('2026-11-14'),
      fechaFin: day('2026-11-16'),
      horaInicio: '18:00',
      horaFin: '23:00',
      estado: SolicitudEstado.PENDIENTE,
    },
  });

  // Evento 1: Concierto Los Kjarkas
  const solKjarkas = await prisma.solicitudEvento.create({
    data: {
      organizadorId,
      nombreEvento: 'Los Kjarkas — Concierto Aniversario en Cochabamba',
      descripcion:
        'Los Kjarkas celebran décadas de música andina con un concierto único en el Coliseo Municipal. Un recorrido por clásicos como “Llorando se fue”, “Bolivia” y “Ave de cristal”, con invitados especiales del folklore boliviano.',
      ubicacion: 'Coliseo Municipal de Cochabamba',
      ubicacionUrl: mapsUrl('Coliseo Municipal de Cochabamba'),
      capacidad: 12000,
      empresa: 'Producciones Andes Live',
      fechaInicio: day('2026-10-18'),
      horaInicio: '20:00',
      horaFin: '23:30',
      estado: SolicitudEstado.EVENTO_CREADO,
      observaciones: 'Aprobado. Confirmar punto de retiro de manillas VIP.',
    },
  });

  const eventoKjarkas = await prisma.evento.create({
    data: {
      solicitudId: solKjarkas.id,
      organizadorId,
      titulo: 'Los Kjarkas — Concierto Aniversario en Cochabamba',
      descripcion:
        'Noche histórica con Los Kjarkas en el Coliseo Municipal de Cochabamba. Más de dos horas de folklore andino, proyecciones y homenaje a la música boliviana. Ideal para familias y público general.',
      ...(await hostImage(
        'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=1600&q=80',
      )),
      ubicacion: 'Coliseo Municipal de Cochabamba, Av. Blanco Galindo',
      ubicacionUrl: mapsUrl('Coliseo Municipal de Cochabamba'),
      servicios: ['Estacionamiento', 'Seguridad privada', 'Puestos de comida', 'Baños', 'Zona VIP', 'Primeros auxilios'],
      cronograma: {
        apertura: '19:00',
        cierre: '23:30',
        actividades: [
          { hora: '20:00', actividad: 'Artista telonero' },
          { hora: '20:45', actividad: 'Los Kjarkas en vivo' },
        ],
      },
      tipoAcceso: TipoAcceso.QR_DIGITAL,
      estado: EventoEstado.PUBLICADO,
      capacidad: 12000,
      fechas: {
        create: [{ fecha: day('2026-10-18'), horaInicio: '19:00', horaFin: '23:30' }],
      },
    },
    include: { fechas: true },
  });

  const catGeneralK = await prisma.categoriaEntrada.create({
    data: {
      eventoId: eventoKjarkas.id,
      nombre: 'General',
      precio: 80,
      beneficios: ['Acceso general', 'Vista a platea'],
      cupo: 8000,
      fechasDisponibles: {
        create: [{ fechaId: eventoKjarkas.fechas[0].id, disponible: true }],
      },
    },
  });
  const catVipK = await prisma.categoriaEntrada.create({
    data: {
      eventoId: eventoKjarkas.id,
      nombre: 'VIP',
      precio: 180,
      beneficios: ['Zona preferencial', 'Acceso anticipado', 'Kit de bienvenida'],
      cupo: 1500,
      fechasDisponibles: {
        create: [{ fechaId: eventoKjarkas.fechas[0].id, disponible: true }],
      },
    },
  });

  for (const cat of [catGeneralK, catVipK]) await crearPool(cat.id, cat.cupo);

  // Evento 2: Feria del Libro
  const solLibro = await prisma.solicitudEvento.create({
    data: {
      organizadorId,
      nombreEvento: 'Feria Internacional del Libro Cochabamba 2026',
      descripcion:
        'La feria literaria más importante del valle. Editoriales bolivianas e internacionales, firmas de autores, talleres infantiles, café literario y escenario cultural todos los días.',
      ubicacion: 'Campo Ferial Alalay, Cochabamba',
      ubicacionUrl: mapsUrl('Campo Ferial Alalay, Cochabamba'),
      capacidad: 15000,
      empresa: 'Cámara Departamental del Libro',
      fechaInicio: day('2026-10-02'),
      fechaFin: day('2026-10-04'),
      horaInicio: '10:00',
      horaFin: '21:00',
      estado: SolicitudEstado.EVENTO_CREADO,
      observaciones: 'Aprobado. Publicar categorías de pase diario y pase completo.',
    },
  });

  const eventoLibro = await prisma.evento.create({
    data: {
      solicitudId: solLibro.id,
      organizadorId,
      titulo: 'Feria Internacional del Libro Cochabamba 2026',
      descripcion:
        'Tres días de cultura, lectura y encuentros con autores. Más de 120 stands, programación infantil, foros académicos y presentaciones editoriales. Entrada con pases diarios o abono completo.',
      ...(await hostImage(
        'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&w=1600&q=80',
      )),
      ubicacion: 'Campo Ferial Alalay, Cochabamba',
      ubicacionUrl: mapsUrl('Campo Ferial Alalay, Cochabamba'),
      servicios: ['WiFi gratuito', 'Zona infantil', 'Cafetería', 'Accesibilidad', 'Guardarropa'],
      cronograma: {
        apertura: '09:30',
        cierre: '21:00',
        actividades: [
          { hora: '10:00', actividad: 'Inauguración de pabellones' },
          { hora: '11:00', actividad: 'Presentaciones editoriales' },
          { hora: '16:00', actividad: 'Firmas de autores' },
          { hora: '19:00', actividad: 'Escenario cultural' },
        ],
      },
      tipoAcceso: TipoAcceso.MANILLA,
      estado: EventoEstado.PUBLICADO,
      capacidad: 15000,
      puntoRetiroManilla: 'Puerta principal Alalay',
      horarioRetiroManilla: '09:30 - 20:00',
      fechas: {
        create: [
          { fecha: day('2026-10-02'), horaInicio: '09:30', horaFin: '21:00' },
          { fecha: day('2026-10-03'), horaInicio: '09:30', horaFin: '21:00' },
          { fecha: day('2026-10-04'), horaInicio: '09:30', horaFin: '21:00' },
        ],
      },
    },
    include: { fechas: true },
  });

  const catDiario = await prisma.categoriaEntrada.create({
    data: {
      eventoId: eventoLibro.id,
      nombre: 'Pase diario',
      precio: 15,
      beneficios: ['Acceso por un día', 'Manilla de ingreso'],
      cupo: 5000,
      fechasDisponibles: {
        create: eventoLibro.fechas.map((f) => ({ fechaId: f.id, disponible: true })),
      },
    },
  });
  const catCompleto = await prisma.categoriaEntrada.create({
    data: {
      eventoId: eventoLibro.id,
      nombre: 'Pase completo',
      precio: 70,
      beneficios: ['Acceso los tres días', 'Descuento en cafetería', 'Manilla de ingreso'],
      cupo: 2000,
      fechasDisponibles: {
        create: eventoLibro.fechas.map((f) => ({ fechaId: f.id, disponible: true })),
      },
    },
  });

  for (const cat of [catDiario, catCompleto]) await crearPool(cat.id, cat.cupo);

  // Evento 3: Chila Jatun
  const solChila = await prisma.solicitudEvento.create({
    data: {
      organizadorId,
      nombreEvento: 'Chila Jatun en Vivo — Cochabamba',
      descripcion:
        'La banda potosina Chila Jatun presenta su gira nacional en el Teatro Achá con un show íntimo de folk-rock andino y temas de sus últimos álbumes.',
      ubicacion: 'Teatro Achá, Plaza 14 de Septiembre, Cochabamba',
      ubicacionUrl: mapsUrl('Teatro Achá, Cochabamba'),
      capacidad: 900,
      empresa: 'Sonidos del Sur Producciones',
      fechaInicio: day('2026-11-07'),
      horaInicio: '20:30',
      horaFin: '23:00',
      estado: SolicitudEstado.EVENTO_CREADO,
    },
  });

  const eventoChila = await prisma.evento.create({
    data: {
      solicitudId: solChila.id,
      organizadorId,
      titulo: 'Chila Jatun en Vivo — Teatro Achá',
      descripcion:
        'Chila Jatun llega al Teatro Achá con un concierto de cercanía: charango, guitarra, quenas y voces potosinas. Aforo limitado. Ideal para amantes del folk contemporáneo boliviano.',
      ...(await hostImage(
        'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1600&q=80',
      )),
      ubicacion: 'Teatro Achá, Calle España esq. Plaza 14 de Septiembre, Cochabamba',
      ubicacionUrl: mapsUrl('Teatro Achá, Cochabamba'),
      servicios: ['Barra de bebidas', 'Merchandising', 'Acceso preferencial a platea'],
      cronograma: {
        apertura: '19:45',
        cierre: '23:00',
        actividades: [
          { hora: '20:30', actividad: 'Apertura acústica' },
          { hora: '21:00', actividad: 'Chila Jatun en vivo' },
        ],
      },
      tipoAcceso: TipoAcceso.AMBOS,
      estado: EventoEstado.PUBLICADO,
      capacidad: 900,
      fechas: {
        create: [{ fecha: day('2026-11-07'), horaInicio: '19:45', horaFin: '23:00' }],
      },
    },
    include: { fechas: true },
  });

  const catPlatea = await prisma.categoriaEntrada.create({
    data: {
      eventoId: eventoChila.id,
      nombre: 'Platea',
      precio: 120,
      beneficios: ['Asiento numerado', 'Mejor vista al escenario'],
      cupo: 400,
      fechasDisponibles: {
        create: [{ fechaId: eventoChila.fechas[0].id, disponible: true }],
      },
    },
  });
  const catPalco = await prisma.categoriaEntrada.create({
    data: {
      eventoId: eventoChila.id,
      nombre: 'Palco',
      precio: 200,
      beneficios: ['Palco preferencial', 'Cortesía de bienvenida'],
      cupo: 80,
      fechasDisponibles: {
        create: [{ fechaId: eventoChila.fechas[0].id, disponible: true }],
      },
    },
  });
  for (const cat of [catPlatea, catPalco]) await crearPool(cat.id, cat.cupo);

  // Evento 4: Expo Gastronómica (borrador sin imagen propia todavía)
  await prisma.evento.create({
    data: {
      organizadorId,
      titulo: 'Expo Gastronómica del Valle — Cochabamba',
      descripcion:
        'Muestra de cocina cochabambina e internacional: silpancho, pique macho, chicha, cerveza artesanal y chefs invitados.',
      ubicacion: 'Plaza de Comidas Laguna Alalay, Cochabamba',
      ubicacionUrl: mapsUrl('Laguna Alalay, Cochabamba'),
      servicios: ['Food trucks', 'Zona infantil', 'Escenario musical'],
      cronograma: {
        apertura: '11:30',
        cierre: '22:00',
        actividades: [
          { hora: '13:00', actividad: 'Muestra de chefs invitados' },
          { hora: '18:00', actividad: 'Escenario musical' },
        ],
      },
      tipoAcceso: TipoAcceso.MANILLA,
      estado: EventoEstado.BORRADOR,
      capacidad: 5000,
      fechas: {
        create: [
          { fecha: day('2026-12-05'), horaInicio: '11:30', horaFin: '22:00' },
          { fecha: day('2026-12-06'), horaInicio: '11:30', horaFin: '22:00' },
        ],
      },
    },
  });

  // Negocios + catálogo + ayudante (HU-031..034)
  const negocioEmpanadas = await prisma.negocio.create({
    data: {
      duenoId: jefeId,
      eventoId: eventoKjarkas.id,
      nombre: 'Empanadas del Tunari',
      descripcion: 'Empanadas de queso, carne y pollo al horno. Bebidas y snacks.',
      productos: {
        create: [
          { nombre: 'Empanada de queso', precio: 8, descripcion: 'Masa hojaldrada, queso criollo' },
          { nombre: 'Empanada de carne', precio: 10, descripcion: 'Carne molida, huevo y aceituna' },
          { nombre: 'Api con pastel', precio: 12, descripcion: 'Api morado + pastel de queso' },
          { nombre: 'Refresco 500 ml', precio: 6 },
        ],
      },
    },
  });

  await prisma.negocio.create({
    data: {
      duenoId: jefeId,
      eventoId: eventoLibro.id,
      nombre: 'Café Literario Alalay',
      descripcion: 'Café de especialidad, pastelería y merchandising de la feria.',
      productos: {
        create: [
          { nombre: 'Café americano', precio: 12 },
          { nombre: 'Cappuccino', precio: 18 },
          { nombre: 'Brownie', precio: 15 },
          { nombre: 'Té de coca', precio: 10 },
        ],
      },
    },
  });

  await prisma.ayudanteNegocio.create({
    data: {
      negocioId: negocioEmpanadas.id,
      usuarioId: ayudanteUserId,
      jefeId,
      rolFuncion: 'cajero',
      activo: true,
    },
  });

  // Saldos por evento en 0 para cliente demo (HU-052)
  for (const eventoId of [eventoKjarkas.id, eventoLibro.id, eventoChila.id]) {
    await prisma.saldoEvento.create({
      data: {
        usuarioId: clienteId,
        eventoId,
        saldo: 0,
      },
    });
  }

  console.log('Seed OK — usuarios por rol:');
  for (const u of created) {
    console.log(`  ${u.role.padEnd(18)} ${u.email} / ${u.password}`);
  }
  console.log('Eventos publicados: Los Kjarkas, Feria del Libro, Chila Jatun');
  console.log('Evento borrador: Expo Gastronómica | Solicitud pendiente: Festival de la Canción');
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
