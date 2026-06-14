import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderPage } from '../test/utils';
import Dashboard from './Dashboard';

vi.mock('../api', () => ({ default: { get: vi.fn() } }));
import api from '../api';

describe('Dashboard', () => {
  it('muestra las tarjetas con conteos para administrador', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/reports/stock-critico') return Promise.resolve({ data: { total: 3, items: [] } });
      if (url === '/solicitudes/pendientes') return Promise.resolve({ data: [{ id: 1 }, { id: 2 }] });
      if (url === '/entregas/pendientes') return Promise.resolve({ data: [{ id: 1 }] });
      if (url === '/reports/vencimientos') return Promise.resolve({ data: { proximos_a_vencer: [{ id: 1 }], vencidos: [] } });
      return Promise.resolve({ data: [] });
    });

    renderPage(<Dashboard />, { user: { id: 1, rol: 'administrador', nombre: 'Admin' } });
    expect(await screen.findByText('Stock Crítico')).toBeInTheDocument();
    expect(await screen.findByText('3')).toBeInTheDocument();
  });
});
