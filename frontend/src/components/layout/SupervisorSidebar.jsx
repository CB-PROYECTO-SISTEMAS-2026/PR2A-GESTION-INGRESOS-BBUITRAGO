import PanelSidebar from './PanelSidebar'

const items = [
  { to: '/supervisor', label: 'Entrega de manillas', end: true },
  { to: '/supervisor/entregas', label: 'Mis entregas' },
  { label: 'Control de acceso' },
]

export default function SupervisorSidebar() {
  return <PanelSidebar items={items} roleLabel="Supervisor de acceso" />
}
