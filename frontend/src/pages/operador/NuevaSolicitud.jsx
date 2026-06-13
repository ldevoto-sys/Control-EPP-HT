import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import { useAuth } from '../../contexts/AuthContext';

const MOTIVOS = [
  { value: 'primera_entrega', label: 'Primera entrega' },
  { value: 'reemplazo_deterioro', label: 'Reemplazo por deterioro' },
  { value: 'reemplazo_perdida', label: 'Reemplazo por pérdida' },
  { value: 'cambio_talla', label: 'Cambio de talla' },
];

function StepIndicator({ current }) {
  const steps = ['Trabajador', 'Items EPP', 'Resumen'];
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {steps.map((label, i) => {
        const step = i + 1;
        const active = step === current;
        const done = step < current;
        return (
          <div key={step} className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors
                  ${active ? 'bg-ht-cyan border-ht-cyan text-white' : done ? 'bg-ht-navy border-ht-navy text-white' : 'border-gray-300 text-gray-400'}`}
              >
                {done ? '✓' : step}
              </div>
              <span className={`text-sm font-medium ${active ? 'text-ht-cyan' : done ? 'text-ht-navy' : 'text-gray-400'}`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`w-8 h-0.5 ${step < current ? 'bg-ht-navy' : 'bg-gray-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function NuevaSolicitud() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(1);

  // Step 1
  const [trabajadores, setTrabajadores] = useState([]);
  const [trabajadorId, setTrabajadorId] = useState('');
  const [paramiMismo, setParaMiMismo] = useState(false);
  const [loadingTrab, setLoadingTrab] = useState(true);

  // Step 2
  const [eppDisponibles, setEppDisponibles] = useState([]);
  const [items, setItems] = useState([{ epp_id: '', cantidad: 1, motivo: '' }]);
  const [loadingEpp, setLoadingEpp] = useState(false);

  // Submit
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/users/trabajadores')
      .then(r => setTrabajadores(r.data))
      .catch(() => setError('No se pudo cargar la lista de trabajadores.'))
      .finally(() => setLoadingTrab(false));
  }, []);

  useEffect(() => {
    if (step === 2 && eppDisponibles.length === 0) {
      setLoadingEpp(true);
      api.get('/epp/activos')
        .then(r => setEppDisponibles(r.data))
        .catch(() => setError('No se pudo cargar el catálogo de EPP.'))
        .finally(() => setLoadingEpp(false));
    }
  }, [step]);

  // Step 1 handlers
  const handleParaMiMismo = () => {
    setParaMiMismo(true);
    setTrabajadorId(String(user.id));
  };

  const handleSelectTrabajador = (val) => {
    setTrabajadorId(val);
    setParaMiMismo(false);
  };

  const validStep1 = () => !!trabajadorId;

  // Step 2 handlers
  const addItem = () => setItems(prev => [...prev, { epp_id: '', cantidad: 1, motivo: '' }]);

  const updateItem = (index, field, value) => {
    setItems(prev => prev.map((it, i) => i === index ? { ...it, [field]: value } : it));
  };

  const removeItem = (index) => setItems(prev => prev.filter((_, i) => i !== index));

  const validStep2 = () => {
    if (items.length === 0) return false;
    const eppIds = items.map(it => it.epp_id).filter(Boolean);
    const uniqueIds = new Set(eppIds);
    if (uniqueIds.size !== eppIds.length) return false;
    return items.every(it => it.epp_id && it.cantidad >= 1 && it.motivo);
  };

  const duplicatedEppIds = () => {
    const ids = items.map(it => it.epp_id).filter(Boolean);
    const seen = new Set();
    const dups = new Set();
    ids.forEach(id => { if (seen.has(id)) dups.add(id); else seen.add(id); });
    return dups;
  };

  // Submit
  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      await api.post('/solicitudes', {
        trabajador_id: trabajadorId,
        items: items.map(it => ({ epp_id: it.epp_id, cantidad: Number(it.cantidad), motivo: it.motivo })),
      });
      navigate('/solicitudes', { state: { success: 'Solicitud enviada correctamente.' } });
    } catch (e) {
      setError(e.response?.data?.message || 'Error al enviar la solicitud.');
    } finally {
      setSubmitting(false);
    }
  };

  // Helpers para resumen
  const trabajadorSeleccionado = trabajadores.find(t => String(t.id) === String(trabajadorId));
  const dups = duplicatedEppIds();

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-ht-navy mb-6">Nueva Solicitud de EPP</h1>
      <StepIndicator current={step} />

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-300 text-red-700 rounded text-sm">{error}</div>
      )}

      {/* PASO 1 */}
      {step === 1 && (
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold text-ht-navy mb-4">Seleccionar trabajador</h2>
          <button
            onClick={handleParaMiMismo}
            className={`w-full mb-4 py-2 px-4 rounded-lg border-2 text-left transition-colors font-medium
              ${paramiMismo ? 'border-ht-cyan bg-ht-cyan/10 text-ht-navy' : 'border-gray-200 hover:border-ht-cyan text-gray-700'}`}
          >
            Para mí mismo ({user?.nombre || user?.email})
          </button>
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">O seleccionar otro trabajador</label>
            {loadingTrab ? (
              <div className="text-sm text-gray-400">Cargando trabajadores...</div>
            ) : (
              <select
                value={paramiMismo ? '' : trabajadorId}
                onChange={e => handleSelectTrabajador(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ht-cyan"
              >
                <option value="">-- Seleccione un trabajador --</option>
                {trabajadores.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.nombre} — {t.rut}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="flex justify-end mt-6">
            <button
              onClick={() => { setError(''); setStep(2); }}
              disabled={!validStep1()}
              className="bg-ht-navy text-white px-6 py-2 rounded-lg hover:bg-ht-navy/90 disabled:opacity-40 disabled:cursor-not-allowed font-medium"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      {/* PASO 2 */}
      {step === 2 && (
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold text-ht-navy mb-4">Items EPP</h2>
          {loadingEpp ? (
            <div className="text-sm text-gray-400 mb-4">Cargando catálogo EPP...</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b">
                      <th className="pb-2 pr-2">EPP</th>
                      <th className="pb-2 pr-2 w-20">Cantidad</th>
                      <th className="pb-2 pr-2">Motivo</th>
                      <th className="pb-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => {
                      const isDup = item.epp_id && dups.has(item.epp_id);
                      return (
                        <tr key={idx} className="border-b last:border-0">
                          <td className="py-2 pr-2">
                            <select
                              value={item.epp_id}
                              onChange={e => updateItem(idx, 'epp_id', e.target.value)}
                              className={`w-full border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-ht-cyan ${isDup ? 'border-red-400' : 'border-gray-300'}`}
                            >
                              <option value="">-- EPP --</option>
                              {eppDisponibles.map(e => (
                                <option key={e.id} value={e.id}>
                                  {e.nombre} ({e.categoria}) — Stock: {e.stock_disponible ?? '—'}
                                </option>
                              ))}
                            </select>
                            {isDup && <p className="text-red-500 text-xs mt-0.5">EPP duplicado</p>}
                          </td>
                          <td className="py-2 pr-2">
                            <input
                              type="number"
                              min={1}
                              value={item.cantidad}
                              onChange={e => updateItem(idx, 'cantidad', Math.max(1, Number(e.target.value)))}
                              className="w-full border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-ht-cyan"
                            />
                          </td>
                          <td className="py-2 pr-2">
                            <select
                              value={item.motivo}
                              onChange={e => updateItem(idx, 'motivo', e.target.value)}
                              className="w-full border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-ht-cyan"
                            >
                              <option value="">-- Motivo --</option>
                              {MOTIVOS.map(m => (
                                <option key={m.value} value={m.value}>{m.label}</option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2 text-center">
                            <button
                              onClick={() => removeItem(idx)}
                              className="text-red-400 hover:text-red-600 font-bold text-lg leading-none"
                              title="Eliminar"
                            >
                              ×
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <button
                onClick={addItem}
                className="mt-3 text-ht-cyan hover:text-ht-cyan/80 text-sm font-medium flex items-center gap-1"
              >
                + Agregar ítem
              </button>
            </>
          )}
          <div className="flex justify-between mt-6">
            <button onClick={() => setStep(1)} className="text-gray-500 hover:text-ht-navy px-4 py-2 rounded-lg border border-gray-300 font-medium">
              Anterior
            </button>
            <button
              onClick={() => { setError(''); setStep(3); }}
              disabled={!validStep2()}
              className="bg-ht-navy text-white px-6 py-2 rounded-lg hover:bg-ht-navy/90 disabled:opacity-40 disabled:cursor-not-allowed font-medium"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      {/* PASO 3 */}
      {step === 3 && (
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold text-ht-navy mb-4">Resumen</h2>
          <div className="mb-4 p-3 bg-gray-50 rounded-lg text-sm">
            <span className="font-medium text-gray-600">Trabajador: </span>
            <span className="text-ht-navy font-semibold">
              {paramiMismo
                ? `${user?.nombre || user?.email} (yo mismo)`
                : trabajadorSeleccionado
                  ? `${trabajadorSeleccionado.nombre} — ${trabajadorSeleccionado.rut}`
                  : '—'}
            </span>
          </div>
          <table className="w-full text-sm border rounded-lg overflow-hidden">
            <thead className="bg-ht-navy text-white">
              <tr>
                <th className="text-left px-3 py-2">EPP</th>
                <th className="px-3 py-2 text-center">Cantidad</th>
                <th className="px-3 py-2">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => {
                const epp = eppDisponibles.find(e => String(e.id) === String(item.epp_id));
                const motivo = MOTIVOS.find(m => m.value === item.motivo);
                return (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-3 py-2">{epp ? `${epp.nombre} (${epp.categoria})` : '—'}</td>
                    <td className="px-3 py-2 text-center">{item.cantidad}</td>
                    <td className="px-3 py-2">{motivo?.label || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="flex justify-between mt-6">
            <button onClick={() => setStep(2)} className="text-gray-500 hover:text-ht-navy px-4 py-2 rounded-lg border border-gray-300 font-medium">
              Anterior
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-ht-cyan text-white px-6 py-2 rounded-lg hover:bg-ht-cyan/90 disabled:opacity-60 font-medium"
            >
              {submitting ? 'Enviando...' : 'Enviar solicitud'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
