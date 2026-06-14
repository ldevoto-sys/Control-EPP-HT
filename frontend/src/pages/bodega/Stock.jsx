import { useEffect, useState } from 'react';
import api from '../../api';

export default function Stock() {
  const [items, setItems] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [categFilter, setCategFilter] = useState('');
  const [soloCriticos, setSoloCriticos] = useState(false);
  const [seleccionado, setSeleccionado] = useState(null);
  const [movimientos, setMovimientos] = useState([]);
  const [cargandoMov, setCargandoMov] = useState(false);

  useEffect(() => {
    api.get('/stock')
      .then(r => {
        setItems(r.data);
        const cats = [...new Set(r.data.map(i => i.categoria).filter(Boolean))];
        setCategorias(cats);
      })
      .catch(() => setError('Error al cargar stock'))
      .finally(() => setCargando(false));
  }, []);

  async function verMovimientos(item) {
    setSeleccionado(item);
    setCargandoMov(true);
    try {
      const r = await api.get(`/stock/${item.epp_id}/movimientos`);
      setMovimientos(r.data);
    } catch {
      setMovimientos([]);
    } finally {
      setCargandoMov(false);
    }
  }

  const filtrados = items.filter(i => {
    if (categFilter && i.categoria !== categFilter) return false;
    if (soloCriticos && i.stock_actual > i.stock_minimo) return false;
    return true;
  });

  function estadoBadge(item) {
    if (item.stock_actual <= item.stock_minimo) {
      return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-700">Crítico</span>;
    }
    return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-700">OK</span>;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-[#112548] mb-4">Estado de Stock</h1>

      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={categFilter}
          onChange={e => setCategFilter(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#34B3DE]"
        >
          <option value="">Todas las categorías</option>
          {categorias.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={soloCriticos}
            onChange={e => setSoloCriticos(e.target.checked)}
            className="accent-[#34B3DE]"
          />
          Solo críticos
        </label>
      </div>

      {cargando && <p className="text-gray-500">Cargando...</p>}
      {error && <p className="text-red-600">{error}</p>}

      {!cargando && !error && (
        <div className="overflow-x-auto rounded border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-[#112548] text-white">
              <tr>
                <th className="px-4 py-2 text-left">EPP</th>
                <th className="px-4 py-2 text-left">Categoría</th>
                <th className="px-4 py-2 text-left">Unidad</th>
                <th className="px-4 py-2 text-center">Stock actual</th>
                <th className="px-4 py-2 text-center">Stock mínimo</th>
                <th className="px-4 py-2 text-center">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-4 text-center text-gray-400">Sin resultados</td></tr>
              )}
              {filtrados.map(item => (
                <tr
                  key={item.epp_id}
                  className="border-t hover:bg-gray-50 cursor-pointer"
                  onClick={() => verMovimientos(item)}
                >
                  <td className="px-4 py-2 font-medium">{item.epp_nombre}</td>
                  <td className="px-4 py-2">{item.categoria}</td>
                  <td className="px-4 py-2">{item.unidad}</td>
                  <td className="px-4 py-2 text-center">{item.stock_actual}</td>
                  <td className="px-4 py-2 text-center">{item.stock_minimo}</td>
                  <td className="px-4 py-2 text-center">{estadoBadge(item)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Panel movimientos */}
      {seleccionado && (
        <div className="mt-6 border border-[#34B3DE] rounded p-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-semibold text-[#112548]">
              Movimientos — {seleccionado.epp_nombre}
            </h2>
            <button onClick={() => setSeleccionado(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
          </div>
          {cargandoMov && <p className="text-gray-500 text-sm">Cargando...</p>}
          {!cargandoMov && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-3 py-2 text-left">Tipo</th>
                    <th className="px-3 py-2 text-center">Cantidad</th>
                    <th className="px-3 py-2 text-center">Stock resultante</th>
                    <th className="px-3 py-2 text-left">Fecha</th>
                    <th className="px-3 py-2 text-left">Usuario</th>
                    <th className="px-3 py-2 text-left">Referencia</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientos.length === 0 && (
                    <tr><td colSpan={6} className="px-3 py-3 text-center text-gray-400">Sin movimientos</td></tr>
                  )}
                  {movimientos.map((m, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-3 py-2 capitalize">{m.tipo}</td>
                      <td className="px-3 py-2 text-center">{m.cantidad}</td>
                      <td className="px-3 py-2 text-center">{m.stock_resultante}</td>
                      <td className="px-3 py-2">{m.fecha}</td>
                      <td className="px-3 py-2">{m.usuario}</td>
                      <td className="px-3 py-2">{m.referencia ?? '—'}</td>
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
