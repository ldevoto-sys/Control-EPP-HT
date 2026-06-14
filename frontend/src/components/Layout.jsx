import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const menuByRole = {
  administrador: [
    { label: 'Dashboard', to: '/dashboard' },
    { label: 'Catálogo EPP', to: '/catalogo' },
    { label: 'Solicitudes', to: '/solicitudes' },
    { label: 'Entregas', to: '/entregas/pendientes' },
    { label: 'Entrega Directa', to: '/entregas/directa' },
    { label: 'Asignaciones', to: '/asignaciones' },
    { label: 'Devoluciones', to: '/devoluciones/nueva' },
    { label: 'Stock', to: '/stock' },
    { label: 'Reportes', to: '/reportes' },
    { label: 'Usuarios', to: '/usuarios' },
  ],
  operador: [
    { label: 'Dashboard', to: '/dashboard' },
    { label: 'Nueva Solicitud', to: '/solicitudes/nueva' },
    { label: 'Mis Solicitudes', to: '/solicitudes' },
  ],
  autorizador: [
    { label: 'Dashboard', to: '/dashboard' },
    { label: 'Pendientes', to: '/solicitudes/pendientes' },
    { label: 'Todas las Solicitudes', to: '/solicitudes' },
    { label: 'Entrega Directa', to: '/entregas/directa' },
  ],
  bodega: [
    { label: 'Dashboard', to: '/dashboard' },
    { label: 'Pendientes de Entrega', to: '/entregas/pendientes' },
    { label: 'Entrega Directa', to: '/entregas/directa' },
    { label: 'Registrar Devolución', to: '/devoluciones/nueva' },
    { label: 'Estado de Stock', to: '/stock' },
    { label: 'Ingreso de Stock', to: '/stock/ingreso' },
  ],
  consulta: [
    { label: 'Dashboard', to: '/dashboard' },
    { label: 'Buscar Trabajador', to: '/asignaciones' },
    { label: 'Documentación EPP', to: '/documentacion' },
    { label: 'Reportes', to: '/reportes' },
  ],
};

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const menu = menuByRole[user?.rol] || [];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 bg-ht-navy flex flex-col">
        <div className="px-5 py-4 border-b border-white/10">
          <span className="text-white font-bold text-base">HidroTecnica</span>
          <span className="text-ht-cyan font-semibold text-sm ml-1">| EPP</span>
        </div>
        <nav className="flex-1 overflow-y-auto py-2">
          {menu.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/dashboard'}
              className={({ isActive }) =>
                `block px-5 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-ht-cyan text-white'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-4">
            <img src="/Hidrotecnica.jpg" alt="HidroTecnica" className="h-8 object-contain" />
            <span className="text-ht-navy font-semibold text-sm">
              {user?.nombre || user?.email}
              <span className="ml-2 text-xs text-gray-400 font-normal capitalize">({user?.rol})</span>
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-ht-navy transition-colors px-3 py-1 border border-gray-200 rounded hover:border-ht-navy"
          >
            Cerrar sesión
          </button>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto bg-slate-50 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
