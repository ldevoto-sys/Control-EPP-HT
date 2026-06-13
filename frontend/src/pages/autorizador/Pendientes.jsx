import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';

export default function Pendientes() {
  const navigate = useNavigate();
  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/solicitudes/pendientes')
      .then(r => setSolicitudes(r.data))
      .catch(() => setError('No se pudieron cargar las solicitudes pendientes.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-ht-navy mb-6">Solicitudes Pendientes de Autorización</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-300 text-red-700 rounded text-sm">{error}</div>
      )}

      {loading ? (
        <div className="text-gray-400 text-sm">Cargando...</div>
      ) : solicitudes.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg font-medium">No hay solicitudes pendientes</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ht-navy text-white">
              <tr>
                <th className="text-left px-4 py-3">N°</th>
                <th className="text-left px-4 py-3">Solicitante</th>
                <th className="text-left px-4 py-3">Trabajador</th>
                <th className="text-left px-4 py-3">Fecha</th>
                <th className="text-center px-4 py-3">Items</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {solicitudes.map((s, idx) => (
                <tr key={s.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-4 py-3 font-medium text-ht-navy">#{s.id}</td>
                  <td className="px-4 py-3">{s.solicitante_nombre || s.solicitante?.nombre || '—'}</td>
                  <td className="px-4 py-3">{s.trabajador_nombre || s.trabajador?.nombre || '—'}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {s.fecha_solicitud
                      ? new Date(s.fecha_solicitud).toLocaleDateString('es-CL')
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="bg-ht-cyan/20 text-ht-navy font-semibold px-2 py-0.5 rounded-full text-xs">
                      {s.items_count ?? s.items?.length ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => navigate(`/solicitudes/${s.id}`)}
                      className="bg-ht-cyan text-white px-3 py-1 rounded-lg hover:bg-ht-cyan/90 text-xs font-medium"
                    >
                      Revisar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
