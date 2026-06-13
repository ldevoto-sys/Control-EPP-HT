import { useEffect, useState, useRef } from 'react';
import api from '../../api';

function colorCelda(estado) {
  if (estado === 'vigente') return 'bg-green-100 text-green-700 border-green-300';
  if (estado === 'por_vencer') return 'bg-orange-100 text-orange-700 border-orange-300';
  if (estado === 'vencido') return 'bg-red-100 text-red-700 border-red-300';
  return '';
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

async function descargarPdfEntrega(entregaId) {
  const res = await api.get(`/reports/entrega/${entregaId}/pdf`, { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `entrega_${entregaId}.pdf`;
  a.click();
  window.URL.revokeObjectURL(url);
}

export default function Documentacion() {
  const [matriz, setMatriz] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [filtro, setFiltro] = useState('');
  const [panelAbierto, setPanelAbierto] = useState(null); // { trabajadorId, eppId, asignacion }
  const [subiendoFirmado, setSubiendoFirmado] = useState(false);
  const fileInputRef = useRef(null);

  function cargarMatriz() {
    setCargando(true);
    api.get('/asignaciones/matriz')
      .then(r => setMatriz(r.data))
      .catch(() => setError('Error al cargar la matriz'))
      .finally(() => setCargando(false));
  }

  useEffect(() => {
    cargarMatriz();
  }, []);

  async function subirFirmado(entregaId, file) {
    const fd = new FormData();
    fd.append('pdf_firmado', file);
    setSubiendoFirmado(true);
    try {
      await api.post(`/entregas/${entregaId}/pdf-firmado`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      cargarMatriz();
      setPanelAbierto(null);
    } catch {
      alert('Error al subir el documento firmado.');
    } finally {
      setSubiendoFirmado(false);
    }
  }

  if (cargando) {
    return (
      <div className="p-6">
        <p className="text-gray-500 text-sm">Cargando matriz...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <p className="text-red-600 text-sm">{error}</p>
      </div>
    );
  }

  const { trabajadores = [], epps = [], asignaciones = [] } = matriz || {};

  // Índice rápido: asignaciones[trabajadorId][eppId] = asignacion
  const indice = {};
  asignaciones.forEach(a => {
    if (!indice[a.trabajador_id]) indice[a.trabajador_id] = {};
    indice[a.trabajador_id][a.epp_id] = a;
  });

  const trabajadoresFiltrados = trabajadores.filter(t => {
    const q = filtro.toLowerCase();
    return t.nombre?.toLowerCase().includes(q) || t.rut?.toLowerCase().includes(q);
  });

  const panel = panelAbierto;

  return (
    <div className="p-6 max-w-full">
      <h1 className="text-2xl font-bold text-[#112548] mb-2">Documentación EPP</h1>
      <p className="text-sm text-gray-500 mb-5">Matriz de asignaciones por trabajador y tipo de EPP.</p>

      <div className="mb-4 flex items-center gap-3">
        <input
          type="text"
          placeholder="Filtrar por nombre o RUT..."
          value={filtro}
          onChange={e => setFiltro(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#34B3DE] w-72"
        />
      </div>

      <div className="overflow-x-auto rounded border border-gray-200">
        <table className="text-xs min-w-max">
          <thead className="bg-[#112548] text-white">
            <tr>
              <th className="px-4 py-3 text-left font-medium sticky left-0 bg-[#112548] z-10 min-w-[180px]">
                Trabajador
              </th>
              {epps.map(epp => (
                <th
                  key={epp.id}
                  className="px-3 py-3 text-center font-medium max-w-[100px]"
                  title={epp.nombre}
                >
                  <span className="block truncate max-w-[90px]">{epp.nombre}</span>
                </th>
              ))}
              <th className="px-3 py-3 text-center font-medium">Descargar todo</th>
            </tr>
          </thead>
          <tbody>
            {trabajadoresFiltrados.length === 0 && (
              <tr>
                <td colSpan={epps.length + 2} className="px-4 py-6 text-center text-gray-400">
                  Sin resultados
                </td>
              </tr>
            )}
            {trabajadoresFiltrados.map(t => (
              <tr key={t.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 sticky left-0 bg-white z-10 border-r border-gray-100">
                  <div className="font-medium text-[#112548]">{t.nombre}</div>
                  <div className="text-gray-400">{t.rut}</div>
                </td>

                {epps.map(epp => {
                  const asig = indice[t.id]?.[epp.id];
                  if (!asig) {
                    return (
                      <td key={epp.id} className="px-3 py-3 text-center text-gray-300">
                        —
                      </td>
                    );
                  }
                  return (
                    <td key={epp.id} className="px-3 py-3 text-center">
                      <div className="relative group inline-block">
                        <button
                          onClick={() =>
                            setPanelAbierto(
                              panel?.trabajadorId === t.id && panel?.eppId === epp.id
                                ? null
                                : { trabajadorId: t.id, eppId: epp.id, asig }
                            )
                          }
                          className={`w-8 h-8 rounded border flex items-center justify-center mx-auto transition-colors ${colorCelda(asig.estado_vencimiento)}`}
                          title={`Entregado: ${asig.fecha_entrega || '—'}`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9l-5-5H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                        </button>
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-20">
                          Entregado: {asig.fecha_entrega || '—'}
                        </span>
                      </div>

                      {panel?.trabajadorId === t.id && panel?.eppId === epp.id && (
                        <div className="absolute z-30 mt-2 w-64 bg-white border border-gray-200 rounded shadow-lg p-3 text-left">
                          <p className="font-medium text-[#112548] text-xs mb-2">
                            {epp.nombre} — {t.nombre}
                          </p>
                          <div className="flex flex-col gap-1.5">
                            <button
                              onClick={() => descargarPdfEntrega(asig.entrega_id)}
                              className="text-xs bg-[#34B3DE] hover:bg-[#1a9bc5] text-white px-2 py-1 rounded"
                            >
                              Ver PDF de entrega
                            </button>
                            {asig.pdf_firmado && (
                              <a
                                href={`/uploads/${asig.pdf_firmado}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-center"
                              >
                                Ver documento firmado
                              </a>
                            )}
                            <label className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded cursor-pointer text-center">
                              {subiendoFirmado ? 'Subiendo...' : 'Subir documento firmado'}
                              <input
                                type="file"
                                accept="application/pdf"
                                className="hidden"
                                ref={fileInputRef}
                                disabled={subiendoFirmado}
                                onChange={e => {
                                  if (e.target.files[0]) {
                                    subirFirmado(asig.entrega_id, e.target.files[0]);
                                  }
                                }}
                              />
                            </label>
                          </div>
                          <button
                            onClick={() => setPanelAbierto(null)}
                            className="mt-2 text-xs text-gray-400 hover:text-gray-600"
                          >
                            Cerrar
                          </button>
                        </div>
                      )}
                    </td>
                  );
                })}

                <td className="px-3 py-3 text-center">
                  <button
                    onClick={() => descargarPdfTrabajador(t.id, t.nombre)}
                    className="text-xs bg-[#112548] hover:bg-[#1a3a6e] text-white px-2 py-1.5 rounded transition-colors"
                    title="Descargar PDF completo del trabajador"
                  >
                    Todo
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Leyenda */}
      <div className="mt-4 flex items-center gap-4 text-xs text-gray-600">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-green-400 inline-block" /> Vigente
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-orange-400 inline-block" /> Por vencer (&lt;30 días)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-red-400 inline-block" /> Vencido
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-gray-200 border border-gray-300 inline-block" /> Sin asignación
        </span>
      </div>
    </div>
  );
}
