import { useEffect, useState } from 'react';
import api from '../../api';

async function descargarPdf(trabajadorId, nombre) {
  const res = await api.get(`/reports/trabajador/${trabajadorId}/pdf`, { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `epp_${nombre.replace(/ /g, '_')}.pdf`;
  a.click();
  window.URL.revokeObjectURL(url);
}

export default function BuscarTrabajador() {
  const [trabajadores, setTrabajadores] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [seleccionado, setSeleccionado] = useState(null);
  const [asignaciones, setAsignaciones] = useState([]);
  const [cargandoAsig, setCargandoAsig] = useState(false);

  useEffect(() => {
    api.get('/users/trabajadores')
      .then(r => setTrabajadores(r.data))
      .catch(() => setError('Error al cargar trabajadores'))
      .finally(() => setCargando(false));
  }, []);

  const filtrados = trabajadores.filter(t => {
    const q = busqueda.toLowerCase();
    return (
      t.nombre?.toLowerCase().includes(q) ||
      t.rut?.toLowerCase().includes(q)
    );
  });

  async function verEpp(trabajador) {
    setSeleccionado(trabajador);
    setCargandoAsig(true);
    try {
      const r = await api.get(`/asignaciones/trabajador/${trabajador.id}`);
      setAsignaciones(r.data);
    } catch {
      setAsignaciones([]);
    } finally {
      setCargandoAsig(false);
    }
  }

  function badgeEstado(estado) {
    const base = 'px-2 py-0.5 rounded text-xs font-semibold';
    if (estado === 'vigente') return <span className={`${base} bg-green-100 text-green-700`}>Vigente</span>;
    if (estado === 'por_vencer') return <span className={`${base} bg-orange-100 text-orange-700`}>Por vencer</span>;
    if (estado === 'vencido') return <span className={`${base} bg-red-100 text-red-700`}>Vencido</span>;
    return <span className={`${base} bg-gray-100 text-gray-500`}>{estado}</span>;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-[#112548] mb-4">Buscar Trabajador</h1>

      <input
        type="text"
        placeholder="Buscar por nombre o RUT..."
        value={busqueda}
        onChange={e => setBusqueda(e.target.value)}
        className="w-full max-w-md border border-gray-300 rounded px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-[#34B3DE]"
      />

      {cargando && <p className="text-gray-500">Cargando...</p>}
      {error && <p className="text-red-600">{error}</p>}

      {!cargando && !error && (
        <div className="overflow-x-auto rounded border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-[#112548] text-white">
              <tr>
                <th className="px-4 py-2 text-left">Nombre</th>
                <th className="px-4 py-2 text-left">RUT</th>
                <th className="px-4 py-2 text-left">Rol</th>
                <th className="px-4 py-2 text-left">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-4 text-center text-gray-400">Sin resultados</td></tr>
              )}
              {filtrados.map(t => (
                <tr key={t.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-2">{t.nombre}</td>
                  <td className="px-4 py-2">{t.rut}</td>
                  <td className="px-4 py-2 capitalize">{t.rol}</td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => verEpp(t)}
                      className="text-[#34B3DE] hover:underline font-medium"
                    >
                      Ver EPP asignado
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {seleccionado && (
        <div className="mt-6 border border-[#34B3DE] rounded p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-[#112548]">
              EPP asignado — {seleccionado.nombre}
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => descargarPdf(seleccionado.id, seleccionado.nombre)}
                className="bg-[#112548] text-white px-3 py-1.5 rounded text-sm hover:opacity-90"
              >
                Descargar PDF completo
              </button>
              <button
                onClick={() => setSeleccionado(null)}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none"
              >
                ✕
              </button>
            </div>
          </div>

          {cargandoAsig && <p className="text-gray-500 text-sm">Cargando asignaciones...</p>}

          {!cargandoAsig && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-3 py-2 text-left">EPP</th>
                    <th className="px-3 py-2 text-left">Categoría</th>
                    <th className="px-3 py-2 text-left">Cantidad</th>
                    <th className="px-3 py-2 text-left">Fecha asignación</th>
                    <th className="px-3 py-2 text-left">Vence</th>
                    <th className="px-3 py-2 text-left">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {asignaciones.length === 0 && (
                    <tr><td colSpan={6} className="px-3 py-3 text-center text-gray-400">Sin asignaciones</td></tr>
                  )}
                  {asignaciones.map((a, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-3 py-2">{a.epp_nombre}</td>
                      <td className="px-3 py-2">{a.categoria}</td>
                      <td className="px-3 py-2">{a.cantidad}</td>
                      <td className="px-3 py-2">{a.fecha_asignacion}</td>
                      <td className="px-3 py-2">{a.fecha_vencimiento ?? '—'}</td>
                      <td className="px-3 py-2">{badgeEstado(a.estado_vencimiento)}</td>
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
