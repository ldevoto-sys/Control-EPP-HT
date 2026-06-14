import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
    } catch {}
    setSent(true);
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-xl shadow-md w-full max-w-sm p-8">
        <h2 className="text-xl font-bold text-ht-navy mb-2">Recuperar contraseña</h2>

        {sent ? (
          <div className="text-sm text-gray-600">
            <p>Si el correo está registrado, recibirás un mensaje con instrucciones.</p>
            <Link to="/login" className="mt-4 block text-ht-cyan hover:underline text-sm">Volver al inicio</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ht-cyan"
                placeholder="usuario@hidrotecnica.cl" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-ht-navy text-white py-2 rounded font-medium text-sm hover:bg-ht-navy/90 transition-colors disabled:opacity-60">
              {loading ? 'Enviando...' : 'Enviar instrucciones'}
            </button>
            <div className="text-center">
              <Link to="/login" className="text-sm text-ht-cyan hover:underline">Volver al inicio</Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
