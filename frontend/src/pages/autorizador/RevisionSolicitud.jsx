import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api';
import { useAuth } from '../../contexts/AuthContext';

const ESTADO_BADGE = {
  pendiente: 'bg-yellow-100 text-yellow-800',
  aprobada:  'bg-green-100 text-green-800',
  rechazada: 'bg-red-100 text-red-800',
  entregada: 'bg-ht-navy text-white',
  anulada:   'bg-gray-100 text-gray-600',
};

const ESTADO_LABEL = {
  pendiente: 'Pendiente',
  aprobada:  'Aprobada',
  rechazada: 'Rechazada',
  entregada: 'Entregada',
  anulada:   'Anulada',
};

export default function RevisionSolicitud() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [solicitud, setSolicitud] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [comentario, setComentario] = useState('');
  const [actionLoading, setActionLoading] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [rSol, rHist] = await Promise.all([
        api.get(`/solicitudes/${id}`),
        api.get(`/solicitudes/${id}/historial`),
      ]);
      setSolicitud(rSol.data);
      setHistorial(rHist.data);
    } catch {
      setError('No se pudo cargar la solicitud.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [id]);

  const handleAprobar = async () => {
    setActionLoading('aprobar');
    setError('');
    try {
      await api.post(`/solicitudes/${id}/aprobar`);
      setSuccess('Solicitud aprobada correctamente.');
      fetchData();
    } catch (e) {
      setError(e.response?.data?.message || 'Error al aprobar la solicitud.');
    } finally {
      setActionLoading('');
    }
  };

  const handleRechazar = async () => {
    if (!comentario.trim()) { setError('El comentario es obligatorio para rechazar.'); return; }
    setActionLoading('rechazar');
    setError('');
    try {
      await api.post(`/solicitudes/${id}/rechazar`, { comentario });
      setSuccess('Solicitud rechazada.');
      setComentario('');
      fetchData();
    } catch (e) {
      setError(e.response?.data?.message || 'Error al rechazar la solicitud.');
    } finally {
      setActionLoading('');
    }
  };

  const handleAnular = async () => {
    if (!window.confirm('¿Seguro que desea anular esta solicitud?')) return;
    setActionLoading('anular');
    setError('');
    try {
      await api.post(`/solicitudes/${id}/anular`);
      setSuccess('Solicitud anulada.');
      fetchData();
    } catch (e) {
      setError(e.response?.data?.message || 'Error al anular la solicitud.');
    } finally {
      setActionLoading('');
    }
  };

  if (loading) return <div className="text-gray-400 text-sm p-8">Cargando...</div>;
  if (!solicitud && error) return <div className="p-8 text-red-600">{error}</div>;

  const esPendiente = solicitud?.estado === 'pendiente';
  const esPropiaSolicitud = String(user?.id) === String(solicitud?.solicitante_id);
  const esAdmin = user?.rol === 'administrador';
  const puedeResolver = esPendiente && !esPropiaSolicitud;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-ht-navy text-sm">← Volver</button>
        <h1 className="text-2xl font-bold text-ht-navy">Solicitud #{solicitud?.id}</h1>
        {solicitud?.estado && (
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ESTADO_BADGE[solicitud.estado] || 'bg-gray-100 text-gray-600'}`}>
            {ESTADO_LABEL[solicitud.estado] || solicitud.estado}
          </span>
        )}
      </div>

      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-300 text-green-700 rounded text-sm">{success}</div>
      )}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-300 text-red-700 rounded text-sm">{error}</div>
      )}

      {/* Datos */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Solicitante</p>
          <p className="font-semibold text-ht-navy">{solicitud?.solicitante_nombre || solicitud?.solicitante?.nombre || '—'}</p>
          <p className="text-sm text-gray-500">{solicitud?.solicitante_email || solicitud?.solicitante?.email || ''}</p>
        </div>
        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Trabajador</p>
          <p className="font-semibold text-ht-navy">{solicitud?.trabajador_nombre || solicitud?.trabajador?.nombre || '—'}</p>
          <p className="text-sm text-gray-500">{solicitud?.trabajador_rut || solicitud?.trabajador?.rut || ''}</p>
        </div>
      </div>

      {/* Tabla EPP */}
      <div className="bg-white rounded-xl shadow p-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">EPP Solicitados</h2>
        <table className="w-full text-sm">
          <thead className="bg-ht-navy text-white">
            <tr>
              <th className="text-left px-3 py-2">EPP</th>
              <th className="text-center px-3 py-2">Cantidad</th>
              <th className="text-left px-3 py-2">Motivo</th>
              <th className="text-center px-3 py-2">Stock disp.</th>
            </tr>
          </thead>
          <tbody>
            {(solicitud?.items || []).map((item, idx) => (
              <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-3 py-2">{item.epp_nombre || item.epp?.nombre || '—'}</td>
                <td className="px-3 py-2 text-center">{item.cantidad}</td>
                <td className="px-3 py-2 text-gray-600">{item.motivo}</td>
                <td className="px-3 py-2 text-center">{item.stock_disponible ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Acciones */}
      {puedeResolver && (
        <div className="bg-white rounded-xl shadow p-4 mb-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Resolución</h2>
          <button
            onClick={handleAprobar}
            disabled={!!actionLoading}
            className="bg-green-600 text-white px-5 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium text-sm"
          >
            {actionLoading === 'aprobar' ? 'Aprobando...' : 'Aprobar'}
          </button>
          <div className="border-t pt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Comentario para rechazar <span className="text-red-500">*</span></label>
            <textarea
              value={comentario}
              onChange={e => setComentario(e.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ht-cyan"
              placeholder="Indique el motivo del rechazo..."
            />
            <button
              onClick={handleRechazar}
              disabled={!!actionLoading}
              className="mt-2 bg-red-600 text-white px-5 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 font-medium text-sm"
            >
              {actionLoading === 'rechazar' ? 'Rechazando...' : 'Rechazar'}
            </button>
          </div>
        </div>
      )}

      {esAdmin && solicitud?.estado !== 'anulada' && (
        <div className="mb-6">
          <button
            onClick={handleAnular}
            disabled={!!actionLoading}
            className="border border-gray-400 text-gray-600 hover:bg-gray-100 px-5 py-2 rounded-lg disabled:opacity-50 font-medium text-sm"
          >
            {actionLoading === 'anular' ? 'Anulando...' : 'Anular solicitud'}
          </button>
        </div>
      )}

      {/* Historial */}
      <div className="bg-white rounded-xl shadow p-4">
        <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">Historial de estados</h2>
        {historial.length === 0 ? (
          <p className="text-gray-400 text-sm">Sin registros.</p>
        ) : (
          <ol className="relative border-l border-gray-200 pl-4 space-y-4">
            {historial.map((h, idx) => (
              <li key={idx} className="relative">
                <div className="absolute -left-2 top-1 w-3 h-3 rounded-full bg-ht-cyan border-2 border-white" />
                <p className="text-xs text-gray-400">
                  {h.fecha ? new Date(h.fecha).toLocaleString('es-CL') : '—'}
                </p>
                <p className="text-sm font-medium text-ht-navy">{ESTADO_LABEL[h.estado] || h.estado}</p>
                {h.comentario && <p className="text-sm text-gray-500">{h.comentario}</p>}
                {h.usuario_nombre && <p className="text-xs text-gray-400">por {h.usuario_nombre}</p>}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
