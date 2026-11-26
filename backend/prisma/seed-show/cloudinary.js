const { v2: cloudinary } = require('cloudinary');
const { randomUUID } = require('crypto');

const UNSPLASH = {
  evento:
    'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=1200&q=80',
  concierto:
    'https://images.unsplash.com/photo-1540039155633-31ff1b90b0c8?w=1200&q=80',
  feria:
    'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=1200&q=80',
  teatro:
    'https://images.unsplash.com/photo-1503095396549-807759245b35?w=1200&q=80',
  mapa: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?w=1200&q=80',
  negocio:
    'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&q=80',
  bebida:
    'https://images.unsplash.com/photo-1629203851122-3726ecdf080e?w=800&q=80',
  acceso:
    'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&q=80',
  comprobante:
    'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&q=80',
};

/** JPEG mínimo válido (1×1) por si falla la descarga. */
const FALLBACK_JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigD//2Q==',
  'base64',
);

function initCloudinary() {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  return process.env.CLOUDINARY_FOLDER || 'eventix';
}

async function fetchBuffer(url) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

function uploadBuffer(buffer, baseFolder, subfolder, attempts = 3) {
  const folder = `${baseFolder}/${subfolder}`;
  return new Promise((resolve, reject) => {
    const tryOnce = (left) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'image',
          format: 'jpg',
          unique_filename: true,
          overwrite: false,
        },
        (err, result) => {
          if (err) {
            if (left > 1) return setTimeout(() => tryOnce(left - 1), 800);
            return reject(err);
          }
          resolve({ url: result.secure_url, publicId: result.public_id });
        },
      );
      stream.end(buffer);
    };
    tryOnce(attempts);
  });
}

async function uploadImage({ baseFolder, subfolder, sourceUrl, cache, key }) {
  if (key && cache.has(key)) return cache.get(key);
  let buffer = FALLBACK_JPEG;
  if (sourceUrl) {
    for (let i = 0; i < 3; i++) {
      try {
        buffer = await fetchBuffer(sourceUrl);
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 500 * (i + 1)));
      }
    }
  }
  const uploaded = await uploadBuffer(buffer, baseFolder, subfolder);
  if (key) cache.set(key, uploaded);
  return uploaded;
}

module.exports = {
  UNSPLASH,
  initCloudinary,
  uploadImage,
  FALLBACK_JPEG,
};