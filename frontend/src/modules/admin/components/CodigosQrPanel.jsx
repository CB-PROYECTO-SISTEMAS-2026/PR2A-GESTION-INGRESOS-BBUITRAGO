import { useEffect, useState } from 'react'
import { getCodigos } from '../../../api/events.api'
import Modal from '../../../components/ui/Modal'
import { IconChevronLeft, IconChevronRight, IconDownload } from '../../../components/ui/icons'
import { getErrorMessage } from '../../../utils/format'
import { formatNumber } from '../../../utils/validation'

const PAGE_SIZE = 24

/** Códigos QR de una categoría, paginados. Cada código es una entrada única. */
export default function CodigosQrPanel({ categoria }) {
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)

  const version = `${categoria.id}:${categoria.codigosTotal}`

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError('')
    getCodigos(categoria.id, { page, pageSize: PAGE_SIZE })
      .then(({ data: res }) => {
        if (!alive) return
        setData(res)
        if (res.page !== page) setPage(res.page)
      })
      .catch((err) => alive && setError(getErrorMessage(err)))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, page])

  const totalPages = data?.totalPages ?? 1

  return (
    <div className="mt-5 border-t border-border pt-5">
      <p className="text-sm text-muted">
        Cada código es una entrada única. Al venderse queda asignado al comprador y se escanea en el ingreso al evento.
      </p>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className={`mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 ${loading ? 'opacity-50' : ''}`}>
        {(data?.items ?? []).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSelected(t)}
            className="group rounded-md border border-border bg-white p-2 text-center transition hover:border-teal hover:shadow-sm"
          >
            <img src={t.qr} alt={`Código ${t.codigo}`} className="mx-auto aspect-square w-full" loading="lazy" />
            <span className="mt-1 block truncate font-mono text-[10px] text-slate-600">{t.codigo}</span>
            {t.asignado && (
              <span className="mt-1 inline-block badge bg-emerald-100 text-emerald-800">
                Vendido
              </span>
            )}
          </button>
        ))}
        {loading && !data && <p className="col-span-full text-sm text-muted">Cargando códigos…</p>}
      </div>

      {data && totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-muted">
            {formatNumber((data.page - 1) * data.pageSize + 1)}–{formatNumber(Math.min(data.page * data.pageSize, data.total))} de{' '}
            {formatNumber(data.total)}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-secondary btn-sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => p - 1)}
              aria-label="Página anterior"
            >
              <IconChevronLeft />
            </button>
            <span className="font-semibold text-ink">
              {data.page} / {totalPages}
            </span>
            <button
              type="button"
              className="btn-secondary btn-sm"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
              aria-label="Página siguiente"
            >
              <IconChevronRight />
            </button>
          </div>
        </div>
      )}

      <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title={categoria.nombre} size="sm" labelledBy="qr-modal-title">
        {selected && (
          <div className="px-6 pb-6 pt-4 text-center">
            <img src={selected.qr} alt={`Código ${selected.codigo}`} className="mx-auto w-64" />
            <p className="mt-3 font-mono text-lg font-bold tracking-wide text-ink">{selected.codigo}</p>
            <span
              className={`mt-2 inline-block badge ${
                selected.asignado ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
              }`}
            >
              {selected.asignado ? 'Vendido' : 'Disponible'}
            </span>
            <div className="mt-6 flex justify-center gap-3">
              <button type="button" className="btn-secondary" onClick={() => setSelected(null)}>
                Cerrar
              </button>
              <a href={selected.qr} download={`${selected.codigo}.png`} className="btn-primary">
                <IconDownload />
                Descargar
              </a>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
