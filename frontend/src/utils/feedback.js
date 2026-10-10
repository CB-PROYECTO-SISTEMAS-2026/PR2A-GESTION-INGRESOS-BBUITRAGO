/**
 * Avisos sonoros y de vibración para la terminal de punto de venta (HU-023).
 * Se generan con Web Audio para no depender de archivos de sonido.
 */
let ctx = null

function tone(freq, duration, { type = 'sine', delay = 0, volume = 0.18 } = {}) {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)()
    const start = ctx.currentTime + delay
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.value = freq
    gain.gain.setValueAtTime(volume, start)
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration)
    osc.connect(gain).connect(ctx.destination)
    osc.start(start)
    osc.stop(start + duration)
  } catch {
    // Sin soporte de audio: el aviso visual es suficiente.
  }
}

export function feedbackOk() {
  tone(880, 0.12)
  tone(1320, 0.16, { delay: 0.13 })
  navigator.vibrate?.(80)
}

export function feedbackError() {
  tone(220, 0.22, { type: 'square', volume: 0.12 })
  tone(165, 0.32, { type: 'square', volume: 0.12, delay: 0.26 })
  navigator.vibrate?.([180, 90, 180])
}
