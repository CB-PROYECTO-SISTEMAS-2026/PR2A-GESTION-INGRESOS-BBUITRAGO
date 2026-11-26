import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { canBrowseCatalog, homeFor } from '../../utils/roles'

/** Personal de piso (POS, recargas, etc.) no recorre la tienda. */
export default function CatalogGate() {
  const { user, isAuthenticated } = useAuth()

  if (isAuthenticated && !canBrowseCatalog(user?.roles)) {
    return <Navigate to={homeFor(user?.roles)} replace />
  }

  return <Outlet />
}
