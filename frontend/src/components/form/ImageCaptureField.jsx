import { useEffect, useMemo, useRef, useState } from 'react'
import { ACCEPT_IMAGE, validateFile } from '../../utils/files'

/**
 * Subir imagen o tomar foto al momento (`capture="environment"`).
 * `allowPdf` habilita PDF además de imagen (comprobantes).
 */
export default function ImageCaptureField({
  value,
  onChange,
  error,
  disabled = false,
  allowPdf = false,
  label = 'Imagen',
  previewAlt = 'Vista previa',
}) {
  const galleryRef = useRef(null)
  const cameraRef = useRef(null)
  const accept = allowPdf ? `${ACCEPT_IMAGE},application/pdf` : ACCEPT_IMAGE

  const preview = useMemo(() => {
    if (!value) return null
    if (value.type?.startsWith('image/')) return URL.createObjectURL(value)
    return null
  }, [value])

  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview])

  const pick = (file) => {
    if (!file) return
    const err = validateFile(file, { allowPdf })
    if (err) {
      onChange?.(null, err)
      return
    }
    onChange?.(file, '')
  }

  const onFile = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    pick(file)
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-secondary btn-sm"
          disabled={disabled}
          onClick={() => galleryRef.current?.click()}
        >
          Subir
        </button>
        <button
          type="button"
          className="btn-secondary btn-sm"
          disabled={disabled}
          onClick={() => cameraRef.current?.click()}
        >
          Tomar foto
        </button>
        {value && (
          <button type="button" className="btn-secondary btn-sm !text-danger" disabled={disabled} onClick={() => onChange?.(null, '')}>
            Quitar
          </button>
        )}
      </div>
      <input ref={galleryRef} type="file" accept={accept} className="sr-only" onChange={onFile} disabled={disabled} />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={onFile}
        disabled={disabled}
      />
      {preview ? (
        <img src={preview} alt={previewAlt} className="max-h-48 rounded-md border border-border object-contain" width={320} height={192} />
      ) : value && allowPdf ? (
        <p className="text-sm text-muted">{value.name || label}</p>
      ) : null}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
