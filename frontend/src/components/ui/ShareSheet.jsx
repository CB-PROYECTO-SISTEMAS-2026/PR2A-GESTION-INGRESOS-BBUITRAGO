import { useState } from 'react'

export default function ShareSheet({ url, title = 'Compartir', className = '' }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const shareUrl = url || (typeof window !== 'undefined' ? window.location.href : '')

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  const nativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, url: shareUrl })
        return
      } catch {
        /* usuario canceló */
      }
    }
    setOpen(true)
  }

  return (
    <div className={`relative inline-block ${className}`}>
      <button type="button" className="btn-secondary !py-2 !text-sm" onClick={nativeShare}>
        Compartir
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-64 rounded-lg border border-border bg-surface p-3 shadow-lg">
          <p className="text-sm font-semibold text-ink">{title}</p>
          <p className="mt-1 break-all text-xs text-muted">{shareUrl}</p>
          <div className="mt-3 flex gap-2">
            <button type="button" className="btn-primary !py-1.5 !text-xs" onClick={copy}>
              {copied ? 'Copiado' : 'Copiar enlace'}
            </button>
            <button type="button" className="btn-secondary !py-1.5 !text-xs" onClick={() => setOpen(false)}>
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
