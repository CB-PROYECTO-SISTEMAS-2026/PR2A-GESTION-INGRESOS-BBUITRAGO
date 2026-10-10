import StaffLayout from '../../components/layout/StaffLayout'

const TABS = [
  { to: '/pos', label: 'Vender', end: true },
  { to: '/pos/historial', label: 'Mis ventas' },
]

/** Terminal de punto de venta: pensada para el celular del ayudante. */
export default function PosLayout() {
  return <StaffLayout tabs={TABS} label="Punto de venta" />
}
