/** Carrusel cilíndrico automático (solo visual, sin interacción requerida). */
export default function CylinderCarousel({ images = [], className = '' }) {
  if (images.length < 3) return null
  const loop = [...images, ...images]

  return (
    <div className={`ev-cylinder ${className}`} aria-hidden="true">
      <div className="ev-cylinder-track">
        {loop.map((img, i) => (
          <div key={`${img.src}-${i}`} className="ev-cylinder-card">
            <img src={img.src} alt="" loading="lazy" />
          </div>
        ))}
      </div>
    </div>
  )
}
