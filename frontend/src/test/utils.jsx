import { render } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../contexts/AuthContext';

// Renderiza una página dentro de Router + AuthProvider.
// - user: si se entrega, se inyecta en localStorage antes de montar (AuthProvider lo lee)
// - path/route: para páginas que usan useParams (ej. "/solicitudes/:id")
export function renderPage(ui, { route = '/', path, user, token = 'test-token' } = {}) {
  if (user) {
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('token', token);
  }
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[route]}>
        {path ? <Routes><Route path={path} element={ui} /></Routes> : ui}
      </MemoryRouter>
    </AuthProvider>
  );
}
