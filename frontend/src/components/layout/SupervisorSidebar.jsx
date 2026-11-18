import PanelSidebar from './PanelSidebar'

const items = [
  { to: '/supervisor', label: 'Entrega de manillas', end: true },
  { to: '/supervisor/entregas', label: 'Mis entregas' },
  { to: '/supervisor/historial-accesos', label: 'Mi historial de accesos' },
  { to: '/supervisor/acceso', label: 'Control de acceso' },
]

export default function SupervisorSidebar(props) {
  return <PanelSidebar items={items} roleLabel="Supervisor de acceso" {...props} />
}
