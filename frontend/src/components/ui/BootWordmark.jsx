import wordmarkBootFill from '../../assets/brand/eventix-wordmark-boot-fill.svg'

/** Wordmark oficial (SVG de marca) + máscara líquida. La estrella va aparte al terminar. */
export default function BootWordmark({ maskId = 'ev-boot-liquid-mask', starRef, maskPathRef }) {
  return (
    <svg
      className="ev-boot-wordmark-svg"
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      viewBox="0 0 240 70"
      width={240}
      height={70}
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="240" height="70">
          <path ref={maskPathRef} fill="#fff" d="M0 70 H240 V70 H0 Z" />
        </mask>
      </defs>

      <image
        href={wordmarkBootFill}
        xlinkHref={wordmarkBootFill}
        width="240"
        height="70"
        opacity="0.22"
        preserveAspectRatio="xMidYMid meet"
      />

      <image
        href={wordmarkBootFill}
        xlinkHref={wordmarkBootFill}
        width="240"
        height="70"
        preserveAspectRatio="xMidYMid meet"
        mask={`url(#${maskId})`}
      />

      {/* Estrella del wordmark oficial (`eventix-wordmark-dark.svg`): solo al 100 %. */}
      <g ref={starRef} className="ev-boot-star" opacity="0">
        <g transform="translate(12, 10)">
          <g transform="skewX(-13)">
            <path
              d="M 160.7 7 Q 160.7 15, 168.7 15 Q 160.7 15, 160.7 23 Q 160.7 15, 152.7 15 Q 160.7 15, 160.7 7 Z"
              fill="#00F2FE"
            />
          </g>
        </g>
      </g>
    </svg>
  )
}

export function bootLiquidMaskPath(width, height, progress, phase) {
  const surface = height * (1 - progress / 100)
  const amplitude = 3.2 + (progress / 100) * 2.1
  const waves = 2.65
  const steps = 36
  const parts = []

  for (let i = 0; i <= steps; i++) {
    const x = (width / steps) * i
    const n = i / steps
    const wobble =
      Math.sin(n * Math.PI * 2 * waves + phase) * amplitude +
      Math.sin(n * Math.PI * 4 + phase * 1.35) * (amplitude * 0.35)
    const y = surface + wobble
    parts.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`)
  }

  parts.push(`L ${width} ${height} L 0 ${height} Z`)
  return parts.join(' ')
}