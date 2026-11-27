import StaffLayout from './StaffLayout'

const TABS = [
  { to: '/supervisor', label: 'Puerta', end: true },
  { to: '/supervisor/manillas', label: 'Manillas' },
]

/** Terminal del encargado de acceso: puerta y entrega de manillas, en el celular. */
export default function SupervisorLayout() {
  return (
    <StaffLayout
      tabs={TABS}
      label="Acceso"
      perfilPath="/supervisor/perfil"
      lectorPath="/supervisor"
    />
  )
}
