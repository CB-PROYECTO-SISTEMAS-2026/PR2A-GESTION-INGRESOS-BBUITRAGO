/** Embed gratuito de Spotify a partir de una URL open.spotify.com o spotify: URI. */
export function parseSpotifyEmbed(link) {
  if (!link || typeof link !== 'string') return null
  const m = link
    .trim()
    .match(
      /^(?:https:\/\/open\.spotify\.com\/(?:intl-[a-z-]+\/)?|spotify:)(track|album|playlist|artist|episode|show)[/:]([A-Za-z0-9]{22})/i,
    )
  if (!m) return null
  const type = m[1].toLowerCase()
  const id = m[2]
  const compact = type === 'track' || type === 'episode'
  return {
    src: `https://open.spotify.com/embed/${type}/${id}`,
    height: compact ? 152 : 352,
  }
}

export default function SpotifyEmbed({ url, title = 'Spotify', className = '' }) {
  const embed = parseSpotifyEmbed(url)
  if (!embed) return null

  return (
    <div className={`overflow-hidden rounded-xl border border-border bg-surface ${className}`}>
      <iframe
        title={title}
        src={embed.src}
        width="100%"
        height={embed.height}
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
        style={{ border: 0, borderRadius: 12, display: 'block' }}
      />
    </div>
  )
}
