import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'
import { leerQrDesdeArchivo } from '../../utils/leerQrDesdeArchivo'

const SCAN_INTERVAL_MS = 150
const MAX_SIDE = 640

function mensajeCamara(err) {
  if (err?.name === 'NotAllowedError') return 'Permite el acceso a la cámara en el navegador para escanear.'
  if (err?.name === 'NotFoundError') return 'No se encontró una cámara en este dispositivo.'
  return 'No se pudo abrir la cámara. Escribe el código manualmente.'
}

/** Lee códigos QR con la cámara trasera mientras `active` sea true y avisa cada lectura con `onDetect`. */
export default function QrScanner({ active, onDetect }) {
  const videoRef = useRef(null)
  const inputFotoRef = useRef(null)
  const onDetectRef = useRef(onDetect)
  const [error, setError] = useState('')
  const [fotoError, setFotoError] = useState('')
  const [leyendoFoto, setLeyendoFoto] = useState(false)
  const puedeCamaraEnVivo = typeof window !== 'undefined' && window.isSecureContext

  useLayoutEffect(() => {
    onDetectRef.current = onDetect
  })

  useEffect(() => {
    if (!active || !puedeCamaraEnVivo) return undefined
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Este navegador no permite usar la cámara. Escribe el código manualmente.')
      return undefined
    }
    let stream = null
    let frame = 0
    let last = 0
    let stopped = false
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })

    const tick = (time) => {
      if (stopped) return
      const video = videoRef.current
      if (video && video.readyState >= 2 && time - last > SCAN_INTERVAL_MS) {
        last = time
        const scale = Math.min(1, MAX_SIDE / Math.max(video.videoWidth, video.videoHeight))
        canvas.width = Math.round(video.videoWidth * scale)
        canvas.height = Math.round(video.videoHeight * scale)
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const code = jsQR(data, width, height, { inversionAttempts: 'attemptBoth' })
        if (code?.data?.trim()) onDetectRef.current(code.data.trim())
      }
      frame = requestAnimationFrame(tick)
    }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      .then((s) => {
        if (stopped) {
          s.getTracks().forEach((t) => t.stop())
          return
        }
        stream = s
        setError('')
        const video = videoRef.current
        if (video) {
          video.srcObject = s
          video.play().catch(() => {})
        }
        frame = requestAnimationFrame(tick)
      })
      .catch((err) => !stopped && setError(mensajeCamara(err)))

    return () => {
      stopped = true
      cancelAnimationFrame(frame)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [active, puedeCamaraEnVivo])

  const onFoto = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !active) return
    setFotoError('')
    setLeyendoFoto(true)
    try {
      const codigo = await leerQrDesdeArchivo(file)
      if (codigo) onDetectRef.current(codigo)
      else setFotoError('No se leyó un QR en la foto. Encuadralo de nuevo o escribí el código.')
    } catch {
      setFotoError('No se pudo leer la foto. Probá de nuevo o escribí el código.')
    } finally {
      setLeyendoFoto(false)
    }
  }

  if (!puedeCamaraEnVivo) {
    return (
      <div className="grid gap-3 rounded-md border border-border bg-surface p-4">
        <p className="text-sm text-ink">Fotografiá el QR con la cámara del celular.</p>
        <input
          ref={inputFotoRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={onFoto}
          disabled={!active || leyendoFoto}
        />
        <button
          type="button"
          className="btn-primary"
          disabled={!active || leyendoFoto}
          onClick={() => inputFotoRef.current?.click()}
        >
          {leyendoFoto ? 'Leyendo QR…' : 'Abrir cámara'}
        </button>
        {fotoError && <p className="text-sm text-danger">{fotoError}</p>}
      </div>
    )
  }

  if (error) {
    return <div className="flex aspect-video items-center justify-center rounded-md bg-slate-900 p-6 text-center text-sm text-slate-200">{error}</div>
  }

  return (
    <div className="relative overflow-hidden rounded-md bg-slate-900">
      <video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-3/5 aspect-square rounded-lg border-4 border-white/80 shadow-[0_0_0_9999px_rgba(15,23,42,0.35)]" />
      </div>
    </div>
  )
}
