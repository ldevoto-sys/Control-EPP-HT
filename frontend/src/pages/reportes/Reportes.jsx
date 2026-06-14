import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';

async function descargarCsv() {
  const res = await api.get('/reports/matriz-csv', { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'epp_matriz.csv';
  a.click();
  window.URL.revokeObjectURL(url);
}

async function descargarPdfTrabajador(trabajadorId, nombre) {
  const res = await api.get(`/reports/trabajador/${trabajadorId}/pdf`, { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `epp_${nombre.replace(/ /g, '_')}.pdf`;
  a.click();
  window.URL.revokeObjectURL(url);
}

export default function Reportes() {
  const [stockCritico, setStockCritico] = useState([]);
  const [vencimientos, setVencimientos] = useState({ proximos_a_vencer: [], vencidos: [] });
  const [trabajadores, setTrabajadores] = useState([]);
  const [trabajadorSel, setTrabajadorSel] = useState('');
  const [cargando, setCargando] = useState(true);
  const [descargando, setDescargando] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/reports/stock-critico').then(r => setStockCritico(r.data.items || r.data)).catch(() => {}),
      api.get('/reports/vencimientos').then(r => setVencimientos(r.data)).catch(() => {}),
      api.get('/users/trabajadores').then(r => setTrabajadores(r.data)).catch(() => {}),
    ]).finally(() => setCargando(false));
  }, []);

  async function handleDescargarCsv() {
    setDescargando(true);
    try { await descargarCsv(); } catch { alert('Error al descargar CSV'); } finally { setDescargando(false); }
  }

  const trabajadorSelObj = trabajadores.find(t => String(t.id) === String(trabajadorSel));

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-2xl font-bold text-[#112548]">Reportes</h1>

      <section className="border border-gray-200 rounded p-5">
        <h2 className="text-lg font-semibold text-[#112548] mb-2">Matriz EPP</h2>
        <p className="text-sm text-gray-500 mb-3">Vista completa de asignaciones por trabajador y EPP.</p>
        <Link to="/documentacion" className="inline-block bg-[#112548] text-white px-4 py-2 rounded text-sm hover:opacity-90">
          Ver matriz
        </Link>
      </section>

      <section className="border border-gray-200 rounded p-5">
        <h2 className="text-lg font-semibold text-[#112548] mb-2">Exportar CSV</h2>
        <p className="text-sm text-gray-500 mb-3">Descarga la matriz completa en formato CSV.</p>
        <button onClick={handleDescargarCsv} disabled={descargando}
          className="bg-[#34B3DE] text-white px-4 py-2 rounded text-sm hover:opacity-90 disabled:opacity-50">
          {descargando ? 'Descargando...' : 'Descargar CSV'}
        </button>
      </section>

      <section className="border border-gray-200 rounded p-5">
        <h2 className="text-lg font-semibold text-[#112548] mb-3">Stock Crítico</h2>
        {cargando && <p className="text-gray-500 text-sm">Cargando...</p>}
        {!cargando && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2 text-left">EPP</th>
                  <th className="px-4 py-2 text-center">Stock actual</th>
                  <th className="px-4 py-2 text-center">Stock mínimo</th>
                </tr>
              </thead>
              <tbody>
                {stockCritico.length === 0 && (
                  <tr><td colSpan={3} className="px-4 py-3 text-center text-gray-400">Sin items críticos</td></tr>
                )}
                {stockCritico.map((s, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-4 py-2">{s.nombre}</td>
                    <td className="px-4 py-2 text-center text-red-600 font-semibold">{s.stock_actual}</td>
                    <td className="px-4 py-2 text-center">{s.stock_minimo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="border border-gray-200 rounded p-5">
        <h2 className="text-lg font-semibold text-[#112548] mb-3">EPP Por Vencer / Vencidos</h2>
        {cargando && <p className="text-gray-500 text-sm">Cargando...</p>}
        {!cargando && (
          <>
            <h3 className="text-sm font-semibold text-orange-600 mb-2">Próximos a vencer (&lt;30 días)</h3>
            <div className="overflow-x-auto mb-4">
              <table className="min-w-full text-sm">
                <thead className="bg-orange-50">
                  <tr>
                    <th className="px-3 py-2 text-left">Trabajador</th>
                    <th className="px-3 py-2 text-left">EPP</th>
                    <th className="px-3 py-2 text-left">Vence</th>
                  </tr>
                </thead>
                <tbody>
                  {(vencimientos.proximos_a_vencer || []).length === 0 && (
                    <tr><td colSpan={3} className="px-3 py-3 text-center text-gray-400">Ninguno</td></tr>
                  )}
                  {(vencimientos.proximos_a_vencer || []).map((v, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-3 py-2">{v.trabajador_nombre}</td>
                      <td className="px-3 py-2">{v.epp_nombre}</td>
                      <td className="px-3 py-2 text-orange-600">{v.fecha_vencimiento}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h3 className="text-sm font-semibold text-red-600 mb-2">Vencidos</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-red-50">
                  <tr>
                    <th className="px-3 py-2 text-left">Trabajador</th>
                    <th className="px-3 py-2 text-left">EPP</th>
                    <th className="px-3 py-2 text-left">Venció</th>
                  </tr>
                </thead>
                <tbody>
                  {(vencimientos.vencidos || []).length === 0 && (
                    <tr><td colSpan={3} className="px-3 py-3 text-center text-gray-400">Ninguno</td></tr>
                  )}
                  {(vencimientos.vencidos || []).map((v, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-3 py-2">{v.trabajador_nombre}</td>
                      <td className="px-3 py-2">{v.epp_nombre}</td>
                      <td className="px-3 py-2 text-red-600">{v.fecha_vencimiento}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section className="border border-gray-200 rounded p-5">
        <h2 className="text-lg font-semibold text-[#112548] mb-3">PDF por Trabajador</h2>
        <div className="flex gap-3 items-end flex-wrap">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Seleccionar trabajador</label>
            <select value={trabajadorSel} onChange={e => setTrabajadorSel(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#34B3DE]">
              <option value="">Seleccionar...</option>
              {trabajadores.map(t => (
                <option key={t.id} value={t.id}>{t.nombre} — {t.rut}</option>
              ))}
            </select>
          </div>
          <button disabled={!trabajadorSel}
            onClick={() => descargarPdfTrabajador(trabajadorSel, trabajadorSelObj?.nombre || 'trabajador')}
            className="bg-[#112548] text-white px-4 py-2 rounded text-sm hover:opacity-90 disabled:opacity-40">
            Descargar PDF
          </button>
        </div>
      </section>
    </div>
  );
}
