export const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,72}$/
export const PASSWORD_MESSAGE =
  'La contraseña debe tener entre 8 y 72 caracteres, con al menos una letra y un número.'

export function validatePassword(password, confirm) {
  if (!PASSWORD_RULE.test(password)) return PASSWORD_MESSAGE
  if (confirm !== undefined && password !== confirm) return 'Las contraseñas no coinciden'
  return ''
}
