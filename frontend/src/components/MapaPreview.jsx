import { isPdfUrl } from '../utils/format'

/** Muestra el mapa del evento: imagen embebida o enlace si es PDF. */
export default function MapaPreview({ url, nombre, className = 'max-h-72' }) {
  if (!url) return <p className="text-sm text-muted">Sin mapa adjunto.</p>

  if (isPdfUrl(url) || /\.pdf$/i.test(nombre || '')) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-lg border border-border bg-page px-4 py-3 text-sm font-semibold text-teal hover:underline"
      >
        Abrir mapa en PDF{nombre ? ` (${nombre})` : ''}
      </a>
    )
  }

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="block">
      <img
        src={url}
        alt={nombre ? `Mapa: ${nombre}` : 'Mapa del evento'}
        className={`${className} w-full rounded-lg bg-page object-contain`}
      />
    </a>
  )
}
