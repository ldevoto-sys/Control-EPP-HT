import { useEffect, useState } from 'react';
import api from '../../api';

function validarRut(rut) {
  const clean = rut.replace(/\./g, '').replace('-', '');
  if (clean.length < 2) return false;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1).toUpperCase();
  let sum = 0, factor = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const expected = 11 - (sum % 11);
  const dvCalc = expected === 11 ? '0' : expected === 10 ? 'K' : String(expected);
  return dv === dvCalc;
}

function formatRut(raw) {
  // Strip everything except digits and K
  const clean = raw.replace(/[^0-9kK]/g, '').toUpperCase();
  if (clean.length === 0) return '';
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  // Add dots every 3 digits from right
  const bodyFmt = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return bodyFmt + '-' + dv;
}

const ROLES = ['administrador', 'operador', 'autorizador', 'bodega', 'consulta'];

const rolBadgeClass = {
  administrador: 'bg-ht-navy text-white',
  operador: 'bg-ht-cyan text-white',
  autorizador: 'bg-green-600 text-white',
  bodega: 'bg-orange-500 text-white',
  consulta: 'bg-gray-400 text-white',
};

const emptyForm = {
  nombre: '',
  rut: '',
  email: '',
  rol: 'operador',
  activo: true,
};

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState({});
  const [successMsg, setSuccessMsg] = useState('');
  const [saving, setSaving] = useState(false);

  // Filtros y ordenamiento
  const [filtroTexto, setFiltroTexto] = useState('');
  const [filtroRol, setFiltroRol] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [sortCol, setSortCol] = useState('nombre');
  const [sortDir, setSortDir] = useState('asc');

  const cargarUsuarios = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/users');
      setUsuarios(Array.isArray(res.data) ? res.data : res.data.data ?? []);
    } catch {
      setError('Error al cargar usuarios.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargarUsuarios(); }, []);

  const abrirCrear = () => {
    setEditando(null);
    setForm(emptyForm);
    setFormErrors({});
    setSuccessMsg('');
    setModalAbierto(true);
  };

  const abrirEditar = (u) => {
    setEditando(u);
    setForm({
      nombre: u.nombre ?? '',
      rut: u.rut ?? '',
      email: u.email ?? '',
      rol: u.rol ?? 'operador',
      activo: u.activo ?? true,
    });
    setFormErrors({});
    setSuccessMsg('');
    setModalAbierto(true);
  };

  const cerrarModal = () => {
    setModalAbierto(false);
    setEditando(null);
    setSuccessMsg('');
  };

  const validarForm = () => {
    const errs = {};
    if (!form.nombre.trim()) errs.nombre = 'El nombre es requerido.';
    if (!form.rut.trim()) {
      errs.rut = 'El RUT es requerido.';
    } else if (!validarRut(form.rut)) {
      errs.rut = 'RUT inválido.';
    }
    if (!form.email.trim()) {
      errs.email = 'El email es requerido.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errs.email = 'Email inválido.';
    }
    if (!form.rol) errs.rol = 'El rol es requerido.';
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validarForm();
    if (Object.keys(errs).length) { setFormErrors(errs); return; }
    setSaving(true);
    setFormErrors({});
    try {
      if (editando) {
        await api.put(`/users/${editando.id}`, form);
        await cargarUsuarios();
        cerrarModal();
      } else {
        await api.post('/users', form);
        await cargarUsuarios();
        setSuccessMsg('Usuario creado. Se envió email con credenciales.');
        setForm(emptyForm);
      }
    } catch (err) {
      setFormErrors({ general: err.response?.data?.error ?? 'Error al guardar.' });
    } finally {
      setSaving(false);
    }
  };

  const toggleActivar = async (u) => {
    try {
      await api.delete(`/users/${u.id}`);
      await cargarUsuarios();
    } catch {
      setError('Error al cambiar estado del usuario.');
    }
  };

  const toggleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  const usuariosFiltrados = usuarios
    .filter(u => {
      const txt = filtroTexto.toLowerCase();
      if (txt && !u.nombre?.toLowerCase().includes(txt) && !u.rut?.toLowerCase().includes(txt) && !u.email?.toLowerCase().includes(txt)) return false;
      if (filtroRol && u.rol !== filtroRol) return false;
      if (filtroEstado === 'activo' && !u.activo) return false;
      if (filtroEstado === 'inactivo' && u.activo) return false;
      return true;
    })
    .sort((a, b) => {
      const va = (a[sortCol] ?? '').toString().toLowerCase();
      const vb = (b[sortCol] ?? '').toString().toLowerCase();
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    });

  const SortIcon = ({ col }) => {
    if (sortCol !== col) return <span className="text-gray-300 ml-1">↕</span>;
    return <span className="text-ht-cyan ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-ht-navy">Gestión de Usuarios</h1>
        <button
          onClick={abrirCrear}
          className="bg-ht-navy text-white px-4 py-2 rounded text-sm font-medium hover:bg-ht-navy/90 transition-colors"
        >
          + Nuevo Usuario
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          placeholder="Buscar nombre, RUT o email..."
          value={filtroTexto}
          onChange={e => setFiltroTexto(e.target.value)}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ht-cyan w-64"
        />
        <select
          value={filtroRol}
          onChange={e => setFiltroRol(e.target.value)}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ht-cyan"
        >
          <option value="">Todos los roles</option>
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select
          value={filtroEstado}
          onChange={e => setFiltroEstado(e.target.value)}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ht-cyan"
        >
          <option value="">Todos los estados</option>
          <option value="activo">Activo</option>
          <option value="inactivo">Inactivo</option>
        </select>
        {(filtroTexto || filtroRol || filtroEstado) && (
          <button
            onClick={() => { setFiltroTexto(''); setFiltroRol(''); setFiltroEstado(''); }}
            className="text-xs text-gray-500 hover:text-ht-navy underline"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-gray-400 text-sm">Cargando...</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left font-semibold text-gray-700 cursor-pointer select-none" onClick={() => toggleSort('nombre')}>
                  Nombre <SortIcon col="nombre" />
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 cursor-pointer select-none" onClick={() => toggleSort('rut')}>
                  RUT <SortIcon col="rut" />
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 cursor-pointer select-none" onClick={() => toggleSort('email')}>
                  Email <SortIcon col="email" />
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 cursor-pointer select-none" onClick={() => toggleSort('rol')}>
                  Rol <SortIcon col="rol" />
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Estado</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuariosFiltrados.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">Sin usuarios.</td>
                </tr>
              )}
              {usuariosFiltrados.map(u => (
                <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{u.nombre}</td>
                  <td className="px-4 py-3 text-gray-600">{u.rut}</td>
                  <td className="px-4 py-3 text-gray-600">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${rolBadgeClass[u.rol] ?? 'bg-gray-200 text-gray-700'}`}>
                      {u.rol}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {u.activo
                      ? <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">Activo</span>
                      : <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">Inactivo</span>
                    }
                  </td>
                  <td className="px-4 py-3 flex gap-2">
                    <button
                      onClick={() => abrirEditar(u)}
                      className="text-ht-cyan hover:underline text-xs font-medium"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => toggleActivar(u)}
                      className={`text-xs font-medium hover:underline ${u.activo ? 'text-red-500' : 'text-green-600'}`}
                    >
                      {u.activo ? 'Desactivar' : 'Activar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-ht-navy">
                {editando ? 'Editar Usuario' : 'Nuevo Usuario'}
              </h2>
              <button onClick={cerrarModal} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>

            {successMsg && (
              <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded text-sm">
                {successMsg}
              </div>
            )}

            {formErrors.general && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
                {formErrors.general}
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                  <input
                    type="text"
                    value={form.nombre}
                    onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                    className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ht-cyan ${formErrors.nombre ? 'border-red-400' : 'border-gray-300'}`}
                  />
                  {formErrors.nombre && <p className="text-xs text-red-500 mt-1">{formErrors.nombre}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">RUT (XX.XXX.XXX-X)</label>
                  <input
                    type="text"
                    value={form.rut}
                    onChange={e => setForm(f => ({ ...f, rut: formatRut(e.target.value) }))}
                    placeholder="12.345.678-9"
                    className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ht-cyan ${formErrors.rut ? 'border-red-400' : 'border-gray-300'}`}
                  />
                  {formErrors.rut && <p className="text-xs text-red-500 mt-1">{formErrors.rut}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ht-cyan ${formErrors.email ? 'border-red-400' : 'border-gray-300'}`}
                  />
                  {formErrors.email && <p className="text-xs text-red-500 mt-1">{formErrors.email}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
                  <select
                    value={form.rol}
                    onChange={e => setForm(f => ({ ...f, rol: e.target.value }))}
                    className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ht-cyan ${formErrors.rol ? 'border-red-400' : 'border-gray-300'}`}
                  >
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  {formErrors.rol && <p className="text-xs text-red-500 mt-1">{formErrors.rol}</p>}
                </div>

                {editando && (
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="activo"
                      checked={form.activo}
                      onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))}
                      className="w-4 h-4 accent-ht-cyan"
                    />
                    <label htmlFor="activo" className="text-sm font-medium text-gray-700">Activo</label>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6 justify-end">
                <button
                  type="button"
                  onClick={cerrarModal}
                  className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm bg-ht-navy text-white rounded hover:bg-ht-navy/90 disabled:opacity-50"
                >
                  {saving ? 'Guardando...' : editando ? 'Guardar cambios' : 'Crear usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
