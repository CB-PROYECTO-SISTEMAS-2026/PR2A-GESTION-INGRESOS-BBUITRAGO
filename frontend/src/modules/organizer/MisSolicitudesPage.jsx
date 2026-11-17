import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { getMisSolicitudes, updateSolicitudMapa } from '../../api/events.api'
import { toast } from '../../components/Toast'
import { confirmDialog } from '../../components/ui/ConfirmDialog'
import { IconExternal, IconUpload } from '../../components/ui/icons'
import MapaPreview from '../../components/MapaPreview'
import { useLeaveGuard } from '../../hooks/useLeaveGuard'
import { formatDateTime, formatDayRange, formatHorario, getErrorMessage } from '../../utils/format'
import { estadoBadgeClass, estadoLabel, mapaCambioLabel } from '../../utils/labels'
import { ACCEPT_MAPA, validateFile } from '../../utils/files'

function MapaSolicitud({ solicitud, onUpdated, onPendingChange }) {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState(null)
  const [nota, setNota] = useState('')
  const [saving, setSaving] = useState(false)
  const puedeActualizar = solicitud.estado !== 'RECHAZADA'
  const historial = solicitud.mapHistory ?? []

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : ''), [file])
  useEffect(() => () => previewUrl && URL.revokeObjectURL(previewUrl), [previewUrl])

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

  const upload = useCallback(async () => {
    if (!file) return true
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('mapa', file)
      if (nota.trim()) fd.append('nota', nota.trim())
      await updateSolicitudMapa(solicitud.id, fd)
      toast('Mapa actualizado', 'success')
      setFile(null)
      setNota('')
      await onUpdated()
      return true
    } catch (err) {
      toast(getErrorMessage(err), 'error')
      return false
    } finally {
      setSaving(false)
    }
  }, [file, nota, solicitud.id, onUpdated])

  useEffect(() => {
    onPendingChange(solicitud.id, file ? { upload, discard: () => setFile(null) } : null)
  }, [file, upload, solicitud.id, onPendingChange])

  useEffect(() => () => onPendingChange(solicitud.id, null), [solicitud.id, onPendingChange])

  return (
    <div className="mt-4 border-t border-border pt-3">
      <button
        type="button"
        className="text-sm font-semibold text-teal-dark hover:underline"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? 'Ocultar mapa' : 'Ver mapa del evento'}
      </button>

      {open && (
        <div className="mt-4 grid gap-5 md:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{file ? 'Nuevo mapa' : 'Mapa actual'}</p>
            {file ? (
              file.type === 'application/pdf' ? (
                <iframe title="Vista previa del nuevo mapa" src={previewUrl} className="h-64 w-full rounded-lg border border-border" />
              ) : (
                <img src={previewUrl} alt="Vista previa del nuevo mapa" className="max-h-64 w-full rounded-lg bg-page object-contain" />
              )
            ) : (
              <MapaPreview url={solicitud.mapaUrl} nombre={solicitud.mapaNombre} className="max-h-64" />
            )}
            {historial.length > 0 && (
              <ul className="mt-4 space-y-2 text-xs">
                {historial.map((h) => (
                  <li key={h.id} className="rounded-lg bg-page px-3 py-2">
                    <span className="font-semibold text-ink">{mapaCambioLabel(h.tipo)}</span>
                    <span className="text-muted"> · {formatDateTime(h.createdAt)}</span>
                    {h.nota && <span className="block text-slate-600">{h.nota}</span>}
                    {h.mapaUrl && (
                      <a
                        href={h.mapaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-0.5 inline-flex items-center gap-1 font-semibold text-teal-dark hover:underline"
                      >
                        <IconExternal className="h-3 w-3" />
                        {h.mapaNombre || 'Ver archivo'}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {puedeActualizar && (
            <div className="space-y-4">
              {file ? (
                <>
                  <p className="truncate text-sm font-medium text-slate-600">{file.name}</p>
                  <div>
                    <label className="label" htmlFor={`nota-${solicitud.id}`}>
                      Nota del cambio
                    </label>
                    <input
                      id={`nota-${solicitud.id}`}
                      className="input"
                      value={nota}
                      onChange={(e) => setNota(e.target.value)}
                      maxLength={191}
                    />
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button type="button" className="btn-primary" onClick={upload} disabled={saving}>
                      <IconUpload />
                      {saving ? 'Actualizando…' : 'Actualizar mapa'}
                    </button>
                    <button type="button" className="btn-secondary" onClick={() => setFile(null)} disabled={saving}>
                      Descartar
                    </button>
                  </div>
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
        </div>
      )}
    </div>
  )
}

export default function MisSolicitudesPage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pendingCount, setPendingCount] = useState(0)
  const pendingRef = useRef(new Map())

  const load = useCallback(async () => {
    const { data } = await getMisSolicitudes()
    setItems(Array.isArray(data) ? data : data?.data ?? [])
  }, [])

  useEffect(() => {
    let alive = true
    load()
      .catch((err) => alive && setError(getErrorMessage(err)))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [load])

  const onPendingChange = useCallback((id, entry) => {
    if (entry) pendingRef.current.set(id, entry)
    else pendingRef.current.delete(id)
    setPendingCount(pendingRef.current.size)
  }, [])

  useLeaveGuard(pendingCount > 0, async (blocker) => {
    const answer = await confirmDialog({
      title: 'El mapa no se actualizó',
      message: 'Seleccionaste un archivo nuevo, pero todavía no se subió. ¿Deseas actualizar el mapa antes de salir?',
      confirmText: 'Sí, actualizar',
      cancelText: 'No',
    })
    const pending = [...pendingRef.current.values()]
    if (answer === true) {
      const results = []
      for (const p of pending) results.push(await p.upload())
      if (results.every(Boolean)) blocker.proceed()
      else blocker.reset()
    } else if (answer === false) {
      pending.forEach((p) => p.discard())
      blocker.proceed()
    } else {
      blocker.reset()
    }
  })

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold text-ink">Mis solicitudes</h1>
        <Link to="/organizador/nueva-solicitud" className="btn-primary">
          Nueva solicitud
        </Link>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {loading ? (
        <p className="mt-6 text-muted">Cargando…</p>
      ) : items.length ? (
        <ul className="mt-6 space-y-3">
          {items.map((s) => (
            <li key={s.id} className="card-surface p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-display text-lg font-bold text-ink">{s.nombreEvento}</h2>
                  <p className="mt-1 text-sm text-muted">
                    {s.ubicacion} · {formatDayRange(s.fechaInicio, s.fechaFin)} · {formatHorario(s.horaInicio, s.horaFin)}
                  </p>
                  {s.ubicacionUrl && (
                    <a
                      href={s.ubicacionUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-teal-dark hover:underline"
                    >
                      Ver en Google Maps
                      <IconExternal className="h-3.5 w-3.5" />
                    </a>
                  )}
                  <p className="mt-2 line-clamp-2 text-sm text-slate-600">{s.descripcion}</p>
                </div>
                <span className={`badge ${estadoBadgeClass(s.estado)}`}>
                  {estadoLabel(s.estado)}
                </span>
              </div>
              {s.observaciones && (
                <div className="mt-3 rounded-lg bg-page px-3 py-2 text-sm">
                  <span className="font-semibold text-ink">Observaciones: </span>
                  <span className="text-slate-600">{s.observaciones}</span>
                </div>
              )}
              {s.evento?.estado === 'PUBLICADO' && (
                <Link to={`/eventos/${s.evento.id}`} className="mt-3 inline-block text-sm font-semibold text-teal-dark hover:underline">
                  Ver evento publicado
                </Link>
              )}
              <MapaSolicitud solicitud={s} onUpdated={load} onPendingChange={onPendingChange} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-muted">Aún no enviaste solicitudes.</p>
      )}
    </div>
  )
}
