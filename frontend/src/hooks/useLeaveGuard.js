import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { useBlocker, useLocation } from 'react-router-dom'

/**
 * Intercepta la navegación interna mientras `when` sea verdadero y llama a
 * `onBlocked(blocker)` para que la página decida (`blocker.proceed()` o `blocker.reset()`).
 * También pide confirmación del navegador al recargar o cerrar la pestaña.
 */
export function useLeaveGuard(when, onBlocked) {
  const bypass = useRef(false)
  const onBlockedRef = useRef(onBlocked)
  const blockerRef = useRef(null)

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      when && !bypass.current && currentLocation.pathname !== nextLocation.pathname,
  )

  const { pathname } = useLocation()

  useLayoutEffect(() => {
    onBlockedRef.current = onBlocked
    blockerRef.current = blocker
  })

  useEffect(() => {
    bypass.current = false
  }, [pathname])

  useEffect(() => {
    if (blocker.state === 'blocked') onBlockedRef.current(blockerRef.current)
  }, [blocker.state])

  useEffect(() => {
    if (!when) return undefined
    const onBeforeUnload = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [when])

  /** Permite la siguiente navegación sin preguntar (por ejemplo, después de guardar). */
  const allowNavigation = useCallback(() => {
    bypass.current = true
  }, [])

  return { allowNavigation }
}
