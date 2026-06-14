import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';

const checks = [
  { label: 'Mínimo 8 caracteres', test: p => p.length >= 8 },
  { label: 'Una letra mayúscula', test: p => /[A-Z]/.test(p) },
  { label: 'Una letra minúscula', test: p => /[a-z]/.test(p) },
  { label: 'Un carácter especial', test: p => /[^A-Za-z0-9]/.test(p) },
];

export default function CambiarPassword() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, user } = useAuth();
  const navigate = useNavigate();

  const valid = checks.every(c => c.test(next)) && next === confirm;

  const handleSubmit = async e => {
    e.preventDefault();
    if (!valid) return;
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/change-password', {
        currentPassword: current,
        newPassword: next,
      });
      const updatedUser = { ...user, must_change_password: 0 };
      login(updatedUser, localStorage.getItem('token'));
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Error al cambiar la contraseña');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-xl shadow-md w-full max-w-sm p-8">
        <h2 className="text-xl font-bold text-ht-navy mb-1">Cambiar contraseña</h2>
        <p className="text-sm text-gray-500 mb-6">Debes establecer una nueva contraseña para continuar.</p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña actual</label>
            <input type="password" required value={current} onChange={e => setCurrent(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ht-cyan" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nueva contraseña</label>
            <input type="password" required value={next} onChange={e => setNext(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ht-cyan" />
            <ul className="mt-2 space-y-1">
              {checks.map(c => (
                <li key={c.label} className={`text-xs flex items-center gap-1 ${c.test(next) ? 'text-green-600' : 'text-gray-400'}`}>
                  <span>{c.test(next) ? '✓' : '○'}</span> {c.label}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar nueva contraseña</label>
            <input type="password" required value={confirm} onChange={e => setConfirm(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ht-cyan" />
            {confirm && next !== confirm && (
              <p className="text-xs text-red-500 mt-1">Las contraseñas no coinciden</p>
            )}
          </div>
          <button type="submit" disabled={!valid || loading}
            className="w-full bg-ht-navy text-white py-2 rounded font-medium text-sm hover:bg-ht-navy/90 transition-colors disabled:opacity-50">
            {loading ? 'Guardando...' : 'Cambiar contraseña'}
          </button>
        </form>
      </div>
    </div>
  );
}
