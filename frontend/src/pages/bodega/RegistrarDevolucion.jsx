import { useEffect, useState } from 'react';
import api from '../../api';

const MOTIVOS = [
  { value: 'fin_contrato', label: 'Fin de contrato' },
  { value: 'deterioro', label: 'Deterioro' },
  { value: 'cambio_talla', label: 'Cambio de talla' },
  { value: 'perdida', label: 'Pérdida' },
  { value: 'otro', label: 'Otro' },
];

export default function RegistrarDevolucion() {
  const [trabajadores, setTrabajadores] = useState([]);
  const [trabajadorId, setTrabajadorId] = useState('');
  const [asignaciones, setAsignaciones] = useState([]);
  const [eppId, setEppId] = useState('');
  const [cantidad, setCantidad] = useState(1);
  const [motivo, setMotivo] = useState('deterioro');
  const [observacion, setObservacion] = useState('');
  const [vuelveAStock, setVuelveAStock] = useState(false);
  const [fechaDevolucion, setFechaDevolucion] = useState(new Date().toISOString().split('T')[0]);
  const [foto, setFoto] = useState(null);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/users/trabajadores').then(r => setTrabajadores(r.data));
  }, []);

  const handleTrabajador = async (id) => {
    setTrabajadorId(id);
    setEppId('');
    if (!id) { setAsignaciones([]); return; }
    const r = await api.get(`/asignaciones/trabajador/${id}`);
    setAsignaciones(r.data.asignaciones || []);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!trabajadorId || !eppId || !motivo) return setError('Completa todos los campos requeridos');
    try {
      const fd = new FormData();
      fd.append('trabajador_id', trabajadorId);
      fd.append('epp_id', eppId);
      fd.append('cantidad', cantidad);
      fd.append('motivo', motivo);
      fd.append('observacion', observacion);
      fd.append('vuelve_a_stock', vuelveAStock ? 1 : 0);
      fd.append('fecha_devolucion', fechaDevolucion);
      if (foto) fd.append('foto', foto);
      await api.post('/devoluciones', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setSuccess('Devolución registrada correctamente');
      setTrabajadorId(''); setEppId(''); setAsignaciones([]);
      setCantidad(1); setObservacion(''); setFoto(null); setVuelveAStock(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al registrar devolución');
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-ht-navy mb-6">Registrar Devolución</h1>
      <div className="bg-white rounded-lg shadow p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Trabajador</label>
            <select value={trabajadorId} onChange={e => handleTrabajador(e.target.value)}
              className="w-full border rounded px-3 py-2" required>
              <option value="">Seleccionar trabajador...</option>
              {trabajadores.map(t => (
                <option key={t.id} value={t.id}>{t.nombre} — {t.rut}</option>
              ))}
            </select>
          </div>

          {asignaciones.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">EPP a devolver</label>
              <select value={eppId} onChange={e => setEppId(e.target.value)}
                className="w-full border rounded px-3 py-2" required>
                <option value="">Seleccionar EPP...</option>
                {asignaciones.map(a => (
                  <option key={a.epp_id} value={a.epp_id}>
                    {a.epp_nombre} (tiene {a.cantidad})
                  </option>
                ))}
              </select>
            </div>
          )}

          {trabajadorId && asignaciones.length === 0 && (
            <p className="text-gray-500 text-sm">Este trabajador no tiene EPP asignado actualmente.</p>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad</label>
              <input type="number" min="1" value={cantidad} onChange={e => setCantidad(e.target.value)}
                className="w-full border rounded px-3 py-2" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha devolución</label>
              <input type="date" value={fechaDevolucion} onChange={e => setFechaDevolucion(e.target.value)}
                className="w-full border rounded px-3 py-2" required />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Motivo</label>
            <select value={motivo} onChange={e => setMotivo(e.target.value)}
              className="w-full border rounded px-3 py-2" required>
              {MOTIVOS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observación</label>
            <textarea value={observacion} onChange={e => setObservacion(e.target.value)}
              className="w-full border rounded px-3 py-2" rows={2} />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={vuelveAStock} onChange={e => setVuelveAStock(e.target.checked)} />
            El EPP vuelve a stock (está en buen estado)
          </label>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Foto (opcional)</label>
            <input type="file" accept="image/*" onChange={e => setFoto(e.target.files[0])}
              className="text-sm" />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}
          {success && <p className="text-green-600 text-sm">{success}</p>}

          <button type="submit"
            className="w-full bg-ht-navy text-white py-2 rounded font-medium hover:bg-opacity-90">
            Registrar Devolución
          </button>
        </form>
      </div>
    </div>
  );
}
