import PanelSidebar from './PanelSidebar'

const items = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/eventos', label: 'Eventos' },
  { to: '/admin/solicitudes', label: 'Solicitudes' },
  { label: 'Entradas' },
  { to: '/admin/compras', label: 'Pagos' },
  { to: '/admin/usuarios', label: 'Usuarios' },
  { label: 'Negocios' },
  { to: '/admin/accesos', label: 'Accesos' },
  { to: '/admin/recargas', label: 'Recargas' },
  { label: 'Ventas' },
  { to: '/admin/retiros', label: 'Retiros' },
  { label: 'Devoluciones' },
  { label: 'Reportes' },
]

export default function AdminSidebar(props) {
  return <PanelSidebar items={items} roleLabel="Administrador" {...props} />
}
