import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CambiarPassword from './pages/CambiarPassword';
import ForgotPassword from './pages/ForgotPassword';
import Usuarios from './pages/admin/Usuarios';
import CatalogoEpp from './pages/admin/CatalogoEpp';
import NuevaSolicitud from './pages/operador/NuevaSolicitud';
import MisSolicitudes from './pages/operador/MisSolicitudes';
import Pendientes from './pages/autorizador/Pendientes';
import RevisionSolicitud from './pages/autorizador/RevisionSolicitud';
import PendientesEntrega from './pages/bodega/PendientesEntrega';
import RegistrarEntrega from './pages/bodega/RegistrarEntrega';

const Placeholder = ({ title }) => (
  <div className="p-8 text-center text-gray-500">
    <h2 className="text-2xl font-bold text-ht-navy mb-2">{title}</h2>
    <p>En construcción</p>
  </div>
);

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/cambiar-password" element={
            <ProtectedRoute><CambiarPassword /></ProtectedRoute>
          } />
          <Route path="/" element={
            <ProtectedRoute><Layout /></ProtectedRoute>
          }>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="catalogo" element={<ProtectedRoute roles={['administrador']}><CatalogoEpp /></ProtectedRoute>} />
            <Route path="solicitudes" element={<MisSolicitudes />} />
            <Route path="solicitudes/nueva" element={<ProtectedRoute roles={['operador','autorizador','administrador']}><NuevaSolicitud /></ProtectedRoute>} />
            <Route path="solicitudes/pendientes" element={<ProtectedRoute roles={['autorizador','administrador']}><Pendientes /></ProtectedRoute>} />
            <Route path="solicitudes/:id" element={<RevisionSolicitud />} />
            <Route path="entregas/pendientes" element={<ProtectedRoute roles={['bodega','administrador']}><PendientesEntrega /></ProtectedRoute>} />
            <Route path="entregas/:id" element={<ProtectedRoute roles={['bodega','administrador']}><RegistrarEntrega /></ProtectedRoute>} />
            <Route path="asignaciones" element={<Placeholder title="Asignaciones" />} />
            <Route path="devoluciones/nueva" element={<Placeholder title="Registrar Devolución" />} />
            <Route path="stock" element={<Placeholder title="Estado de Stock" />} />
            <Route path="stock/ingreso" element={<Placeholder title="Ingreso de Stock" />} />
            <Route path="reportes" element={<Placeholder title="Reportes" />} />
            <Route path="documentacion" element={<Placeholder title="Documentación EPP" />} />
            <Route path="usuarios" element={<ProtectedRoute roles={['administrador']}><Usuarios /></ProtectedRoute>} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
