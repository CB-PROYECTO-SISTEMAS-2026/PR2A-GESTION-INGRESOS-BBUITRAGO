/** Trazo de escritorio de two26.studio `.services-path-svg` (viewBox 1616×2187). */
export const DESKTOP_PATH = {
  viewBox: '0 0 1616 2187',
  d: 'M1601 15C1241.24 56.6913 1025.14 308.977 1139.71 377.393C1191.45 408.29 1240.74 339.444 1181.39 282.059C1075.45 179.627 937.582 215.243 741.458 298.287C701.638 315.147 622.383 350.59 552.298 410.201C487.298 465.486 487.725 549.018 534.765 563.77C581.804 578.523 632.714 579.634 681.058 587.392C729.731 595.202 767.011 617.17 797.836 657.756C833.766 705.065 838.864 772.034 862.127 825.767C890.491 891.283 966.341 911.2 1033.5 915.638C1130.56 922.052 1195.74 891.215 1286.16 899.069C1347.7 904.414 1457.75 932.208 1466.92 1059.42C1477.81 1210.68 1340.4 1252.99 1221.76 1286.05C1118.2 1314.91 997.775 1397.54 862.127 1334.5C757.468 1285.86 666.411 1293.34 650.401 1384.21C634.391 1475.07 710.968 1532.13 837.283 1542.81C963.598 1553.5 1146.44 1534.93 1181.39 1676C1226.53 1858.21 954.075 1839.5 797.836 1839.5C661.891 1839.5 422.283 1807.72 385.5 1700C340.427 1568 635.939 1584.37 465.5 1917C414.516 2016.5 310 2165.31 15 2165.31',
}

/** Trazo móvil de two26.studio `.service-path-mobile` (el `d` se sale de 407px; viewBox abarca el trazo). */
export const MOBILE_PATH = {
  viewBox: '-140 0 690 1560',
  d: 'M542.705 10C465.727 48.981 92.8237 79.5116 92.8237 185.592C92.8237 291.673 352.712 336 346.322 440.868C339.933 545.736 104.278 543.251 92.8237 652.131C79.6013 777.82 353.287 765.564 346.322 898.5C339.358 1031.44 63.9084 911.5 68 1046C72.0916 1180.5 335.245 1170.41 328.309 1279.59C320.5 1402.5 -37.4522 1513.46 -135.704 1545.09',
}

/**
 * Centra cada capa sobre el trazo fijo de Two26 (sin cambiar el `d`).
 * En móvil no desplaza las capas (el CSS ya ancla las palabras): solo sincroniza el progreso del trazo.
 * @returns {number[]} progreso 0–1 en el path por icono
 */
export function alignLayersToFixedPath(path, root, layersEl, iconFallbackWidth, { mobile = false } = {}) {
  const body = root.querySelector('.ev-ex-body')
  const icons = [...layersEl.querySelectorAll('.ev-ex-icon')]
  const layers = icons.map((icon) => icon.closest('.ev-ex-layer'))

  layers.forEach((layer) => {
    if (layer) layer.style.transform = ''
  })

  body?.classList.add('is-measuring')
  if (iconFallbackWidth > 0) {
    icons.forEach((icon) => {
      icon.style.width = `${iconFallbackWidth}px`
    })
  }

  const len = path.getTotalLength()
  const fallbackProgress = (arr) =>
    arr.map((_, i, a) => (a.length > 1 ? i / (a.length - 1) : 0))

  if (!len) {
    body?.classList.remove('is-measuring')
    icons.forEach((icon) => {
      icon.style.width = ''
    })
    return fallbackProgress(icons)
  }

  const ctm = path.getScreenCTM()
  if (!ctm) {
    body?.classList.remove('is-measuring')
    icons.forEach((icon) => {
      icon.style.width = ''
    })
    return fallbackProgress(icons)
  }

  const total = icons.length
  const band = 1 / Math.max(total, 1)
  const progresses = []

  icons.forEach((icon, i) => {
    const layer = layers[i]
    const anchor = mobile ? layer : icon
    const r = (anchor || icon).getBoundingClientRect()
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2

    const lo = Math.max(0, i * band - band * 0.65)
    const hi = Math.min(1, i * band + band * 1.25)
    const step = mobile ? 0.004 : 0.0025

    let bestT = total > 1 ? i / (total - 1) : 0
    let bestDist = Infinity
    let bestX = cx
    let bestY = cy

    for (let t = lo; t <= hi; t += step) {
      const pt = path.getPointAtLength(len * t)
      const sp = new DOMPoint(pt.x, pt.y).matrixTransform(ctm)
      const dist = mobile
        ? (sp.y - cy) ** 2 * 4 + (sp.x - cx) ** 2 * 0.35
        : (sp.x - cx) ** 2 + (sp.y - cy) ** 2
      if (dist < bestDist) {
        bestDist = dist
        bestT = t
        bestX = sp.x
        bestY = sp.y
      }
    }

    if (!mobile) {
      const deltaX = bestX - cx
      const deltaY = bestY - cy
      if (layer && (Math.abs(deltaX) > 0.5 || Math.abs(deltaY) > 0.5)) {
        layer.style.transform = `translate(${deltaX}px, ${deltaY}px)`
      }
    }

    progresses.push(bestT)
    icon.dataset.pathProgress = String(bestT)
  })

  body?.classList.remove('is-measuring')
  icons.forEach((icon) => {
    icon.style.width = ''
  })

  return progresses
}