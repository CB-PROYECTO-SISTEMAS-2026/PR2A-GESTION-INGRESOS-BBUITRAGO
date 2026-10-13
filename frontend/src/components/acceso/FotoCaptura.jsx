import { useEffect, useMemo, useRef, useState } from 'react'
import { IconImage, IconUpload } from '../ui/icons'
import { ACCEPT_IMAGE, validateFile } from '../../utils/files'

const JPEG_QUALITY = 0.85

/** Toma la foto de la persona con la cámara (o desde un archivo si la cámara no está disponible). */
export default function FotoCaptura({ value, onChange }) {
  const videoRef = useRef(null)
  const [camara, setCamara] = useState(!value)
  const [facing, setFacing] = useState('environment')
  const [error, setError] = useState('')
  const preview = useMemo(() => (value ? URL.createObjectURL(value) : null), [value])
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview])

  useEffect(() => {
    if (!camara) return undefined
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('No se puede usar la cámara en este navegador: sube la foto desde un archivo.')
      return undefined
    }
    let stream = null
    let stopped = false
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: facing } }, audio: false })
      .then((s) => {
        if (stopped) {
          s.getTracks().forEach((t) => t.stop())
          return
        }
        stream = s
        setError('')
        if (videoRef.current) {
          videoRef.current.srcObject = s
          videoRef.current.play().catch(() => {})
        }
      })
      .catch(() => !stopped && setError('No se pudo abrir la cámara: sube la foto desde un archivo.'))
    return () => {
      stopped = true
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [camara, facing])

  const tomar = () => {
    const video = videoRef.current
    if (!video || video.readyState < 2) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    canvas.toBlob(
      (blob) => {
        if (!blob) return
        onChange(new File([blob], 'ingreso.jpg', { type: 'image/jpeg' }))
        setCamara(false)
      },
      'image/jpeg',
      JPEG_QUALITY,
    )
  }

  const onArchivo = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const err = validateFile(file)
    setError(err)
    if (!err) {
      onChange(file)
      setCamara(false)
    }
  }

  return (
    <div className="space-y-3">
      {preview && !camara ? (
        <img src={preview} alt="Foto tomada" className="aspect-video w-full rounded-md bg-slate-900 object-contain" />
      ) : error ? (
        <div className="flex aspect-video items-center justify-center rounded-md bg-slate-100 p-6 text-center text-sm text-slate-600">
          <span>
            <IconImage className="mx-auto mb-2 h-8 w-8 text-slate-400" />
            {error}
          </span>
        </div>
      ) : (
        <video ref={videoRef} className="aspect-video w-full rounded-md bg-slate-900 object-cover" muted playsInline />
      )}
      <div className="flex flex-wrap gap-2">
        {camara && !error && (
          <>
            <button type="button" className="btn-primary btn-sm" onClick={tomar}>
              Tomar foto
            </button>
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))}
            >
              Cambiar cámara
            </button>
          </>
        )}
        {!camara && (
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={() => {
              onChange(null)
              setError('')
              setCamara(true)
            }}
          >
            Tomar otra
          </button>
        )}
        <label className="btn-secondary btn-sm cursor-pointer">
          <IconUpload />
          Subir archivo
          <input type="file" accept={ACCEPT_IMAGE} capture="environment" className="sr-only" onChange={onArchivo} />
        </label>
      </div>
    </div>
  )
}
