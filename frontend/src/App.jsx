import { createBrowserRouter, Navigate, Outlet, RouterProvider, ScrollRestoration } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ToastHost } from './components/Toast'
import { ConfirmHost } from './components/ui/ConfirmDialog'
import PublicLayout from './components/layout/PublicLayout'
import AdminLayout from './components/layout/AdminLayout'
import BusinessLayout from './components/layout/BusinessLayout'
import ProtectedRoute from './components/layout/ProtectedRoute'

import HomePage from './modules/public/HomePage'
import EventsPage from './modules/public/EventsPage'
import EventDetailPage from './modules/public/EventDetailPage'

import LoginPage from './modules/auth/LoginPage'
import RegisterPage from './modules/auth/RegisterPage'
import ForgotPasswordPage from './modules/auth/ForgotPasswordPage'
import ResetPasswordPage from './modules/auth/ResetPasswordPage'
import AceptarInvitacionPage from './modules/auth/AceptarInvitacionPage'

import ProfilePage from './modules/profile/ProfilePage'

import SolicitudFormPage from './modules/organizer/SolicitudFormPage'
import MisSolicitudesPage from './modules/organizer/MisSolicitudesPage'

import AdminDashboardPage from './modules/admin/AdminDashboardPage'
import SolicitudesListPage from './modules/admin/SolicitudesListPage'
import SolicitudDetailPage from './modules/admin/SolicitudDetailPage'
import EventosAdminPage from './modules/admin/EventosAdminPage'
import EventoEditPage from './modules/admin/EventoEditPage'
import CategoriasPage from './modules/admin/CategoriasPage'
import MapaHistorialPage from './modules/admin/MapaHistorialPage'
import UsuariosPage from './modules/admin/UsuariosPage'

import NegociosPage from './modules/business/NegociosPage'
import ProductosPage from './modules/business/ProductosPage'
import AyudantesPage from './modules/business/AyudantesPage'

function RootLayout() {
  return (
    <>
      <ScrollRestoration />
      <ToastHost />
      <ConfirmHost />
      <Outlet />
    </>
  )
}

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      {
        element: <PublicLayout />,
        children: [
          { index: true, element: <HomePage /> },
          { path: 'eventos', element: <EventsPage /> },
          { path: 'eventos/:id', element: <EventDetailPage /> },
          { path: 'login', element: <LoginPage /> },
          { path: 'register', element: <RegisterPage /> },
          { path: 'forgot-password', element: <ForgotPasswordPage /> },
          { path: 'reset-password', element: <ResetPasswordPage /> },
          { path: 'activar-cuenta', element: <AceptarInvitacionPage /> },
          {
            element: <ProtectedRoute />,
            children: [{ path: 'perfil', element: <ProfilePage /> }],
          },
          {
            element: <ProtectedRoute roles={['ORGANIZADOR', 'ADMIN']} />,
            children: [
              { path: 'organizador/solicitudes', element: <MisSolicitudesPage /> },
              { path: 'organizador/nueva-solicitud', element: <SolicitudFormPage /> },
            ],
          },
        ],
      },
      {
        path: 'admin',
        element: <ProtectedRoute roles={['ADMIN']} />,
        children: [
          {
            element: <AdminLayout />,
            children: [
              { index: true, element: <AdminDashboardPage /> },
              { path: 'solicitudes', element: <SolicitudesListPage /> },
              { path: 'solicitudes/:id', element: <SolicitudDetailPage /> },
              { path: 'eventos', element: <EventosAdminPage /> },
              { path: 'eventos/:id', element: <EventoEditPage /> },
              { path: 'eventos/:id/categorias', element: <CategoriasPage /> },
              { path: 'eventos/:id/mapa', element: <MapaHistorialPage /> },
              { path: 'mapa/:solicitudId', element: <MapaHistorialPage /> },
              { path: 'usuarios', element: <UsuariosPage /> },
            ],
          },
        ],
      },
      {
        path: 'negocio',
        element: <ProtectedRoute roles={['JEFE_NEGOCIO', 'ADMIN']} />,
        children: [
          {
            element: <BusinessLayout />,
            children: [
              { index: true, element: <NegociosPage /> },
              { path: 'productos', element: <ProductosPage /> },
              { path: 'ayudantes', element: <AyudantesPage /> },
            ],
          },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  )
}
