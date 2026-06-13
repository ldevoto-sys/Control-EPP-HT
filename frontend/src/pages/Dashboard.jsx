import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../api';

function StatCard({ label, value, icon, color = 'text-ht-navy', onClick }) {
  return (
    <div
      className={`bg-white rounded-xl shadow-sm p-6 flex items-center gap-4 ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
      onClick={onClick}
    >
      <span className="text-3xl">{icon}</span>
      <div>
        <p className={`text-3xl font-bold ${color}`}>{value ?? '—'}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        if (user?.rol === 'administrador' || user?.rol === 'bodega') {
          const [stockCritico, solicPend, entregasPend, vencimientos] = await Promise.allSettled([
            api.get('/reports/stock-critico'),
            api.get('/solicitudes/pendientes'),
            api.get('/entregas/pendientes'),
            api.get('/reports/vencimientos'),
          ]);
          setData({
            stockCritico: stockCritico.value?.data?.total ?? stockCritico.value?.data?.length ?? 0,
            solicPend: solicPend.value?.data?.total ?? solicPend.value?.data?.length ?? 0,
            entregasPend: entregasPend.value?.data?.total ?? entregasPend.value?.data?.length ?? 0,
            vencimientos: vencimientos.value?.data?.total ?? vencimientos.value?.data?.length ?? 0,
          });
        } else if (user?.rol === 'autorizador') {
          const res = await api.get('/solicitudes/pendientes').catch(() => ({ data: [] }));
          setData({ solicPend: res.data?.total ?? res.data?.length ?? 0 });
        } else if (user?.rol === 'operador') {
          const res = await api.get('/solicitudes').catch(() => ({ data: [] }));
          const activas = Array.isArray(res.data)
            ? res.data.filter(s => ['pendiente', 'aprobada'].includes(s.estado)).length
            : 0;
          setData({ activas });
        }
      } catch {}
      setLoading(false);
    };
    fetchData();
  }, [user]);

  if (loading) return <div className="text-gray-400 text-sm">Cargando...</div>;

  const rol = user?.rol;

  if (rol === 'administrador' || rol === 'bodega') {
    return (
      <div>
        <h1 className="text-2xl font-bold text-ht-navy mb-6">Dashboard</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Stock Crítico" value={data.stockCritico} icon="⚠️" color="text-red-600" onClick={() => navigate('/stock')} />
          <StatCard label="Solicitudes Pendientes" value={data.solicPend} icon="📋" onClick={() => navigate('/solicitudes/pendientes')} />
          <StatCard label="Pendientes de Entrega" value={data.entregasPend} icon="📦" onClick={() => navigate('/entregas/pendientes')} />
          <StatCard label="EPP Por Vencer" value={data.vencimientos} icon="🕐" color="text-amber-600" onClick={() => navigate('/reportes')} />
        </div>
      </div>
    );
  }

  if (rol === 'autorizador') {
    return (
      <div>
        <h1 className="text-2xl font-bold text-ht-navy mb-6">Dashboard</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
          <StatCard label="Solicitudes pendientes de autorización" value={data.solicPend} icon="📋" onClick={() => navigate('/solicitudes/pendientes')} />
        </div>
      </div>
    );
  }

  if (rol === 'operador') {
    return (
      <div>
        <h1 className="text-2xl font-bold text-ht-navy mb-6">Dashboard</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
          <StatCard label="Mis solicitudes activas" value={data.activas} icon="📋" onClick={() => navigate('/solicitudes')} />
        </div>
      </div>
    );
  }

  if (rol === 'consulta') {
    return (
      <div>
        <h1 className="text-2xl font-bold text-ht-navy mb-6">Dashboard</h1>
        <div className="bg-white rounded-xl shadow-sm p-6 max-w-md">
          <p className="text-sm font-medium text-gray-700 mb-2">Buscar trabajador</p>
          <div className="flex gap-2">
            <input
              className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ht-cyan"
              placeholder="Nombre o RUT..."
              onKeyDown={e => {
                if (e.key === 'Enter') navigate(`/asignaciones?q=${encodeURIComponent(e.target.value)}`);
              }}
            />
            <button
              className="bg-ht-navy text-white px-4 py-2 rounded text-sm hover:bg-ht-navy/90"
              onClick={e => {
                const input = e.target.previousSibling;
                navigate(`/asignaciones?q=${encodeURIComponent(input.value)}`);
              }}
            >Buscar</button>
          </div>
        </div>
      </div>
    );
  }

  return <div className="text-gray-400 text-sm">Sin contenido para este rol.</div>;
}
