import { useEffect, useState } from 'react';
import api from '../../api';

export default function IngresoStock() {
  const [epps, setEpps] = useState([]);
  const [eppId, setEppId] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [referencia, setReferencia] = useState('');
  const [observacion, setObservacion] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [stockActual, setStockActual] = useState(null);
  const [movimientos, setMovimientos] = useState([]);
  const [cargandoMov, setCargandoMov] = useState(false);

  useEffect(() => {
    api.get('/epp/activos').then(r => setEpps(r.data)).catch(() => {});
  }, []);

  async function cargarMovimientos(id) {
    if (!id) return;
    setCargandoMov(true);
    try {
      const r = await api.get(`/stock/${id}/movimientos`);
      const ingresos = r.data.filter(m => m.tipo === 'ingreso');
      setMovimientos(ingresos);
      if (r.data.length > 0) setStockActual(r.data[0].stock_resultante);
    } catch {
      setMovimientos([]);
    } finally {
      setCargandoMov(false);
    }
  }

  function handleEppChange(id) {
    setEppId(id);
    setStockActual(null);
    setMovimientos([]);
    cargarMovimientos(id);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!eppId || !cantidad || Number(cantidad) <= 0) {
      setMensaje({ tipo: 'error', texto: 'Selecciona un EPP e ingresa una cantidad válida.' });
      return;
    }
    setEnviando(true);
    setMensaje(null);
    try {
      const r = await api.post(`/epp/${eppId}/ingreso-stock`, {
        cantidad: Number(cantidad),
        referencia,
        observacion,
      });
      setMensaje({ tipo: 'ok', texto: 'Ingreso registrado correctamente.' });
      if (r.data.stock_actual !== undefined) setStockActual(r.data.stock_actual);
      setCantidad('');
      setReferencia('');
      setObservacion('');
      cargarMovimientos(eppId);
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err?.response?.data?.message || 'Error al registrar ingreso.' });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-[#112548] mb-4">Ingreso de Stock</h1>

      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded p-5 mb-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">EPP</label>
          <select
            value={eppId}
            onChange={e => handleEppChange(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#34B3DE]"
            required
          >
            <option value="">Seleccionar EPP...</option>
            {epps.map(e => (
              <option key={e.id} value={e.id}>{e.nombre}</option>
            ))}
          </select>
          {stockActual !== null && (
            <p className="text-xs text-gray-500 mt-1">Stock actual: <strong>{stockActual}</strong></p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad</label>
          <input
            type="number"
            min="1"
            value={cantidad}
            onChange={e => setCantidad(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#34B3DE]"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Referencia (ej: Factura 1234)</label>
          <input
            type="text"
            value={referencia}
            onChange={e => setReferencia(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#34B3DE]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Observación</label>
          <textarea
            value={observacion}
            onChange={e => setObservacion(e.target.value)}
            rows={2}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#34B3DE]"
          />
        </div>

        {mensaje && (
          <p className={`text-sm ${mensaje.tipo === 'ok' ? 'text-green-600' : 'text-red-600'}`}>
            {mensaje.texto}
          </p>
        )}

        <button
          type="submit"
          disabled={enviando}
          className="bg-[#112548] text-white px-5 py-2 rounded hover:opacity-90 text-sm disabled:opacity-50"
        >
          {enviando ? 'Registrando...' : 'Registrar ingreso'}
        </button>
      </form>

      {/* Historial de ingresos */}
      {eppId && (
        <div>
          <h2 className="text-lg font-semibold text-[#112548] mb-3">Historial de ingresos recientes</h2>
          {cargandoMov && <p className="text-gray-500 text-sm">Cargando...</p>}
          {!cargandoMov && (
            <div className="overflow-x-auto rounded border border-gray-200">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-3 py-2 text-left">Fecha</th>
                    <th className="px-3 py-2 text-center">Cantidad</th>
                    <th className="px-3 py-2 text-center">Stock resultante</th>
                    <th className="px-3 py-2 text-left">Referencia</th>
                    <th className="px-3 py-2 text-left">Usuario</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientos.length === 0 && (
                    <tr><td colSpan={5} className="px-3 py-3 text-center text-gray-400">Sin ingresos registrados</td></tr>
                  )}
                  {movimientos.map((m, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-3 py-2">{m.fecha}</td>
                      <td className="px-3 py-2 text-center">{m.cantidad}</td>
                      <td className="px-3 py-2 text-center">{m.stock_resultante}</td>
                      <td className="px-3 py-2">{m.referencia ?? '—'}</td>
                      <td className="px-3 py-2">{m.usuario}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
