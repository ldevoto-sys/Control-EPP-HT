import { useEffect, useState, useRef } from 'react';
import api from '../../api';

const CATEGORIAS = ['Cabeza', 'Visual', 'Auditivo', 'Manos', 'Pies', 'Cuerpo', 'Altura', 'Respiratoria', 'Otro'];
const UNIDADES = ['unidad', 'par', 'set'];

const emptyEppForm = {
  nombre: '',
  categoria: 'Otro',
  descripcion: '',
  unidad: 'unidad',
  vida_util_meses: '',
  stock_minimo: '',
  activo: true,
};

const emptyStockForm = {
  cantidad: '',
  referencia: '',
  observacion: '',
};

export default function CatalogoEpp() {
  const [epps, setEpps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal EPP
  const [modalEpp, setModalEpp] = useState(false);
  const [editandoEpp, setEditandoEpp] = useState(null);
  const [eppForm, setEppForm] = useState(emptyEppForm);
  const [eppErrors, setEppErrors] = useState({});
  const [savingEpp, setSavingEpp] = useState(false);

  // Modal stock
  const [modalStock, setModalStock] = useState(false);
  const [eppStock, setEppStock] = useState(null);
  const [stockForm, setStockForm] = useState(emptyStockForm);
  const [stockErrors, setStockErrors] = useState({});
  const [savingStock, setSavingStock] = useState(false);

  // Subida de archivos
  const fotoRef = useRef(null);
  const certRef = useRef(null);
  const [uploadingFoto, setUploadingFoto] = useState(null);
  const [uploadingCert, setUploadingCert] = useState(null);
  const [uploadMsg, setUploadMsg] = useState('');

  const cargar = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/epp');
      setEpps(Array.isArray(res.data) ? res.data : res.data.data ?? []);
    } catch {
      setError('Error al cargar catálogo.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  // --- Modal EPP ---
  const abrirCrearEpp = () => {
    setEditandoEpp(null);
    setEppForm(emptyEppForm);
    setEppErrors({});
    setModalEpp(true);
  };

  const abrirEditarEpp = (e) => {
    setEditandoEpp(e);
    setEppForm({
      nombre: e.nombre ?? '',
      categoria: e.categoria ?? 'Otro',
      descripcion: e.descripcion ?? '',
      unidad: e.unidad ?? 'unidad',
      vida_util_meses: e.vida_util_meses ?? '',
      stock_minimo: e.stock_minimo ?? '',
      activo: e.activo ?? true,
    });
    setEppErrors({});
    setModalEpp(true);
  };

  const validarEppForm = () => {
    const errs = {};
    if (!eppForm.nombre.trim()) errs.nombre = 'El nombre es requerido.';
    if (!eppForm.categoria) errs.categoria = 'La categoría es requerida.';
    if (eppForm.stock_minimo === '' || isNaN(Number(eppForm.stock_minimo))) errs.stock_minimo = 'Stock mínimo inválido.';
    return errs;
  };

  const handleSubmitEpp = async (e) => {
    e.preventDefault();
    const errs = validarEppForm();
    if (Object.keys(errs).length) { setEppErrors(errs); return; }
    setSavingEpp(true);
    setEppErrors({});
    try {
      const payload = {
        ...eppForm,
        vida_util_meses: eppForm.vida_util_meses === '' ? null : Number(eppForm.vida_util_meses),
        stock_minimo: Number(eppForm.stock_minimo),
      };
      if (editandoEpp) {
        await api.put(`/epp/${editandoEpp.id}`, payload);
      } else {
        await api.post('/epp', payload);
      }
      await cargar();
      setModalEpp(false);
    } catch (err) {
      setEppErrors({ general: err.response?.data?.error ?? 'Error al guardar.' });
    } finally {
      setSavingEpp(false);
    }
  };

  // --- Modal stock ---
  const abrirStock = (epp) => {
    setEppStock(epp);
    setStockForm(emptyStockForm);
    setStockErrors({});
    setModalStock(true);
  };

  const handleSubmitStock = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!stockForm.cantidad || Number(stockForm.cantidad) <= 0) errs.cantidad = 'Cantidad debe ser mayor a 0.';
    if (!stockForm.referencia.trim()) errs.referencia = 'La referencia es requerida.';
    if (Object.keys(errs).length) { setStockErrors(errs); return; }
    setSavingStock(true);
    setStockErrors({});
    try {
      await api.post(`/epp/${eppStock.id}/ingreso-stock`, {
        cantidad: Number(stockForm.cantidad),
        referencia: stockForm.referencia,
        observacion: stockForm.observacion,
      });
      await cargar();
      setModalStock(false);
    } catch (err) {
      setStockErrors({ general: err.response?.data?.error ?? 'Error al registrar ingreso.' });
    } finally {
      setSavingStock(false);
    }
  };

  // --- Eliminar EPP ---
  const eliminarEpp = async (epp) => {
    if (!window.confirm(`¿Eliminar "${epp.nombre}"? Esta acción no se puede deshacer.`)) return;
    setError('');
    try {
      await api.delete(`/epp/${epp.id}`);
      await cargar();
    } catch (err) {
      setError(err.response?.data?.error ?? 'Error al eliminar EPP.');
    }
  };

  // --- Subida foto ---
  const subirFoto = async (epp) => {
    const file = fotoRef.current?.files?.[0];
    if (!file) return;
    setUploadingFoto(epp.id);
    setUploadMsg('');
    try {
      const fd = new FormData();
      fd.append('foto', file);
      await api.post(`/epp/${epp.id}/foto`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      await cargar();
      setUploadMsg('Foto subida correctamente.');
    } catch {
      setUploadMsg('Error al subir foto.');
    } finally {
      setUploadingFoto(null);
      if (fotoRef.current) fotoRef.current.value = '';
    }
  };

  // --- Subida certificado ---
  const subirCertificado = async (epp) => {
    const file = certRef.current?.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') { setUploadMsg('Solo se aceptan archivos PDF.'); return; }
    setUploadingCert(epp.id);
    setUploadMsg('');
    try {
      const fd = new FormData();
      fd.append('certificado', file);
      await api.post(`/epp/${epp.id}/certificado`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      await cargar();
      setUploadMsg('Certificado subido correctamente.');
    } catch {
      setUploadMsg('Error al subir certificado.');
    } finally {
      setUploadingCert(null);
      if (certRef.current) certRef.current.value = '';
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-ht-navy">Catálogo EPP</h1>
        <button
          onClick={abrirCrearEpp}
          className="bg-ht-navy text-white px-4 py-2 rounded text-sm font-medium hover:bg-ht-navy/90 transition-colors"
        >
          + Nuevo EPP
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">{error}</div>
      )}
      {uploadMsg && (
        <div className="mb-4 bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded text-sm">{uploadMsg}</div>
      )}

      {loading ? (
        <div className="text-gray-400 text-sm">Cargando...</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Nombre</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Categoría</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Unidad</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Stock actual</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Stock mín.</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Vida útil</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Estado</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {epps.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">Sin EPP registrados.</td>
                </tr>
              )}
              {epps.map(epp => {
                const stockCritico = epp.stock_actual <= epp.stock_minimo;
                return (
                  <tr key={epp.id} className={`border-b border-gray-100 hover:bg-gray-50 ${!epp.activo ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3 font-medium text-gray-900">{epp.nombre}</td>
                    <td className="px-4 py-3 text-gray-600">{epp.categoria}</td>
                    <td className="px-4 py-3 text-gray-600">{epp.unidad}</td>
                    <td className="px-4 py-3">
                      <span className={stockCritico ? 'text-red-600 font-semibold' : 'text-gray-700'}>
                        {epp.stock_actual ?? 0}
                        {stockCritico && (
                          <span className="ml-2 inline-block px-1.5 py-0.5 bg-red-100 text-red-700 text-xs rounded">Stock crítico</span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{epp.stock_minimo}</td>
                    <td className="px-4 py-3 text-gray-600">{epp.vida_util_meses ? `${epp.vida_util_meses} meses` : '—'}</td>
                    <td className="px-4 py-3">
                      {epp.activo
                        ? <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">Activo</span>
                        : <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-gray-200 text-gray-600">Inactivo</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2 items-center">
                        <button
                          onClick={() => abrirEditarEpp(epp)}
                          className="text-ht-cyan hover:underline text-xs font-medium"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => abrirStock(epp)}
                          className="text-green-600 hover:underline text-xs font-medium"
                        >
                          Ingreso Stock
                        </button>
                        {epp.certificado_url ? (
                          <a
                            href={`/uploads/${epp.certificado_url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-ht-navy hover:underline text-xs font-medium"
                          >
                            Ver Certificado
                          </a>
                        ) : null}
                        <label className="text-xs text-orange-600 hover:underline font-medium cursor-pointer">
                          Subir Foto
                          <input
                            ref={fotoRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={() => subirFoto(epp)}
                          />
                        </label>
                        <label className="text-xs text-purple-600 hover:underline font-medium cursor-pointer">
                          {epp.certificado_url ? 'Reemplazar Cert.' : 'Subir Certificado'}
                          <input
                            ref={certRef}
                            type="file"
                            accept="application/pdf"
                            className="hidden"
                            onChange={() => subirCertificado(epp)}
                          />
                        </label>
                        {(uploadingFoto === epp.id || uploadingCert === epp.id) && (
                          <span className="text-xs text-gray-400">Subiendo...</span>
                        )}
                        <button
                          onClick={() => eliminarEpp(epp)}
                          className="text-xs text-red-500 hover:underline font-medium"
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal EPP */}
      {modalEpp && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-ht-navy">{editandoEpp ? 'Editar EPP' : 'Nuevo EPP'}</h2>
              <button onClick={() => setModalEpp(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>

            {eppErrors.general && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">{eppErrors.general}</div>
            )}

            <form onSubmit={handleSubmitEpp} noValidate>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                  <input
                    type="text"
                    value={eppForm.nombre}
                    onChange={e => setEppForm(f => ({ ...f, nombre: e.target.value }))}
                    className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ht-cyan ${eppErrors.nombre ? 'border-red-400' : 'border-gray-300'}`}
                  />
                  {eppErrors.nombre && <p className="text-xs text-red-500 mt-1">{eppErrors.nombre}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                  <select
                    value={eppForm.categoria}
                    onChange={e => setEppForm(f => ({ ...f, categoria: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ht-cyan"
                  >
                    {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                  <textarea
                    value={eppForm.descripcion}
                    onChange={e => setEppForm(f => ({ ...f, descripcion: e.target.value }))}
                    rows={3}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ht-cyan resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Unidad</label>
                    <select
                      value={eppForm.unidad}
                      onChange={e => setEppForm(f => ({ ...f, unidad: e.target.value }))}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ht-cyan"
                    >
                      {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Vida útil (meses)</label>
                    <input
                      type="number"
                      min="1"
                      value={eppForm.vida_util_meses}
                      onChange={e => setEppForm(f => ({ ...f, vida_util_meses: e.target.value }))}
                      placeholder="Opcional"
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ht-cyan"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stock mínimo</label>
                  <input
                    type="number"
                    min="0"
                    value={eppForm.stock_minimo}
                    onChange={e => setEppForm(f => ({ ...f, stock_minimo: e.target.value }))}
                    className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ht-cyan ${eppErrors.stock_minimo ? 'border-red-400' : 'border-gray-300'}`}
                  />
                  {eppErrors.stock_minimo && <p className="text-xs text-red-500 mt-1">{eppErrors.stock_minimo}</p>}
                </div>

                {editandoEpp && (
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="epp-activo"
                      checked={eppForm.activo}
                      onChange={e => setEppForm(f => ({ ...f, activo: e.target.checked }))}
                      className="w-4 h-4 accent-ht-cyan"
                    />
                    <label htmlFor="epp-activo" className="text-sm font-medium text-gray-700">Activo</label>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6 justify-end">
                <button type="button" onClick={() => setModalEpp(false)} className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50">
                  Cancelar
                </button>
                <button type="submit" disabled={savingEpp} className="px-4 py-2 text-sm bg-ht-navy text-white rounded hover:bg-ht-navy/90 disabled:opacity-50">
                  {savingEpp ? 'Guardando...' : editandoEpp ? 'Guardar cambios' : 'Crear EPP'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal ingreso stock */}
      {modalStock && eppStock && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-ht-navy">Ingreso de Stock — {eppStock.nombre}</h2>
              <button onClick={() => setModalStock(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>

            {stockErrors.general && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">{stockErrors.general}</div>
            )}

            <form onSubmit={handleSubmitStock} noValidate>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad</label>
                  <input
                    type="number"
                    min="1"
                    value={stockForm.cantidad}
                    onChange={e => setStockForm(f => ({ ...f, cantidad: e.target.value }))}
                    className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ht-cyan ${stockErrors.cantidad ? 'border-red-400' : 'border-gray-300'}`}
                  />
                  {stockErrors.cantidad && <p className="text-xs text-red-500 mt-1">{stockErrors.cantidad}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Referencia (ej: Factura 1234)</label>
                  <input
                    type="text"
                    value={stockForm.referencia}
                    onChange={e => setStockForm(f => ({ ...f, referencia: e.target.value }))}
                    placeholder="Factura 1234"
                    className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ht-cyan ${stockErrors.referencia ? 'border-red-400' : 'border-gray-300'}`}
                  />
                  {stockErrors.referencia && <p className="text-xs text-red-500 mt-1">{stockErrors.referencia}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Observación</label>
                  <textarea
                    value={stockForm.observacion}
                    onChange={e => setStockForm(f => ({ ...f, observacion: e.target.value }))}
                    rows={2}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ht-cyan resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6 justify-end">
                <button type="button" onClick={() => setModalStock(false)} className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50">
                  Cancelar
                </button>
                <button type="submit" disabled={savingStock} className="px-4 py-2 text-sm bg-ht-navy text-white rounded hover:bg-ht-navy/90 disabled:opacity-50">
                  {savingStock ? 'Registrando...' : 'Registrar ingreso'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
