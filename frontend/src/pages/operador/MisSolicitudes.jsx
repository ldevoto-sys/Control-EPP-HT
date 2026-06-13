import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../../api';

const ESTADO_BADGE = {
  pendiente:  'bg-yellow-100 text-yellow-800',
  aprobada:   'bg-green-100 text-green-800',
  rechazada:  'bg-red-100 text-red-800',
  entregada:  'bg-ht-navy text-white',
  anulada:    'bg-gray-100 text-gray-600',
};

const ESTADO_LABEL = {
  pendiente: 'Pendiente',
  aprobada:  'Aprobada',
  rechazada: 'Rechazada',
  entregada: 'Entregada',
  anulada:   'Anulada',
};

export default function MisSolicitudes() {
  const navigate = useNavigate();
  const location = useLocation();
  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const successMsg = location.state?.success;

  useEffect(() => {
    api.get('/solicitudes')
      .then(r => setSolicitudes(r.data))
      .catch(() => setError('No se pudieron cargar las solicitudes.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-ht-navy">Mis Solicitudes</h1>
        <button
          onClick={() => navigate('/solicitudes/nueva')}
          className="bg-ht-cyan text-white px-4 py-2 rounded-lg hover:bg-ht-cyan/90 font-medium text-sm"
        >
          + Nueva Solicitud
        </button>
      </div>

      {successMsg && (
        <div className="mb-4 p-3 bg-green-50 border border-green-300 text-green-700 rounded text-sm">
          {successMsg}
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-300 text-red-700 rounded text-sm">{error}</div>
      )}

      {loading ? (
        <div className="text-gray-400 text-sm">Cargando...</div>
      ) : solicitudes.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg font-medium">No hay solicitudes registradas</p>
          <p className="text-sm mt-1">Crea tu primera solicitud usando el botón superior.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ht-navy text-white">
              <tr>
                <th className="text-left px-4 py-3">N°</th>
                <th className="text-left px-4 py-3">Trabajador</th>
                <th className="text-left px-4 py-3">Fecha</th>
                <th className="text-left px-4 py-3">Estado</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {solicitudes.map((s, idx) => (
                <tr key={s.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-4 py-3 font-medium text-ht-navy">#{s.id}</td>
                  <td className="px-4 py-3">{s.trabajador_nombre || s.trabajador?.nombre || '—'}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {s.fecha_solicitud
                      ? new Date(s.fecha_solicitud).toLocaleDateString('es-CL')
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ESTADO_BADGE[s.estado] || 'bg-gray-100 text-gray-600'}`}>
                      {ESTADO_LABEL[s.estado] || s.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => navigate(`/solicitudes/${s.id}`)}
                      className="text-ht-cyan hover:underline font-medium text-xs"
                    >
                      Ver detalle
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
