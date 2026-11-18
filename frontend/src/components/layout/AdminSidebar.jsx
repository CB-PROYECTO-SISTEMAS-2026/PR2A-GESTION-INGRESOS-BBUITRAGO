import PanelSidebar from './PanelSidebar'

const items = [
  { to: '/admin', label: 'Resumen', end: true },
  { to: '/admin/eventos', label: 'Eventos' },
  { to: '/admin/solicitudes', label: 'Solicitudes' },
  { to: '/admin/compras', label: 'Pagos' },
  { to: '/admin/usuarios', label: 'Usuarios' },
  { to: '/admin/accesos', label: 'Accesos' },
  { to: '/admin/recargas', label: 'Recargas' },
  { to: '/admin/retiros', label: 'Retiros' },
  { to: '/admin/reembolsos', label: 'Reembolsos de entradas' },
  { to: '/admin/reportes', label: 'Reportes' },
]

export default function AdminSidebar(props) {
  return <PanelSidebar items={items} roleLabel="Administrador" {...props} />
}
