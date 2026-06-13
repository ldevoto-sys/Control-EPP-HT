import { useEffect, useState } from 'react';
import api from '../../api';

async function descargarPdfTrabajador(trabajadorId, nombre) {
  const res = await api.get(`/reports/trabajador/${trabajadorId}/pdf`, { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `epp_${nombre.replace(/ /g, '_')}.pdf`;
  a.click();
  window.URL.revokeObjectURL(url);
}

async function verPdfEntrega(entregaId) {
  const res = await api.get(`/reports/entrega/${entregaId}/pdf`, { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
  window.open(url, '_blank');
}

export default function Documentacion() {
  const [matriz, setMatriz] = useState({ trabajadores: [], epps: [], asignaciones: [] });
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [celda, setCelda] = useState(null); // { trabajador, epp, asignacion }
  const [subiendoId, setSubiendoId] = useState(null);

  function cargarMatriz() {
    setCargando(true);
    api.get('/asignaciones/matriz')
      .then(r => setMatriz(r.data))
      .catch(() => setError('Error al cargar la matriz'))
      .finally(() => setCargando(false));
  }

  useEffect(() => { cargarMatriz(); }, []);

  async function subirFirmado(entregaId, file) {
    const fd = new FormData();
    fd.append('pdf_firmado', file);
    setSubiendoId(entregaId);
    try {
      await api.post(`/entregas/${entregaId}/pdf-firmado`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setCelda(null);
      cargarMatriz();
    } catch {
      alert('Error al subir el documento');
    } finally {
      setSubiendoId(null);
    }
  }

  function colorCelda(estado) {
    if (estado === 'vigente') return 'bg-green-100 text-green-700';
    if (estado === 'por_vencer') return 'bg-orange-100 text-orange-700';
    if (estado === 'vencido') return 'bg-red-100 text-red-700';
    return '';
  }

  function buscarAsig(trabajadorId, eppId) {
    return matriz.asignaciones.find(
      a => a.trabajador_id === trabajadorId && a.epp_id === eppId
    );
  }

  const trabajadoresFiltrados = (matriz.trabajadores || []).filter(t => {
    const q = busqueda.toLowerCase();
    return t.nombre?.toLowerCase().includes(q) || t.rut?.toLowerCase().includes(q);
  });

  if (cargando) return <div className="p-6 text-gray-500">Cargando matriz...</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-[#112548] mb-2">Documentación EPP — Matriz</h1>
      <p className="text-gray-500 text-sm mb-4">Registro de asignaciones por trabajador y tipo de EPP.</p>

      <input
        type="text"
        placeholder="Filtrar por nombre o RUT..."
        value={busqueda}
        onChange={e => setBusqueda(e.target.value)}
        className="w-full max-w-md border border-gray-300 rounded px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-[#34B3DE]"
      />

      <div className="overflow-x-auto rounded border border-gray-200">
        <table className="text-sm border-collapse min-w-max">
          <thead>
            <tr className="bg-[#112548] text-white">
              <th className="px-4 py-2 text-left sticky left-0 bg-[#112548] z-10 min-w-[200px]">Trabajador</th>
              {(matriz.epps || []).map(epp => (
                <th key={epp.id} className="px-3 py-2 text-center max-w-[80px] truncate" title={epp.nombre}>
                  <span className="block truncate max-w-[80px]">{epp.nombre_corto || epp.nombre}</span>
                </th>
              ))}
              <th className="px-3 py-2 text-center">Descargar todo</th>
            </tr>
          </thead>
          <tbody>
            {trabajadoresFiltrados.length === 0 && (
              <tr><td colSpan={(matriz.epps?.length || 0) + 2} className="px-4 py-4 text-center text-gray-400">Sin resultados</td></tr>
            )}
            {trabajadoresFiltrados.map(t => (
              <tr key={t.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-2 sticky left-0 bg-white z-10 font-medium">
                  {t.nombre}<br /><span className="text-xs text-gray-400">{t.rut}</span>
                </td>
                {(matriz.epps || []).map(epp => {
                  const asig = buscarAsig(t.id, epp.id);
                  return (
                    <td key={epp.id} className="px-2 py-2 text-center">
                      {asig ? (
                        <div className="relative group inline-block">
                          <button
                            onClick={() => setCelda({ trabajador: t, epp, asignacion: asig })}
                            className={`w-8 h-8 rounded flex items-center justify-center mx-auto text-base ${colorCelda(asig.estado_vencimiento)}`}
                            title={`Entregado: ${asig.fecha_asignacion}`}
                          >
                            📄
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  );
                })}
                <td className="px-2 py-2 text-center">
                  <button
                    onClick={() => descargarPdfTrabajador(t.id, t.nombre)}
                    className="text-[#34B3DE] hover:underline text-xs font-medium"
                  >
                    ⬇ Todo
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Leyenda */}
      <div className="flex gap-4 mt-3 text-xs text-gray-600">
        <span><span className="inline-block w-3 h-3 rounded-full bg-green-400 mr-1"></span>Vigente</span>
        <span><span className="inline-block w-3 h-3 rounded-full bg-orange-400 mr-1"></span>Por vencer (&lt;30 días)</span>
        <span><span className="inline-block w-3 h-3 rounded-full bg-red-400 mr-1"></span>Vencido</span>
        <span><span className="inline-block w-3 h-3 rounded-full bg-gray-200 mr-1"></span>Sin asignación</span>
      </div>

      {/* Panel de celda */}
      {celda && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setCelda(null)}>
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="font-semibold text-[#112548]">{celda.epp.nombre}</p>
                <p className="text-sm text-gray-500">{celda.trabajador.nombre}</p>
              </div>
              <button onClick={() => setCelda(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <p className="text-xs text-gray-500 mb-3">Entregado: {celda.asignacion.fecha_asignacion}</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => verPdfEntrega(celda.asignacion.entrega_id)}
                className="bg-[#112548] text-white px-3 py-2 rounded text-sm hover:opacity-90"
              >
                Ver PDF de entrega
              </button>
              {celda.asignacion.pdf_firmado && (
                <a
                  href={`/uploads/${celda.asignacion.pdf_firmado}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-center border border-[#34B3DE] text-[#34B3DE] px-3 py-2 rounded text-sm hover:bg-[#34B3DE] hover:text-white transition"
                >
                  Ver documento firmado
                </a>
              )}
              <div>
                <p className="text-xs text-gray-500 mb-1">Subir documento firmado (PDF):</p>
                <input
                  type="file"
                  accept="application/pdf"
                  disabled={subiendoId === celda.asignacion.entrega_id}
                  onChange={e => {
                    if (e.target.files[0]) subirFirmado(celda.asignacion.entrega_id, e.target.files[0]);
                  }}
                  className="text-sm"
                />
                {subiendoId === celda.asignacion.entrega_id && (
                  <p className="text-xs text-gray-400 mt-1">Subiendo...</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
