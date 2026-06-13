import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CambiarPassword from './pages/CambiarPassword';
import ForgotPassword from './pages/ForgotPassword';

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
            <Route path="catalogo" element={<Placeholder title="Catálogo EPP" />} />
            <Route path="solicitudes" element={<Placeholder title="Solicitudes" />} />
            <Route path="solicitudes/nueva" element={<Placeholder title="Nueva Solicitud" />} />
            <Route path="solicitudes/pendientes" element={<Placeholder title="Pendientes de Autorización" />} />
            <Route path="solicitudes/:id" element={<Placeholder title="Detalle Solicitud" />} />
            <Route path="entregas/pendientes" element={<Placeholder title="Pendientes de Entrega" />} />
            <Route path="entregas/:id" element={<Placeholder title="Registrar Entrega" />} />
            <Route path="asignaciones" element={<Placeholder title="Asignaciones" />} />
            <Route path="devoluciones/nueva" element={<Placeholder title="Registrar Devolución" />} />
            <Route path="stock" element={<Placeholder title="Estado de Stock" />} />
            <Route path="stock/ingreso" element={<Placeholder title="Ingreso de Stock" />} />
            <Route path="reportes" element={<Placeholder title="Reportes" />} />
            <Route path="documentacion" element={<Placeholder title="Documentación EPP" />} />
            <Route path="usuarios" element={<Placeholder title="Usuarios" />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
