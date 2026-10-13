import { Outlet } from 'react-router-dom'
import SupervisorSidebar from './SupervisorSidebar'
import Footer from './Footer'
import Navbar from './Navbar'

export default function SupervisorLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-page">
      <Navbar />
      <div className="flex flex-1">
        <SupervisorSidebar />
        <div className="flex-1 overflow-auto bg-white">
          <Outlet />
        </div>
      </div>
      <Footer />
    </div>
  )
}
