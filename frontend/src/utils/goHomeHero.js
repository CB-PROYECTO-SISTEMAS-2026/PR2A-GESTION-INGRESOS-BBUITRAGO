/** Tras iniciar sesión: home con scroll al hero (#inicio). */
export function goHomeHero(navigate) {
  navigate('/', { replace: true, state: { scrollToInicio: true } })
}

export function scrollHomeHeroInicio() {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const el = document.getElementById('inicio')
  if (el) {
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'instant', block: 'start' })
    el.focus({ preventScroll: true })
  } else {
    window.scrollTo(0, 0)
  }
}