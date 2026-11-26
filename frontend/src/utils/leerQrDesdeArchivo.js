import jsQR from 'jsqr'

const MAX_SIDE = 1280

/** Decodifica el primer QR encontrado en una imagen (p. ej. foto desde el celular sin HTTPS). */
export async function leerQrDesdeArchivo(file) {
  if (!file) return null
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close?.()
  const { data } = ctx.getImageData(0, 0, width, height)
  const code = jsQR(data, width, height, { inversionAttempts: 'attemptBoth' })
  return code?.data?.trim() || null
}
