import BusinessSidebar from './BusinessSidebar'
import PanelLayout from './PanelLayout'

/** Misma cáscara que admin (navbar + sidebar). Sin pie compacto. */
export default function BusinessLayout() {
  return <PanelLayout sidebar={BusinessSidebar} showFooter={false} />
}
