import StaffLayout from '../../components/layout/StaffLayout'

const TABS = [
  { to: '/recargas', label: 'Recargar', end: true },
  { to: '/recargas/historial', label: 'Mis recargas' },
]

/** Terminal del recargador de saldo: pensada para su celular. */
export default function RecargasLayout() {
  return <StaffLayout tabs={TABS} label="Recargas" />
}
