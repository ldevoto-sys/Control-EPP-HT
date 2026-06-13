import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../api';

function estadoBadge(estado) {
  const map = {
    vigente: 'bg-green-100 text-green-800',
    por_vencer: 'bg-orange-100 text-orange-800',
    vencido: 'bg-red-100 text-red-800',
  };
  const label = { vigente: 'Vigente', por_vencer: 'Por vencer', vencido: 'Vencido' };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${map[estado] || 'bg-gray-100 text-gray-600'}`}>
      {label[estado] || estado}
    </span>
  );
}

async function descargarPdf(trabajadorId, nombre) {
  const res = await api.get(`/reports/trabajador/${trabajadorId}/pdf`, { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `epp_${(nombre || 'trabajador').replace(/ /g, '_')}.pdf`;
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

export default function DetalleAsignacion({ trabajadorIdProp }) {
  const { id: idParam } = useParams();
  const trabajadorId = trabajadorIdProp || idParam;

  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [descargando, setDescargando] = useState(false);
  const [subiendo, setSubiendo] = useState(null); // entregaId en progreso

  function cargar() {
    if (!trabajadorId) return;
    setCargando(true);
    api.get(`/asignaciones/trabajador/${trabajadorId}`)
      .then(r => setDatos(r.data))
      .catch(() => setError('Error al cargar los datos del trabajador'))
      .finally(() => setCargando(false));
  }

  useEffect(() => {
    cargar();
  }, [trabajadorId]);

  async function subirFirmado(entregaId, file) {
    const fd = new FormData();
    fd.append('pdf_firmado', file);
    setSubiendo(entregaId);
    try {
      await api.post(`/entregas/${entregaId}/pdf-firmado`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      cargar();
    } catch {
      alert('Error al subir el documento firmado.');
    } finally {
      setSubiendo(null);
    }
  }

  async function handleDescargaPdf() {
    setDescargando(true);
    try {
      await descargarPdf(trabajadorId, datos?.trabajador?.nombre);
    } finally {
      setDescargando(false);
    }
  }

  if (!trabajadorId) {
    return <div className="p-6 text-gray-400 text-sm">No se especificó un trabajador.</div>;
  }

  if (cargando) {
    return <div className="p-6 text-gray-500 text-sm">Cargando...</div>;
  }

  if (error) {
    return <div className="p-6 text-red-600 text-sm">{error}</div>;
  }

  const trabajador = datos?.trabajador || {};
  const asignaciones = datos?.asignaciones || [];
  const entregas = datos?.entregas || [];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#112548]">{trabajador.nombre || `Trabajador #${trabajadorId}`}</h1>
          {trabajador.rut && <p className="text-gray-500 text-sm mt-0.5">RUT: {trabajador.rut}</p>}
          {trabajador.rol && <p className="text-gray-500 text-sm">Rol: {trabajador.rol}</p>}
        </div>
        <button
          onClick={handleDescargaPdf}
          disabled={descargando}
          className="bg-[#112548] hover:bg-[#1a3a6e] text-white text-sm px-4 py-2 rounded transition-colors disabled:opacity-60"
        >
          {descargando ? 'Generando...' : 'Descargar PDF completo'}
        </button>
      </div>

      {/* Sección 1: EPP asignado actualmente */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-[#112548] mb-3 border-b border-gray-200 pb-2">
          EPP asignado actualmente
        </h2>
        {asignaciones.length === 0 ? (
          <p className="text-gray-400 text-sm">Sin EPP asignado actualmente.</p>
        ) : (
          <div className="overflow-x-auto rounded border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">EPP</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Categoría</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Cantidad</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Fecha asignación</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Vencimiento</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Estado</th>
                </tr>
              </thead>
              <tbody>
                {asignaciones.map((a, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="px-4 py-2 font-medium">{a.epp_nombre || a.epp}</td>
                    <td className="px-4 py-2 text-gray-500">{a.categoria}</td>
                    <td className="px-4 py-2">{a.cantidad}</td>
                    <td className="px-4 py-2 text-gray-500">{a.fecha_asignacion}</td>
                    <td className="px-4 py-2 text-gray-500">{a.fecha_vencimiento || '—'}</td>
                    <td className="px-4 py-2">{estadoBadge(a.estado_vencimiento || a.estado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Sección 2: Historial de entregas */}
      <section>
        <h2 className="text-lg font-semibold text-[#112548] mb-3 border-b border-gray-200 pb-2">
          Historial de entregas
        </h2>
        {entregas.length === 0 ? (
          <p className="text-gray-400 text-sm">Sin entregas registradas.</p>
        ) : (
          <div className="space-y-4">
            {entregas.map((entrega, i) => (
              <div key={entrega.id || i} className="border border-gray-200 rounded p-4 bg-white">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium text-[#112548]">
                      Entrega {entrega.fecha_entrega || entrega.fecha}
                    </p>
                    {entrega.bodeguero && (
                      <p className="text-xs text-gray-500">Bodeguero: {entrega.bodeguero}</p>
                    )}
                    {entrega.observacion && (
                      <p className="text-xs text-gray-400 mt-1">Obs: {entrega.observacion}</p>
                    )}
                  </div>
                  <div className="flex gap-2 flex-wrap justify-end">
                    <button
                      onClick={() => descargarPdfEntrega(entrega.id)}
                      className="text-xs bg-[#34B3DE] hover:bg-[#1a9bc5] text-white px-2 py-1 rounded"
                    >
                      PDF de entrega
                    </button>
                    {entrega.pdf_firmado && (
                      <a
                        href={`/uploads/${entrega.pdf_firmado}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded"
                      >
                        Ver firmado
                      </a>
                    )}
                    {!entrega.pdf_firmado && (
                      <label className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded cursor-pointer">
                        {subiendo === entrega.id ? 'Subiendo...' : 'Subir firmado'}
                        <input
                          type="file"
                          accept="application/pdf"
                          className="hidden"
                          disabled={subiendo === entrega.id}
                          onChange={e => {
                            if (e.target.files[0]) subirFirmado(entrega.id, e.target.files[0]);
                          }}
                        />
                      </label>
                    )}
                  </div>
                </div>

                {entrega.items && entrega.items.length > 0 && (
                  <div className="mt-2 overflow-x-auto">
                    <table className="min-w-full text-xs border border-gray-100 rounded">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-1.5 text-left text-gray-500 font-medium">EPP</th>
                          <th className="px-3 py-1.5 text-left text-gray-500 font-medium">Cantidad</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entrega.items.map((item, j) => (
                          <tr key={j} className="border-t border-gray-100">
                            <td className="px-3 py-1.5">{item.epp_nombre || item.epp}</td>
                            <td className="px-3 py-1.5">{item.cantidad}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
