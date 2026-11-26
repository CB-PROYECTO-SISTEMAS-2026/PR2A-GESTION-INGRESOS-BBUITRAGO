import { createHash } from 'crypto';
import { v2 as cloudinary } from 'cloudinary';

const cache = new Map();

export function initCloudinary() {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

const baseFolder = () => process.env.CLOUDINARY_FOLDER || 'eventix';

/** Sube como en producción (Cloudinary) y cachea por URL+carpeta. */
export async function uploadFromUrl(sourceUrl, folder, nombre = 'archivo.jpg') {
  const key = `${folder}::${sourceUrl}`;
  if (cache.has(key)) return cache.get(key);

  const publicHint = createHash('sha1').update(key).digest('hex').slice(0, 12);
  const result = await cloudinary.uploader.upload(sourceUrl, {
    folder: `${baseFolder()}/${folder}`,
    public_id: `seed_${publicHint}`,
    overwrite: true,
    resource_type: 'image',
    format: 'jpg',
  });

  const stored = {
    url: result.secure_url,
    publicId: result.public_id,
    nombre,
  };
  cache.set(key, stored);
  return stored;
}

/** Genera un PNG mínimo (1x1) y lo sube — útil solo como último recurso. */
export async function uploadSolidColor(folder, hex = '1a1a2e', nombre = 'mapa.jpg') {
  // Data URI JPEG 2x2 gris vía Cloudinary text/image overlay no; usamos picsum estable
  return uploadFromUrl(`https://picsum.photos/seed/${hex}/1200/800`, folder, nombre);
}
