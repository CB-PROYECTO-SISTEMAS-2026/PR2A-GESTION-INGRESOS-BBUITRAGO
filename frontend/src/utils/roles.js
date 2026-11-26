export const ROLE_LABELS = {
  ADMIN: 'Administrador',
  ORGANIZADOR: 'Organizador',
  CLIENTE: 'Cliente',
  JEFE_NEGOCIO: 'Jefe de negocio',
  AYUDANTE: 'Ayudante',
  ENCARGADO_ACCESO: 'Encargado de acceso',
  RECARGADOR: 'Recargador',
  DEVOLUCIONES: 'Devoluciones',
}

/** Roles que el administrador puede asignar por invitación. */
export const INVITABLE_ROLES = ['ORGANIZADOR', 'JEFE_NEGOCIO', 'ENCARGADO_ACCESO', 'RECARGADOR', 'DEVOLUCIONES', 'ADMIN']

export const roleLabel = (role) => ROLE_LABELS[role] || role

/** Panel de trabajo. Cliente y visitante quedan en la tienda (`/`). */
export function homeFor(roles = []) {
  if (roles.includes('ADMIN')) return '/admin'
  if (roles.includes('JEFE_NEGOCIO')) return '/negocio'
  if (roles.includes('ORGANIZADOR')) return '/organizador/solicitudes'
  if (roles.includes('ENCARGADO_ACCESO')) return '/supervisor'
  if (roles.includes('AYUDANTE')) return '/pos'
  if (roles.includes('RECARGADOR')) return '/recargas'
  if (roles.includes('DEVOLUCIONES')) return '/devoluciones'
  return '/'
}

/** Admin, organizador y jefe de negocio revisan la vitrina. El resto del personal no. */
export function canBrowseCatalog(roles = []) {
  if (!roles.length) return true
  if (roles.includes('ADMIN') || roles.includes('ORGANIZADOR') || roles.includes('JEFE_NEGOCIO')) return true
  return homeFor(roles) === '/'
}

/** Rutas de la tienda (y la invitación de entrada) a las que puede volver un cliente. */
export function safePublicRedirect(raw) {
  if (typeof raw !== 'string' || !raw.startsWith('/') || raw.startsWith('//')) return null
  let url
  try {
    url = new URL(raw, 'http://local')
  } catch {
    return null
  }
  const path = url.pathname
  const catalog = path === '/' || path === '/eventos' || /^\/eventos\/[^/]+$/.test(path)
  if (!catalog && path !== '/invitar-entrada') return null
  return path + url.search
}
