import PanelSidebar from './PanelSidebar'

const items = [
  { to: '/negocio/dashboard', label: 'Dashboard' },
  { to: '/negocio', label: 'Mis Negocios', end: true },
  { to: '/negocio/productos', label: 'Productos' },
  { to: '/negocio/ventas', label: 'Ventas' },
  { to: '/negocio/ayudantes', label: 'Ayudantes' },
  { to: '/negocio/liquidacion', label: 'Liquidación' },
]

export default function BusinessSidebar(props) {
  return <PanelSidebar items={items} roleLabel="Jefe de negocio" {...props} />
}
