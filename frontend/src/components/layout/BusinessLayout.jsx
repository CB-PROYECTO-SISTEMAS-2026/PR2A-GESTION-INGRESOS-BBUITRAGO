import { Outlet } from 'react-router-dom'
import BusinessSidebar from './BusinessSidebar'
import Footer from './Footer'
import Navbar from './Navbar'

export default function BusinessLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-page">
      <Navbar />
      <div className="flex flex-1">
        <BusinessSidebar />
        <div className="flex-1 overflow-auto bg-white">
          <Outlet />
        </div>
      </div>
      <Footer />
    </div>
  )
}
