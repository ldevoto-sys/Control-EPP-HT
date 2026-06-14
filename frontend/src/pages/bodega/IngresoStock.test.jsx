import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderPage } from '../../test/utils';
import IngresoStock from './IngresoStock';

vi.mock('../../api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
import api from '../../api';

describe('IngresoStock', () => {
  it('al seleccionar EPP carga el historial desde {epp, movimientos}', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/epp/activos') return Promise.resolve({ data: [{ id: 1, nombre: 'Casco' }] });
      if (url === '/stock/1/movimientos') return Promise.resolve({ data: {
        epp: { id: 1, nombre: 'Casco' },
        movimientos: [{ tipo: 'ingreso', cantidad: 5, stock_resultante: 5, fecha: '2026-01-01', referencia: 'F1', usuario_nombre: 'Admin' }],
      } });
      return Promise.resolve({ data: [] });
    });

    renderPage(<IngresoStock />);
    const select = await screen.findByRole('combobox');
    await userEvent.selectOptions(select, '1');
    expect(await screen.findByText('Admin')).toBeInTheDocument();
  });
});
