const KEY = 'eventix_lector_qr'

export const AJUSTES_LECTOR = {
  tapOnSuccess: true,
  holdOnFail: true,
  successMs: 1000,
  ignoreMs: 15000,
}

export function leerAjustesLector() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...AJUSTES_LECTOR }
    const data = JSON.parse(raw)
    return {
      tapOnSuccess: data.tapOnSuccess !== false,
      holdOnFail: data.holdOnFail !== false,
      successMs: Number.isFinite(data.successMs) ? data.successMs : AJUSTES_LECTOR.successMs,
      ignoreMs: Number.isFinite(data.ignoreMs) ? data.ignoreMs : AJUSTES_LECTOR.ignoreMs,
    }
  } catch {
    return { ...AJUSTES_LECTOR }
  }
}

export function guardarAjustesLector(parcial) {
  const next = { ...leerAjustesLector(), ...parcial }
  localStorage.setItem(KEY, JSON.stringify(next))
  return next
}
