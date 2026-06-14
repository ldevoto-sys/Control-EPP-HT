import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';

let itemSeq = 0;
const nuevoItem = () => ({ uid: `item-${itemSeq++}`, epp_id: '', cantidad: 1, numero_serie: '' });

export default function EntregaDirecta() {
  const navigate = useNavigate();
  const [trabajadores, setTrabajadores] = useState([]);
  const [catalogo, setCatalogo] = useState([]);
  const [form, setForm] = useState({
    trabajador_id: '',
    fecha_entrega: new Date().toISOString().slice(0, 10),
    observacion: '',
  });
  const [items, setItems] = useState([nuevoItem()]);
  const [foto, setFoto] = useState(null);
  const [certificados, setCertificados] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/users/trabajadores').then(r => setTrabajadores(r.data)).catch(() => {});
    api.get('/epp').then(r => setCatalogo(Array.isArray(r.data) ? r.data : r.data.data ?? [])).catch(() => {});
  }, []);

  const addItem = () => setItems(prev => [...prev, nuevoItem()]);
  const removeItem = (i) => setItems(prev => {
    const removed = prev[i];
    if (removed) {
      setCertificados(c => {
        const next = { ...c };
        delete next[removed.uid];
        return next;
      });
    }
    return prev.filter((_, idx) => idx !== i);
  });

  const updateItem = (i, field, value) => {
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [field]: value } : it));
  };

  const handleCertificado = (uid, file) => {
    setCertificados(prev => ({ ...prev, [uid]: file }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.trabajador_id) { setError('Seleccione un trabajador.'); return; }
    if (items.some(it => !it.epp_id || it.cantidad < 1)) {
      setError('Complete todos los ítems de EPP.');
      return;
    }

    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('trabajador_id', form.trabajador_id);
      fd.append('fecha_entrega', form.fecha_entrega);
      fd.append('observacion', form.observacion);
      fd.append('items', JSON.stringify(items.map(it => ({
        epp_id: it.epp_id,
        cantidad: Number(it.cantidad),
        numero_serie: it.numero_serie || null,
      }))));
      if (foto) fd.append('foto', foto);
      items.forEach((it, i) => {
        if (certificados[it.uid]) fd.append(`certificado_${i}`, certificados[it.uid]);
      });

      await api.post('/entregas/directa', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      navigate('/entregas/pendientes');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al registrar entrega.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-ht-navy mb-6">Entrega Directa de EPP</h1>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-6 space-y-5">
        {/* Trabajador */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Trabajador *</label>
          <select
            required
            value={form.trabajador_id}
            onChange={e => setForm(f => ({ ...f, trabajador_id: e.target.value }))}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ht-cyan"
          >
            <option value="">Seleccionar...</option>
            {trabajadores.map(t => (
              <option key={t.id} value={t.id}>{t.nombre} — {t.rut}</option>
            ))}
          </select>
        </div>

        {/* Fecha */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de entrega *</label>
          <input
            type="date"
            required
            value={form.fecha_entrega}
            onChange={e => setForm(f => ({ ...f, fecha_entrega: e.target.value }))}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ht-cyan"
          />
        </div>

        {/* Items EPP */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">Ítems EPP *</label>
            <button
              type="button"
              onClick={addItem}
              className="text-xs text-ht-cyan hover:underline font-medium"
            >
              + Agregar ítem
            </button>
          </div>
          <div className="space-y-3">
            {items.map((item, i) => (
              <div key={item.uid} className="border border-gray-200 rounded p-3 space-y-2">
                <div className="flex gap-2">
                  <select
                    value={item.epp_id}
                    onChange={e => updateItem(i, 'epp_id', e.target.value)}
                    className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ht-cyan"
                  >
                    <option value="">Seleccionar EPP...</option>
                    {catalogo.map(e => (
                      <option key={e.id} value={e.id}>{e.nombre}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={item.cantidad}
                    onChange={e => updateItem(i, 'cantidad', e.target.value)}
                    className="w-20 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ht-cyan"
                    placeholder="Cant."
                  />
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(i)}
                      className="text-red-400 hover:text-red-600 text-lg leading-none px-1"
                    >
                      &times;
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={item.numero_serie}
                  onChange={e => updateItem(i, 'numero_serie', e.target.value)}
                  placeholder="N° de serie (opcional)"
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ht-cyan"
                />
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Certificado técnico (PDF/imagen, opcional)</label>
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    onChange={e => handleCertificado(item.uid, e.target.files[0])}
                    className="text-xs text-gray-600"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Foto entrega */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Foto de entrega (opcional)</label>
          <input
            type="file"
            accept="image/*"
            onChange={e => setFoto(e.target.files[0])}
            className="text-sm text-gray-600"
          />
        </div>

        {/* Observación */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Observación</label>
          <textarea
            value={form.observacion}
            onChange={e => setForm(f => ({ ...f, observacion: e.target.value }))}
            rows={3}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ht-cyan"
          />
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 text-sm bg-ht-navy text-white rounded hover:bg-ht-navy/90 disabled:opacity-50"
          >
            {saving ? 'Registrando...' : 'Registrar entrega'}
          </button>
        </div>
      </form>
    </div>
  );
}
