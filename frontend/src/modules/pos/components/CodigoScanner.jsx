import { useRef, useState } from 'react'
import { Scanner } from '@yudiel/react-qr-scanner'
import MarcoEscaner from '../../../components/terminal/MarcoEscaner'
import TarjetaLectura from '../../../components/terminal/TarjetaLectura'
import { leerQrDesdeArchivo } from '../../../utils/leerQrDesdeArchivo'

const CAMERA_ERRORS = {
  'insecure-context': 'La cámara en vivo necesita HTTPS. En el celular podés fotografiar el QR.',
  'permission-denied': 'No se dio permiso para usar la cámara. Actívalo en el navegador o ingresa el código.',
  'no-camera': 'No se encontró una cámara en este dispositivo.',
  'in-use': 'La cámara está siendo usada por otra aplicación.',
  unsupported: 'Este navegador no permite escanear códigos. Ingresa el código manualmente.',
}

const puedeCamaraEnVivo = typeof window !== 'undefined' && window.isSecureContext

/**
 * Lee el QR de la entrada digital o de la manilla con la cámara del celular.
 * En HTTP por IP LAN (celular) usa la cámara nativa por foto; en localhost/HTTPS, escaneo en vivo.
 * Siempre ofrece el ingreso manual del código por si la cámara falla.
 */
export default function CodigoScanner({ onCodigo, disabled = false }) {
  const [manual, setManual] = useState('')
  const [cameraError, setCameraError] = useState('')
  const [fotoError, setFotoError] = useState('')
  const [leyendoFoto, setLeyendoFoto] = useState(false)
  const inputFotoRef = useRef(null)

  const submitManual = (e) => {
    e.preventDefault()
    const codigo = manual.trim()
    if (codigo && !disabled) onCodigo(codigo)
  }

  const onFoto = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || disabled) return
    setFotoError('')
    setLeyendoFoto(true)
    try {
      const codigo = await leerQrDesdeArchivo(file)
      if (codigo) onCodigo(codigo)
      else setFotoError('No se leyó un QR en la foto. Encuadralo de nuevo o ingresá el código.')
    } catch {
      setFotoError('No se pudo leer la foto. Probá de nuevo o ingresá el código.')
    } finally {
      setLeyendoFoto(false)
    }
  }

  return (
    <div className="grid gap-4">
      {puedeCamaraEnVivo ? (
        cameraError ? (
          <TarjetaLectura tono="warning" titulo="Cámara no disponible" motivo={cameraError} />
        ) : (
          <MarcoEscaner>
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
          </MarcoEscaner>
        )
      ) : (
        <div className="grid gap-3 rounded-md border border-border bg-surface p-4">
          <p className="text-sm text-ink">Fotografiá el QR con la cámara del celular.</p>
          <input
            ref={inputFotoRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={onFoto}
            disabled={disabled || leyendoFoto}
          />
          <button
            type="button"
            className="btn-primary"
            disabled={disabled || leyendoFoto}
            onClick={() => inputFotoRef.current?.click()}
          >
            {leyendoFoto ? 'Leyendo QR…' : 'Abrir cámara'}
          </button>
          {fotoError && <p className="text-sm text-danger">{fotoError}</p>}
        </div>
      )}
      <p className="text-center text-xs text-muted">
        {puedeCamaraEnVivo
          ? 'Alinea el QR de la manilla o de la entrada digital dentro del recuadro.'
          : 'Si la foto no lee el código, ingresalo abajo.'}
      </p>

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
