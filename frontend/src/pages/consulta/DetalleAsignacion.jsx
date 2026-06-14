import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
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

async function descargarPdfEntrega(entregaId) {
  const res = await api.get(`/reports/entrega/${entregaId}/pdf`, { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
  window.open(url, '_blank');
}

export default function DetalleAsignacion({ trabajadorIdProp }) {
  const { id: idParam } = useParams();
  const trabajadorId = trabajadorIdProp || idParam;

  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [subiendoId, setSubiendoId] = useState(null);

  function cargar() {
    if (!trabajadorId) return;
    setCargando(true);
    api.get(`/asignaciones/trabajador/${trabajadorId}`)
      .then(r => setDatos(r.data))
      .catch(() => setError('Error al cargar datos del trabajador'))
      .finally(() => setCargando(false));
  }

  useEffect(() => { cargar(); }, [trabajadorId]);

  async function subirFirmado(entregaId, file) {
    const fd = new FormData();
    fd.append('pdf_firmado', file);
    setSubiendoId(entregaId);
    try {
      await api.post(`/entregas/${entregaId}/pdf-firmado`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      cargar();
    } catch {
      alert('Error al subir el documento');
    } finally {
      setSubiendoId(null);
    }
  }

  function badgeEstado(estado) {
    const base = 'px-2 py-0.5 rounded text-xs font-semibold';
    if (estado === 'vigente') return <span className={`${base} bg-green-100 text-green-700`}>Vigente</span>;
    if (estado === 'por_vencer') return <span className={`${base} bg-orange-100 text-orange-700`}>Por vencer</span>;
    if (estado === 'vencido') return <span className={`${base} bg-red-100 text-red-700`}>Vencido</span>;
    return <span className={`${base} bg-gray-100 text-gray-500`}>{estado ?? '—'}</span>;
  }

  if (!trabajadorId) return <div className="p-6 text-gray-500">No se especificó un trabajador.</div>;
  if (cargando) return <div className="p-6 text-gray-500">Cargando...</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (!datos) return null;

  const eppActual = datos.asignaciones || [];
  const historial = datos.historial_entregas || [];
  const trabajador = datos.trabajador || {};

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#112548]">{trabajador.nombre}</h1>
          <p className="text-gray-500 text-sm">RUT: {trabajador.rut} — {trabajador.rol}</p>
        </div>
        <button
          onClick={() => descargarPdf(trabajadorId, trabajador.nombre || 'trabajador')}
          className="bg-[#112548] text-white px-4 py-2 rounded hover:opacity-90 text-sm"
        >
          Descargar PDF completo
        </button>
      </div>

      {/* Sección 1: EPP actual */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-[#112548] mb-3">EPP asignado actualmente</h2>
        <div className="overflow-x-auto rounded border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-2 text-left">EPP</th>
                <th className="px-4 py-2 text-left">Categoría</th>
                <th className="px-4 py-2 text-left">Cantidad</th>
                <th className="px-4 py-2 text-left">Fecha asignación</th>
                <th className="px-4 py-2 text-left">Vence</th>
                <th className="px-4 py-2 text-left">Estado</th>
              </tr>
            </thead>
            <tbody>
              {eppActual.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-4 text-center text-gray-400">Sin EPP asignado</td></tr>
              )}
              {eppActual.map((e, i) => (
                <tr key={i} className="border-t">
                  <td className="px-4 py-2">{e.epp_nombre}</td>
                  <td className="px-4 py-2">{e.categoria}</td>
                  <td className="px-4 py-2">{e.cantidad}</td>
                  <td className="px-4 py-2">{e.fecha_asignacion}</td>
                  <td className="px-4 py-2">{e.fecha_vencimiento ?? '—'}</td>
                  <td className="px-4 py-2">{badgeEstado(e.estado_vencimiento)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Sección 2: Historial */}
      <section>
        <h2 className="text-lg font-semibold text-[#112548] mb-3">Historial de entregas</h2>
        {historial.length === 0 && <p className="text-gray-400 text-sm">Sin historial registrado.</p>}
        <div className="flex flex-col gap-4">
          {historial.map(entrega => (
            <div key={entrega.id} className="border border-gray-200 rounded p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-medium text-[#112548]">Entrega #{entrega.id} — {entrega.fecha_entrega}</p>
                  <p className="text-xs text-gray-500">Bodeguero: {entrega.bodeguero_nombre}</p>
                  {entrega.observacion && <p className="text-xs text-gray-500 mt-0.5">Obs: {entrega.observacion}</p>}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => descargarPdfEntrega(entrega.id)}
                    className="text-xs bg-[#112548] text-white px-2 py-1 rounded hover:opacity-90"
                  >
                    PDF de entrega
                  </button>
                  {entrega.pdf_firmado && (
                    <a
                      href={`/uploads/${entrega.pdf_firmado}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs border border-[#34B3DE] text-[#34B3DE] px-2 py-1 rounded hover:bg-[#34B3DE] hover:text-white transition"
                    >
                      Ver firmado
                    </a>
                  )}
                </div>
              </div>

              {/* EPP entregados en esta entrega */}
              {entrega.items && entrega.items.length > 0 && (
                <table className="text-xs w-full mt-2 border-t pt-2">
                  <thead>
                    <tr className="text-gray-500">
                      <th className="text-left py-1">EPP</th>
                      <th className="text-left py-1">Cantidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entrega.items.map((item, ii) => (
                      <tr key={ii}>
                        <td className="py-0.5">{item.epp_nombre}</td>
                        <td className="py-0.5">{item.cantidad}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Subir firmado */}
              {!entrega.pdf_firmado && (
                <div className="mt-3">
                  <p className="text-xs text-gray-500 mb-1">Subir documento firmado (PDF):</p>
                  <input
                    type="file"
                    accept="application/pdf"
                    disabled={subiendoId === entrega.id}
                    onChange={e => {
                      if (e.target.files[0]) subirFirmado(entrega.id, e.target.files[0]);
                    }}
                    className="text-xs"
                  />
                  {subiendoId === entrega.id && <p className="text-xs text-gray-400 mt-1">Subiendo...</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
