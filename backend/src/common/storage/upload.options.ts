import { memoryStorage } from 'multer';

export const memoryUpload = {
  storage: memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
};
