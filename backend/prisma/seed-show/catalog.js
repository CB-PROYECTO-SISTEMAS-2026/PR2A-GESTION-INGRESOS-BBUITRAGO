const PASSWORDS = {
  ADMIN: 'admin123!',
  ORGANIZADOR: 'organizador123!',
  CLIENTE: 'cliente123!',
  JEFE_NEGOCIO: 'jefenegocio123!',
  AYUDANTE: 'ayudante123!',
  ENCARGADO_ACCESO: 'encargadoacceso123!',
  RECARGADOR: 'recargador123!',
  DEVOLUCIONES: 'devoluciones123!',
};

const NOMBRES = [
  'María',
  'Juan',
  'Roxana',
  'Carlos',
  'Lucía',
  'Diego',
  'Fernanda',
  'Rodrigo',
  'Valeria',
  'Miguel',
  'Camila',
  'Sergio',
  'Andrea',
  'José',
  'Paola',
  'Luis',
  'Gabriela',
  'Marcelo',
  'Daniela',
  'Roberto',
  'Sandra',
  'Eduardo',
  'Patricia',
  'Hugo',
  'Natalia',
  'Oscar',
  'Silvia',
  'Ricardo',
  'Monica',
  'Alejandro',
  'Emma',
  'Thomas',
  'Ana',
  'Pedro',
  'Laura',
  'Julio',
];

const APELLIDOS = [
  'Mamani',
  'Quispe',
  'Flores',
  'Rojas',
  'Gutiérrez',
  'Vargas',
  'Condori',
  'Choque',
  'Apaza',
  'Salazar',
  'Terrazas',
  'Medina',
  'Fernández',
  'López',
  'Romero',
  'Aguilar',
  'Paredes',
  'Céspedes',
  'Orellana',
  'Jiménez',
  'Mendoza',
  'Suárez',
  'Cabrera',
  'Torrico',
  'Lanza',
  'Rivera',
  'Bustos',
  'Escobar',
  'Ramos',
  'Smith',
  'Johnson',
];

const UBICACIONES_CBBA = [
  'FEXCO Arena, Av. América, Cochabamba',
  'Teatro Achá, Av. Heroínas, Cochabamba',
  'La Troje, Calle España, Cochabamba',
  'El Portal, Zona Norte, Cochabamba',
  'Teatro al Aire Libre C.R.O, Calle Lanza',
  'Alice Park, Sacaba',
  'Plaza Quintanilla, Cochabamba',
  'Felipe Santivañez, Cochabamba',
  'Recinto Ferial Alalay, Cochabamba',
  'Coliseo Julio León Prado',
];

const TITULOS_EVENTO = [
  'Lucho SSJ en vivo',
  'More Humor – Stand Up Tour',
  'Kjarkas – Concierto folklore',
  'FEXCO Feria Navideña',
  'Alice Park Festival',
  'Teatro Achá: Opera Clásica',
  'Noche en La Troje',
  'El Portal Rock Night',
  'C.R.O Rap en la calle',
  'Festival Gastronómico CBBA',
  'Cerveza Artesanal al Atardecer',
  'Carnaval de Invierno',
  'Electro Andina',
  'Charla Emprendimiento Juvenil',
  'Copa Cochabamba Futsal',
  'Maratón Nocturna 10K',
  'Expo Música Bolivia',
  'Navidad en Familia',
  'Año Nuevo en FEXCO',
  'Concierto Sinfónica Municipal',
  'Jazz en el Jardín',
  'Mercado de Arte Callejero',
  'Festival de Cine Plaza',
  'Concierto Beni Molido',
  'Urban Sounds CBBA',
  'Voces del Altiplano',
  'Comedia Musical',
  'Reyes Magos en Coliseo',
  'Huayño Total',
  'Cumbia Session Live',
  'Boxeo Amateur Copa Valle',
  'Feria de Emprendedores',
  'Concurso de Bandas',
  'Noche de Boleros',
  'Open Mic Poetas',
  'Viernes de Ska',
  'Reggaeton Beach Party',
  'Noche Anime & Cosplay',
  'Festival del Dulce',
  'Concierto Acústico Trova',
  'Desfile Moda Joven',
  'Kids Fest Cochabamba',
  'Noche Latina DJ Set',
  'Encuentro de Danzas',
  'Fin de Año en el Portal',
];

const PRE_EVENTOS = [
  {
    titulo: 'Rock al Atardecer – Edición Octubre',
    inicio: '2026-10-05',
    fin: '2026-10-05',
    estado: 'FINALIZADO',
    tipo: 'QR_DIGITAL',
  },
  {
    titulo: 'Festival Gastronómico Valle',
    inicio: '2026-10-18',
    fin: '2026-10-20',
    estado: 'FINALIZADO',
    tipo: 'AMBOS',
  },
  {
    titulo: 'Concierto Sinfónica Otoño',
    inicio: '2026-11-01',
    fin: '2026-11-01',
    estado: 'FINALIZADO',
    tipo: 'QR_DIGITAL',
  },
  {
    titulo: 'Expo Emprendedores CBBA',
    inicio: '2026-11-08',
    fin: '2026-11-09',
    estado: 'FINALIZADO',
    tipo: 'MANILLA',
  },
  {
    titulo: 'Noche de Jazz La Troje',
    inicio: '2026-11-12',
    fin: '2026-11-12',
    estado: 'FINALIZADO',
    tipo: 'QR_DIGITAL',
  },
];

const NEGOCIOS = [
  {
    nombre: "Chicken's Kingdom",
    rubro: 'COMIDA',
    razonSocial: "Pollos Kingdom SRL",
    nit: '1023456700015',
  },
  {
    nombre: 'Coca-Cola Bolivia – Activación',
    rubro: 'BEBIDAS',
    razonSocial: 'Embotelladoras Bolivianas Unidas SA',
    nit: '1020304000019',
  },
  {
    nombre: 'Fernet Branca Barra Móvil',
    rubro: 'BEBIDAS',
    razonSocial: 'Fratelli Branca Bolivia SRL',
    nit: '1045678900123',
  },
  {
    nombre: 'Restaurante La Troje',
    rubro: 'COMIDA',
    razonSocial: 'Gastronomía La Troje SRL',
    nit: '1056789012345',
  },
  {
    nombre: 'Caserita Food Truck',
    rubro: 'COMIDA',
    razonSocial: 'Caserita Gastronómica UNIPERSONAL',
    nit: '1067890123456',
  },
  {
    nombre: 'Heladería Dumbo',
    rubro: 'POSTRES_SNACKS',
    razonSocial: 'Dumbo Helados Bolivia SRL',
    nit: '1078901234567',
  },
  {
    nombre: 'Cervecería Boliviana CBBA',
    rubro: 'BEBIDAS',
    razonSocial: 'Cervecería Boliviana Nacional SA',
    nit: '1089012345678',
  },
  {
    nombre: 'Wendy Bolivia',
    rubro: 'COMIDA',
    razonSocial: 'Operadora Wendy Bolivia SRL',
    nit: '1090123456789',
  },
  {
    nombre: 'Pollos Copacabana',
    rubro: 'COMIDA',
    razonSocial: 'Avícola Copacabana SRL',
    nit: '1101234567890',
  },
  {
    nombre: 'Café Martínez CBBA',
    rubro: 'BEBIDAS',
    razonSocial: 'Martínez Café Bolivia SRL',
    nit: '1112345678901',
  },
  {
    nombre: 'Mercado Lanza – Piqueos',
    rubro: 'COMIDA',
    razonSocial: 'Asociación Comerciantes Lanza',
    nit: '1123456789012',
  },
  {
    nombre: 'Artesanías Valle',
    rubro: 'ARTESANIA',
    razonSocial: 'Artesanías del Valle UNIPERSONAL',
    nit: '1134567890123',
  },
];

function dateOnly(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function addDays(iso, n) {
  const dt = dateOnly(iso);
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

/** 40 eventos en ventana + 5 previos = 45; cobertura diaria 15/11–15/01 (62 días). */
function planEventos() {
  const eventos = PRE_EVENTOS.map((e, i) => ({
    ...e,
    ubicacion: UBICACIONES_CBBA[i % UBICACIONES_CBBA.length],
    titulo: e.titulo,
  }));

  const duraciones = [
    ...Array(23).fill(1),
    ...Array(12).fill(2),
    ...Array(5).fill(3),
  ];
  let cursor = '2026-11-15';
  const endWindow = '2027-01-15';
  const estados = ['PUBLICADO', 'PUBLICADO', 'BORRADOR', 'FINALIZADO', 'CANCELADO'];
  const tipos = ['QR_DIGITAL', 'MANILLA', 'AMBOS'];
  let tituloIdx = 0;

  for (let i = 0; i < duraciones.length; i++) {
    const dur = duraciones[i];
    let fin = addDays(cursor, dur - 1);
    if (fin > endWindow) fin = endWindow;
    eventos.push({
      titulo: TITULOS_EVENTO[tituloIdx % TITULOS_EVENTO.length],
      inicio: cursor,
      fin,
      estado: estados[i % estados.length],
      tipo: tipos[i % tipos.length],
      ubicacion: UBICACIONES_CBBA[i % UBICACIONES_CBBA.length],
    });
    tituloIdx++;
    cursor = addDays(fin, 1);
    if (cursor > endWindow) break;
  }

  while (eventos.length < 45) {
    const slot = endWindow;
    eventos.push({
      titulo: TITULOS_EVENTO[tituloIdx % TITULOS_EVENTO.length],
      inicio: slot,
      fin: slot,
      estado: 'PUBLICADO',
      tipo: tipos[tituloIdx % tipos.length],
      ubicacion: UBICACIONES_CBBA[tituloIdx % UBICACIONES_CBBA.length],
    });
    tituloIdx++;
  }

  return eventos.slice(0, 45);
}

function slugEmail(nombre, apellido, rol, idx) {
  const base = `${nombre}.${apellido}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9.]/g, '');
  const suf = rol.toLowerCase().replace(/_/g, '');
  return `${base}.${suf}${idx > 0 ? idx : ''}@gmail.com`;
}

module.exports = {
  PASSWORDS,
  NOMBRES,
  APELLIDOS,
  NEGOCIOS,
  planEventos,
  dateOnly,
  addDays,
  slugEmail,
};