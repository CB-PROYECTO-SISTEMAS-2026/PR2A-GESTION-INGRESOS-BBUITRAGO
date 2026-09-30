import PanelSidebar from './PanelSidebar'

const items = [
  { label: 'Dashboard' },
  { to: '/negocio', label: 'Mis Negocios', end: true },
  { to: '/negocio/productos', label: 'Productos' },
  { label: 'Ventas' },
  { to: '/negocio/ayudantes', label: 'Ayudantes' },
  { label: 'Historial' },
]

export default function BusinessSidebar() {
  return <PanelSidebar items={items} roleLabel="Jefe de negocio" />
}
