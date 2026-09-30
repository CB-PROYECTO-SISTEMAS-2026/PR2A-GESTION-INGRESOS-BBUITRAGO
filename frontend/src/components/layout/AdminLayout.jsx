import { Outlet } from 'react-router-dom'
import AdminSidebar from './AdminSidebar'
import Footer from './Footer'
import Navbar from './Navbar'

export default function AdminLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-page">
      <Navbar />
      <div className="flex flex-1">
        <AdminSidebar />
        <div className="flex-1 overflow-auto bg-white">
          <Outlet />
        </div>
      </div>
      <Footer />
    </div>
  )
}
