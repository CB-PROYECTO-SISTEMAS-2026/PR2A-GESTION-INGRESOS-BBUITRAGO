import { confirmDialog } from '../components/ui/ConfirmDialog'

export async function confirmLogout() {
  const ok = await confirmDialog({
    title: '¿Cerrar sesión?',
    message: '¿Estás seguro de que deseas salir de tu cuenta?',
    confirmText: 'Cerrar sesión',
    cancelText: 'Cancelar',
    tone: 'danger',
  })
  return ok === true
}