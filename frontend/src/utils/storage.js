/**
 * Clave única por operación de dinero (cobro, recarga). Se repite en los reintentos para que el
 * servidor no la registre dos veces si se perdió la respuesta. crypto.randomUUID solo existe con
 * HTTPS o localhost, por eso se arma con getRandomValues como alternativa (p. ej. el celular
 * entrando por la IP local).
 */
export function nuevaClave() {
  if (crypto.randomUUID) return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** localStorage puede no estar disponible (modo privado, bloqueado): nunca debe romper la pantalla. */
export function readStorage(key) {
  try {
    return localStorage.getItem(key) || ''
  } catch {
    return ''
  }
}

export function writeStorage(key, value) {
  try {
    if (value) localStorage.setItem(key, value)
    else localStorage.removeItem(key)
  } catch {
    // Sin almacenamiento disponible: el dato solo vive mientras la pantalla esté abierta.
  }
}

export function readJson(key, fallback) {
  try {
    const raw = readStorage(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

export function writeJson(key, value) {
  writeStorage(key, value == null ? '' : JSON.stringify(value))
}
