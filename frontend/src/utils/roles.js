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
export const INVITABLE_ROLES = ['ORGANIZADOR', 'JEFE_NEGOCIO', 'ADMIN']

export const roleLabel = (role) => ROLE_LABELS[role] || role
