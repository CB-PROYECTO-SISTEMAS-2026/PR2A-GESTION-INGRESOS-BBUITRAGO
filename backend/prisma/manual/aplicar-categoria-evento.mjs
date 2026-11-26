/**
 * DDL CategoriaEvento + seed + asignación + Spotify verificado (oEmbed).
 * Usa ADMIN_DATABASE_URL para DDL; DATABASE_URL para datos si admin no está.
 * NO toca CategoriaEntrada (tipos de ticket).
 */
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  try {
    const raw = readFileSync(join(__dirname, '../../.env'), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m || process.env[m[1]]) continue;
      let v = m[2].trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      process.env[m[1]] = v;
    }
  } catch {
    /* already in env */
  }
}

loadEnv();

const adminUrl = process.env.ADMIN_DATABASE_URL || process.env.DATABASE_URL;
const appUrl = process.env.DATABASE_URL;
const admin = new PrismaClient({ datasources: { db: { url: adminUrl } } });
const app = new PrismaClient({ datasources: { db: { url: appUrl } } });

const CATALOGO = [
  { slug: 'conciertos', nombre: 'Conciertos', esMusical: true, orden: 1 },
  { slug: 'urbano', nombre: 'Urbano', esMusical: true, orden: 2 },
  { slug: 'electronica', nombre: 'Electrónica', esMusical: true, orden: 3 },
  { slug: 'folclore', nombre: 'Folclore', esMusical: true, orden: 4 },
  { slug: 'teatro-comedia', nombre: 'Teatro y comedia', esMusical: false, orden: 5 },
  { slug: 'ferias-expos', nombre: 'Ferias y expos', esMusical: false, orden: 6 },
  { slug: 'gastronomia', nombre: 'Gastronomía', esMusical: false, orden: 7 },
  { slug: 'deportes', nombre: 'Deportes', esMusical: false, orden: 8 },
  { slug: 'familia', nombre: 'Familia', esMusical: false, orden: 9 },
  { slug: 'cultura', nombre: 'Cultura', esMusical: false, orden: 10 },
  { slug: 'festividades', nombre: 'Festividades', esMusical: false, orden: 11 },
];

const SPOTIFY = [
  { match: /alcoholika/i, id: '2wcQ9ygMF236f1YkkrlT2D', expect: /alcoholika/i },
  { match: /fabulosos cadillacs/i, id: '2FS22haX3FYbyOsUAkuYqZ', expect: /fabulosos cadillacs/i },
  { match: /miranda/i, id: '2eEmsgWmUFMbtU7agJpnjY', expect: /miranda/i },
  { match: /chaqueño|chaqueno/i, id: '1GlOpg3dPUft550esb82K3', expect: /chaqueño|chaqueno|palavecino/i },
  { match: /auténticos decadentes|autenticos decadentes/i, id: '3HrbmsYpKjWH1lzhad7alj', expect: /auténticos|autenticos/i },
  { match: /ángela leiva|angela leiva/i, id: '4pVwuoiEckq2nBqEjGQhla', expect: /^angela$/i },
  { match: /^octavia\b/i, id: '4ooyae64t1DFiWd1UnJ5d4', expect: /octavia/i },
  { match: /neo pistea/i, id: '01m2XZ7m7rAz6KY3scTdaV', expect: /neo pistea/i },
  { match: /\bkhea\b/i, id: '4m6ubhNsdwF4psNf3R8kwR', expect: /khea/i },
  { match: /steve aoki/i, id: '77AiFEVeAVj2ORpC85QVJs', expect: /steve aoki/i },
  { match: /\bcazzu\b/i, id: '6w3SkAHYPsQ1bxV7VDlG5y', expect: /cazzu/i },
  { match: /\bairbag\b/i, id: '1wKDGglKV4FsFS85r2Dmpr', expect: /airbag/i },
  { match: /bizarrap/i, id: '716NhGYqD1jl2wI1Qkgq36', expect: /bizarrap/i },
  { match: /grupo frontera/i, id: '6XkjpgcEsYab502Vr1bBeW', expect: /frontera/i },
  { match: /arc[aá]ngel/i, id: '4SsVbpTthjScTS7U2hmr1X', expect: /arc[aá]ngel/i },
  { match: /\byandel\b/i, id: '0eHQ9o50hj6ZDNBt6Ys1sD', expect: /yandel/i },
  { match: /rata blanca/i, id: '632M26jlmnCrL8CqD5i7Kd', expect: /rata blanca/i },
  { match: /abel pintos/i, id: '6HTUcOExehqydqa7C3usAa', expect: /abel pintos/i },
  { match: /\bmolotov\b/i, id: '27Owkm4TGlMqb0BqaEt3PW', expect: /molotov/i },
  { match: /\bduki\b/i, id: '0GDHbTQmuiq7QuMmNlZkeU', expect: /duki/i },
  { match: /lucho ssj/i, id: '1OBizG9nrnHJkrL9NjnWYN', expect: /lucho/i },
  { match: /alex ubago|álex ubago/i, id: '2tY2GFdhH0Wa2VBvsxew5X', expect: /ubago/i },
  { match: /kjarkas/i, id: '0tkboyBYNymYytYlb9EXkN', expect: /kjarkas/i },
  { match: /sin bandera/i, id: '7xeM7V59cA1X8GKyKKQV87', expect: /sin bandera/i },
  { match: /no te va gustar/i, id: '4ZDoy7AWNgQVmX7T0u0B1j', expect: /no te va gustar/i },
  { match: /chino\s*&\s*nacho|chino y nacho/i, id: '5NS0854TqZQVoRmJKSWtFZ', expect: /chino\s*&\s*nacho/i },
  { match: /chencho|casa del perreo/i, id: '37230BxxYs9ksS7OkZw3IU', expect: /chencho/i },
  { match: /ke personajes/i, id: '06Q5VlSAku57lFzyME3HrM', expect: /ke personajes/i },
  { match: /\bcro\b|c\.r\.o/i, id: '4puAp107dCehraE47QXVQX', expect: /c\.?r\.?o/i },
];

const CATEGORIAS = [
  { match: /stand\s*up|comedy|irreverentes|grillo villegas|mano a mano|willy claure|papirri/i, slugs: ['teatro-comedia'] },
  { match: /frozen/i, slugs: ['familia', 'teatro-comedia'] },
  { match: /ruta de los palacios/i, slugs: ['cultura'] },
  { match: /expoconstrucci|feria internacional del libro|caf[eé] y cacao/i, slugs: ['ferias-expos'] },
  { match: /miski|gastron/i, slugs: ['gastronomia'] },
  { match: /hgw|aniversario hgw/i, slugs: ['deportes'] },
  { match: /steve aoki/i, slugs: ['electronica'] },
  { match: /kjarkas|chaqueño|chaqueno/i, slugs: ['folclore'] },
  {
    match: /duki|khea|cazzu|neo pistea|bizarrap|arc[aá]ngel|yandel|lucho|trap|cro\b|c\.r\.o|chino|chencho|perreo|ke personajes|nonstop|madness/i,
    slugs: ['urbano'],
  },
  { match: /marvel sinf/i, slugs: ['conciertos', 'cultura'] },
  { match: /.*/, slugs: ['conciertos'] },
];

function cuidLike() {
  return `c${createHash('sha1').update(randomBytes(16)).digest('hex').slice(0, 24)}`;
}

async function oembedArtist(id) {
  const res = await fetch(
    `https://open.spotify.com/oembed?url=${encodeURIComponent(`https://open.spotify.com/artist/${id}`)}`,
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data?.title ? String(data.title) : null;
}

async function applyDdl() {
  const db = admin;
  await db.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS \`CategoriaEvento\` (
  \`id\` VARCHAR(191) NOT NULL,
  \`nombre\` VARCHAR(191) NOT NULL,
  \`slug\` VARCHAR(191) NOT NULL,
  \`esMusical\` BOOLEAN NOT NULL DEFAULT false,
  \`orden\` INTEGER NOT NULL DEFAULT 0,
  \`activa\` BOOLEAN NOT NULL DEFAULT true,
  \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX \`CategoriaEvento_nombre_key\`(\`nombre\`),
  UNIQUE INDEX \`CategoriaEvento_slug_key\`(\`slug\`),
  PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);

  await db.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS \`EventoCategoriaEvento\` (
  \`eventoId\` VARCHAR(191) NOT NULL,
  \`categoriaEventoId\` VARCHAR(191) NOT NULL,
  PRIMARY KEY (\`eventoId\`, \`categoriaEventoId\`),
  INDEX \`EventoCategoriaEvento_categoriaEventoId_idx\`(\`categoriaEventoId\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);

  await db.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS \`SolicitudCategoriaEvento\` (
  \`solicitudId\` VARCHAR(191) NOT NULL,
  \`categoriaEventoId\` VARCHAR(191) NOT NULL,
  PRIMARY KEY (\`solicitudId\`, \`categoriaEventoId\`),
  INDEX \`SolicitudCategoriaEvento_categoriaEventoId_idx\`(\`categoriaEventoId\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);

  for (const stmt of [
    `ALTER TABLE \`EventoCategoriaEvento\` ADD CONSTRAINT \`EventoCategoriaEvento_eventoId_fkey\` FOREIGN KEY (\`eventoId\`) REFERENCES \`Evento\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    `ALTER TABLE \`EventoCategoriaEvento\` ADD CONSTRAINT \`EventoCategoriaEvento_categoriaEventoId_fkey\` FOREIGN KEY (\`categoriaEventoId\`) REFERENCES \`CategoriaEvento\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`,
    `ALTER TABLE \`SolicitudCategoriaEvento\` ADD CONSTRAINT \`SolicitudCategoriaEvento_solicitudId_fkey\` FOREIGN KEY (\`solicitudId\`) REFERENCES \`SolicitudEvento\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    `ALTER TABLE \`SolicitudCategoriaEvento\` ADD CONSTRAINT \`SolicitudCategoriaEvento_categoriaEventoId_fkey\` FOREIGN KEY (\`categoriaEventoId\`) REFERENCES \`CategoriaEvento\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`,
  ]) {
    try {
      await db.$executeRawUnsafe(stmt);
    } catch (e) {
      const msg = String(e?.message || e);
      if (!/Duplicate|exists|already/i.test(msg)) console.warn('FK:', msg.slice(0, 160));
    }
  }

  const cols = await db.$queryRawUnsafe(
    `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'SolicitudEvento' AND COLUMN_NAME = 'spotifyUrl'`,
  );
  if (Number(cols[0]?.c || 0) === 0) {
    await db.$executeRawUnsafe(
      `ALTER TABLE \`SolicitudEvento\` ADD COLUMN \`spotifyUrl\` VARCHAR(500) NULL`,
    );
  }
}

async function seedCatalogo() {
  for (const c of CATALOGO) {
    const existing = await app.$queryRawUnsafe(
      `SELECT id FROM CategoriaEvento WHERE slug = ? LIMIT 1`,
      c.slug,
    );
    if (existing[0]?.id) {
      await app.$executeRawUnsafe(
        `UPDATE CategoriaEvento SET nombre = ?, esMusical = ?, orden = ?, activa = true WHERE id = ?`,
        c.nombre,
        c.esMusical,
        c.orden,
        existing[0].id,
      );
      continue;
    }
    await app.$executeRawUnsafe(
      `INSERT INTO CategoriaEvento (id, nombre, slug, esMusical, orden, activa, createdAt) VALUES (?, ?, ?, ?, ?, true, NOW(3))`,
      cuidLike(),
      c.nombre,
      c.slug,
      c.esMusical,
      c.orden,
    );
  }
}

async function loadSlugMap() {
  const rows = await app.$queryRawUnsafe(`SELECT id, slug FROM CategoriaEvento`);
  return Object.fromEntries(rows.map((r) => [r.slug, r.id]));
}

function slugsForTitulo(titulo) {
  for (const rule of CATEGORIAS) {
    if (rule.match.test(titulo)) return rule.slugs.slice(0, 3);
  }
  return ['conciertos'];
}

async function resolveSpotify(titulo) {
  const rule = SPOTIFY.find((r) => r.match.test(titulo));
  if (!rule) return null;
  const title = await oembedArtist(rule.id);
  if (!title) {
    console.warn(`  Spotify FAIL oEmbed: ${titulo} (${rule.id})`);
    return null;
  }
  if (!rule.expect.test(title)) {
    console.warn(`  Spotify FAIL match: "${titulo}" → "${title}" (${rule.id})`);
    return null;
  }
  console.log(`  Spotify OK: ${title}`);
  return `https://open.spotify.com/artist/${rule.id}`;
}

async function assignEvents(slugMap) {
  const eventos = await app.$queryRawUnsafe(
    `SELECT id, titulo FROM Evento ORDER BY createdAt DESC`,
  );
  for (const ev of eventos) {
    const slugs = slugsForTitulo(ev.titulo);
    const catIds = slugs.map((s) => slugMap[s]).filter(Boolean);
    await app.$executeRawUnsafe(
      `DELETE FROM EventoCategoriaEvento WHERE eventoId = ?`,
      ev.id,
    );
    for (const categoriaEventoId of catIds) {
      await app.$executeRawUnsafe(
        `INSERT INTO EventoCategoriaEvento (eventoId, categoriaEventoId) VALUES (?, ?)`,
        ev.id,
        categoriaEventoId,
      );
    }

    const musical = slugs.some((s) =>
      ['conciertos', 'urbano', 'electronica', 'folclore'].includes(s),
    );
    let spotify = null;
    if (musical) spotify = await resolveSpotify(ev.titulo);
    if (spotify) {
      await app.$executeRawUnsafe(
        `UPDATE Evento SET spotifyUrl = ? WHERE id = ?`,
        spotify,
        ev.id,
      );
    }
    console.log(`✓ ${ev.titulo} → [${slugs.join(', ')}]${spotify ? ' + Spotify' : ''}`);
  }
}

async function main() {
  console.log('1) DDL (admin)…');
  await applyDdl();
  console.log('2) Catálogo…');
  await seedCatalogo();
  const slugMap = await loadSlugMap();
  console.log('3) Asignar + Spotify…');
  await assignEvents(slugMap);
  console.log('Listo.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await admin.$disconnect();
    await app.$disconnect();
  });
