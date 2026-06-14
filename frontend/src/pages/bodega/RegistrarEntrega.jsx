import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api';

export default function RegistrarEntrega() {
  const { id: solicitudId } = useParams();
  const navigate = useNavigate();

  const [solicitud, setSolicitud] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [entregaId, setEntregaId] = useState(null);

  // Campos del formulario
  const hoy = new Date().toISOString().split('T')[0];
  const [fechaEntrega, setFechaEntrega] = useState(hoy);
  const [observacion, setObservacion] = useState('');
  const [foto, setFoto] = useState(null);
  const [fotoPreview, setFotoPreview] = useState('');
  const [items, setItems] = useState([]);
  const [certificados, setCertificados] = useState([]);

  const fotoRef = useRef();

  useEffect(() => {
    api.get(`/solicitudes/${solicitudId}`)
      .then(r => {
        setSolicitud(r.data);
        const its = (r.data.items || []).map(it => ({
          epp_id: it.epp_id || it.epp?.id,
          epp_nombre: it.epp_nombre || it.epp?.nombre || '—',
          cantidad: it.cantidad,
          numero_serie: '',
        }));
        setItems(its);
        setCertificados(its.map(() => null));
      })
      .catch(() => setError('No se pudo cargar la solicitud.'))
      .finally(() => setLoading(false));
  }, [solicitudId]);

  const handleFoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFoto(file);
    setFotoPreview(URL.createObjectURL(file));
  };

  const handleNumSerie = (idx, val) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, numero_serie: val } : it));
  };

  const handleCertificado = (idx, file) => {
    setCertificados(prev => prev.map((c, i) => i === idx ? file : c));
  };

  const handleSubmit = async () => {
    if (!fechaEntrega) { setError('La fecha de entrega es obligatoria.'); return; }
    setSubmitting(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('solicitud_id', solicitudId);
      formData.append('fecha_entrega', fechaEntrega);
      formData.append('observacion', observacion);
      if (foto) formData.append('foto', foto);
      formData.append('items', JSON.stringify(
        items.map(it => ({ epp_id: it.epp_id, cantidad: it.cantidad, numero_serie: it.numero_serie }))
      ));
      certificados.forEach((cert, i) => {
        if (cert) formData.append(`certificado_${i}`, cert);
      });

      const res = await api.post('/entregas', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setEntregaId(res.data?.id || res.data?.entrega_id || null);
      setSuccess('Entrega registrada correctamente.');
    } catch (e) {
      setError(e.response?.data?.message || 'Error al registrar la entrega.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDescargarPDF = async () => {
    try {
      const res = await api.get(`/reports/entrega/${entregaId}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `entrega_${entregaId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('No se pudo descargar el PDF.');
    }
  };

  if (loading) return <div className="text-gray-400 text-sm p-8">Cargando...</div>;
  if (!solicitud && error) return <div className="p-8 text-red-600">{error}</div>;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-ht-navy text-sm">← Volver</button>
        <h1 className="text-2xl font-bold text-ht-navy">Registrar Entrega — Solicitud #{solicitudId}</h1>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-300 text-red-700 rounded text-sm">{error}</div>
      )}

      {success ? (
        <div className="bg-white rounded-xl shadow p-8 text-center space-y-4">
          <div className="text-green-600 font-semibold text-lg">{success}</div>
          <div className="flex justify-center gap-4">
            {entregaId && (
              <button
                onClick={handleDescargarPDF}
                className="bg-ht-navy text-white px-5 py-2 rounded-lg hover:bg-ht-navy/90 font-medium text-sm"
              >
                Descargar PDF de entrega
              </button>
            )}
            <button
              onClick={() => navigate('/entregas/pendientes')}
              className="border border-gray-300 text-gray-600 px-5 py-2 rounded-lg hover:bg-gray-50 font-medium text-sm"
            >
              Volver a entregas pendientes
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Datos generales */}
          <div className="bg-white rounded-xl shadow p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Datos de la entrega</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Trabajador
                </label>
                <p className="text-ht-navy font-semibold">
                  {solicitud?.trabajador_nombre || solicitud?.trabajador?.nombre || '—'}
                  {(solicitud?.trabajador_rut || solicitud?.trabajador?.rut) && (
                    <span className="text-gray-500 font-normal text-sm ml-2">
                      {solicitud?.trabajador_rut || solicitud?.trabajador?.rut}
                    </span>
                  )}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha de entrega <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={fechaEntrega}
                  onChange={e => setFechaEntrega(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ht-cyan"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Observación general</label>
              <textarea
                value={observacion}
                onChange={e => setObservacion(e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ht-cyan"
                placeholder="Observaciones opcionales sobre la entrega..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Foto de entrega</label>
              <input
                ref={fotoRef}
                type="file"
                accept="image/*"
                onChange={handleFoto}
                className="block text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-ht-cyan/10 file:text-ht-navy hover:file:bg-ht-cyan/20"
              />
              {fotoPreview && (
                <img
                  src={fotoPreview}
                  alt="Vista previa foto entrega"
                  className="mt-2 h-28 w-auto rounded-lg border border-gray-200 object-cover"
                />
              )}
            </div>
          </div>

          {/* Items */}
          <div className="bg-white rounded-xl shadow p-5">
            <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-4">Items EPP</h2>
            <div className="space-y-5">
              {items.map((item, idx) => (
                <div key={idx} className="border border-gray-100 rounded-lg p-4 bg-gray-50">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="font-semibold text-ht-navy text-sm">{item.epp_nombre}</span>
                    <span className="text-gray-500 text-sm">— Cantidad: {item.cantidad}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Número de serie (opcional)</label>
                      <input
                        type="text"
                        value={item.numero_serie}
                        onChange={e => handleNumSerie(idx, e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ht-cyan"
                        placeholder="Ej: SN-20240001"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Certificado de este lote (PDF, opcional)
                      </label>
                      <input
                        type="file"
                        accept="application/pdf"
                        onChange={e => handleCertificado(idx, e.target.files[0] || null)}
                        className="block text-xs text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-medium file:bg-ht-cyan/10 file:text-ht-navy hover:file:bg-ht-cyan/20"
                      />
                      {certificados[idx] && (
                        <p className="text-xs text-green-600 mt-0.5">{certificados[idx].name}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Confirmar */}
          <div className="flex justify-end gap-3 pb-6">
            <button
              onClick={() => navigate(-1)}
              className="border border-gray-300 text-gray-600 px-5 py-2 rounded-lg hover:bg-gray-50 font-medium text-sm"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-ht-cyan text-white px-6 py-2 rounded-lg hover:bg-ht-cyan/90 disabled:opacity-60 font-medium text-sm"
            >
              {submitting ? 'Registrando...' : 'Confirmar entrega'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
