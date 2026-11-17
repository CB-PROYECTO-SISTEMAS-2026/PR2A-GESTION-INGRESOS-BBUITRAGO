import { useState } from 'react'
import { Scanner } from '@yudiel/react-qr-scanner'

const CAMERA_ERRORS = {
  'insecure-context': 'La cámara solo funciona con HTTPS o en localhost. Ingresa el código manualmente.',
  'permission-denied': 'No se dio permiso para usar la cámara. Actívalo en el navegador o ingresa el código.',
  'no-camera': 'No se encontró una cámara en este dispositivo.',
  'in-use': 'La cámara está siendo usada por otra aplicación.',
  unsupported: 'Este navegador no permite escanear códigos. Ingresa el código manualmente.',
}

/**
 * Lee el QR de la entrada digital o de la manilla con la cámara del celular.
 * Siempre ofrece el ingreso manual del código por si la cámara falla.
 */
export default function CodigoScanner({ onCodigo, disabled = false }) {
  const [manual, setManual] = useState('')
  const [cameraError, setCameraError] = useState('')

  const submitManual = (e) => {
    e.preventDefault()
    const codigo = manual.trim()
    if (codigo && !disabled) onCodigo(codigo)
  }

  return (
    <div className="grid gap-4">
      {cameraError ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900" role="status">
          {cameraError}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl bg-navy">
          <Scanner
            formats={['qr_code']}
            constraints={{ facingMode: 'environment' }}
            paused={disabled}
            sound={false}
            components={{ finder: true, torch: true }}
            onScan={(codes) => {
              const codigo = codes[0]?.rawValue?.trim()
              if (codigo && !disabled) onCodigo(codigo)
            }}
            onError={(err) => setCameraError(CAMERA_ERRORS[err?.kind] || 'No se pudo iniciar la cámara.')}
            styles={{ container: { aspectRatio: '1 / 1' } }}
          />
        </div>
      )}
      <p className="text-center text-xs text-muted">Alinea el QR de la manilla o de la entrada digital dentro del recuadro.</p>

      <form onSubmit={submitManual} className="grid gap-2">
        <label className="label" htmlFor="codigo-manual">
          ¿No se puede escanear? Ingresa el código
        </label>
        <div className="flex gap-2">
          <input
            id="codigo-manual"
            className="input font-mono uppercase"
            placeholder="MNL-0847 o EVX-XXXX-XXXX-XXXX"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
          />
          <button type="submit" className="btn-secondary shrink-0" disabled={disabled || !manual.trim()}>
            Buscar
          </button>
        </div>
      </form>
    </div>
  )
}
