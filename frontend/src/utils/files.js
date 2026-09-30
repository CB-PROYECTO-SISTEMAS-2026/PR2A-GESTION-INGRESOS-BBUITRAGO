export const MAX_FILE_MB = 10
export const ACCEPT_IMAGE = 'image/png,image/jpeg,image/webp,image/gif'
export const ACCEPT_MAPA = `${ACCEPT_IMAGE},application/pdf`

const IMAGE_TYPES = ACCEPT_IMAGE.split(',')

/** Validación previa en el navegador; la API vuelve a validar el contenido real del archivo. */
export function validateFile(file, { allowPdf = false } = {}) {
  if (!file) return 'Selecciona un archivo.'
  const allowed = allowPdf ? [...IMAGE_TYPES, 'application/pdf'] : IMAGE_TYPES
  if (!allowed.includes(file.type)) {
    return allowPdf ? 'Solo se permiten imágenes (PNG, JPG, WEBP, GIF) o PDF.' : 'Solo se permiten imágenes (PNG, JPG, WEBP, GIF).'
  }
  if (file.size > MAX_FILE_MB * 1024 * 1024) return `El archivo supera el máximo de ${MAX_FILE_MB} MB.`
  return ''
}
