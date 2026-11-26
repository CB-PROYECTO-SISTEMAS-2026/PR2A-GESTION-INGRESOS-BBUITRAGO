/**
 * Actualiza en BDD (no seed): título, ubicación, descripción, foto y mapa
 * de los eventos existentes. Conserva capacidad, fechas, categorías y estado.
 *
 * Ejecutar desde backend:
 *   node prisma/seed-show/actualizar-eventos-reales.js
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { PrismaClient } = require('@prisma/client');
const { v2: cloudinary } = require('cloudinary');

const IMGS_DIR = 'D:\\Proyecto_Sistemas_II\\IMGS';
const MAPA_FILE = 'mapa eventos.png';
const eventosReales = require('./eventos_reales.json');

const prisma = new PrismaClient();

function initCloudinary() {
  const cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
  const api_key = process.env.CLOUDINARY_API_KEY;
  const api_secret = process.env.CLOUDINARY_API_SECRET;
  if (!cloud_name || !api_key || !api_secret) {
    throw new Error('Faltan CLOUDINARY_* en backend/.env');
  }
  cloudinary.config({ cloud_name, api_key, api_secret, secure: true });
  return process.env.CLOUDINARY_FOLDER || 'eventix';
}

function resolveLocalImage(fileName) {
  if (!fileName) return null;
  const exact = path.join(IMGS_DIR, fileName);
  if (fs.existsSync(exact)) return exact;

  const wanted = fileName.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const files = fs.readdirSync(IMGS_DIR);
  const hit = files.find((f) => {
    const n = f.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
    return n === wanted;
  });
  return hit ? path.join(IMGS_DIR, hit) : null;
}

function uploadLocalFile(filePath, baseFolder, subfolder) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `${baseFolder}/${subfolder}`,
        resource_type: 'image',
        unique_filename: true,
        overwrite: false,
      },
      (err, result) => {
        if (err || !result) return reject(err || new Error('Upload vacío'));
        resolve({ url: result.secure_url, publicId: result.public_id });
      },
    );
    fs.createReadStream(filePath).pipe(stream);
  });
}

function descripcionPara(titulo, lugar) {
  return `${titulo}. Evento en ${lugar}, Cochabamba. Entradas y acceso gestionados por EvenTix.`;
}

async function main() {
  const baseFolder = initCloudinary();
  console.log('Conectando a BDD y Cloudinary...');

  const mapaPath = resolveLocalImage(MAPA_FILE);
  if (!mapaPath) throw new Error(`No se encontró ${MAPA_FILE} en ${IMGS_DIR}`);
  console.log('Subiendo mapa común...');
  const mapa = await uploadLocalFile(mapaPath, baseFolder, 'mapas-eventos');
  console.log('Mapa OK:', mapa.url);

  const eventosDb = await prisma.evento.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      titulo: true,
      solicitudId: true,
      capacidad: true,
      fotoUrl: true,
      fotoPublicId: true,
    },
  });

  console.log(`Eventos en BDD: ${eventosDb.length}`);
  console.log(`Eventos en lista: ${eventosReales.length}`);

  const total = Math.min(eventosDb.length, eventosReales.length);
  const faltantesImagen = [];
  const usados = new Set();

  for (let i = 0; i < total; i++) {
    const dbEvt = eventosDb[i];
    const real = eventosReales[i];
    usados.add(real.titulo);

    const data = {
      titulo: real.titulo,
      ubicacion: real.lugar,
      descripcion: descripcionPara(real.titulo, real.lugar),
      mapaUrl: mapa.url,
    };

    if (real.imagen) {
      const imgPath = resolveLocalImage(real.imagen);
      if (!imgPath) {
        faltantesImagen.push({ i: i + 1, titulo: real.titulo, imagen: real.imagen });
        console.warn(`[${i + 1}] SIN ARCHIVO: ${real.imagen}`);
      } else {
        const uploaded = await uploadLocalFile(imgPath, baseFolder, 'eventos-reales');
        data.fotoUrl = uploaded.url;
        data.fotoPublicId = uploaded.publicId;
        console.log(`[${i + 1}/${total}] foto ← ${path.basename(imgPath)}`);
      }
    } else {
      faltantesImagen.push({ i: i + 1, titulo: real.titulo, imagen: null });
      console.warn(`[${i + 1}] sin imagen definida: ${real.titulo}`);
    }

    await prisma.evento.update({ where: { id: dbEvt.id }, data });

    if (dbEvt.solicitudId) {
      await prisma.solicitudEvento
        .update({
          where: { id: dbEvt.solicitudId },
          data: {
            nombreEvento: real.titulo,
            ubicacion: real.lugar,
            descripcion: data.descripcion,
            mapaUrl: mapa.url,
            mapaNombre: MAPA_FILE,
          },
        })
        .catch(() => {});
    }

    console.log(
      `OK [${i + 1}/${total}] cap=${dbEvt.capacidad} → "${real.titulo}" @ ${real.lugar}`,
    );
  }

  const sobrantesLista = eventosReales
    .slice(total)
    .map((e) => e.titulo);

  console.log('\n--- Resumen ---');
  console.log(`Actualizados: ${total}`);
  if (sobrantesLista.length) {
    console.log('En lista pero sin slot en BDD (no creados):');
    sobrantesLista.forEach((t) => console.log('  -', t));
  }
  if (faltantesImagen.length) {
    console.log('Sin imagen local:');
    faltantesImagen.forEach((f) =>
      console.log(`  - #${f.i} ${f.titulo} (${f.imagen || 'sin archivo'})`),
    );
  }
  console.log('Listo.');
}

main()
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
