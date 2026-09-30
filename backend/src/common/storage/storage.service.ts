import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { randomUUID } from 'crypto';

export type UploadKind = 'image' | 'imageOrPdf';

export interface StoredFile {
  url: string;
  publicId: string;
  nombre: string;
}

const MAX_BYTES = 10 * 1024 * 1024;

type Detected = { format: 'png' | 'jpg' | 'webp' | 'gif' | 'pdf' };

function detect(buffer: Buffer): Detected | null {
  if (buffer.length < 12) return null;
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { format: 'png' };
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { format: 'jpg' };
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
    return { format: 'webp' };
  }
  const head6 = buffer.subarray(0, 6).toString('ascii');
  if (head6 === 'GIF87a' || head6 === 'GIF89a') return { format: 'gif' };
  if (buffer.subarray(0, 5).toString('ascii') === '%PDF-') return { format: 'pdf' };
  return null;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly baseFolder: string;

  constructor(config: ConfigService) {
    cloudinary.config({
      cloud_name: config.getOrThrow<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: config.getOrThrow<string>('CLOUDINARY_API_KEY'),
      api_secret: config.getOrThrow<string>('CLOUDINARY_API_SECRET'),
      secure: true,
    });
    this.baseFolder = config.get<string>('CLOUDINARY_FOLDER', 'eventix');
  }

  async upload(file: Express.Multer.File | undefined, folder: string, kind: UploadKind): Promise<StoredFile> {
    if (!file?.buffer?.length) throw new BadRequestException('Debes adjuntar un archivo.');
    if (file.size > MAX_BYTES) throw new BadRequestException('El archivo supera el máximo de 10 MB.');

    const detected = detect(file.buffer);
    const allowed = kind === 'image' ? ['png', 'jpg', 'webp', 'gif'] : ['png', 'jpg', 'webp', 'gif', 'pdf'];
    if (!detected || !allowed.includes(detected.format)) {
      throw new BadRequestException(
        kind === 'image'
          ? 'Formato no permitido. Sube una imagen PNG, JPG, WEBP o GIF.'
          : 'Formato no permitido. Sube una imagen PNG, JPG, WEBP, GIF o un PDF.',
      );
    }

    // Los PDFs solo se sirven si la cuenta tiene activo Settings > Security > "Allow delivery of PDF and ZIP files".
    const resourceType = detected.format === 'pdf' ? 'raw' : 'image';
    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: `${this.baseFolder}/${folder}`,
          resource_type: resourceType,
          // Los recursos "raw" no tienen formato: la extensión debe ir en el public_id para servirse como PDF.
          ...(resourceType === 'raw'
            ? { public_id: `${randomUUID()}.pdf` }
            : { format: detected.format, use_filename: false, unique_filename: true }),
          overwrite: false,
        },
        (err, res) => (err || !res ? reject(err ?? new Error('Respuesta vacía')) : resolve(res)),
      );
      stream.end(file.buffer);
    }).catch((err: { message?: string }) => {
      this.logger.error(`Error subiendo a Cloudinary: ${err?.message}`);
      throw new ServiceUnavailableException('No se pudo subir el archivo. Intenta nuevamente.');
    });

    return {
      url: result.secure_url,
      publicId: resourceType === 'raw' ? `raw:${result.public_id}` : result.public_id,
      nombre: file.originalname,
    };
  }

  async remove(publicId: string | null | undefined) {
    if (!publicId) return;
    const [resourceType, id] = publicId.startsWith('raw:') ? ['raw', publicId.slice(4)] : ['image', publicId];
    try {
      await cloudinary.uploader.destroy(id, { resource_type: resourceType, invalidate: true });
    } catch (err) {
      this.logger.warn(`No se pudo eliminar ${publicId} de Cloudinary: ${(err as Error).message}`);
    }
  }
}
