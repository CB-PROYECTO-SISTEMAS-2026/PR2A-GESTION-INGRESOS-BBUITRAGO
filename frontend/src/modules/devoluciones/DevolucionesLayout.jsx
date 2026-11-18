import StaffLayout from '../../components/layout/StaffLayout'

// El historial de devoluciones (HU-029, Módulo D) se sumará como segunda pestaña.
const TABS = [{ to: '/devoluciones', label: 'Devolver saldo', end: true }]

/** Terminal del encargado de devoluciones de saldo: pensada para su celular. */
export default function DevolucionesLayout() {
  return <StaffLayout tabs={TABS} label="Devoluciones" />
}
