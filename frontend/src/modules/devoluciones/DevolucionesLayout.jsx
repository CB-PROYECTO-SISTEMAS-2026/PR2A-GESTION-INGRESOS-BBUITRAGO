import StaffLayout from '../../components/layout/StaffLayout'

const TABS = [
  { to: '/devoluciones', label: 'Devolver', end: true },
  { to: '/devoluciones/historial', label: 'Historial' },
  { to: '/devoluciones/retiros', label: 'Retiros' },
]

/** Terminal del encargado de devoluciones de saldo: pensada para su celular. */
export default function DevolucionesLayout() {
  return (
    <StaffLayout
      tabs={TABS}
      label="Devoluciones"
      perfilPath="/devoluciones/perfil"
      lectorPath="/devoluciones"
    />
  )
}
