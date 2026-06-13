import { useEffect, useState } from 'react';
import api from '../../api';

function estadoBadge(estado) {
  const map = {
    vigente: 'bg-green-100 text-green-800',
    por_vencer: 'bg-orange-100 text-orange-800',
    vencido: 'bg-red-100 text-red-800',
  };
  const label = {
    vigente: 'Vigente',
    por_vencer: 'Por vencer',
    vencido: 'Vencido',
  };
  const cls = map[estado] || 'bg-gray-100 text-gray-600';
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {label[estado] || estado}
    </span>
  );
}

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
  const [filtro, setFiltro] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [seleccionado, setSeleccionado] = useState(null);
  const [asignaciones, setAsignaciones] = useState([]);
  const [cargandoAsig, setCargandoAsig] = useState(false);
  const [descargando, setDescargando] = useState(false);

  useEffect(() => {
    setCargando(true);
    api.get('/users/trabajadores')
      .then(r => setTrabajadores(r.data))
      .catch(() => setError('Error al cargar trabajadores'))
      .finally(() => setCargando(false));
  }, []);

  const filtrados = trabajadores.filter(t => {
    const q = filtro.toLowerCase();
    return (
      t.nombre?.toLowerCase().includes(q) ||
      t.rut?.toLowerCase().includes(q)
    );
  });

  function verEpp(trabajador) {
    if (seleccionado?.id === trabajador.id) {
      setSeleccionado(null);
      setAsignaciones([]);
      return;
    }
    setSeleccionado(trabajador);
    setCargandoAsig(true);
    api.get(`/asignaciones/trabajador/${trabajador.id}`)
      .then(r => setAsignaciones(r.data.asignaciones || r.data || []))
      .catch(() => setAsignaciones([]))
      .finally(() => setCargandoAsig(false));
  }

  async function handleDescargarPdf(id, nombre) {
    setDescargando(id);
    try {
      await descargarPdf(id, nombre);
    } catch {
      // silencioso
    } finally {
      setDescargando(null);
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-[#112548] mb-6">Buscar Trabajador</h1>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Buscar por nombre o RUT..."
          value={filtro}
          onChange={e => setFiltro(e.target.value)}
          className="w-full max-w-md border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#34B3DE]"
        />
      </div>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      {cargando ? (
        <p className="text-gray-500 text-sm">Cargando trabajadores...</p>
      ) : (
        <div className="overflow-x-auto rounded border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-[#112548] text-white">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Nombre</th>
                <th className="px-4 py-3 text-left font-medium">RUT</th>
                <th className="px-4 py-3 text-left font-medium">Rol</th>
                <th className="px-4 py-3 text-left font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-gray-400">
                    Sin resultados
                  </td>
                </tr>
              )}
              {filtrados.map(t => (
                <>
                  <tr key={t.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-[#112548]">{t.nombre}</td>
                    <td className="px-4 py-3 text-gray-600">{t.rut}</td>
                    <td className="px-4 py-3 text-gray-600 capitalize">{t.rol}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => verEpp(t)}
                        className="bg-[#34B3DE] hover:bg-[#1a9bc5] text-white text-xs px-3 py-1.5 rounded transition-colors"
                      >
                        {seleccionado?.id === t.id ? 'Ocultar EPP' : 'Ver EPP asignado'}
                      </button>
                    </td>
                  </tr>

                  {seleccionado?.id === t.id && (
                    <tr key={`panel-${t.id}`} className="bg-blue-50">
                      <td colSpan={4} className="px-6 py-4">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-semibold text-[#112548] text-sm">
                            EPP asignado a {t.nombre}
                          </h3>
                          <button
                            onClick={() => handleDescargarPdf(t.id, t.nombre)}
                            disabled={descargando === t.id}
                            className="bg-[#112548] hover:bg-[#1a3a6e] text-white text-xs px-3 py-1.5 rounded transition-colors disabled:opacity-60"
                          >
                            {descargando === t.id ? 'Generando...' : 'Descargar PDF completo'}
                          </button>
                        </div>

                        {cargandoAsig ? (
                          <p className="text-sm text-gray-500">Cargando asignaciones...</p>
                        ) : asignaciones.length === 0 ? (
                          <p className="text-sm text-gray-400">Sin EPP asignado actualmente.</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="min-w-full text-xs bg-white rounded border border-gray-200">
                              <thead className="bg-gray-100">
                                <tr>
                                  <th className="px-3 py-2 text-left font-medium text-gray-600">EPP</th>
                                  <th className="px-3 py-2 text-left font-medium text-gray-600">Categoría</th>
                                  <th className="px-3 py-2 text-left font-medium text-gray-600">Cantidad</th>
                                  <th className="px-3 py-2 text-left font-medium text-gray-600">Fecha asignación</th>
                                  <th className="px-3 py-2 text-left font-medium text-gray-600">Vence</th>
                                  <th className="px-3 py-2 text-left font-medium text-gray-600">Estado</th>
                                </tr>
                              </thead>
                              <tbody>
                                {asignaciones.map((a, i) => (
                                  <tr key={i} className="border-t border-gray-100">
                                    <td className="px-3 py-2">{a.epp_nombre || a.epp}</td>
                                    <td className="px-3 py-2 text-gray-500">{a.categoria}</td>
                                    <td className="px-3 py-2">{a.cantidad}</td>
                                    <td className="px-3 py-2 text-gray-500">{a.fecha_asignacion}</td>
                                    <td className="px-3 py-2 text-gray-500">{a.fecha_vencimiento || '—'}</td>
                                    <td className="px-3 py-2">{estadoBadge(a.estado_vencimiento || a.estado)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
