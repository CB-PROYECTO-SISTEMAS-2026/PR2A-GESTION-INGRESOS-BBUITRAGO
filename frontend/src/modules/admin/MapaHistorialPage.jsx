import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  getEventAdminById,
  getEventMapHistory,
  getSolicitudById,
  updateEventMapa,
} from '../../api/events.api'
import { toast } from '../../components/Toast'
import { confirmDialog } from '../../components/ui/ConfirmDialog'
import { IconChevronLeft, IconExternal, IconUpload } from '../../components/ui/icons'
import MapaPreview from '../../components/MapaPreview'
import EventoHeader from './components/EventoHeader'
import { useLeaveGuard } from '../../hooks/useLeaveGuard'
import { formatDateTime, getErrorMessage } from '../../utils/format'
import { mapaCambioLabel } from '../../utils/labels'
import { ACCEPT_MAPA, validateFile } from '../../utils/files'

export default function MapaHistorialPage() {
  const { id, solicitudId } = useParams()
  const eventoId = !solicitudId && id ? id : undefined

  const [evento, setEvento] = useState(null)
  const [titulo, setTitulo] = useState('')
  const [mapaUrl, setMapaUrl] = useState('')
  const [mapaNombre, setMapaNombre] = useState('')
  const [historial, setHistorial] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : ''), [file])
  useEffect(() => () => previewUrl && URL.revokeObjectURL(previewUrl), [previewUrl])

  const load = useCallback(async () => {
    if (solicitudId) {
      const { data } = await getSolicitudById(solicitudId)
      const s = data?.data ?? data
      setTitulo(s?.nombreEvento || '')
      setMapaUrl(s?.mapaUrl || '')
      setMapaNombre(s?.mapaNombre || '')
      setHistorial(s?.mapHistory ?? [])
      return
    }
    const [{ data: evData }, { data: histData }] = await Promise.all([
      getEventAdminById(eventoId),
      getEventMapHistory(eventoId),
    ])
    const e = evData?.data ?? evData
    const hist = Array.isArray(histData) ? histData : histData?.data ?? []
    setEvento(e)
    setTitulo(e?.titulo || '')
    setMapaUrl(e?.mapaUrl || '')
    setMapaNombre(hist.find((h) => h.mapaUrl === e?.mapaUrl)?.mapaNombre || '')
    setHistorial(hist)
  }, [solicitudId, eventoId])

  useEffect(() => {
    let alive = true
    setLoading(true)
    load()
      .catch((err) => alive && setError(getErrorMessage(err)))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [load])

  const onSelect = (e) => {
    const selected = e.target.files?.[0]
    e.target.value = ''
    if (!selected) return
    const invalid = validateFile(selected, { allowPdf: true })
    if (invalid) {
      toast(invalid, 'error')
      return
    }
    setFile(selected)
  }

  const upload = async () => {
    if (!file || !eventoId) return false
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('mapa', file)
      await updateEventMapa(eventoId, fd)
      setFile(null)
      toast('Mapa actualizado', 'success')
      await load()
      return true
    } catch (err) {
      toast(getErrorMessage(err), 'error')
      return false
    } finally {
      setUploading(false)
    }
  }

  useLeaveGuard(Boolean(file) && !uploading, async (blocker) => {
    const answer = await confirmDialog({
      title: 'El mapa no se actualizó',
      message: 'Seleccionaste un archivo nuevo, pero todavía no se subió. ¿Deseas actualizar el mapa antes de salir?',
      confirmText: 'Sí, actualizar',
      cancelText: 'No',
    })
    if (answer === true) {
      if (await upload()) blocker.proceed()
      else blocker.reset()
    } else if (answer === false) {
      setFile(null)
      blocker.proceed()
    } else {
      blocker.reset()
    }
  })

  const isPdf = file?.type === 'application/pdf'

  const body = loading ? (
    <div className="p-8 text-muted">Cargando…</div>
  ) : (
    <div className="grid gap-6 p-8 lg:grid-cols-[minmax(0,1fr)_380px]">
      {error && <p className="text-sm text-red-600 lg:col-span-2">{error}</p>}

      <section className="card-surface p-6">
        <h2 className="font-display text-lg font-bold text-ink">{file ? 'Nuevo mapa' : 'Mapa actual'}</h2>

        <div className="mt-4">
          {file ? (
            isPdf ? (
              <iframe title="Vista previa del nuevo mapa" src={previewUrl} className="h-[28rem] w-full rounded-lg border border-border" />
            ) : (
              <img src={previewUrl} alt="Vista previa del nuevo mapa" className="max-h-[28rem] w-full rounded-lg bg-page object-contain" />
            )
          ) : (
            <MapaPreview url={mapaUrl} nombre={mapaNombre} className="max-h-[28rem]" />
          )}
        </div>

        {file && <p className="mt-3 truncate text-sm font-medium text-slate-600">{file.name}</p>}

        {eventoId && (
          <div className="mt-5 flex flex-wrap gap-3 border-t border-border pt-5">
            {file ? (
              <>
                <button type="button" className="btn-primary" onClick={upload} disabled={uploading}>
                  <IconUpload />
                  {uploading ? 'Actualizando…' : 'Actualizar mapa'}
                </button>
                <button type="button" className="btn-secondary" onClick={() => setFile(null)} disabled={uploading}>
                  Descartar
                </button>
              </>
            ) : (
              <label className="btn-secondary cursor-pointer">
                <IconUpload />
                Elegir nuevo mapa
                <input type="file" accept={ACCEPT_MAPA} className="hidden" onChange={onSelect} />
              </label>
            )}
          </div>
        )}
      </section>

      <section className="card-surface p-6">
        <h2 className="font-display text-lg font-bold text-ink">Historial</h2>
        <ol className="mt-4 space-y-3">
          {historial.map((h, i) => (
            <li key={h.id} className={`rounded-md border p-4 text-sm ${i === 0 ? 'border-teal/40 bg-teal/5' : 'border-border'}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-ink">{mapaCambioLabel(h.tipo)}</span>
                {i === 0 && (
                  <span className="badge bg-teal text-white">Vigente</span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-muted">{formatDateTime(h.createdAt)}</p>
              {h.nota && <p className="mt-2 text-slate-700">{h.nota}</p>}
              {h.mapaUrl && (
                <a
                  href={h.mapaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 font-semibold text-teal-dark hover:underline"
                >
                  <IconExternal className="h-3.5 w-3.5" />
                  {h.mapaNombre || 'Ver archivo'}
                </a>
              )}
            </li>
          ))}
          {!historial.length && <p className="text-sm text-muted">Sin cambios registrados.</p>}
        </ol>
      </section>
    </div>
  )

  if (eventoId) {
    return (
      <>
        <EventoHeader eventoId={eventoId} titulo={evento?.titulo} estado={evento?.estado} />
        {body}
      </>
    )
  }

  return (
    <>
      <header className="border-b border-border bg-white px-8 pb-6 pt-6">
        <Link
          to={`/admin/solicitudes/${solicitudId}`}
          className="inline-flex items-center gap-1 text-sm font-semibold text-teal-dark hover:text-teal"
        >
          <IconChevronLeft />
          Solicitud
        </Link>
        <h1 className="mt-2 font-display text-3xl font-bold text-ink">Mapa e historial</h1>
        {titulo && <p className="mt-1 text-sm text-muted">{titulo}</p>}
      </header>
      {body}
    </>
  )
}
