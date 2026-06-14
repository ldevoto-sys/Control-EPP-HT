import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Reportes from './Reportes';

vi.mock('../../api', () => ({ default: { get: vi.fn() } }));
import api from '../../api';

describe('Reportes', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renderiza stock crítico desde {total, items} sin crashear', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/reports/stock-critico') {
        return Promise.resolve({ data: { total: 1, items: [
          { id: 1, nombre: 'Casco', stock_actual: 0, stock_minimo: 2 },
        ] } });
      }
      if (url === '/reports/vencimientos') {
        return Promise.resolve({ data: { proximos_a_vencer: [], vencidos: [] } });
      }
      if (url === '/users/trabajadores') {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: [] });
    });

    render(<MemoryRouter><Reportes /></MemoryRouter>);
    // El nombre del EPP crítico aparece en la tabla
    expect(await screen.findByText('Casco')).toBeInTheDocument();
  });
});
