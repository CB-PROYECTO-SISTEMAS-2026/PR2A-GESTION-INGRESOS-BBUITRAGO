import PanelSidebar from './PanelSidebar'

const items = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/eventos', label: 'Eventos' },
  { to: '/admin/solicitudes', label: 'Solicitudes' },
  { label: 'Entradas' },
  { label: 'Pagos' },
  { to: '/admin/usuarios', label: 'Usuarios' },
  { label: 'Negocios' },
  { label: 'Accesos' },
  { label: 'Recargas' },
  { label: 'Ventas' },
  { label: 'Devoluciones' },
  { label: 'Reportes' },
]

export default function AdminSidebar() {
  return <PanelSidebar items={items} roleLabel="Administrador" />
}
