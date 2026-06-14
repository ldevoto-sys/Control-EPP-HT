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
  const [cargandoAsig, setCargandoAsig] = useState(false);

  const [eppId, setEppId] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [motivo, setMotivo] = useState('');
  const [vuelta, setVuelta] = useState(false);
  const [observacion, setObservacion] = useState('');
  const [fecha, setFecha] = useState(() => new Date().toISOString().split('T')[0]);
  const [foto, setFoto] = useState(null);

  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState(null);

  useEffect(() => {
    api.get('/users/trabajadores').then(r => setTrabajadores(r.data)).catch(() => {});
  }, []);

  async function handleTrabajadorChange(id) {
    setTrabajadorId(id);
    setAsignaciones([]);
    setEppId('');
    if (!id) return;
    setCargandoAsig(true);
    try {
      const r = await api.get(`/asignaciones/trabajador/${id}`);
      const eppActual = Array.isArray(r.data) ? r.data : (r.data.asignaciones || []);
      setAsignaciones(eppActual);
    } catch {
      setAsignaciones([]);
    } finally {
      setCargandoAsig(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!trabajadorId || !eppId || !cantidad || !motivo) {
      setMensaje({ tipo: 'error', texto: 'Completa todos los campos obligatorios.' });
      return;
    }
    setEnviando(true);
    setMensaje(null);

    try {
      const fd = new FormData();
      fd.append('trabajador_id', trabajadorId);
      fd.append('epp_id', eppId);
      fd.append('cantidad', cantidad);
      fd.append('motivo', motivo);
      fd.append('vuelta_a_stock', vuelta ? '1' : '0');
      fd.append('observacion', observacion);
      fd.append('fecha_devolucion', fecha);
      if (foto) fd.append('foto', foto);

      await api.post('/devoluciones', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setMensaje({ tipo: 'ok', texto: 'Devolución registrada correctamente.' });
      setEppId('');
      setCantidad('');
      setMotivo('');
      setVuelta(false);
      setObservacion('');
      setFoto(null);
      setFecha(new Date().toISOString().split('T')[0]);
      handleTrabajadorChange(trabajadorId);
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err?.response?.data?.message || 'Error al registrar devolución.' });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-[#112548] mb-4">Registrar Devolución</h1>

      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded p-5 space-y-4">

        {/* Trabajador */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Trabajador *</label>
          <select
            value={trabajadorId}
            onChange={e => handleTrabajadorChange(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#34B3DE]"
            required
          >
            <option value="">Seleccionar trabajador...</option>
            {trabajadores.map(t => (
              <option key={t.id} value={t.id}>{t.nombre} — {t.rut}</option>
            ))}
          </select>
        </div>

        {/* EPP asignado */}
        {trabajadorId && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">EPP a devolver *</label>
            {cargandoAsig && <p className="text-gray-400 text-xs">Cargando EPP asignado...</p>}
            {!cargandoAsig && (
              <select
                value={eppId}
                onChange={e => setEppId(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#34B3DE]"
                required
              >
                <option value="">Seleccionar EPP...</option>
                {asignaciones.map((a, i) => (
                  <option key={a.epp_id || i} value={a.epp_id}>{a.epp_nombre}</option>
                ))}
              </select>
            )}
            {!cargandoAsig && asignaciones.length === 0 && (
              <p className="text-xs text-gray-400 mt-1">Sin EPP asignado actualmente.</p>
            )}
          </div>
        )}

        {/* Cantidad */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad *</label>
          <input
            type="number"
            min="1"
            value={cantidad}
            onChange={e => setCantidad(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#34B3DE]"
            required
          />
        </div>

        {/* Motivo */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Motivo *</label>
          <select
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#34B3DE]"
            required
          >
            <option value="">Seleccionar motivo...</option>
            {MOTIVOS.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        {/* Vuelta a stock */}
        <div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={vuelta}
              onChange={e => setVuelta(e.target.checked)}
              className="accent-[#34B3DE]"
            />
            Vuelve a stock (buen estado)
          </label>
        </div>

        {/* Observación */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Observación</label>
          <textarea
            value={observacion}
            onChange={e => setObservacion(e.target.value)}
            rows={2}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#34B3DE]"
          />
        </div>

        {/* Fecha */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Fecha devolución</label>
          <input
            type="date"
            value={fecha}
            onChange={e => setFecha(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#34B3DE]"
          />
        </div>

        {/* Foto opcional */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Foto (opcional)</label>
          <input
            type="file"
            accept="image/*"
            onChange={e => setFoto(e.target.files[0] || null)}
            className="text-sm"
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
          {enviando ? 'Registrando...' : 'Registrar devolución'}
        </button>
      </form>
    </div>
  );
}
